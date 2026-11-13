/* ObraFlow Control — protótipo funcional sem backend */
const ANALYSIS_DATE = new Date("2026-07-23T12:00:00");
const STORAGE_KEY = "obraflow-control-v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("pt-BR");

const NAV = [
  ["dashboard", "⌂", "Dashboard"], ["lancamentos", "✉", "Lançamentos"], ["obras", "▦", "Obras"], ["cronogramas", "≡", "Cronogramas"],
  ["curva", "⌁", "Curva S"], ["diario", "☷", "Diário de Obra"], ["financeiro", "◇", "Financeiro"],
  ["documentos", "▤", "Documentos"], ["relatorios", "▧", "Relatórios"], ["configuracoes", "⚙", "Configurações"]
];

const DEMO = {
  dataRevision: 3,
  projects: [
    {
      id: "reforma", name: "Vale do Sol 1", client: "Empresa Alpha", location: "Rio de Janeiro, RJ",
      manager: "Carlos Martins", start: "2026-04-01", end: "2026-09-30", budget: 820000, planned: 52, actual: 54, cost: 510000,
      activities: [
        ["1.1","Mobilização","Preliminares","Carlos Martins","2026-04-01","2026-04-12",8,100,100],
        ["1.2","Demolições","Civil","João Lima","2026-04-10","2026-05-15",15,100,100],
        ["1.3","Adequações estruturais","Estrutura","Paulo Reis","2026-05-01","2026-07-30",27,78,83],
        ["1.4","Instalações prediais","Instalações","Ana Luz","2026-06-01","2026-08-20",25,52,57],
        ["1.5","Acabamentos","Arquitetura","Carlos Martins","2026-07-01","2026-09-20",25,18,20]
      ]
    },
    {
      id: "logistico", name: "Vale do Sol 2", client: "Logística Brasil", location: "Duque de Caxias, RJ",
      manager: "Mariana Souza", start: "2026-01-10", end: "2026-10-15", budget: 2400000, planned: 68, actual: 54, cost: 1550000, delay: 35,
      activities: [
        ["1.1","Mobilização","Preliminares","Mariana Souza","2026-01-10","2026-01-25",5,100,100],
        ["1.2","Terraplanagem","Terraplenagem","Eduardo Melo","2026-01-20","2026-03-05",10,100,100],
        ["1.3","Fundação","Estrutura","Paulo Reis","2026-02-20","2026-05-10",20,100,85],
        ["1.4","Estrutura","Estrutura","Paulo Reis","2026-04-10","2026-08-15",30,65,42],
        ["1.5","Instalações","Instalações","Ana Luz","2026-06-15","2026-09-20",20,25,12],
        ["1.6","Acabamentos","Arquitetura","Juliana Dias","2026-08-01","2026-10-10",15,0,0]
      ]
    },
    {
      id: "escola", name: "Casa Fabiola & Julio", client: "Prefeitura Municipal", location: "Volta Redonda, RJ",
      manager: "Roberto Almeida", start: "2026-02-15", end: "2026-12-20", budget: 4800000, planned: 41, actual: 43, cost: 1900000,
      activities: [
        ["1.1","Serviços preliminares","Preliminares","Roberto Almeida","2026-02-15","2026-03-10",5,100,100],
        ["1.2","Infraestrutura","Estrutura","César Pinto","2026-03-01","2026-05-30",20,100,100],
        ["1.3","Superestrutura","Estrutura","César Pinto","2026-05-01","2026-08-30",30,62,68],
        ["1.4","Instalações","Instalações","Ana Luz","2026-07-01","2026-10-30",20,15,18],
        ["1.5","Fechamentos e cobertura","Arquitetura","Luís Alves","2026-06-20","2026-10-15",15,18,20],
        ["1.6","Acabamentos e entrega","Arquitetura","Roberto Almeida","2026-09-01","2026-12-20",10,0,0]
      ]
    }
  ],
  financials: [
    {id:1, project:"logistico", date:"2026-07-02", category:"Materiais", supplier:"Aço Brasil", description:"Estrutura metálica — lote 3", planned:280000, actual:312000, status:"Pago", document:"NF 8129"},
    {id:2, project:"logistico", date:"2026-07-08", category:"Mão de obra", supplier:"Equipe própria", description:"Folha quinzenal", planned:118000, actual:121400, status:"Pago", document:"FP 07/1"},
    {id:3, project:"logistico", date:"2026-07-15", category:"Equipamentos", supplier:"LocaMáquinas", description:"Guindaste e plataformas", planned:76000, actual:82400, status:"A pagar", document:"NF 3391"},
    {id:4, project:"escola", date:"2026-07-18", category:"Materiais", supplier:"ConcreRio", description:"Concreto usinado", planned:165000, actual:181000, status:"Pago", document:"NF 1930"},
    {id:5, project:"reforma", date:"2026-07-19", category:"Serviços contratados", supplier:"Clima Engenharia", description:"Adequação HVAC", planned:46000, actual:43800, status:"A pagar", document:"NF 449"}
  ],
  diaries: [
    {id:1, date:"2026-07-22", type:"Recomendação ao trabalhador", description:"Reprogramar montagem do setor 4.", project:"logistico"},
    {id:2, date:"2026-07-20", type:"Recomendação ao trabalhador", description:"Reavaliar solo após estiagem.", project:"logistico"},
    {id:3, date:"2026-07-17", type:"Recomendação ao trabalhador", description:"Concluir inspeção de qualidade.", project:"logistico"},
    {id:4, date:"2026-07-15", type:"Recomendação ao trabalhador", description:"Compatibilizar projeto elétrico.", project:"logistico"},
    {id:5, date:"2026-07-12", type:"Recomendação ao trabalhador", description:"Medir ganho de produtividade.", project:"logistico"}
  ]
};

