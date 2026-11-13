"use strict";

// Ligação com o Supabase do GMSync. Enquanto os dois valores estiverem vazios,
// o site roda em modo demonstração, com dados de exemplo guardados no navegador.
// A chave "anon" é pública por natureza; a service_role nunca entra aqui.
window.GMSYNC_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabaseAnonKey: "",
});
