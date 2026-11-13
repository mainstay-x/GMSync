// Transcrição de áudio pela OpenAI. É o único uso da OpenAI no GMSync:
// o texto transcrito segue para a leitura pelo Claude, como qualquer mensagem.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // limite da OpenAI

export function transcriptionEnabled(): boolean {
  return Boolean(Deno.env.get("OPENAI_API_KEY"));
}

/**
 * Devolve o texto falado no áudio. `names` são nomes de obras e equipes,
 * passados como contexto para o modelo grafar corretamente o que ouvir.
 */
export async function transcribe(audio: Blob, fileName: string, names: string[]): Promise<string> {
  if (audio.size > MAX_AUDIO_BYTES) throw new Error("Áudio maior que 25 MB.");
  const base = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com";
  const form = new FormData();
  form.append("file", audio, fileName);
  form.append("model", Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || "gpt-transcribe");
  form.append(
    "prompt",
    `Áudio em português do Brasil, de uma equipe de obra, sobre compras, pagamentos de mão de obra e andamento. Nomes que podem aparecer: ${
      names.join(", ") || "nenhum cadastrado"
    }.`,
  );
  const response = await fetch(`${base}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: form,
  });
  const result = (await response.json().catch(() => ({}))) as { text?: unknown; error?: { message?: unknown } };
  if (!response.ok) {
    throw new Error(`Transcrição recusada pela OpenAI (${response.status}): ${result.error?.message ?? "sem detalhes"}`);
  }
  if (typeof result.text !== "string" || !result.text.trim()) throw new Error("A transcrição veio vazia.");
  return result.text.trim();
}
