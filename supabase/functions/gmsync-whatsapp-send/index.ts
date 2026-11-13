// Envio de mensagem de texto pelo número do GMSync.
// Uso interno: só aceita chamadas com a chave service_role (outras Edge Functions
// ou rotinas do servidor). O navegador não chama esta função enquanto o GMSync
// não tiver login de verdade e permissões por usuário.
import { adminClient, env, json, type Json, safeEqual, sendText } from "../_shared/whatsapp.ts";

const WINDOW_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return json(405, { error: "Use POST." });

    const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!safeEqual(bearer, env("SUPABASE_SERVICE_ROLE_KEY"))) return json(403, { error: "Acesso negado." });

    let input: Json;
    try {
      input = await request.json();
    } catch (_error) {
      return json(400, { error: "Corpo inválido." });
    }
    const to = typeof input.to === "string" ? input.to.replace(/\D/g, "") : "";
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!/^\d{8,15}$/.test(to)) return json(400, { error: "Número de destino inválido." });
    if (!text || text.length > 4096) return json(400, { error: "O texto precisa ter de 1 a 4096 caracteres." });

    // Texto livre só dentro de 24 horas da última mensagem recebida do contato.
    // Fora disso a Meta exige um modelo aprovado, que esta função ainda não envia.
    const db = adminClient();
    const contact = await db
      .from("gmsync_whatsapp_contacts")
      .select("last_inbound_at")
      .eq("wa_id", to)
      .maybeSingle();
    if (contact.error) throw new Error(contact.error.message);
    const lastInbound = contact.data?.last_inbound_at ? Date.parse(contact.data.last_inbound_at) : 0;
    if (!lastInbound || Date.now() - lastInbound > WINDOW_MS) {
      return json(409, { error: "Fora da janela de 24 horas: é preciso um modelo aprovado pela Meta." });
    }

    const sent = await sendText(db, to, text);
    if (!sent.ok) {
      return json(502, { error: "A Meta recusou o envio.", meta_code: sent.code, meta_message: sent.message });
    }
    return json(200, { ok: true, wa_message_id: sent.waMessageId });
  } catch (error) {
    console.error("gmsync-whatsapp-send", error instanceof Error ? error.message : error);
    return json(500, { error: "Erro interno." });
  }
});
