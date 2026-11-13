// Webhook do WhatsApp (Cloud API da Meta) do GMSync.
// GET  -> verificação do endereço, feita pela Meta ao cadastrar o webhook.
// POST -> mensagens recebidas e mudanças de status das enviadas.
// Publicar com verify_jwt = false (ver supabase/config.toml): quem chama é a Meta,
// e a autenticidade é conferida pela assinatura X-Hub-Signature-256.
import {
  adminClient,
  env,
  graphUrl,
  hmacSha256Hex,
  json,
  type Json,
  matchKey,
  metaTime,
  safeEqual,
} from "../_shared/whatsapp.ts";
import { processMessage } from "../_shared/process.ts";

const BUCKET = "gmsync-whatsapp";
const MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker"]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

const STATUS_RANK: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
const STATUS_COLUMN: Record<string, string> = {
  sent: "sent_at",
  delivered: "delivered_at",
  read: "read_at",
  failed: "failed_at",
};

function verify(url: URL): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode === "subscribe" && safeEqual(token, env("WHATSAPP_VERIFY_TOKEN"))) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

function messageBody(message: Json): string | null {
  const type = String(message.type ?? "");
  const part = (message[type] ?? {}) as Json;
  if (type === "text") return typeof part.body === "string" ? part.body : null;
  if (type === "button") return typeof part.text === "string" ? part.text : null;
  if (type === "interactive") {
    const reply = (part.button_reply ?? part.list_reply ?? {}) as Json;
    return typeof reply.title === "string" ? reply.title : null;
  }
  return typeof part.caption === "string" ? part.caption : null;
}