let state = loadState();
let route = "dashboard";
let selectedProjectId = "logistico";
let projectTab = "overview";
let chart = null;
let presentationStep = 0;
let projectView = "cards";

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return clone(DEMO);
    const currentNames = {
      reforma: "Vale do Sol 1",
      logistico: "Vale do Sol 2",
      escola: "Casa Fabiola & Julio"
    };
    saved.projects?.forEach(p => {
      if (currentNames[p.id]) p.name = currentNames[p.id];
    });
    if ((saved.dataRevision || 0) < 2) {
      const valeDoSol1 = saved.projects?.find(p => p.id === "reforma");
      const casaFabiolaJulio = saved.projects?.find(p => p.id === "escola");
      if (valeDoSol1) valeDoSol1.cost = 510000;
      if (casaFabiolaJulio) casaFabiolaJulio.cost = 1900000;
      saved.dataRevision = 2;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }
    if ((saved.dataRevision || 0) < 3) {
      saved.diaries = (saved.diaries || []).map((d, i) => Array.isArray(d) ? {
        id: i + 1, date: d[0], type: "Recomendação ao trabalhador",
        description: d[6] || d[5] || d[3], project: "logistico"
      } : d);
      saved.dataRevision = 3;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }
    return saved;
  }
  catch { return clone(DEMO); }
}
function saveState(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (message) toast(message);
}
function slug(v) { return String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"); }
function fmtDate(v) { return dateFmt.format(new Date(v + "T12:00:00")); }
function daysBetween(a,b) { return Math.ceil((new Date(b+"T12:00:00") - new Date(a+"T12:00:00")) / 86400000); }
function clamp(n,min=0,max=100) { return Math.min(max, Math.max(min, Number(n)||0)); }
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
function project(id=selectedProjectId) { return state.projects.find(p => p.id === id) || state.projects[0]; }
function calc(p) {
  const pv = p.budget * p.planned / 100, ev = p.budget * p.actual / 100, ac = p.cost;
  const spi = pv ? ev / pv : 1, cpi = ac ? ev / ac : 1, eac = cpi ? p.budget / cpi : p.budget;
  const duration = daysBetween(p.start,p.end), consumed = clamp(daysBetween(p.start,"2026-07-23")/duration*100);
  const remaining = Math.max(0, daysBetween("2026-07-23",p.end));
  const delay = spi < 1 ? Math.round((1/spi-1) * remaining) : 0;
  const projectedEnd = new Date(new Date(p.end+"T12:00:00").getTime()+delay*86400000);
  let status = "Saudável";
  if (spi < .9 && cpi < .9) status = "Crítica";
  else if (cpi < .9) status = "Risco financeiro";
  else if (spi < .9) status = "Atrasada";
  else if (spi < 1 || cpi < 1) status = "Atenção";
  return { pv, ev, ac, spi, cpi, eac, variance:p.actual-p.planned, costVariance:ev-ac, duration, consumed, remaining, delay, projectedEnd, status };
}
function alerts() {
  const out = [];
  state.projects.forEach(p => {
    const c = calc(p);
    if (p.actual < p.planned) out.push({level:c.spi<.9?"high":"medium", project:p.name, text:`Realizado ${p.actual}% abaixo do planejado de ${p.planned}%.`, action:"Revisar sequência e recursos das atividades críticas."});
    if (c.spi < .9) out.push({level:"high", project:p.name, text:`SPI em ${number.format(c.spi)}, indicando atraso relevante.`, action:"Aplicar plano de recuperação do prazo."});
    if (c.cpi < .9) out.push({level:"high", project:p.name, text:`CPI em ${number.format(c.cpi)}: custo acima do valor produzido.`, action:"Revisar contratos, produtividade e compras."});
    if (p.cost > c.pv) out.push({level:"medium", project:p.name, text:"Custo realizado superior ao valor planejado acumulado.", action:"Validar medições e compromissos financeiros."});
    if (c.delay > 0) out.push({level:c.delay>30?"high":"medium", project:p.name, text:`Conclusão projetada ${c.delay} dias após o contrato.`, action:"Simular reforço de equipe e jornadas adicionais."});
    const weight = p.activities.reduce((s,a)=>s+Number(a[6]),0);
    if (weight !== 100) out.push({level:"high", project:p.name, text:`Pesos do cronograma totalizam ${weight}%.`, action:"Ajustar pesos para totalizar 100%."});
    p.activities.forEach(a => {
      if (!a[3]) out.push({level:"medium", project:p.name, text:`Atividade “${a[1]}” sem responsável.`, action:"Designar responsável."});
      if (new Date(a[5]) < ANALYSIS_DATE && a[8] < 100) out.push({level:"medium", project:p.name, text:`Atividade vencida: ${a[1]} (${a[8]}%).`, action:"Atualizar plano de conclusão."});
    });
  });
  return out;
}
function statusBadge(s) { return `<span class="status ${slug(s)}">${s}</span>`; }
function progress(value, planned) { return `<div class="progress ${value < planned ? "warn":""}"><span style="width:${clamp(value)}%"></span></div>`; }
function setPage(title, eyebrow="GESTÃO DE OBRAS") { document.querySelector("#pageTitle").textContent=title; document.querySelector("#breadcrumb").textContent=eyebrow; }
function navigate(to, id) {
  route=to; if(id) selectedProjectId=id;
  document.querySelector("#sidebar").classList.remove("open");
  renderNav(); render();
}
function renderNav() {
  const html = NAV.map(([id,icon,label])=>`<button class="nav-item ${route===id||(route==="project"&&id==="obras")?"active":""}" data-route="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>${id==="lancamentos"&&GMUI.pendingCount()?`<span class="gm-count">${GMUI.pendingCount()}</span>`:""}</button>`).join("");
  document.querySelector("#mainNav").innerHTML=html;
  document.querySelector("#mobileNav").innerHTML=NAV.slice(0,5).map(([id,icon,label])=>`<button class="nav-item ${route===id||(route==="project"&&id==="obras")?"active":""}" data-route="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${label.split(" ")[0]}</span></button>`).join("");
  document.querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>navigate(b.dataset.route));
  document.querySelector("#notificationCount").textContent=alerts().length;
}
function kpi(label,value,note,icon="◇",klass="") { return `<div class="kpi-card ${klass}"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon}</span></div><strong class="kpi-value">${value}</strong><div class="kpi-note">${note}</div></div>`; }
function dashboard() {
  setPage("Visão geral","PORTFÓLIO DE OBRAS");
  const cs=state.projects.map(calc), totalBudget=state.projects.reduce((s,p)=>s+p.budget,0), totalCost=state.projects.reduce((s,p)=>s+p.cost,0);
  const avg=state.projects.reduce((s,p)=>s+p.actual,0)/state.projects.length, delayed=cs.filter(c=>c.spi<1).length, critical=alerts().filter(a=>a.level==="high").length;
  return `
    <div class="section-head"><div><h2>${greeting()}, Gerson</h2><p>Indicadores consolidados em 23 de julho de 2026.</p></div><div class="actions"><button class="secondary-btn" data-action="report">Exportar relatório</button><button class="primary-btn" data-action="new-project">+ Nova obra</button></div></div>
    <section class="kpi-grid">
      ${kpi("Obras ativas",state.projects.length,"Todas em execução","▦")}
      ${kpi("Valor contratado",money.format(totalBudget),"Portfólio consolidado","◇")}
      ${kpi("Avanço médio",number.format(avg)+"%","<span class='delta-up'>↑ 1,8 p.p.</span> no mês","↗","good")}
      ${kpi("Obras atrasadas",delayed,delayed?"Requerem plano de ação":"Nenhuma obra","⌛","warn")}
      ${kpi("Alertas críticos",critical,"Atualizados automaticamente","!","warn")}
      ${kpi("Custo realizado",money.format(totalCost),number.format(totalCost/totalBudget*100)+"% do BAC","▤")}
    </section>
    <section class="grid-2">
      <div class="panel"><div class="panel-head"><div><h3>Avanço consolidado</h3><p>Planejado, realizado e projeção do portfólio</p></div><div class="mini-legend"><span><i class="legend-dot" style="background:#292b2c"></i>Planejado</span><span><i class="legend-dot" style="background:#ad8a55"></i>Realizado</span></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="mainChart"></canvas></div></div></div>
      <div class="panel"><div class="panel-head"><div><h3>Alertas recentes</h3><p>Prioridades para tomada de decisão</p></div><button class="ghost-btn" data-action="show-alerts">Ver todos</button></div><div class="panel-body"><div class="alert-list">${alertItems(alerts().slice(0,4))}</div></div></div>
    </section>
    <section class="grid-2">
      <div class="panel"><div class="panel-head"><div><h3>Obras em andamento</h3><p>Posição física e financeira por projeto</p></div><button class="ghost-btn" data-route="obras">Ver portfólio</button></div><div class="table-wrap">${projectTable(state.projects)}</div></div>
      <div class="panel"><div class="panel-head"><div><h3>Ranking de desempenho</h3><p>Índice combinado SPI e CPI</p></div></div><div class="panel-body"><div class="ranking-list">${state.projects.map(p=>({p,score:(calc(p).spi+calc(p).cpi)/2})).sort((a,b)=>b.score-a.score).map((x,i)=>`<div class="ranking-item"><span class="rank">${i+1}</span><div><strong>${x.p.name}</strong><div>${statusBadge(calc(x.p).status)}</div></div><span>${number.format(x.score)}</span></div>`).join("")}</div></div></div>
    </section>`;
}
function projectTable(projects) {
  if(!projects.length) return `<div class="empty">Nenhuma obra encontrada.</div>`;
  return `<table><thead><tr><th>Obra</th><th>Responsável</th><th>Orçamento</th><th>Planejado</th><th>Realizado</th><th>Desvio</th><th>SPI</th><th>Situação</th><th></th></tr></thead><tbody>${projects.map(p=>{const c=calc(p);return `<tr><td><div class="table-main"><strong>${p.name}</strong><span>${p.client}</span></div></td><td>${p.manager}</td><td>${money.format(p.budget)}</td><td>${p.planned}%</td><td><div>${p.actual}%</div>${progress(p.actual,p.planned)}</td><td class="${c.variance>=0?"delta-up":"delta-down"}">${c.variance>0?"+":""}${number.format(c.variance)} p.p.</td><td>${number.format(c.spi)}</td><td>${statusBadge(c.status)}</td><td><button class="icon-btn" data-open-project="${p.id}" title="Abrir detalhes">›</button></td></tr>`}).join("")}</tbody></table>`;
}
function alertItems(items) { return items.length ? items.map(a=>`<div class="alert-item ${a.level}"><span class="alert-sign">${a.level==="high"?"!":"i"}</span><div><strong>${a.project}</strong><p>${a.text}</p></div></div>`).join("") : `<div class="empty">Nenhum alerta no momento.</div>`; }
function obras() {
  setPage("Obras","PORTFÓLIO");
  return `<div class="section-head"><div><h2>Portfólio de obras</h2><p>Gerencie desempenho, responsáveis e marcos contratuais.</p></div><div class="actions"><div class="view-toggle"><button data-view="cards" class="${projectView==="cards"?"active":""}">▦ Cards</button><button data-view="table" class="${projectView==="table"?"active":""}">☷ Tabela</button></div><button class="primary-btn" data-action="new-project">+ Nova obra</button></div></div>
  <div class="filter-row"><label class="search"><span>⌕</span><input id="projectSearch" placeholder="Nome, cliente ou responsável"></label><select id="statusFilter"><option value="">Todas as situações</option>${["Saudável","Atenção","Atrasada","Risco financeiro","Crítica"].map(s=>`<option>${s}</option>`)}</select></div>
  <div id="projectResults">${renderProjectResults(state.projects)}</div>`;
}
function renderProjectResults(items) {
  if(projectView==="table") return `<div class="panel table-wrap">${projectTable(items)}</div>`;
  return `<div class="cards-grid">${items.map(p=>{const c=calc(p);return `<article class="project-card" data-open-project="${p.id}"><div class="project-card-head"><div><h3>${p.name}</h3><p>${p.client} · ${p.location}</p></div>${statusBadge(c.status)}</div><div class="project-meta"><div><span>Responsável</span><strong>${p.manager}</strong></div><div><span>Orçamento</span><strong>${money.format(p.budget)}</strong></div><div><span>Término</span><strong>${fmtDate(p.end)}</strong></div><div><span>Desvio físico</span><strong class="${c.variance>=0?"delta-up":"delta-down"}">${c.variance>0?"+":""}${number.format(c.variance)} p.p.</strong></div></div><div class="project-progress">${progress(p.actual,p.planned)}<strong>${p.actual}%</strong></div></article>`}).join("")}</div>`;
}
function projectPage() {
  const p=project(), c=calc(p); setPage(p.name,"DETALHES DA OBRA");
  const tabs=[["overview","Visão geral"],["curve","Curva S"],["schedule","Cronograma"],["finance","Financeiro"],["diary","Diário"],["documents","Documentos"],["report","Relatórios"]];
  let content={overview:projectOverview,curve:curveView,schedule:scheduleView,finance:financeView,diary:diaryView,documents:documentsView,report:reportView}[projectTab](p);
  return `<div class="project-hero"><div><span class="eyebrow">${p.client}</span><h2>${p.name}</h2><p>${p.location} · Responsável: ${p.manager}</p></div><div class="actions">${statusBadge(c.status)}<button class="secondary-btn" data-action="edit-project">Editar</button><button class="ghost-btn" data-action="duplicate-project">Duplicar</button><button class="ghost-btn danger-btn" data-action="delete-project">Excluir</button></div></div>
  <div class="metric-strip">${metric("Orçamento",money.format(p.budget))}${metric("Planejado",p.planned+"%")}${metric("Realizado",p.actual+"%",c.variance>=0?"delta-up":"delta-down")}${metric("SPI",number.format(c.spi))}${metric("CPI",number.format(c.cpi))}${metric("Dias restantes",c.remaining)}${metric("Conclusão projetada",dateFmt.format(c.projectedEnd))}</div>
  <div class="tabs">${tabs.map(([id,label])=>`<button class="tab ${projectTab===id?"active":""}" data-tab="${id}">${label}</button>`).join("")}</div>${content}`;
}
function metric(label,value,klass="") { return `<div class="metric"><span>${label}</span><strong class="${klass}">${value}</strong></div>`; }
function projectOverview(p) {
  const c=calc(p);
  return `<div class="grid-2"><div class="panel"><div class="panel-head"><div><h3>Curva de desempenho</h3><p>Evolução física acumulada</p></div><button class="ghost-btn" data-tab="curve">Explorar curva</button></div><div class="panel-body"><div class="chart-wrap"><canvas id="mainChart"></canvas></div></div></div>
  <div class="panel"><div class="panel-head"><div><h3>Valor agregado</h3><p>Indicadores em 23/07/2026</p></div></div><div class="panel-body"><div class="ranking-list">${[
    ["PV · Valor planejado",money.format(c.pv)],["EV · Valor agregado",money.format(c.ev)],["AC · Custo real",money.format(c.ac)],["Variação de custo",money.format(c.costVariance)],["EAC · Custo final",money.format(c.eac)],["Prazo consumido",number.format(c.consumed)+"%"]
  ].map((x,i)=>`<div class="ranking-item"><span class="rank">${i+1}</span><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join("")}</div></div></div></div>
  <div class="grid-equal"><div class="panel"><div class="panel-head"><h3>Resumo executivo</h3></div><div class="panel-body"><p>${executiveSummary(p)}</p><button class="primary-btn" data-action="scenario">Simular cenário</button></div></div><div class="panel"><div class="panel-head"><h3>Alertas da obra</h3></div><div class="panel-body"><div class="alert-list">${alertItems(alerts().filter(a=>a.project===p.name).slice(0,3))}</div></div></div></div>`;
}
function executiveSummary(p) {
  const c=calc(p);
  if(c.status==="Saudável") return `A obra apresenta desempenho físico acima do planejado e boa eficiência de custos. A recomendação é preservar o ritmo atual e monitorar os próximos marcos de execução.`;
  if(c.status==="Risco financeiro") return `O avanço físico está aderente ao plano, porém o custo real supera o valor agregado. Priorizar a revisão de compras, produtividade e contratos para conter a projeção final de ${money.format(c.eac)}.`;
  return `A obra apresenta desvio físico de ${number.format(c.variance)} p.p., SPI ${number.format(c.spi)} e projeção de ${c.delay} dias de atraso. Estrutura e Instalações concentram o impacto e exigem plano de recuperação.`;
}
function curveSeries(p, financial=false) {
  const labels=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"], midpoint=Math.max(1,new Date(p.start).getMonth()), end=Math.max(midpoint+1,new Date(p.end).getMonth());
  const logistic = i => 100/(1+Math.exp(-.82*(i-(midpoint+end)/2)));
  const rawStart=logistic(midpoint-1), rawEnd=logistic(end);
  const plan=labels.map((_,i)=>i<midpoint?0:i>end?100:clamp((logistic(i)-rawStart)/(rawEnd-rawStart)*100));
  const july=6, ratio=p.actual/Math.max(p.planned,1);
  const actual=plan.map((v,i)=>i<=july?clamp(v*ratio):null);
  actual[july]=p.actual;
  const projected=plan.map((v,i)=>i<july?null:i===july?p.actual:clamp(p.actual+(100-p.actual)*Math.pow((i-july)/Math.max(1,end-july),1.1)*(calc(p).spi<1?.9:1)));
  if(financial) return {labels, plan:plan.map(v=>v*p.budget/100), actual:actual.map(v=>v==null?null:v*p.cost/Math.max(p.actual,1)), projected:projected.map(v=>v==null?null:v*calc(p).eac/100)};
  return {labels,plan,actual,projected};
}
function curveView(p) {
  return `<div class="panel"><div class="panel-head"><div><h3>Curva S do projeto</h3><p>Planejado × realizado × projeção</p></div><div class="actions"><select id="curveType"><option value="physical">Curva física</option><option value="financial">Curva financeira</option></select><select><option>Visão mensal</option><option>Visão semanal</option></select><select><option>Todas as disciplinas</option><option>Estrutura</option><option>Instalações</option></select></div></div><div class="panel-body"><div class="chart-wrap" style="height:420px"><canvas id="mainChart"></canvas></div></div></div>`;
}
function scheduleView(p) {
  const budgeted=p.activities.reduce((s,a)=>s+(p.budget*Number(a[6])/100),0);
  return `<div class="section-head"><div><h2>Cronograma executivo</h2><p>Etapas, situação e controle de custo da obra.</p></div></div>
  <div class="metric-strip schedule-cost-summary">${metric("Orçado por etapas",money.format(budgeted))}${metric("Custo real por etapas","Não classificado")}</div>
  <div class="panel"><div class="panel-head"><div><h3>Etapas da obra</h3><p>Marque cada etapa como concluída quando o serviço estiver finalizado.</p></div></div><div class="table-wrap"><table class="schedule-table"><thead><tr><th>WBS</th><th>Etapa</th><th>Disciplina</th><th>Início</th><th>Término</th><th>Orçado</th><th>Custo real</th><th>Situação</th></tr></thead><tbody>${p.activities.map((a,i)=>{const done=typeof a[9]==="boolean"?a[9]:Number(a[8])>=100;return `<tr><td>${a[0]}</td><td><strong>${a[1]}</strong></td><td>${a[2]}</td><td>${fmtDate(a[4])}</td><td>${fmtDate(a[5])}</td><td>${money.format(p.budget*Number(a[6])/100)}</td><td><span class="unclassified-cost">Não classificado</span></td><td><select class="stage-status ${done?"is-done":""}" data-index="${i}" aria-label="Situação de ${a[1]}"><option value="false" ${!done?"selected":""}>Não concluída</option><option value="true" ${done?"selected":""}>Concluída</option></select></td></tr>`}).join("")}</tbody></table></div></div>`;
}
function financeView(p) {
  const entries=state.financials.filter(f=>f.project===p.id);
  return `<div class="section-head"><div><h2>Controle financeiro</h2><p>Custos, compromissos e projeção da obra.</p></div><button class="primary-btn" data-action="add-cost">+ Novo custo</button></div><div class="kpi-grid">${kpi("Custo realizado",money.format(p.cost),"AC acumulado","◇")}${kpi("Valor agregado",money.format(calc(p).ev),"EV acumulado","↗")}${kpi("CPI",number.format(calc(p).cpi),calc(p).cpi<1?"Acima do valor produzido":"Eficiência positiva","◎",calc(p).cpi<.9?"warn":"good")}${kpi("Projeção final",money.format(calc(p).eac),"Estimate at Completion","⌁")}</div><div class="panel table-wrap"><table><thead><tr><th>Data</th><th>Categoria</th><th>Fornecedor</th><th>Descrição</th><th>Planejado</th><th>Realizado</th><th>Status</th><th>Documento</th></tr></thead><tbody>${entries.map(f=>`<tr><td>${fmtDate(f.date)}</td><td>${f.category}</td><td>${f.supplier}</td><td>${f.description}</td><td>${money.format(f.planned)}</td><td>${money.format(f.actual)}</td><td>${statusBadge(f.status==="Pago"?"Saudável":"Atenção")}</td><td>${f.document}</td></tr>`).join("")}</tbody></table></div>`;
}
function diaryView(p) {
  const entries=state.diaries.filter(d=>!d.project||d.project===p.id);
  return `<div class="section-head"><div><h2>Diário de obra</h2><p>Recomendações aos trabalhadores e solicitações do cliente.</p></div><button class="primary-btn" data-action="add-diary">+ Novo registro</button></div>${!entries.length?`<div class="panel"><div class="empty">Ainda não há registros para esta obra.</div></div>`:`<div class="panel"><div class="panel-body"><div class="timeline simple-log">${entries.map(d=>`<div class="timeline-item"><div class="timeline-date">${fmtDate(d.date)}</div><div class="timeline-card"><span class="log-type">${d.type}</span><p>${d.description}</p>${d.project?`<small>${project(d.project).name}</small>`:""}</div></div>`).join("")}</div></div></div>`}`;
}
function documentsView() { return `<div class="panel"><div class="panel-head"><div><h3>Documentos da obra</h3><p>Projetos, contratos, medições e registros</p></div><button class="primary-btn" data-action="upload-doc">+ Adicionar documento</button></div><div class="panel-body"><div class="cards-grid">${["Contrato e aditivos","Projetos executivos","Medições mensais","Relatórios fotográficos","Licenças e alvarás","Atas de reunião"].map((x,i)=>`<div class="project-card"><div class="project-card-head"><div><h3>▤ ${x}</h3><p>${i+2} arquivos · atualizado recentemente</p></div><button class="icon-btn">›</button></div></div>`).join("")}</div></div></div>`; }
function reportView(p) {
  const c=calc(p);
  return `<div class="actions no-print" style="justify-content:flex-end;margin-bottom:12px"><button class="secondary-btn" data-action="print">Imprimir ou salvar como PDF</button></div><article class="report"><div class="report-cover"><div><span class="eyebrow">RELATÓRIO EXECUTIVO</span><h2>${p.name}</h2><p>${p.client} · posição em 23/07/2026</p></div>${statusBadge(c.status)}</div><div class="report-summary"><strong>Resumo executivo</strong><p>${executiveSummary(p)}</p></div><h3>Indicadores principais</h3><div class="metric-strip">${metric("Planejado",p.planned+"%")}${metric("Realizado",p.actual+"%")}${metric("SPI",number.format(c.spi))}${metric("CPI",number.format(c.cpi))}${metric("EAC",money.format(c.eac))}${metric("Projeção",dateFmt.format(c.projectedEnd))}</div><h3>Curva S</h3><div class="chart-wrap"><canvas id="mainChart"></canvas></div><h3>Atividades críticas</h3>${projectTable([p])}<h3>Riscos e ações recomendadas</h3><div class="alert-list">${alertItems(alerts().filter(a=>a.project===p.name).slice(0,4))}</div></article>`;
}
function cronogramas() { selectedProjectId=selectedProjectId||"logistico"; projectTab="schedule"; route="project"; return projectPage(); }
function curva() { projectTab="curve"; route="project"; return projectPage(); }
function financeiro() { projectTab="finance"; route="project"; return projectPage(); }
function diario() { selectedProjectId="logistico"; projectTab="diary"; route="project"; return projectPage(); }
function documentos() { projectTab="documents"; route="project"; return projectPage(); }
function relatorios() { projectTab="report"; route="project"; return projectPage(); }
function ambienteView() {
  return `<div class="grid-equal"><div class="panel"><div class="panel-head"><h3>Preferências do ambiente</h3></div><div class="panel-body"><div class="form-grid"><div class="field"><label>Empresa</label><input value="A&M Incorporações"></div><div class="field"><label>Data de análise</label><input value="23/07/2026" disabled></div><div class="field"><label>Moeda</label><select><option>Real brasileiro (BRL)</option></select></div><div class="field"><label>Fuso horário</label><select><option>América/São Paulo</option></select></div></div><div class="form-actions"><button class="primary-btn" data-action="save-settings">Salvar preferências</button></div></div></div><div class="panel"><div class="panel-head"><h3>Dados de demonstração</h3></div><div class="panel-body"><p>Restaure obras, lançamentos e diários para o estado original do protótipo.</p><button class="secondary-btn danger-btn" data-action="reset-demo">Restaurar dados de demonstração</button></div></div></div>`;
}
function render() {
  if(chart) { chart.destroy(); chart=null; }
  const views={dashboard,lancamentos:GMUI.inbox,obras,project:projectPage,cronogramas,curva,diario,financeiro,documentos,relatorios,configuracoes:GMUI.settings};
  document.querySelector("#appContent").innerHTML=(views[route]||dashboard)();
  bind();
  requestAnimationFrame(renderChartIfNeeded);
}
function renderChartIfNeeded() {
  const canvas=document.querySelector("#mainChart"); if(!canvas||typeof Chart==="undefined") return;
  const p=route==="dashboard"?state.projects[0]:project();
  const financial=document.querySelector("#curveType")?.value==="financial";
  const s=curveSeries(p,financial);
  chart=new Chart(canvas,{type:"line",data:{labels:s.labels,datasets:[
    {label:"Planejado",data:s.plan,borderColor:"#292b2c",backgroundColor:"rgba(41,43,44,.06)",borderWidth:2.5,tension:.38,pointRadius:2},
    {label:"Realizado",data:s.actual,borderColor:"#ad8a55",backgroundColor:"rgba(173,138,85,.08)",borderWidth:2.5,tension:.38,pointRadius:3},
    {label:"Projetado",data:s.projected,borderColor:"#2e806b",borderDash:[6,5],borderWidth:2,tension:.38,pointRadius:1}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,color:"#72716d",font:{family:"Inter",size:10}}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${financial?money.format(c.raw):number.format(c.raw)+"%"}`,afterBody:ctx=>ctx.length>1&&!financial?`Desvio: ${number.format((ctx.find(x=>x.dataset.label==="Realizado")?.raw||0)-(ctx.find(x=>x.dataset.label==="Planejado")?.raw||0))} p.p.`:""}}},scales:{y:{beginAtZero:true,max:financial?undefined:100,ticks:{callback:v=>financial?`${Math.round(v/1000)} mil`:v+"%",color:"#97958f"},grid:{color:"#e9e7e1"}},x:{ticks:{color:"#97958f"},grid:{display:false}}}}});
}
function bind() {
  document.querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>navigate(b.dataset.route));
  document.querySelectorAll("[data-open-project]").forEach(b=>b.onclick=e=>{e.stopPropagation();selectedProjectId=b.dataset.openProject;projectTab="overview";navigate("project")});
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{projectTab=b.dataset.tab;render()});
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{projectView=b.dataset.view;render()});
  document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>actions(b.dataset.action));
  document.querySelectorAll(".stage-status").forEach(input=>input.onchange=()=>updateStageStatus(Number(input.dataset.index),input.value==="true"));
  const ps=document.querySelector("#projectSearch"), sf=document.querySelector("#statusFilter");
  if(ps) { const filter=()=>{const q=ps.value.toLowerCase(),s=sf.value;const items=state.projects.filter(p=>(p.name+" "+p.client+" "+p.manager).toLowerCase().includes(q)&&(!s||calc(p).status===s));document.querySelector("#projectResults").innerHTML=renderProjectResults(items);bindProjectOpen();}; ps.oninput=filter; sf.onchange=filter; }
  const ct=document.querySelector("#curveType"); if(ct) ct.onchange=renderChartIfNeeded;
}
function bindProjectOpen(){document.querySelectorAll("[data-open-project]").forEach(b=>b.onclick=e=>{e.stopPropagation();selectedProjectId=b.dataset.openProject;projectTab="overview";navigate("project")});}
function actions(action) {
  const p=project();
  if(action==="new-project") return projectModal();
  if(action==="edit-project") return projectModal(p);
  if(action==="duplicate-project"){const copy=clone(p);copy.id=p.id+"-"+Date.now();copy.name+=" — Cópia";state.projects.push(copy);saveState("Obra duplicada.");return navigate("obras");}
  if(action==="delete-project"){if(confirm(`Excluir “${p.name}”?`)){state.projects=state.projects.filter(x=>x.id!==p.id);saveState("Obra excluída.");navigate("obras");}return;}
  if(action==="show-alerts"||action==="notifications") return alertModal();
  if(action==="scenario") return scenarioModal();
  if(action==="add-cost") return costModal();
  if(action==="add-diary") return diaryModal();
  if(action==="report"){selectedProjectId="logistico";projectTab="report";return navigate("project");}
  if(action==="print") return window.print();
  if(action==="reset-demo"){if(confirm("Restaurar todos os dados de demonstração?")){state=clone(DEMO);saveState("Dados restaurados.");renderNav();render();}return;}
  if(action==="save-settings") return toast("Preferências salvas.");
  if(action==="add-activity") return toast("Use a edição direta para atualizar o cronograma.");
  if(action==="upload-doc") return toast("Documento simulado adicionado à biblioteca.");
}
function openModal(title,body) { document.querySelector("#modalTitle").textContent=title;document.querySelector("#modalBody").innerHTML=body;document.querySelector("#modalBackdrop").hidden=false;document.querySelector("#modal").hidden=false; }
function closeModal(){document.querySelector("#modalBackdrop").hidden=true;document.querySelector("#modal").hidden=true;document.querySelector("#modal").classList.remove("gm-modal-wide");GMUI.clear();}
function projectModal(p) {
  openModal(p?"Editar obra":"Nova obra",`<form id="projectForm"><div class="form-grid">
  ${field("name","Nome da obra",p?.name||"",true,"full")}${field("client","Cliente",p?.client||"",true)}${field("manager","Responsável",p?.manager||"",true)}
  ${field("location","Local",p?.location||"",true,"full")}${field("start","Data de início",p?.start||"2026-07-23",true,"","date")}${field("end","Término previsto",p?.end||"2026-12-31",true,"","date")}
  ${field("budget","Orçamento total",p?.budget||"",true,"","number")}${field("cost","Custo realizado",p?.cost||0,true,"","number")}${field("planned","Planejado (%)",p?.planned||0,true,"","number")}${field("actual","Realizado (%)",p?.actual||0,true,"","number")}
  </div><div class="form-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancelar</button><button class="primary-btn">Salvar obra</button></div></form>`);
  document.querySelector("#cancelModal").onclick=closeModal;
  document.querySelector("#projectForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),obj={id:p?.id||slug(f.get("name"))+"-"+Date.now(),name:f.get("name"),client:f.get("client"),manager:f.get("manager"),location:f.get("location"),start:f.get("start"),end:f.get("end"),budget:+f.get("budget"),cost:+f.get("cost"),planned:clamp(f.get("planned")),actual:clamp(f.get("actual")),activities:p?.activities||[]};if(p)Object.assign(p,obj);else state.projects.push(obj);saveState(p?"Obra atualizada.":"Obra criada.");closeModal();navigate("obras");};
}
function field(name,label,value,required=false,klass="",type="text"){return `<div class="field ${klass}"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${value}" ${required?"required":""}></div>`;}
function alertModal(){openModal("Central de alertas",`<div class="alert-list">${alertItems(alerts())}</div>`);}
function costModal(){
  openModal("Adicionar custo",`<form id="costForm"><div class="form-grid">${field("date","Data","2026-07-23",true,"","date")}<div class="field"><label>Categoria</label><select name="category">${["Mão de obra","Materiais","Equipamentos","Serviços contratados","Transporte","Administração","Imprevistos"].map(x=>`<option>${x}</option>`)}</select></div>${field("supplier","Fornecedor","",true)}${field("description","Descrição","",true)}${field("planned","Valor planejado","",true,"","number")}${field("actual","Valor realizado","",true,"","number")}${field("document","Documento","NF ")}<div class="field"><label>Status</label><select name="status"><option>Pago</option><option>A pagar</option></select></div></div><div class="form-actions"><button class="primary-btn">Adicionar custo</button></div></form>`);
  document.querySelector("#costForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),actual=+f.get("actual");state.financials.push({id:Date.now(),project:project().id,date:f.get("date"),category:f.get("category"),supplier:f.get("supplier"),description:f.get("description"),planned:+f.get("planned"),actual,status:f.get("status"),document:f.get("document")});project().cost+=actual;saveState("Custo adicionado e indicadores recalculados.");closeModal();renderNav();render();};
}
function diaryModal(){
  const p=project();
  openModal("Novo registro",`<form id="diaryForm"><div class="form-grid">${field("date","Data",new Date().toISOString().slice(0,10),true,"","date")}<div class="field"><label for="diaryType">Tipo</label><select id="diaryType" name="type" required><option>Recomendação ao trabalhador</option><option>Solicitação do cliente</option></select></div><div class="field full"><label for="diaryDescription">Descrição</label><textarea id="diaryDescription" name="description" required></textarea></div><div class="field full"><label for="diaryProject">Obra (opcional)</label><select id="diaryProject" name="project"><option value="">Sem obra vinculada</option>${state.projects.map(x=>`<option value="${x.id}" ${x.id===p.id?"selected":""}>${x.name}</option>`).join("")}</select></div></div><div class="form-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancelar</button><button class="primary-btn">Salvar registro</button></div></form>`);
  document.querySelector("#cancelModal").onclick=closeModal;
  document.querySelector("#diaryForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);state.diaries.unshift({id:Date.now(),date:f.get("date"),type:f.get("type"),description:f.get("description"),project:f.get("project")||null});saveState("Registro salvo.");closeModal();render();};
}
function scenarioModal() {
  const p=project(),c=calc(p);
  openModal("Simular cenário de recuperação",`<form id="scenarioForm"><div class="form-grid">${field("workers","Trabalhadores adicionais","12",true,"","number")}${field("productivity","Aumento de produtividade (%)","15",true,"","number")}${field("hours","Horas adicionais por semana","8",true,"","number")}${field("structure","Novo avanço da Estrutura (%)","58",true,"","number")}${field("installations","Novo avanço de Instalações (%)","25",true,"","number")}${field("extraCost","Custo adicional estimado","180000",true,"","number")}</div><div id="scenarioResult" class="scenario-result" style="margin-top:16px">${metric("Conclusão atual",dateFmt.format(c.projectedEnd))}${metric("Atraso atual",c.delay+" dias")}${metric("EAC atual",money.format(c.eac))}</div><div class="form-actions"><button type="button" class="secondary-btn" id="restoreScenario">Restaurar cenário original</button><button class="primary-btn">Aplicar simulação</button></div></form>`);
  document.querySelector("#restoreScenario").onclick=scenarioModal;
  document.querySelector("#scenarioForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),boost=(+f.get("productivity")/100)+(+f.get("hours")/160),newActual=clamp(p.actual+boost*12),newSpi=newActual/p.planned,newDelay=Math.max(0,Math.round(c.delay*(1-boost*1.8))),newCpi=(p.budget*newActual/100)/(p.cost+(+f.get("extraCost"))),newEac=p.budget/newCpi,newDate=new Date(new Date(p.end).getTime()+newDelay*86400000);document.querySelector("#scenarioResult").innerHTML=metric("Nova conclusão",dateFmt.format(newDate),"delta-up")+metric("Novo atraso",newDelay+" dias",newDelay<c.delay?"delta-up":"")+metric("Novo custo final",money.format(newEac))+metric("Novo SPI",number.format(newSpi),"delta-up")+metric("Novo CPI",number.format(newCpi))+metric("Ganho estimado",(c.delay-newDelay)+" dias","delta-up");toast("Cenário recalculado sem alterar os dados originais.");};
}
function updateActivity(i,value) {
  const p=project();p.activities[i][8]=clamp(value);
  const weightedActual=p.activities.reduce((s,a)=>s+a[6]*a[8]/100,0), weightedPlan=p.activities.reduce((s,a)=>s+a[6]*a[7]/100,0);
  p.actual=Math.round(weightedActual*100)/100;p.planned=Math.round(weightedPlan*100)/100;
  saveState("Cronograma e indicadores atualizados.");renderNav();render();
}
function updateStageStatus(i,done) {
  project().activities[i][9]=Boolean(done);
  saveState("Situação da etapa atualizada.");
  render();
}
function toast(text){const el=document.createElement("div");el.className="toast";el.textContent=text;document.querySelector("#toastRegion").append(el);setTimeout(()=>el.remove(),3200);}
function presentation() {
  const p=state.projects.find(x=>x.id==="logistico"),c=calc(p);
  const slides=[
    ["PORTFÓLIO","Controle total das obras em uma única visão","Indicadores físicos, financeiros e operacionais atualizados para decisões rápidas.",[["3","obras ativas"],[money.format(8020000),"valor contratado"],["50,3%","avanço médio"]]],
    ["OBRA EM FOCO",p.name,`${p.client} · ${p.location}`,[["68%","planejado"],["54%","realizado"],["−14 p.p.","desvio"]]],
    ["CURVA S","O atraso está visível antes de virar surpresa","A curva realizada perdeu aderência ao planejamento a partir da fase de fundações.",[["0,79","SPI"],["35 dias","atraso projetado"],["15/10/2026","prazo contratual"]]],
    ["CAUSA RAIZ","Estrutura e Instalações concentram o desvio","A leitura por WBS orienta o plano de recuperação para as frentes com maior impacto.",[["−23 p.p.","Estrutura"],["−13 p.p.","Instalações"],["50%","peso combinado"]]],
    ["VALOR AGREGADO","Prazo e custo na mesma linguagem","O projeto produz menos valor do que o planejado e apresenta pressão financeira.",[[number.format(c.spi),"SPI"],[number.format(c.cpi),"CPI"],[money.format(c.eac),"EAC"]]],
    ["RECUPERAÇÃO","Um cenário viável pode recuperar parte do prazo","Reforço seletivo da equipe, jornada estendida e foco nas frentes estruturais.",[["+12","trabalhadores"],["+15%","produtividade"],["−18 dias","ganho potencial"]]],
    ["RELATÓRIO EXECUTIVO","Da operação à diretoria, sem retrabalho","Curva S, riscos, projeções e ações recomendadas reunidos em um relatório pronto para decisão.",[["1 clique","geração"],["PDF","pronto para reunião"],["Local","dados persistentes"]]]
  ];
  const s=slides[presentationStep];
  document.querySelector("#presentation").innerHTML=`<div class="presentation-stage"><div class="presentation-top"><strong>ObraFlow Control</strong><span>${presentationStep+1} / ${slides.length}</span></div><div class="presentation-progress"><span style="width:${(presentationStep+1)/slides.length*100}%"></span></div><div class="slide"><div class="slide-inner"><span class="eyebrow">${s[0]}</span><h2>${s[1]}</h2><p>${s[2]}</p><div class="slide-stats">${s[3].map(x=>`<div class="slide-stat"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join("")}</div></div></div><div class="presentation-nav"><button class="secondary-btn" id="presExit">Sair da apresentação</button><div class="actions"><button class="secondary-btn" id="presPrev" ${presentationStep===0?"disabled":""}>Anterior</button><button class="primary-btn" id="presNext">${presentationStep===slides.length-1?"Concluir":"Próximo"}</button></div></div></div>`;
  document.querySelector("#presExit").onclick=()=>document.querySelector("#presentation").hidden=true;
  document.querySelector("#presPrev").onclick=()=>{presentationStep=Math.max(0,presentationStep-1);presentation();};
  document.querySelector("#presNext").onclick=()=>{if(presentationStep===slides.length-1){document.querySelector("#presentation").hidden=true;presentationStep=0;}else{presentationStep++;presentation();}};
}
document.querySelector("#sidebarToggle").onclick=()=>{const s=document.querySelector("#sidebar");s.classList.toggle("collapsed");document.querySelector("#sidebarToggle").textContent=s.classList.contains("collapsed")?"›":"‹";};
document.querySelector("#mobileMenu").onclick=()=>document.querySelector("#sidebar").classList.toggle("open");
document.querySelector("#modalClose").onclick=closeModal;
document.querySelector("#modalBackdrop").onclick=closeModal;
document.querySelector("#notificationsBtn").onclick=alertModal;
document.querySelector("#presentationBtn").onclick=()=>{presentationStep=0;document.querySelector("#presentation").hidden=false;presentation();};
document.querySelector("#globalSearch").onkeydown=e=>{if(e.key==="Enter"){route="obras";renderNav();render();requestAnimationFrame(()=>{const q=document.querySelector("#projectSearch");if(q){q.value=e.target.value;q.dispatchEvent(new Event("input"));}});}};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();document.querySelector("#presentation").hidden=true;}});

function showApplication() {
  document.querySelector("#loginScreen").hidden = true;
  document.querySelector("#appShell").hidden = false;
}
function showLogin() {
  document.querySelector("#appShell").hidden = true;
  document.querySelector("#loginScreen").hidden = false;
  document.querySelector("#loginPassword").value = "";
  document.querySelector("#loginError").hidden = true;
  document.querySelector("#loginUser").focus();
}
// Com o Supabase ligado (config.js), o login é o de verdade. Sem ele, vale o acesso de demonstração.
const DEMO_LOGINS = { gerson: "1234", gmarcola: "gmarcola" };
document.querySelector("#loginForm").onsubmit = async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const user = String(form.get("user")).trim().toLowerCase();
  const password = String(form.get("password"));
  let ok;
  try { ok = GMData.remote ? await GMData.signIn(user, password) : DEMO_LOGINS[user] === password; }
  catch { ok = false; }
  if (ok) {
    sessionStorage.setItem("obraflow-authenticated", "true");
    if (form.get("remember")) localStorage.setItem("obraflow-remember-login", "true");
    else localStorage.removeItem("obraflow-remember-login");
    document.querySelector("#loginError").hidden = true;
    showApplication();
    toast(`${greeting()}. Bem-vindo ao ObraFlow.`);
  } else {
    document.querySelector("#loginError").hidden = false;
    document.querySelector("#loginPassword").select();
  }
};
document.querySelector("#passwordToggle").onclick = () => {
  const input = document.querySelector("#loginPassword");
  input.type = input.type === "password" ? "text" : "password";
  document.querySelector("#passwordToggle").setAttribute("aria-label", input.type === "password" ? "Mostrar senha" : "Ocultar senha");
};
document.querySelector("#forgotPassword").onclick = () => {
  toast(GMData.remote ? "Peça ao administrador para redefinir a sua senha." : "Neste protótipo, use gerson e a senha 1234.");
};
document.querySelector("#profileBtn").onclick = () => {
  if (confirm("Deseja encerrar sua sessão?")) {
    sessionStorage.removeItem("obraflow-authenticated");
    localStorage.removeItem("obraflow-remember-login");
    GMData.signOut();
    showLogin();
  }
};

renderNav();
render();
if (GMData.remote) {
  // Com o banco ligado, quem decide é a sessão do Supabase.
  showLogin();
  GMData.hasSession().then(active => { if (active) showApplication(); }).catch(() => {});
} else if (sessionStorage.getItem("obraflow-authenticated") === "true" || localStorage.getItem("obraflow-remember-login") === "true") {
  showApplication();
} else {
  showLogin();
}
document.querySelector("#syncMode").textContent = GMData.remote ? "Banco de dados conectado" : "Modo demonstração";
document.querySelector("#demoAccess").hidden = GMData.remote;

