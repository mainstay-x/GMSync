"use strict";

// Camada de dados dos lançamentos e cadastros.
// Com config.js preenchido, lê e grava no Supabase; sem ele, usa dados de
// demonstração guardados no navegador. As telas usam sempre a mesma interface.
window.GMData = (function () {
  const config = window.GMSYNC_CONFIG || {};
  const remote = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const LOGIN_DOMAIN = "gmsync.mainstay-x.com.br";
  const DEMO_KEY = "gmsync-lancamentos-demo-v1";
  const BUCKET = "gmsync-whatsapp";

  const TABLES = {
    projects: "gmsync_projects",
    categories: "gmsync_categories",
    teams: "gmsync_teams",
    senders: "gmsync_whatsapp_senders",
    entries: "gmsync_entries",
    purchases: "gmsync_purchases",
    items: "gmsync_purchase_items",
    labor: "gmsync_labor",
  };
  const KEY = { purchases: "entry_id" }; // chave de cada tabela; o padrão é "id"
  const keyOf = (name) => KEY[name] || "id";

  let client = null;
  let cache = null;

  function empty() {
    return { projects: [], categories: [], teams: [], senders: [], entries: [], purchases: [], items: [], labor: [] };
  }
  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  }
  function fail(error) {
    if (error) throw new Error(error.message || String(error));
  }

  // ---------------------------------------------------------------- demonstração
  function placeholder(label, tone) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><rect width="600" height="450" fill="${tone}"/>` +
      `<path d="M0 340 150 230l110 80 120-130 220 160v110H0z" fill="#00000014"/>` +
      `<text x="300" y="215" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#00000066">${label}</text>` +
      `<text x="300" y="250" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#00000050">imagem de demonstração</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function seed() {
    const now = Date.now();
    const ago = (hours) => new Date(now - hours * 3600000).toISOString();
    const day = (hours) => ago(hours).slice(0, 10);
    const P = { vs1: uid(), vs2: uid(), casa: uid() };
    const C = { bruto: uid(), acab: uid(), gesso: uid(), eletrica: uid(), requinte: uid() };
    const T = { ze: uid(), gesso: uid(), eletrica: uid() };
    const S = { gerson: uid(), carlos: uid() };
    const E = Array.from({ length: 9 }, uid);
    const entry = (i, sender, project, kind, summary, hours, extra) => ({
      id: E[i], message_id: null, sender_id: sender, project_id: project, kind, summary,
      text_content: null, media_path: null, occurred_on: day(hours), needs_review: false, review_reasons: [],
      created_at: ago(hours), updated_at: ago(hours), ...extra,
    });
    return {
      projects: [
        { id: P.vs1, name: "Vale do Sol 1", aliases: ["VS1"], client: "Empresa Alpha", location: "Rio de Janeiro, RJ", active: true },
        { id: P.vs2, name: "Vale do Sol 2", aliases: ["VS2"], client: "Logística Brasil", location: "Duque de Caxias, RJ", active: true },
        { id: P.casa, name: "Casa Fabiola & Julio", aliases: ["casa"], client: "", location: "", active: true },
      ],
      categories: [
        { id: C.bruto, name: "Material bruto", position: 1, active: true, guidance: "Cimento, areia, brita, tijolo, bloco, ferro, vergalhão, madeira de obra, argamassa, cal, tubos e conexões de esgoto e água." },
        { id: C.acab, name: "Acabamentos", position: 2, active: true, guidance: "Pisos, revestimentos, rejunte, tintas, massa corrida, louças e metais comuns, portas, rodapés, esquadrias." },
        { id: C.gesso, name: "Gesso", position: 3, active: true, guidance: "Placas de gesso, drywall, perfis, sancas, molduras, massa e cola de gesso." },
        { id: C.eletrica, name: "Elétrica", position: 4, active: true, guidance: "Fios, cabos, eletrodutos, disjuntores, quadros, tomadas, interruptores e lâmpadas comuns." },
        { id: C.requinte, name: "Requinte", position: 5, active: true, guidance: "Itens de alto padrão que valorizam o imóvel: spots e trilhos de luz, fitas de LED decorativas, torneiras gourmet, fechadura eletrônica, cubas e metais de design, automação." },
      ],
      teams: [
        { id: T.ze, name: "Equipe do Zé", aliases: ["Zé", "pedreiros"], active: true },
        { id: T.gesso, name: "Gesseiros", aliases: ["gesso"], active: true },
        { id: T.eletrica, name: "Eletricistas", aliases: ["elétrica"], active: true },
      ],
      senders: [
        { id: S.gerson, name: "Gerson", phone: "5521999990001", active: true },
        { id: S.carlos, name: "Carlos", phone: "5521999990002", active: true },
      ],
      entries: [
        entry(0, S.carlos, null, "purchase", "Nota da Casa das Tintas e Elétrica", 2, {
          media_path: placeholder("Foto da nota", "#efe9dc"), text_content: "nota de hoje",
          needs_review: true, review_reasons: ["obra não identificada", "item sem categoria"],
        }),
        entry(1, S.carlos, P.vs1, "labor", "Diárias da semana", 5, {
          text_content: "Paguei quatro diárias pro Zé e duas pro Tonho do telhado, tudo na Vale do Sol 1.",
          media_path: "audio-demo", needs_review: true, review_reasons: ["equipe não cadastrada", "valor da mão de obra não informado"],
        }),
        entry(2, S.gerson, P.vs1, "purchase", "Nota do Depósito Central", 26, {
          media_path: placeholder("Foto da nota", "#e9ecef"), text_content: "material da laje VS1",
        }),
        entry(3, S.gerson, P.vs2, "purchase", "Nota da Gesso & Cia", 50, { media_path: placeholder("Foto da nota", "#ece6ee") }),
        entry(4, S.carlos, P.vs2, "labor", "Gesseiros, forro do 2º andar", 52, { text_content: "Três diárias dos gesseiros, 540 reais, Vale do Sol 2." , media_path: "audio-demo" }),
        entry(5, S.carlos, P.vs1, "photo", "Laje concretada", 27, { media_path: placeholder("Laje", "#dfe6e4"), text_content: "laje VS1 concretada" }),
        entry(6, S.carlos, P.vs1, "photo", "Alvenaria do térreo", 74, { media_path: placeholder("Alvenaria", "#e6e0d6") }),
        entry(7, S.gerson, P.vs2, "photo", "Forro de gesso em andamento", 51, { media_path: placeholder("Forro", "#e3e3ea") }),
        entry(8, S.gerson, P.vs1, "diary", "Chuva forte parou a concretagem às 15h", 30, {
          text_content: "Chuva forte parou a concretagem às 15h. Retomamos amanhã cedo.",
        }),
      ],
      purchases: [
        { entry_id: E[0], supplier: "Casa das Tintas e Elétrica", document_number: "CF 88213", purchase_date: day(2), total: 1262.4 },
        { entry_id: E[2], supplier: "Depósito Central", document_number: "NF 4471", purchase_date: day(26), total: 2390 },
        { entry_id: E[3], supplier: "Gesso & Cia", document_number: "NF 902", purchase_date: day(50), total: 1180 },
      ],
      items: [
        { id: uid(), entry_id: E[0], position: 1, description: "Tinta acrílica fosca 18 L", quantity: 2, unit: "lt", unit_price: 289.9, total: 579.8, category_id: C.acab },
        { id: uid(), entry_id: E[0], position: 2, description: "Spot de embutir LED 7 W", quantity: 12, unit: "un", unit_price: 34.9, total: 418.8, category_id: C.requinte },
        { id: uid(), entry_id: E[0], position: 3, description: "Cabo flexível 2,5 mm 100 m", quantity: 1, unit: "rl", unit_price: 189, total: 189, category_id: C.eletrica },
        { id: uid(), entry_id: E[0], position: 4, description: "Kit suporte SX-40", quantity: 2, unit: "un", unit_price: 37.4, total: 74.8, category_id: null },
        { id: uid(), entry_id: E[2], position: 1, description: "Cimento CP II 50 kg", quantity: 40, unit: "sc", unit_price: 36, total: 1440, category_id: C.bruto },
        { id: uid(), entry_id: E[2], position: 2, description: "Areia média", quantity: 5, unit: "m³", unit_price: 130, total: 650, category_id: C.bruto },
        { id: uid(), entry_id: E[2], position: 3, description: "Vergalhão CA-50 10 mm", quantity: 10, unit: "br", unit_price: 30, total: 300, category_id: C.bruto },
        { id: uid(), entry_id: E[3], position: 1, description: "Placa de gesso 60×60", quantity: 200, unit: "un", unit_price: 4.9, total: 980, category_id: C.gesso },
        { id: uid(), entry_id: E[3], position: 2, description: "Cola de gesso 5 kg", quantity: 8, unit: "sc", unit_price: 25, total: 200, category_id: C.gesso },
      ],
      labor: [
        { id: uid(), entry_id: E[1], team_id: T.ze, team_heard: null, description: "4 diárias", amount: 800, days: 4 },
        { id: uid(), entry_id: E[1], team_id: null, team_heard: "Tonho do telhado", description: "2 diárias", amount: null, days: 2 },
        { id: uid(), entry_id: E[4], team_id: T.gesso, team_heard: null, description: "Forro do 2º andar", amount: 540, days: 3 },
      ],
    };
  }

  function loadDemo() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (saved && saved.entries) return { ...empty(), ...saved };
    } catch (_error) { /* dados corrompidos: recomeça do exemplo */ }
    const fresh = seed();
    localStorage.setItem(DEMO_KEY, JSON.stringify(fresh));
    return fresh;
  }
  function persistDemo() {
    localStorage.setItem(DEMO_KEY, JSON.stringify(cache));
  }

  // ---------------------------------------------------------------- Supabase
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error("Não foi possível carregar a biblioteca do Supabase."));
      document.head.appendChild(tag);
    });
  }
  const ready = remote
    ? loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js").then(() => {
      client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    })
    : Promise.resolve();

  async function loadRemote() {
    const simple = ["projects", "categories", "teams", "senders"];
    const [lists, entries] = await Promise.all([
      Promise.all(simple.map((name) => client.from(TABLES[name]).select("*").order("name"))),
      client
        .from(TABLES.entries)
        .select("*, purchase:gmsync_purchases(*), items:gmsync_purchase_items(*), labor:gmsync_labor(*)")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const next = empty();
    lists.forEach((result, index) => {
      fail(result.error);
      next[simple[index]] = result.data;
    });
    fail(entries.error);
    for (const row of entries.data) {
      const { purchase, items, labor, ...entry } = row;
      next.entries.push(entry);
      const purchases = Array.isArray(purchase) ? purchase : purchase ? [purchase] : [];
      next.purchases.push(...purchases);
      next.items.push(...(items || []));
      next.labor.push(...(labor || []));
    }
    return next;
  }

  // ---------------------------------------------------------------- interface
  async function load() {
    await ready;
    cache = remote ? await loadRemote() : loadDemo();
    return cache;
  }

  /** Cria ou atualiza uma linha e devolve a linha gravada. */
  async function save(name, row) {
    const key = keyOf(name);
    let saved;
    if (remote) {
      const result = await client.from(TABLES[name]).upsert(row).select().single();
      fail(result.error);
      saved = result.data;
    } else {
      saved = { ...row };
      if (!saved[key]) saved[key] = uid();
      if (!saved.created_at) saved.created_at = new Date().toISOString();
    }
    const list = cache[name];
    const index = list.findIndex((item) => item[key] === saved[key]);
    if (index >= 0) list[index] = { ...list[index], ...saved };
    else list.unshift(saved);
    if (!remote) persistDemo();
    return saved;
  }

  /** Troca todas as linhas filhas de um lançamento (itens da nota ou mão de obra). */
  async function replaceChildren(name, entryId, rows) {
    const clean = rows.map((row) => ({ ...row, entry_id: entryId }));
    if (remote) {
      fail((await client.from(TABLES[name]).delete().eq("entry_id", entryId)).error);
      if (clean.length) {
        const result = await client.from(TABLES[name]).insert(clean.map(({ id: _id, ...row }) => row)).select();
        fail(result.error);
        cache[name] = cache[name].filter((row) => row.entry_id !== entryId).concat(result.data);
        return;
      }
      cache[name] = cache[name].filter((row) => row.entry_id !== entryId);
      return;
    }
    cache[name] = cache[name]
      .filter((row) => row.entry_id !== entryId)
      .concat(clean.map((row) => ({ ...row, id: row.id || uid() })));
    persistDemo();
  }

  async function remove(name, id) {
    const key = keyOf(name);
    if (remote) {
      fail((await client.from(TABLES[name]).delete().eq(key, id)).error);
    }
    cache[name] = cache[name].filter((row) => row[key] !== id);
    // O banco faz o mesmo por conta própria (on delete cascade / set null).
    if (name === "entries") {
      for (const child of ["purchases", "items", "labor"]) {
        cache[child] = cache[child].filter((row) => row.entry_id !== id);
      }
    }
    const reference = { projects: ["entries", "project_id"], categories: ["items", "category_id"], teams: ["labor", "team_id"], senders: ["entries", "sender_id"] }[name];
    if (reference) {
      cache[reference[0]].forEach((row) => {
        if (row[reference[1]] === id) row[reference[1]] = null;
      });
    }
    if (!remote) persistDemo();
  }

  /** Endereço para exibir uma foto ou tocar um áudio guardado. */
  async function mediaUrl(path) {
    if (!path || path === "audio-demo") return null;
    if (!remote) return path;
    const result = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
    return result.error ? null : result.data.signedUrl;
  }

  async function signIn(username, password) {
    await ready;
    const email = `${String(username).trim().toLowerCase()}@${LOGIN_DOMAIN}`;
    const result = await client.auth.signInWithPassword({ email, password });
    return !result.error;
  }
  async function signOut() {
    await ready;
    if (client) await client.auth.signOut();
  }
  async function hasSession() {
    await ready;
    if (!client) return false;
    const result = await client.auth.getSession();
    return Boolean(result.data.session);
  }
  function resetDemo() {
    localStorage.removeItem(DEMO_KEY);
    cache = null;
  }

  return {
    remote,
    get cache() { return cache; },
    load, save, replaceChildren, remove, mediaUrl, signIn, signOut, hasSession, resetDemo,
  };
})();
