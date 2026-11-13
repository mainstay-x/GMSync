import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Json = Record<string, unknown>;

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ausente: ${name}`);
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function json(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Compara dois textos sem revelar, pelo tempo de resposta, onde diferem. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i % (right.length || 1)];
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A Meta envia horários em segundos desde 1970, como texto. */
export function metaTime(value: unknown): string | null {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

/** Chave de comparação de números: celulares do Brasil sem o nono dígito. */
export function matchKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return /^55\d{2}9\d{8}$/.test(digits) ? digits.slice(0, 4) + digits.slice(5) : digits;
}

export function graphUrl(path: string): string {
  const base = Deno.env.get("WHATSAPP_GRAPH_URL") || "https://graph.facebook.com";
  const version = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v26.0";
  return `${base}/${version}/${path}`;
}

export type SendResult = { ok: true; waMessageId: string } | { ok: false; code: unknown; message: unknown };

/** Envia um texto pelo número do GMSync e grava a mensagem enviada. */
export async function sendText(db: SupabaseClient, to: string, text: string): Promise<SendResult> {
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  };
  const response = await fetch(graphUrl(`${phoneNumberId}/messages`), {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as Json;
  const waMessageId = ((result.messages ?? []) as Json[])[0]?.id;
  if (!response.ok || typeof waMessageId !== "string") {
    const metaError = (result.error ?? {}) as Json;
    return { ok: false, code: metaError.code ?? null, message: metaError.message ?? null };
  }
  const saved = await db.from("gmsync_whatsapp_messages").insert({
    wa_message_id: waMessageId,
    direction: "out",
    wa_id: to,
    phone_number_id: phoneNumberId,
    type: "text",
    body: text,
    payload: body,
    status: "accepted",
    process_status: "skipped",
  });
  // A mensagem já saiu: uma falha ao gravar é registrada, mas não vira erro de envio.
  if (saved.error) console.error("sendText: gravação", saved.error.message);
  return { ok: true, waMessageId };
}
