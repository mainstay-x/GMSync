// Reprocessa uma mensagem já recebida (por exemplo, depois de corrigir um cadastro
// ou de um erro do Claude). Uso interno: só aceita a chave service_role.
import { env, json, type Json, safeEqual } from "../_shared/whatsapp.ts";
import { processMessage } from "../_shared/process.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Use POST." });
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(bearer, env("SUPABASE_SERVICE_ROLE_KEY"))) return json(403, { error: "Acesso negado." });

  let input: Json;
  try {
    input = await request.json();
  } catch (_error) {
    return json(400, { error: "Corpo inválido." });
  }
  if (typeof input.wa_message_id !== "string" || !input.wa_message_id) {
    return json(400, { error: "Informe wa_message_id." });
  }
  await processMessage(input.wa_message_id);
  return json(200, { ok: true });
});