/** Baixa o arquivo da Meta e guarda no bucket privado. Nunca lança erro. */
async function storeMedia(waMessageId: string, waId: string, mediaId: string, when: string): Promise<void> {
  const db = adminClient();
  try {
    const auth = { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}` };
    const info = await fetch(graphUrl(mediaId), { headers: auth });
    const meta = (await info.json().catch(() => ({}))) as Json;
    if (!info.ok || typeof meta.url !== "string") throw new Error(`Meta não informou o arquivo (${info.status}).`);

    const file = await fetch(meta.url, { headers: auth });
    if (!file.ok) throw new Error(`Download recusado pela Meta (${file.status}).`);
    const mime = String(meta.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream")
      .split(";")[0].trim();
    const name = waMessageId.replace(/[^A-Za-z0-9]/g, "_");
    const path = `${waId}/${when.slice(0, 7)}/${name}.${EXTENSIONS[mime] ?? "bin"}`;

    const uploaded = await db.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: mime,
      upsert: true,
    });
    if (uploaded.error) throw new Error(uploaded.error.message);

    const saved = await db
      .from("gmsync_whatsapp_messages")
      .update({ media_path: path, media_mime: mime, media_error: null })
      .eq("wa_message_id", waMessageId);
    if (saved.error) throw new Error(saved.error.message);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error("gmsync-whatsapp-webhook: mídia", text);
    await db.from("gmsync_whatsapp_messages").update({ media_error: text.slice(0, 500) }).eq(
      "wa_message_id",
      waMessageId,
    );
  }
}

async function saveInbound(value: Json, phoneNumberId: string, background: Promise<void>[]): Promise<void> {
  const db = adminClient();
  const names = new Map<string, string>();
  for (const contact of (value.contacts ?? []) as Json[]) {
    const name = (contact.profile as Json | undefined)?.name;
    if (typeof contact.wa_id === "string" && typeof name === "string") names.set(contact.wa_id, name);
  }

  for (const message of (value.messages ?? []) as Json[]) {
    const waId = String(message.from ?? "");
    const waMessageId = String(message.id ?? "");
    if (!waId || !waMessageId) continue;

    // Só números cadastrados e ativos enviam dados ao sistema.
    const sender = await db
      .from("gmsync_whatsapp_senders")
      .select("id")
      .eq("match_key", matchKey(waId))
      .eq("active", true)
      .maybeSingle();
    if (sender.error) throw new Error(sender.error.message);
    if (!sender.data) {
      console.log(`gmsync-whatsapp-webhook: número não autorizado (final ${waId.slice(-4)}), mensagem descartada`);
      continue;
    }

    const when = metaTime(message.timestamp) ?? new Date().toISOString();
    const contact: Json = { wa_id: waId, last_inbound_at: when };
    if (names.has(waId)) contact.profile_name = names.get(waId);
    const savedContact = await db.from("gmsync_whatsapp_contacts").upsert(contact, { onConflict: "wa_id" });
    if (savedContact.error) throw new Error(savedContact.error.message);

    const type = String(message.type ?? "unknown");
    const mediaId = MEDIA_TYPES.has(type) ? (message[type] as Json | undefined)?.id : null;

    // A Meta reenvia o mesmo evento quando não recebe 200: repetidos são ignorados.
    const savedMessage = await db
      .from("gmsync_whatsapp_messages")
      .upsert(
        {
          wa_message_id: waMessageId,
          direction: "in",
          wa_id: waId,
          sender_id: sender.data.id,
          phone_number_id: phoneNumberId,
          type,
          body: messageBody(message),
          payload: message,
          status: "received",
          media_id: typeof mediaId === "string" ? mediaId : null,
          wa_timestamp: when,
        },
        { onConflict: "wa_message_id", ignoreDuplicates: true },
      )
      .select("id");
    if (savedMessage.error) throw new Error(savedMessage.error.message);

    const isNew = (savedMessage.data ?? []).length > 0;
    if (!isNew) continue;
    // Guarda o arquivo (se houver) e depois interpreta a mensagem.
    const stored = typeof mediaId === "string" ? storeMedia(waMessageId, waId, mediaId, when) : Promise.resolve();
    background.push(stored.then(() => processMessage(waMessageId)));
  }
}

async function saveStatuses(value: Json): Promise<void> {
  const db = adminClient();
  for (const item of (value.statuses ?? []) as Json[]) {
    const status = String(item.status ?? "");
    const waMessageId = String(item.id ?? "");
    const column = STATUS_COLUMN[status];
    if (!column || !waMessageId) continue;

    const current = await db
      .from("gmsync_whatsapp_messages")
      .select("status")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (!current.data) continue; // mensagem que não saiu do GMSync

    const change: Json = { [column]: metaTime(item.timestamp) ?? new Date().toISOString() };
    // Os status podem chegar fora de ordem: "lida" não volta para "entregue".
    if ((STATUS_RANK[status] ?? 0) > (STATUS_RANK[current.data.status] ?? 0)) change.status = status;
    if (status === "failed") {
      const error = ((item.errors ?? []) as Json[])[0] ?? {};
      change.error_code = Number.isInteger(error.code) ? error.code : null;
      change.error_title = typeof error.title === "string" ? error.title : null;
    }
    const updated = await db.from("gmsync_whatsapp_messages").update(change).eq("wa_message_id", waMessageId);
    if (updated.error) throw new Error(updated.error.message);
  }
}

async function receive(request: Request): Promise<Response> {
  const raw = await request.arrayBuffer();
  const expected = "sha256=" + (await hmacSha256Hex(env("WHATSAPP_APP_SECRET"), raw));
  if (!safeEqual(request.headers.get("x-hub-signature-256") ?? "", expected)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: Json;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch (_error) {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (payload.object !== "whatsapp_business_account") return json(200, { ignored: true });

  const ownNumber = env("WHATSAPP_PHONE_NUMBER_ID");
  const background: Promise<void>[] = [];
  for (const entry of (payload.entry ?? []) as Json[]) {
    for (const change of (entry.changes ?? []) as Json[]) {
      if (change.field !== "messages") continue;
      const value = (change.value ?? {}) as Json;
      const phoneNumberId = String((value.metadata as Json | undefined)?.phone_number_id ?? "");
      if (phoneNumberId !== ownNumber) continue; // outro número: não é do GMSync
      await saveInbound(value, phoneNumberId, background);
      await saveStatuses(value);
    }
  }

  // O download e a leitura por IA continuam depois da resposta, para a Meta não esperar.
  if (background.length) {
    const all = Promise.all(background).then(() => undefined);
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil(task: Promise<unknown>): void } }).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(all);
    else await all;
  }
  return json(200, { ok: true });
}

Deno.serve(async (request) => {
  try {
    if (request.method === "GET") return verify(new URL(request.url));
    if (request.method === "POST") return await receive(request);
    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    // 500 faz a Meta tentar de novo mais tarde, sem perder a mensagem.
    console.error("gmsync-whatsapp-webhook", error instanceof Error ? error.message : error);
    return new Response("Internal error", { status: 500 });
  }
});
