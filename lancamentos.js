"use strict";

// Telas dos lançamentos que chegam pelo WhatsApp (caixa de entrada, compras,
// mão de obra, fotos) e dos cadastros. Usa os utilitários de app.js
// (setPage, openModal, closeModal, toast, money, render, renderNav).
window.GMUI = (function () {
  const D = window.GMData;

  const KINDS = {
    purchase: { label: "Nota de compra", icon: "▤" },
    labor: { label: "Mão de obra", icon: "⚒" },
    photo: { label: "Foto", icon: "▣" },
    diary: { label: "Diário", icon: "☷" },
    other: { label: "Outro", icon: "?" },
  };
  const TABS = [["inbox", "Caixa de entrada"], ["purchases", "Compras"], ["labor", "Mão de obra"], ["photos", "Fotos"]];

  const ui = {
    tab: "inbox", onlyReview: true, project: "", kind: "", q: "",
    settingsTab: "projects", loading: false, error: null,
  };
  let draft = null; // lançamento aberto no detalhe

  // ------------------------------------------------------------------ utilitários
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const brl = (value) => (value == null || value === "" ? "—" : money.format(Number(value)));
  const num = (value) => (value === "" || value == null || Number.isNaN(Number(value)) ? null : Number(value));
  const find = (list, id, key = "id") => D.cache[list].find((row) => row[key] === id) || null;
  const nameOf = (list, id) => find(list, id)?.name || null;
  const active = (list) => D.cache[list].filter((row) => row.active !== false);
  function when(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
      date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function dayLabel(value) {
    return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "—";
  }
  function entryAmount(entry) {
    if (entry.kind === "purchase") return find("purchases", entry.id, "entry_id")?.total ?? null;
    if (entry.kind === "labor") {
      const rows = D.cache.labor.filter((row) => row.entry_id === entry.id);
      return rows.some((row) => row.amount != null) ? rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) : null;
    }
    return null;
  }
  function mediaKind(path) {
    if (!path) return null;
    if (path === "audio-demo" || /\.(ogg|mp3|m4a|aac|amr)$/i.test(path)) return "audio";
    if (/\.pdf$/i.test(path)) return "pdf";
    return "image";
  }
  function options(list, selected, emptyLabel) {
    const rows = active(list).slice();
    const current = selected && !rows.some((row) => row.id === selected) ? find(list, selected) : null;
    if (current) rows.push(current); // cadastro inativo que ainda está em uso
    return `<option value="">${esc(emptyLabel)}</option>` +
      rows.map((row) => `<option value="${esc(row.id)}" ${row.id === selected ? "selected" : ""}>${esc(row.name)}</option>`).join("");
  }
  function pendingCount() {
    return D.cache ? D.cache.entries.filter((entry) => entry.needs_review).length : 0;
  }

  /** Garante os dados carregados; enquanto carrega, devolve a tela de espera. */
  function waiting() {
    if (D.cache) return null;
    if (ui.error) {
      return `<div class="panel"><div class="empty"><strong>Não foi possível carregar os dados.</strong><br>${esc(ui.error)}<br><br><button class="primary-btn" data-gm="retry">Tentar de novo</button></div></div>`;
    }
    if (!ui.loading) reload();
    return `<div class="panel"><div class="empty">Carregando…</div></div>`;
  }
  function reload() {
    ui.loading = true;
    ui.error = null;
    return D.load()
      .then(() => { ui.loading = false; })
      .catch((error) => { ui.loading = false; ui.error = error.message; })
      .then(() => { renderNav(); render(); });
  }
  async function guarded(task, okMessage) {
    try {
      await task();
      if (okMessage) toast(okMessage);
      return true;
    } catch (error) {
      toast("Não foi possível salvar: " + error.message);
      return false;
    }
  }
  function hydrateMedia() {
    document.querySelectorAll("[data-gm-media]").forEach(async (node) => {
      const url = await D.mediaUrl(node.dataset.gmMedia);
      node.removeAttribute("data-gm-media");
      if (!url) return node.closest("[data-gm-media-box]")?.classList.add("missing");
      if (node.tagName === "A") node.href = url; else node.src = url;
    });
  }

  // ------------------------------------------------------------------ Lançamentos
  function inbox() {
    setPage("Lançamentos", "RECEBIDOS PELO WHATSAPP");
    const wait = waiting();
    if (wait) return wait;
    const pending = pendingCount();
    const tabs = TABS.map(([id, label]) =>
      `<button class="tab ${ui.tab === id ? "active" : ""}" data-gm="tab" data-id="${id}">${label}${id === "inbox" && pending ? ` <span class="gm-count">${pending}</span>` : ""}</button>`).join("");
    const body = { inbox: inboxTab, purchases: purchasesTab, labor: laborTab, photos: photosTab }[ui.tab]();
    requestAnimationFrame(hydrateMedia);
    return `<div class="tabs">${tabs}</div>${body}`;
  }

  function projectFilter() {
    return `<select data-gm-filter="project" aria-label="Obra"><option value="">Todas as obras</option>` +
      D.cache.projects.map((p) => `<option value="${esc(p.id)}" ${ui.project === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("") +
      `<option value="none" ${ui.project === "none" ? "selected" : ""}>Sem obra</option></select>`;
  }
  const matchesProject = (entry) => !ui.project || (ui.project === "none" ? !entry.project_id : entry.project_id === ui.project);

  function entryCard(entry) {
    const kind = KINDS[entry.kind] || KINDS.other;
    const project = nameOf("projects", entry.project_id);
    const sender = nameOf("senders", entry.sender_id);
    const amount = entryAmount(entry);
    const chips = (entry.review_reasons || []).map((reason) => `<span class="gm-chip warn">${esc(reason)}</span>`).join("");
    return `<button class="gm-entry ${entry.needs_review ? "review" : ""}" data-gm="open" data-id="${esc(entry.id)}">
      <span class="gm-kind kind-${esc(entry.kind)}" aria-hidden="true">${kind.icon}</span>
      <span class="gm-entry-main">
        <strong>${esc(entry.summary)}</strong>
        <small>${kind.label}${sender ? " · enviado por " + esc(sender) : " · lançado à mão"} · ${when(entry.created_at)}</small>
        ${chips ? `<span class="gm-chips">${chips}</span>` : ""}
      </span>
      <span class="gm-entry-side">
        <span class="gm-chip ${project ? "" : "warn"}">${esc(project || "Sem obra")}</span>
        ${amount != null ? `<b>${brl(amount)}</b>` : ""}
      </span>
    </button>`;
  }

  function inboxTab() {
    const q = ui.q.trim().toLowerCase();
    const list = D.cache.entries.filter((entry) =>
      (!ui.onlyReview || entry.needs_review) && matchesProject(entry) && (!ui.kind || entry.kind === ui.kind) &&
      (!q || (entry.summary + " " + (entry.text_content || "")).toLowerCase().includes(q)));
    const pending = pendingCount();
    let emptyText = "Nenhum lançamento encontrado com esses filtros.";
    if (ui.onlyReview && !pending) emptyText = "Tudo conferido. Não há lançamentos esperando revisão.";
    return `<div class="gm-hint">
        <strong>Como funciona</strong>
        <span>A equipe envia foto da nota, áudio ou foto da obra pelo WhatsApp. O sistema lê, lança na obra e mostra aqui. O que ficou com dúvida aparece em <b>Para revisar</b>: abra, corrija o que estiver marcado e salve.</span>
      </div>
      <div class="filter-row gm-toolbar">
        <div class="gm-segment" role="group" aria-label="Mostrar">
          <button class="${ui.onlyReview ? "active" : ""}" data-gm="review" data-id="1">Para revisar${pending ? ` <span class="gm-count">${pending}</span>` : ""}</button>
          <button class="${ui.onlyReview ? "" : "active"}" data-gm="review" data-id="0">Todos</button>
        </div>
        ${projectFilter()}
        <select data-gm-filter="kind" aria-label="Tipo"><option value="">Todos os tipos</option>${Object.entries(KINDS).map(([id, k]) => `<option value="${id}" ${ui.kind === id ? "selected" : ""}>${k.label}</option>`).join("")}</select>
        <label class="search"><span>⌕</span><input data-gm-filter="q" type="search" placeholder="Buscar no resumo ou no texto" value="${esc(ui.q)}"></label>
        <button class="primary-btn" data-gm="new">+ Novo lançamento</button>
      </div>
      <div class="gm-list" id="gmList">${list.length ? list.map(entryCard).join("") : `<div class="panel"><div class="empty">${emptyText}</div></div>`}</div>`;
  }

  function purchasesTab() {
    const entries = D.cache.entries.filter((entry) => entry.kind === "purchase" && matchesProject(entry));
    const ids = new Set(entries.map((entry) => entry.id));
    const items = D.cache.items.filter((item) => ids.has(item.entry_id));
    const total = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const groups = D.cache.categories.slice().sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((category) => ({ name: category.name, id: category.id }))
      .concat([{ name: "Sem categoria", id: null }])
      .map((group) => ({ ...group, total: items.filter((item) => (item.category_id || null) === group.id).reduce((sum, item) => sum + (Number(item.total) || 0), 0) }))
      .filter((group) => group.total > 0 || group.id);
    const bars = groups.map((group) => `<div class="gm-bar ${group.id ? "" : "warn"}">
        <div class="gm-bar-top"><span>${esc(group.name)}</span><b>${brl(group.total)}</b></div>
        <div class="gm-bar-track"><span style="width:${total ? Math.round(group.total / total * 100) : 0}%"></span></div>
      </div>`).join("");
    const rows = items
      .map((item) => ({ item, entry: find("entries", item.entry_id), purchase: find("purchases", item.entry_id, "entry_id") }))
      .sort((a, b) => String(b.purchase?.purchase_date || b.entry.occurred_on || "").localeCompare(String(a.purchase?.purchase_date || a.entry.occurred_on || "")))
      .map(({ item, entry, purchase }) => `<tr class="gm-row" data-gm="open" data-id="${esc(entry.id)}" tabindex="0">
        <td>${dayLabel(purchase?.purchase_date || entry.occurred_on)}</td>
        <td>${esc(nameOf("projects", entry.project_id) || "Sem obra")}</td>
        <td>${esc(purchase?.supplier || "—")}</td>
        <td><strong>${esc(item.description)}</strong></td>
        <td>${item.quantity != null ? esc(item.quantity) + " " + esc(item.unit || "") : "—"}</td>
        <td>${item.category_id ? esc(nameOf("categories", item.category_id)) : `<span class="gm-chip warn">Sem categoria</span>`}</td>
        <td class="gm-money">${brl(item.total)}</td></tr>`).join("");
    return `<div class="filter-row gm-toolbar">${projectFilter()}<span class="gm-total">Total em compras: <b>${brl(total)}</b> em ${entries.length} nota(s)</span></div>
      <div class="panel gm-gap"><div class="panel-head"><div><h3>Por categoria</h3><p>Soma dos itens de todas as notas lançadas</p></div></div><div class="panel-body gm-bars">${bars || `<div class="empty">Nenhuma compra lançada ainda.</div>`}</div></div>
      <div class="panel table-wrap"><table class="gm-table"><thead><tr><th>Data</th><th>Obra</th><th>Fornecedor</th><th>Item</th><th>Qtd.</th><th>Categoria</th><th class="gm-money">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="empty">Nenhum item de compra para mostrar.</td></tr>`}</tbody></table></div>`;
  }

  function laborTab() {
    const entries = D.cache.entries.filter((entry) => entry.kind === "labor" && matchesProject(entry));
    const ids = new Set(entries.map((entry) => entry.id));
    const rows = D.cache.labor.filter((row) => ids.has(row.entry_id));
    const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const teams = D.cache.teams.map((team) => ({ id: team.id, name: team.name })).concat([{ id: null, name: "Equipe não cadastrada" }])
      .map((team) => {
        const mine = rows.filter((row) => (row.team_id || null) === team.id);
        return { ...team, count: mine.length, total: mine.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), days: mine.reduce((sum, row) => sum + (Number(row.days) || 0), 0) };
      })
      .filter((team) => team.count);
    const cards = teams.map((team) => `<div class="kpi-card ${team.id ? "" : "warn"}"><div class="kpi-top"><span>${esc(team.name)}</span><span class="kpi-icon">⚒</span></div><strong class="kpi-value">${brl(team.total)}</strong><div class="kpi-note">${team.days ? team.days + " diária(s) · " : ""}${team.count} lançamento(s)</div></div>`).join("");
    const table = rows
      .map((row) => ({ row, entry: find("entries", row.entry_id) }))
      .sort((a, b) => String(b.entry.occurred_on || "").localeCompare(String(a.entry.occurred_on || "")))
      .map(({ row, entry }) => `<tr class="gm-row" data-gm="open" data-id="${esc(entry.id)}" tabindex="0">
        <td>${dayLabel(entry.occurred_on)}</td>
        <td>${esc(nameOf("projects", entry.project_id) || "Sem obra")}</td>
        <td>${row.team_id ? esc(nameOf("teams", row.team_id)) : `<span class="gm-chip warn">${esc(row.team_heard || "Não cadastrada")}</span>`}</td>
        <td>${esc(row.description)}</td>
        <td>${row.days != null ? esc(row.days) : "—"}</td>
        <td class="gm-money">${row.amount != null ? brl(row.amount) : `<span class="gm-chip warn">Sem valor</span>`}</td></tr>`).join("");
    return `<div class="filter-row gm-toolbar">${projectFilter()}<span class="gm-total">Total em mão de obra: <b>${brl(total)}</b></span></div>
      ${cards ? `<div class="kpi-grid gm-team-grid">${cards}</div>` : ""}
      <div class="panel table-wrap"><table class="gm-table"><thead><tr><th>Data</th><th>Obra</th><th>Equipe</th><th>Descrição</th><th>Diárias</th><th class="gm-money">Valor</th></tr></thead>
      <tbody>${table || `<tr><td colspan="6" class="empty">Nenhuma mão de obra lançada ainda.</td></tr>`}</tbody></table></div>`;
  }

  function photosTab() {
    const photos = D.cache.entries.filter((entry) => entry.kind === "photo" && entry.media_path && matchesProject(entry));
    const groups = D.cache.projects.map((p) => ({ id: p.id, name: p.name })).concat([{ id: null, name: "Sem obra" }])
      .map((group) => ({ ...group, photos: photos.filter((entry) => (entry.project_id || null) === group.id) }))
      .filter((group) => group.photos.length);
    const html = groups.map((group) => `<div class="gm-gallery-group"><h3>${esc(group.name)} <small>${group.photos.length} foto(s)</small></h3><div class="gm-gallery">${
      group.photos.map((entry) => `<button class="gm-photo" data-gm="open" data-id="${esc(entry.id)}" data-gm-media-box>
        <img alt="${esc(entry.summary)}" loading="lazy" data-gm-media="${esc(entry.media_path)}">
        <span><strong>${esc(entry.summary)}</strong><small>${dayLabel(entry.occurred_on)}</small></span></button>`).join("")}</div></div>`).join("");
    return `<div class="filter-row gm-toolbar">${projectFilter()}<span class="gm-total">${photos.length} foto(s)</span></div>
      ${html || `<div class="panel"><div class="empty">Nenhuma foto recebida ainda. As fotos enviadas pelo WhatsApp aparecem aqui, separadas por obra.</div></div>`}`;
  }

  // ------------------------------------------------------------------ detalhe do lançamento
  function openEntry(id, kind) {
    const entry = id ? find("entries", id) : null;
    if (id && !entry) return;
    draft = {
      isNew: !entry,
      entry: entry ? { ...entry } : {
        kind: kind || "purchase", summary: "", project_id: ui.project && ui.project !== "none" ? ui.project : null,
        occurred_on: new Date().toISOString().slice(0, 10), needs_review: false, review_reasons: [],
        message_id: null, sender_id: null, media_path: null, text_content: null,
      },
      purchase: { supplier: "", document_number: "", purchase_date: null, total: null, ...(entry ? find("purchases", entry.id, "entry_id") : null) },
      items: entry ? D.cache.items.filter((item) => item.entry_id === entry.id).sort((a, b) => (a.position || 0) - (b.position || 0)).map((item) => ({ ...item })) : [],
      labor: entry ? D.cache.labor.filter((row) => row.entry_id === entry.id).map((row) => ({ ...row })) : [],
      error: null,
    };
    openModal(entry ? "Conferir lançamento" : "Novo lançamento", "");
    document.querySelector("#modal").classList.add("gm-modal-wide");
    renderDraft();
  }

  function sourcePanel() {
    const entry = draft.entry;
    const kind = mediaKind(entry.media_path);
    const sender = nameOf("senders", entry.sender_id);
    let media = "";
    if (kind === "image") {
      media = `<a class="gm-source-image" target="_blank" rel="noopener" data-gm-media="${esc(entry.media_path)}" data-gm-media-box title="Abrir em tamanho real"><img alt="Imagem recebida" data-gm-media="${esc(entry.media_path)}"></a><small class="gm-muted">Clique na imagem para ampliar.</small>`;
    } else if (kind === "audio") {
      media = entry.media_path === "audio-demo"
        ? `<div class="gm-audio-demo">▶ Áudio recebido <small>(sem arquivo no modo demonstração)</small></div>`
        : `<audio controls preload="none" data-gm-media="${esc(entry.media_path)}"></audio>`;
    } else if (kind === "pdf") {
      media = `<a class="secondary-btn" target="_blank" rel="noopener" data-gm-media="${esc(entry.media_path)}">Abrir o PDF recebido</a>`;
    }
    const text = entry.text_content
      ? `<div class="gm-bubble"><small>${kind === "audio" ? "Transcrição do áudio" : kind ? "Legenda" : "Mensagem"}</small>${esc(entry.text_content)}</div>` : "";
    if (!media && !text) return `<div class="gm-source"><div class="gm-source-empty">Lançado à mão, sem mensagem do WhatsApp.</div></div>`;
    return `<div class="gm-source"><div class="gm-source-head">Recebido${sender ? " de <b>" + esc(sender) + "</b>" : ""} · ${when(entry.created_at)}</div>${media}${text}</div>`;
  }

  function itemsSection() {
    const rows = draft.items.map((item, index) => `<tr>
        <td><input data-gm-item="${index}:description" value="${esc(item.description)}" placeholder="Descrição do item" aria-label="Descrição"></td>
        <td><input data-gm-item="${index}:quantity" type="number" step="any" value="${esc(item.quantity ?? "")}" aria-label="Quantidade"></td>
        <td><input data-gm-item="${index}:unit" value="${esc(item.unit ?? "")}" aria-label="Unidade"></td>
        <td><input data-gm-item="${index}:total" type="number" step="0.01" value="${esc(item.total ?? "")}" aria-label="Total do item"></td>
        <td><select data-gm-item="${index}:category_id" class="${item.category_id ? "" : "gm-missing"}" aria-label="Categoria">${options("categories", item.category_id, "Escolher categoria")}</select></td>
        <td><button type="button" class="icon-btn" data-gm="item-remove" data-id="${index}" aria-label="Remover item" title="Remover item">×</button></td>
      </tr>`).join("");
    return `<div class="gm-section"><h4>Dados da nota</h4>
      <div class="form-grid gm-grid-3">
        <div class="field"><label>Fornecedor</label><input data-gm-purchase="supplier" value="${esc(draft.purchase.supplier ?? "")}"></div>
        <div class="field"><label>Nº da nota ou cupom</label><input data-gm-purchase="document_number" value="${esc(draft.purchase.document_number ?? "")}"></div>
        <div class="field"><label>Total da nota (R$)</label><input data-gm-purchase="total" type="number" step="0.01" value="${esc(draft.purchase.total ?? "")}"></div>
      </div></div>
      <div class="gm-section"><h4>Itens da nota</h4>
      <div class="table-wrap"><table class="gm-table gm-edit-table gm-items"><thead><tr><th>Item</th><th>Qtd.</th><th>Un.</th><th>Total (R$)</th><th>Categoria</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="gm-muted">Nenhum item. Adicione os itens da nota.</td></tr>`}</tbody></table></div>
      <div class="gm-section-foot"><button type="button" class="secondary-btn" data-gm="item-add">+ Adicionar item</button><span id="gmSum"></span></div></div>`;
  }

  function laborSection() {
    const rows = draft.labor.map((row, index) => `<tr>
        <td><select data-gm-labor="${index}:team_id" class="${row.team_id ? "" : "gm-missing"}" aria-label="Equipe">${options("teams", row.team_id, row.team_heard ? `Ouvido: "${row.team_heard}" — escolher` : "Escolher equipe")}</select></td>
        <td><input data-gm-labor="${index}:description" value="${esc(row.description ?? "")}" placeholder="Serviço" aria-label="Descrição"></td>
        <td><input data-gm-labor="${index}:days" type="number" step="0.5" value="${esc(row.days ?? "")}" aria-label="Diárias"></td>
        <td><input data-gm-labor="${index}:amount" type="number" step="0.01" class="${row.amount == null ? "gm-missing" : ""}" value="${esc(row.amount ?? "")}" aria-label="Valor"></td>
        <td><button type="button" class="icon-btn" data-gm="labor-remove" data-id="${index}" aria-label="Remover linha" title="Remover linha">×</button></td>
      </tr>`).join("");
    return `<div class="gm-section"><h4>Mão de obra por equipe</h4>
      <div class="table-wrap"><table class="gm-table gm-edit-table gm-labor"><thead><tr><th>Equipe</th><th>Serviço</th><th>Diárias</th><th>Valor (R$)</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="gm-muted">Nenhuma equipe. Adicione uma linha por equipe.</td></tr>`}</tbody></table></div>
      <div class="gm-section-foot"><button type="button" class="secondary-btn" data-gm="labor-add">+ Adicionar equipe</button>
      <span class="gm-muted">Equipe nova? Cadastre em Configurações › Equipes.</span></div></div>`;
  }

  function renderDraft() {
    const entry = draft.entry;
    const reasons = (entry.review_reasons || []).map((reason) => `<span class="gm-chip warn">${esc(reason)}</span>`).join("");
    const kinds = Object.entries(KINDS).map(([id, k]) => `<option value="${id}" ${entry.kind === id ? "selected" : ""}>${k.label}</option>`).join("");
    document.querySelector("#modalBody").innerHTML = `<div class="gm-detail">
      ${sourcePanel()}
      <form class="gm-form" id="gmEntryForm" novalidate>
        ${entry.needs_review ? `<div class="gm-review-banner"><strong>Precisa de conferência</strong><span class="gm-chips">${reasons}</span></div>` : ""}
        <div class="form-grid gm-grid-3">
          <div class="field"><label>Tipo</label><select data-gm-entry="kind">${kinds}</select></div>
          <div class="field"><label>Obra</label><select data-gm-entry="project_id" class="${entry.project_id ? "" : "gm-missing"}">${options("projects", entry.project_id, "Escolher obra")}</select></div>
          <div class="field"><label>Data</label><input data-gm-entry="occurred_on" type="date" value="${esc(entry.occurred_on ?? "")}"></div>
          <div class="field full"><label>Resumo</label><input data-gm-entry="summary" value="${esc(entry.summary)}" placeholder="Uma frase dizendo o que é"></div>
        </div>
        ${entry.kind === "purchase" ? itemsSection() : ""}
        ${entry.kind === "labor" ? laborSection() : ""}
        <div class="login-error" id="gmDraftError" role="alert" ${draft.error ? "" : "hidden"}>${esc(draft.error || "")}</div>
        <div class="gm-actions">
          ${draft.isNew ? "" : `<button type="button" class="ghost-btn danger-btn" data-gm="entry-delete">Excluir</button>`}
          <span class="gm-spacer"></span>
          ${entry.needs_review ? `<button type="button" class="secondary-btn" data-gm="entry-save" data-id="keep">Salvar e revisar depois</button>` : ""}
          <button type="button" class="primary-btn" data-gm="entry-save" data-id="confirm">${entry.needs_review ? "Está certo — salvar" : "Salvar"}</button>
        </div>
      </form></div>`;
    updateSum();
    hydrateMedia();
  }

  function updateSum() {
    const box = document.querySelector("#gmSum");
    if (!box) return;
    const sum = draft.items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    const total = num(draft.purchase.total);
    const diff = total == null ? null : Math.round((sum - total) * 100) / 100;
    box.className = diff ? "gm-sum warn" : "gm-sum ok";
    box.textContent = total == null
      ? `Soma dos itens: ${brl(sum)}`
      : diff ? `Soma dos itens: ${brl(sum)} — difere do total em ${brl(Math.abs(diff))}` : `Soma dos itens: ${brl(sum)} — confere com o total`;
  }

  function draftProblems() {
    const problems = [];
    const entry = draft.entry;
    if (!entry.project_id) problems.push("escolha a obra");
    if (entry.kind === "purchase") {
      if (!draft.items.length) problems.push("adicione pelo menos um item");
      if (draft.items.some((item) => !String(item.description || "").trim())) problems.push("descreva todos os itens");
      if (draft.items.some((item) => !item.category_id)) problems.push("escolha a categoria de todos os itens");
    }
    if (entry.kind === "labor") {
      if (!draft.labor.length) problems.push("adicione pelo menos uma equipe");
      if (draft.labor.some((row) => !row.team_id)) problems.push("escolha a equipe de todas as linhas");
      if (draft.labor.some((row) => row.amount == null)) problems.push("informe o valor de todas as linhas");
    }
    return problems;
  }

  async function saveDraft(confirm) {
    if (confirm) {
      const problems = draftProblems();
      if (problems.length) {
        draft.error = "Para salvar como conferido: " + problems.join("; ") + ".";
        const box = document.querySelector("#gmDraftError");
        box.textContent = draft.error;
        box.hidden = false;
        return;
      }
    }
    const entry = { ...draft.entry, updated_at: new Date().toISOString() };
    if (!String(entry.summary || "").trim()) entry.summary = (KINDS[entry.kind] || KINDS.other).label;
    if (confirm) { entry.needs_review = false; entry.review_reasons = []; }
    const ok = await guarded(async () => {
      const saved = await D.save("entries", entry);
      const isPurchase = saved.kind === "purchase";
      if (isPurchase) {
        await D.save("purchases", {
          entry_id: saved.id, supplier: draft.purchase.supplier || null, document_number: draft.purchase.document_number || null,
          purchase_date: draft.purchase.purchase_date || saved.occurred_on || null, total: num(draft.purchase.total),
        });
      } else if (find("purchases", saved.id, "entry_id")) {
        await D.remove("purchases", saved.id);
      }
      await D.replaceChildren("items", saved.id, isPurchase ? draft.items.map((item, index) => ({
        id: item.id, position: index + 1, description: String(item.description).trim(), quantity: num(item.quantity), unit: item.unit || null,
        unit_price: num(item.unit_price), total: num(item.total), category_id: item.category_id || null,
      })) : []);
      await D.replaceChildren("labor", saved.id, saved.kind === "labor" ? draft.labor.map((row) => ({
        id: row.id, team_id: row.team_id || null, team_heard: row.team_id ? null : row.team_heard || null,
        description: String(row.description || "").trim() || "Mão de obra", amount: num(row.amount), days: num(row.days),
      })) : []);
    }, confirm ? "Lançamento conferido e salvo." : "Lançamento salvo.");
    if (!ok) return;
    closeEntry();
  }
  function closeEntry() {
    draft = null;
    closeModal();
    renderNav();
    render();
  }

  // ------------------------------------------------------------------ cadastros
  const REGISTERS = {
    projects: {
      tab: "Obras", one: "obra", newLabel: "+ Nova obra",
      help: "As obras para onde os lançamentos são alocados. Os apelidos ajudam o sistema a reconhecer a obra quando ela é citada de outro jeito.",
      deleteNote: "Os lançamentos dela continuam guardados, mas ficam sem obra.",
      fields: [
        { name: "name", label: "Nome da obra", required: true },
        { name: "aliases", label: "Apelidos (separados por vírgula)", list: true, placeholder: "VS1, obra da praia" },
        { name: "client", label: "Cliente" },
        { name: "location", label: "Local" },
      ],
      detail: (row) => [row.client, row.location, (row.aliases || []).length ? "Apelidos: " + row.aliases.join(", ") : ""].filter(Boolean).join(" · "),
    },
    categories: {
      tab: "Categorias", one: "categoria", newLabel: "+ Nova categoria",
      help: "As categorias em que cada item de nota é classificado. O sistema lê a descrição para decidir, então escreva nela o que entra e dê exemplos.",
      deleteNote: "Os itens dela continuam guardados, mas ficam sem categoria.",
      fields: [
        { name: "name", label: "Nome da categoria", required: true },
        { name: "guidance", label: "O que entra nesta categoria (com exemplos)", textarea: true, full: true },
        { name: "position", label: "Ordem de exibição", type: "number" },
      ],
      detail: (row) => row.guidance || "",
    },
    teams: {
      tab: "Equipes", one: "equipe", newLabel: "+ Nova equipe",
      help: "As equipes que recebem mão de obra. Os apelidos ajudam a reconhecer a equipe pelo jeito como ela é chamada nos áudios.",
      deleteNote: "Os lançamentos dela continuam guardados, mas ficam sem equipe.",
      fields: [
        { name: "name", label: "Nome da equipe", required: true },
        { name: "aliases", label: "Apelidos (separados por vírgula)", list: true, placeholder: "Zé, pedreiros" },
      ],
      detail: (row) => ((row.aliases || []).length ? "Apelidos: " + row.aliases.join(", ") : ""),
    },
    senders: {
      tab: "Números de WhatsApp", one: "número", newLabel: "+ Novo número",
      help: "Só os números desta lista conseguem enviar dados ao sistema. Mensagens de qualquer outro número são descartadas.",
      deleteNote: "Esse número deixa de poder enviar mensagens ao sistema.",
      fields: [
        { name: "name", label: "Nome da pessoa", required: true },
        { name: "phone", label: "Número com DDI e DDD (só números)", required: true, phone: true, placeholder: "5521999998888" },
      ],
      detail: (row) => row.phone || "",
    },
  };

  function settings() {
    setPage("Configurações", "CADASTROS E PREFERÊNCIAS");
    const wait = waiting();
    if (wait) return wait;
    const tabs = Object.entries(REGISTERS).map(([id, r]) => [id, r.tab]).concat([["ambiente", "Ambiente"]])
      .map(([id, label]) => `<button class="tab ${ui.settingsTab === id ? "active" : ""}" data-gm="settings-tab" data-id="${id}">${label}</button>`).join("");
    const demo = D.remote ? "" : `<div class="gm-hint"><strong>Modo demonstração</strong><span>O banco de dados ainda não está ligado. O que você cadastrar aqui fica só neste navegador. <button class="text-btn" data-gm="demo-reset">Restaurar os dados de exemplo</button></span></div>`;
    if (ui.settingsTab === "ambiente") return `<div class="tabs">${tabs}</div>${ambienteView()}`;
    const register = REGISTERS[ui.settingsTab];
    const rows = D.cache[ui.settingsTab].slice().sort((a, b) => (a.position || 0) - (b.position || 0) || String(a.name).localeCompare(String(b.name)))
      .map((row) => `<div class="gm-register-row ${row.active === false ? "inactive" : ""}">
        <div><strong>${esc(row.name)}</strong>${row.active === false ? ` <span class="gm-chip">Inativo</span>` : ""}<small>${esc(register.detail(row))}</small></div>
        <div class="gm-register-actions"><button class="secondary-btn" data-gm="register-edit" data-id="${esc(row.id)}">Editar</button><button class="ghost-btn danger-btn" data-gm="register-delete" data-id="${esc(row.id)}">Excluir</button></div>
      </div>`).join("");
    return `<div class="tabs">${tabs}</div>${demo}
      <div class="panel"><div class="panel-head"><div><h3>${register.tab}</h3><p>${register.help}</p></div><button class="primary-btn" data-gm="register-new">${register.newLabel}</button></div>
      <div class="gm-register">${rows || `<div class="empty">Nada cadastrado ainda.</div>`}</div></div>`;
  }

  function registerModal(id) {
    const register = REGISTERS[ui.settingsTab];
    const row = id ? find(ui.settingsTab, id) : null;
    const fields = register.fields.map((f) => {
      const value = f.list ? (row?.[f.name] || []).join(", ") : row?.[f.name] ?? "";
      const attrs = `id="gm_${f.name}" name="${f.name}" ${f.required ? "required" : ""} placeholder="${esc(f.placeholder || "")}"`;
      const input = f.textarea ? `<textarea ${attrs}>${esc(value)}</textarea>` : `<input ${attrs} type="${f.type || "text"}" value="${esc(value)}">`;
      return `<div class="field ${f.full || f.textarea ? "full" : ""}"><label for="gm_${f.name}">${f.label}</label>${input}</div>`;
    }).join("");
    openModal(row ? `Editar ${register.one}` : register.newLabel.replace("+ ", ""), `<form id="gmRegisterForm" data-id="${esc(id || "")}">
      <div class="form-grid">${fields}
        <label class="remember full"><input type="checkbox" name="active" ${row?.active === false ? "" : "checked"}> Ativo (desmarque para parar de usar sem excluir)</label>
      </div>
      <div class="login-error" id="gmRegisterError" role="alert" hidden></div>
      <div class="form-actions"><button type="button" class="secondary-btn" data-gm="modal-cancel">Cancelar</button><button class="primary-btn">Salvar</button></div></form>`);
  }

  async function saveRegister(form) {
    const register = REGISTERS[ui.settingsTab];
    const data = new FormData(form);
    const row = { active: data.get("active") === "on" };
    if (form.dataset.id) row.id = form.dataset.id;
    const error = document.querySelector("#gmRegisterError");
    for (const f of register.fields) {
      let value = String(data.get(f.name) || "").trim();
      if (f.phone) value = value.replace(/\D/g, "");
      if (f.required && !value) { error.textContent = `Preencha: ${f.label}.`; error.hidden = false; return; }
      if (f.phone && !/^\d{10,15}$/.test(value)) { error.textContent = "O número precisa ter DDI e DDD, só com dígitos. Exemplo: 5521999998888."; error.hidden = false; return; }
      if (f.list) row[f.name] = value ? value.split(",").map((part) => part.trim()).filter(Boolean) : [];
      else if (f.type === "number") row[f.name] = value === "" ? 0 : Number(value);
      else row[f.name] = value || null;
    }
    const duplicate = D.cache[ui.settingsTab].some((other) => other.id !== row.id && String(other.name).toLowerCase() === String(row.name).toLowerCase());
    if (duplicate) { error.textContent = "Já existe um cadastro com esse nome."; error.hidden = false; return; }
    if (await guarded(() => D.save(ui.settingsTab, row), "Cadastro salvo.")) { closeModal(); render(); }
  }

  // ------------------------------------------------------------------ eventos
  function setPath(target, path, value) {
    const [index, field] = path.split(":");
    target[Number(index)][field] = value;
  }
  function onInput(event) {
    const el = event.target;
    if (el.dataset.gmFilter === "q") {
      ui.q = el.value;
      const list = document.querySelector("#gmList");
      if (list) { // troca só a lista, para não perder o foco da busca
        const holder = document.createElement("div");
        holder.innerHTML = inboxTab();
        list.innerHTML = holder.querySelector("#gmList").innerHTML;
      }
      return;
    }
    if (!draft) return;
    if (el.dataset.gmEntry && el.dataset.gmEntry !== "kind") draft.entry[el.dataset.gmEntry] = el.value || null;
    else if (el.dataset.gmPurchase) { draft.purchase[el.dataset.gmPurchase] = el.value; updateSum(); }
    else if (el.dataset.gmItem) { setPath(draft.items, el.dataset.gmItem, el.value === "" ? null : el.value); updateSum(); }
    else if (el.dataset.gmLabor) setPath(draft.labor, el.dataset.gmLabor, el.value === "" ? null : el.value);
    if (el.classList.contains("gm-missing") && el.value) el.classList.remove("gm-missing");
  }
  function onChange(event) {
    const el = event.target;
    if (el.dataset.gmFilter && el.dataset.gmFilter !== "q") { ui[el.dataset.gmFilter] = el.value; return render(); }
    if (draft && el.dataset.gmEntry === "kind") { draft.entry.kind = el.value; draft.error = null; renderDraft(); }
  }
  async function onClick(event) {
    const el = event.target.closest("[data-gm]");
    if (!el) return;
    const action = el.dataset.gm, id = el.dataset.id;
    if (action === "retry") return reload();
    if (action === "tab") { ui.tab = id; return render(); }
    if (action === "review") { ui.onlyReview = id === "1"; return render(); }
    if (action === "open") return openEntry(id);
    if (action === "new") return openEntry(null, ui.kind || "purchase");
    if (action === "modal-cancel") return closeModal();
    if (action === "item-add") { draft.items.push({ description: "", quantity: null, unit: null, unit_price: null, total: null, category_id: null }); return renderDraft(); }
    if (action === "item-remove") { draft.items.splice(Number(id), 1); return renderDraft(); }
    if (action === "labor-add") { draft.labor.push({ team_id: null, team_heard: null, description: "", amount: null, days: null }); return renderDraft(); }
    if (action === "labor-remove") { draft.labor.splice(Number(id), 1); return renderDraft(); }
    if (action === "entry-save") return saveDraft(id === "confirm");
    if (action === "entry-delete") {
      if (!confirm("Excluir este lançamento? Os itens e valores dele também são apagados. Não dá para desfazer.")) return;
      if (await guarded(() => D.remove("entries", draft.entry.id), "Lançamento excluído.")) closeEntry();
      return;
    }
    if (action === "settings-tab") { ui.settingsTab = id; return render(); }
    if (action === "register-new") return registerModal(null);
    if (action === "register-edit") return registerModal(id);
    if (action === "register-delete") {
      const register = REGISTERS[ui.settingsTab], row = find(ui.settingsTab, id);
      if (!confirm(`Excluir ${register.one} "${row.name}"? ${register.deleteNote} Não dá para desfazer.`)) return;
      if (await guarded(() => D.remove(ui.settingsTab, id), "Cadastro excluído.")) { renderNav(); render(); }
      return;
    }
    if (action === "demo-reset") {
      if (!confirm("Restaurar os dados de exemplo? O que você cadastrou na demonstração será apagado.")) return;
      D.resetDemo();
      return reload();
    }
  }
  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);
  document.addEventListener("submit", (event) => {
    if (event.target.id === "gmRegisterForm") { event.preventDefault(); saveRegister(event.target); }
    if (event.target.id === "gmEntryForm") event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches?.("tr.gm-row")) openEntry(event.target.dataset.id);
  });

  return { inbox, settings, pendingCount, reload, clear() { draft = null; } };
})();
