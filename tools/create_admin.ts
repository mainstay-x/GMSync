// Cria um login de administrador no GMSync.
// Uso (a senha é pedida na hora e não fica gravada em lugar nenhum):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... deno run --allow-net --allow-env tools/create_admin.ts USUARIO
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOGIN_DOMAIN = "gmsync.mainstay-x.com.br";

const username = (Deno.args[0] ?? "").trim().toLowerCase();
if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error("Informe o usuário (3 a 40 caracteres: letras, números, ponto, traço).");
  Deno.exit(1);
}
const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(1);
}
const password = Deno.env.get("GMSYNC_ADMIN_PASSWORD") ?? prompt(`Senha para ${username}:`) ?? "";
if (password.length < 6) {
  console.error("A senha precisa ter pelo menos 6 caracteres.");
  Deno.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
// O Supabase identifica usuários por e-mail; o GMSync mostra só o nome de usuário.
const created = await db.auth.admin.createUser({
  email: `${username}@${LOGIN_DOMAIN}`,
  password,
  email_confirm: true,
});
if (created.error || !created.data.user) {
  console.error("Não foi possível criar o login:", created.error?.message);
  Deno.exit(1);
}
const profile = await db.from("gmsync_profiles").insert({
  user_id: created.data.user.id,
  username,
  display_name: username,
  role: "admin",
});
if (profile.error) {
  await db.auth.admin.deleteUser(created.data.user.id);
  console.error("Não foi possível gravar o perfil:", profile.error.message);
  Deno.exit(1);
}
console.log(`Administrador "${username}" criado.`);
