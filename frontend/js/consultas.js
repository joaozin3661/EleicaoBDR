/* Consultas: uma tela por pergunta. Cada pergunta declara seus filtros e como montar a tela a partir das
   respostas das views (dados.js). O endereço guarda a pergunta e os filtros (#q5?ano=2022&...), então
   qualquer tela pode ser compartilhada por link. */

const { resposta, arquivo, qs } = window.Dados;
const H = window.Hemiciclo;

/* ---------- formatos ---------- */
const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = {
  int: (v) => (v == null ? "—" : nf(0).format(v)),
  pct: (v, d = 1) => (v == null ? "—" : `${nf(d).format(v)}%`),
  dec: (v, d = 1) => (v == null ? "—" : nf(d).format(v)),
  brl: (v) => (v == null ? "—" : `R$ ${nf(0).format(v)}`),
  brlCurto: (v) => {
    if (v == null) return "—";
    if (Math.abs(v) >= 1e9) return `R$ ${nf(2).format(v / 1e9)} bi`;
    if (Math.abs(v) >= 1e6) return `R$ ${nf(1).format(v / 1e6)} mi`;
    if (Math.abs(v) >= 1e4) return `R$ ${nf(1).format(v / 1e3)} mil`;
    return `R$ ${nf(0).format(v)}`;
  },
  corr: (v) => (v == null ? "—" : nf(2).format(v)),
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Em)\b/g, (w) => w.toLowerCase()).replace(/(^|\s)(?!Dr\b)([B-DF-HJ-NP-TV-Z][b-df-hj-np-tv-z]{1,3})(?=\s|$)/g, (m, a, w) => a + w.toUpperCase());
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const UFS = ["TODAS", ...window.UFs.LISTA];
const NOME_UF = { TODAS: window.UFs.TODAS, ...window.UFs.NOME };
const cargoTxt = (c) => titulo(c).replace("Deputado Federal", "Deputado federal").replace("Deputado Estadual", "Deputado estadual").replace("Deputado Distrital", "Deputado distrital");
const parTxt = (p) => `${p.ano} · ${cargoTxt(p.cargo)}`;
const DO_UF = window.UFs.DO;
const EM_UF = window.UFs.EM;
const ufTxt = (u) => (u === "TODAS" ? window.UFs.EM_TODAS : EM_UF[u]);

/* ---------- blocos de tela ---------- */
function kpis(itens) {
  return `<div class="kpis" style="--n:${itens.length}">${itens.map((k) => `
    <div class="kpi${k.lider ? " lider" : ""}${k.texto ? " kpi--texto" : ""}"><span>${k.rot}</span><b>${k.val}${k.uni ? ` <small>${k.uni}</small>` : ""}</b></div>`).join("")}</div>`;
}
/* Os dados de cada bloco, para "Ver tabela" e "Baixar CSV": { nome, cols: [[título, linha => texto]], linhas }.
   A lista recomeça a cada tela (vai()). */
let dadosDosPaineis = [];
function painel({ titulo: t, sub, span = 12, corpo, id, dados }) {
  let pe = "";
  if (dados?.linhas?.length) {
    const i = dadosDosPaineis.push(dados) - 1;
    pe = `<p class="ferr"><button type="button" data-ferr="tabela" data-i="${i}" aria-expanded="false">Ver tabela</button><button type="button" data-ferr="csv" data-i="${i}">Baixar CSV</button><a href="#sql-t">Ver SQL</a></p><div class="ferr__tabela" hidden></div>`;
  }
  return `<section class="painel${span < 12 ? ` s${span}` : ""}"${id ? ` id="${id}"` : ""}>
    <h2>${t}</h2>${sub ? `<p>${sub}</p>` : ""}<div class="painel__corpo">${corpo}</div>${pe}</section>`;
}
const semTags = (h) => String(h ?? "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
function ferramenta(botao) {
  const d = dadosDosPaineis[Number(botao.dataset.i)];
  if (!d) return;
  if (botao.dataset.ferr === "tabela") {
    const caixa = botao.closest(".painel").querySelector(".ferr__tabela");
    if (!caixa.innerHTML) caixa.innerHTML = tabela(d.cols.map(([t, f, num]) => ({ t, f, num })), d.linhas);
    caixa.hidden = !caixa.hidden;
    botao.setAttribute("aria-expanded", String(!caixa.hidden));
    botao.textContent = caixa.hidden ? "Ver tabela" : "Esconder tabela";
    return;
  }
  /* CSV com ponto e vírgula e BOM, como o Excel em português espera */
  const celula = (v) => `"${semTags(v).replace(/"/g, '""')}"`;
  const texto = [d.cols.map(([t]) => celula(t)).join(";"), ...d.linhas.map((l) => d.cols.map(([, f]) => celula(f(l))).join(";"))].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }));
  a.download = `${d.nome}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* escala "redonda" para um eixo: o menor teto entre 1, 2, 2,5 e 5 vezes uma potência de 10 */
function teto(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 10].map((k) => k * p).find((t) => t >= v);
}
/** Colunas em pé: linhas = [{ rot, sub, v, txt, forte }]; ref = { v, txt } desenha a linha tracejada de comparação. */
function colunas(linhas, { ref, eixo = (v) => fmt.pct(v, Number.isInteger(v) ? 0 : 1) } = {}) {
  const max = teto(Math.max(...linhas.map((l) => l.v ?? 0), ref?.v ?? 0) * 1.12);
  const marcas = [0, 0.2, 0.4, 0.6, 0.8, 1].map((k) => Math.round(k * max * 100) / 100);
  return `<div class="colunas" style="--n:${linhas.length}">
    <div class="colunas__area">
      ${marcas.map((m) => `<span class="colunas__grade" style="bottom:${(m / max) * 100}%"><em>${eixo(m)}</em></span>`).join("")}
      ${ref ? `<span class="colunas__ref" style="bottom:${(ref.v / max) * 100}%"><em>${ref.txt}</em></span>` : ""}
      ${linhas.map((l, i) => `<div class="coluna${l.forte ? " forte" : ""}${l.apagada ? " apagada" : ""}" style="--h:${(((l.v ?? 0) / max) * 100).toFixed(2)}%;--i:${i}"><b class="num">${l.txt}</b><i></i></div>`).join("")}
    </div>
    <div class="colunas__rots">${linhas.map((l) => `<span>${l.rot}${l.sub ? `<small>${l.sub}</small>` : ""}</span>`).join("")}</div>
  </div>`;
}
/** Funil em três barras de 100%: etapas = [{ rot, sub, partes: [{ id, pct }] }], na mesma ordem de partes.
    A parte em destaque fica em cobalto e uma fita a liga de uma barra à seguinte; o número à direita é a parte dela. */
function funil(etapas, { cores, destaque }) {
  const W = 1000, X0 = 230, X1 = 870, BH = 50, PASSO = 118, H = PASSO * (etapas.length - 1) + BH;
  const faixa = (e) => { let acc = 0; return e.partes.map((p) => { const x0 = X0 + (acc / 100) * (X1 - X0); acc += p.pct; return { ...p, x0, x1: X0 + (Math.min(acc, 100) / 100) * (X1 - X0) }; }); };
  const linhas = etapas.map(faixa);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Parte de cada grau de escolaridade em cada etapa">`;
  linhas.forEach((ps, i) => {
    const y = i * PASSO, d = ps.find((p) => p.id === destaque), prox = linhas[i + 1]?.find((p) => p.id === destaque);
    if (d && prox) { const y1 = y + BH, y2 = y + PASSO, m = (y1 + y2) / 2; svg += `<path class="funil__fita" d="M${d.x0},${y1}C${d.x0},${m} ${prox.x0},${m} ${prox.x0},${y2}L${prox.x1},${y2}C${prox.x1},${m} ${d.x1},${m} ${d.x1},${y1}Z"/>`; }
    ps.forEach((p, k) => { if (p.x1 - p.x0 > 0.05) svg += `<rect class="funil__parte${p.id === destaque ? " is-on" : ""}" data-id="${esc(p.id)}" x="${p.x0.toFixed(1)}" y="${y}" width="${Math.max(0.6, p.x1 - p.x0 - 1.5).toFixed(1)}" height="${BH}" fill="${p.id === destaque ? "var(--accent)" : cores[k]}"><title>${esc(p.nome)}: ${fmt.pct(p.pct)}</title></rect>`; });
    svg += `<text class="funil__rot" x="0" y="${y + 22}">${etapas[i].rot}</text><text class="funil__sub" x="0" y="${y + 42}">${etapas[i].sub}</text>`;
    svg += `<text class="funil__num" x="${W}" y="${y + 38}" text-anchor="end">${fmt.pct(d?.pct ?? 0, 0)}</text>`;
  });
  return `<div class="funil">${svg}</svg></div>`;
}
/** Halteres: em cada linha, dois marcadores na mesma régua (a = laranja, b = cobalto) ligados por um traço.
    grupos = [{ titulo, linhas: [{ rot, a, b, v, atual }] }]; v vai no data-v do botão da linha. */
function halteres(grupos, { max, nome = "par", unidade = "%", rotulo = "3rem" }) {
  const marcas = [0, 0.2, 0.4, 0.6, 0.8, 1].map((k) => Math.round(k * max * 100) / 100);
  const x = (v) => `${((Math.min(v, max) / max) * 100).toFixed(2)}%`;
  const val = (v, d = 1) => (unidade === "%" ? fmt.pct(v, d) : fmt.dec(v, d));
  const tag = nome ? "button" : "div";
  return `<div class="halteres" style="--rot:${rotulo}">${grupos.map((g) => `<div class="halteres__grupo"><h3>${g.titulo}</h3>
    <div class="halteres__eixo" aria-hidden="true">${marcas.map((m) => `<span style="left:${x(m)}">${val(m, Number.isInteger(m) ? 0 : 1)}</span>`).join("")}</div>
    ${g.linhas.map((l) => `<${tag}${nome ? ` type="button" data-nome="${nome}" data-v="${esc(l.v)}" aria-pressed="${!!l.atual}"` : ""} class="haltere${l.atual ? " is-atual" : ""}${l.b < l.a ? " desce" : ""}">
      <span class="haltere__rot num">${l.rot}</span>
      <span class="haltere__trilho">${marcas.map((m) => `<s style="left:${x(m)}"></s>`).join("")}<u style="left:${x(Math.min(l.a, l.b))};width:calc(${x(Math.max(l.a, l.b))} - ${x(Math.min(l.a, l.b))})"></u><i class="a" style="left:${x(l.a)}"></i><i class="b" style="left:${x(l.b)}"></i></span>
      <span class="haltere__val num">${val(l.a)} → <b>${val(l.b)}</b></span></${tag}>`).join("")}</div>`).join("")}</div>`;
}
/** Lista de barras: rótulo, trilho e valor. A largura é valor / maior valor. */
function barras(linhas, { forte } = {}) {
  const max = Math.max(...linhas.map((l) => l.v), 0) || 1;
  return `<div class="barras">${linhas.map((l, i) => `
    <div class="barra${forte && forte(l) ? " forte" : ""}" style="--w:${((l.v / max) * 100).toFixed(1)}%;--i:${i}">
      <span class="rot">${l.rot}${l.sub ? `<small>${l.sub}</small>` : ""}</span>
      <span class="trilho"><i></i></span>
      <span class="val">${l.txt}${l.extra ? `<small>${l.extra}</small>` : ""}</span>
    </div>`).join("")}</div>`;
}
function tabela(cols, linhas) {
  if (!linhas.length) return `<p class="vazio">Nenhuma linha para esses filtros.</p>`;
  return `<div class="tabela-wrap"><table><thead><tr>${cols.map((c) => `<th${c.num ? ' class="num"' : ""}>${c.t}</th>`).join("")}</tr></thead>
    <tbody>${linhas.map((l) => `<tr>${cols.map((c) => { const v = c.f(l); return `<td class="${c.num ? "num" : ""}${v === "—" ? " traco" : ""}">${v}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
}
/* miniatura da foto do candidato (registro no TSE, de 2018 em diante); some se o arquivo faltar */
const foto = (idc, alt, classe = "foto-p") => (idc ? `<img class="${classe}" src="fotos/${idc}.webp" alt="${esc(alt)}" width="161" height="225" loading="lazy" onerror="this.remove()">` : "");
const chave = (itens) => `<p class="chave">${itens.map(([cor, t]) => `<span><i style="background:${cor}"></i>${t}</span>`).join("")}</p>`;

/* ---------- controles de filtro ---------- */
const F = {
  select: (nome, rot, opcoes) => ({ nome, rot, tipo: "select", opcoes }),
  seg: (nome, rot, opcoes) => ({ nome, rot, tipo: "seg", opcoes }),
  uf: () => F.select("uf", "Estado", UFS.map((u) => ({ v: u, t: NOME_UF[u] }))),
};
/* Eleição e cargo andam juntos (o par ano|cargo que a view respondeu), mas aparecem como dois grupos de botões.
   O ano manda: todo ano pode ser escolhido, e o grupo de cargos mostra só os cargos disputados naquele ano.
   Ao trocar para um ano sem o cargo atual (de eleição geral para municipal, por exemplo), o cargo passa a ser
   o mais comum daquele ano. Assim não existe combinação que a tela não saiba responder. */
/* Q7: "CARGO v; CARGO v" (vies_por_cargo das views) vira [{ cargo, v }] */
const cargosQ7 = (x) => String(x?.vies_por_cargo ?? "").split("; ").filter(Boolean).map((c) => { const k = c.lastIndexOf(" "); return { cargo: c.slice(0, k), v: Number(c.slice(k + 1)) }; });
const CARGOS_2T = ["PRESIDENTE", "GOVERNADOR", "PREFEITO"]; // Q7: os cargos com 2º turno
const ORDEM_CARGO = ["PRESIDENTE", "GOVERNADOR", "SENADOR", "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL", "DEPUTADO DISTRITAL", "PREFEITO", "VEREADOR"];
function gruposDoPar(d, atual) {
  const [anoTxt, cargo] = String(atual).split("|"), ano = Number(anoTxt);
  const tem = (a, c) => d.pares.some((p) => p.ano === a && p.cargo === c);
  const anos = [...new Set(d.pares.map((p) => p.ano))].sort();
  const cargos = d.pares.filter((p) => p.ano === ano).map((p) => p.cargo).sort((a, b) => ORDEM_CARGO.indexOf(a) - ORDEM_CARGO.indexOf(b));
  const cargoDe = (a) => (tem(a, cargo) ? cargo : ["DEPUTADO FEDERAL", "VEREADOR"].find((c) => tem(a, c)) ?? d.pares.find((p) => p.ano === a).cargo);
  const botao = (v, t, ligado) => `<button type="button" data-nome="par" data-v="${esc(v)}" aria-pressed="${ligado}">${esc(t)}</button>`;
  return `<div class="campo"><span id="rot-ano">Eleição</span><div class="seg" role="group" aria-labelledby="rot-ano">${anos.map((a) => botao(`${a}|${cargoDe(a)}`, a, a === ano)).join("")}</div></div>
    <div class="campo"><span id="rot-cargo">Cargo em ${ano}</span><div class="seg" role="group" aria-labelledby="rot-cargo">${cargos.map((c) => botao(`${ano}|${c}`, cargoTxt(c), c === cargo)).join("")}</div></div>`;
}
function desenhaFiltros(defs, valores, aoMudar) {
  const form = document.getElementById("filtros");
  const ops = (d) => (typeof d.opcoes === "function" ? d.opcoes(valores) : d.opcoes);
  const grupo = (d) => `<div class="campo"><span id="rot-${d.nome}">${d.rot}</span><div class="seg" role="group" aria-labelledby="rot-${d.nome}">${ops(d).map((o) => `<button type="button" data-nome="${d.nome}" data-v="${esc(o.v)}" aria-pressed="${String(o.v) === String(valores[d.nome])}">${esc(o.t)}</button>`).join("")}</div></div>`;
  form.innerHTML = defs.map((d) => {
    if (d.mostra && !d.mostra(valores)) return "";
    if (d.tipo === "par") return gruposDoPar(d, valores.par);
    if (d.tipo === "seg" || (d.tipo === "select" && ops(d).length <= 10)) return grupo(d);
    if (d.tipo === "select") return `<label class="campo"><span>${d.rot}</span><select name="${d.nome}">${ops(d).map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(valores[d.nome]) ? " selected" : ""}>${esc(o.t)}</option>`).join("")}</select></label>`;
    return d.html;
  }).join("");
  form.onchange = (e) => { if (e.target.name) aoMudar(e.target.name, e.target.value); };
  form.onclick = (e) => { const b = e.target.closest("button[data-nome]"); if (b && b.getAttribute("aria-pressed") !== "true") aoMudar(b.dataset.nome, b.dataset.v); };
  form.onsubmit = (e) => e.preventDefault();
}

/* ---------- as perguntas ---------- */
/* telas do banco: as 14 tabelas e os casos reais da resolução de identidade */
const TABELAS = [
  { tabela: "municipio", desc: "Municípios das 27 UFs, com código IBGE e TSE", questoes: "todas" },
  { tabela: "eleicao", desc: "Pleitos de 2002 a 2026", questoes: "todas" },
  { tabela: "partido", desc: "Legendas pelo número", questoes: "todas" },
  { tabela: "pessoa", desc: "Políticos com identidade resolvida", questoes: "todas" },
  { tabela: "candidatura", desc: "Uma linha por candidato por pleito", questoes: "todas" },
  { tabela: "vaga", desc: "Cadeiras em disputa (2018–2026)", questoes: "Q1, Q5" },
  { tabela: "despesa", desc: "Despesas contratadas (2018–2024)", questoes: "Q1, Q9" },
  { tabela: "bem_declarado", desc: "Patrimônio declarado", questoes: "Q2" },
  { tabela: "receita", desc: "Receitas de campanha", questoes: "Q8" },
  { tabela: "votacao", desc: "Votos nominais por município", questoes: "Q3–Q7" },
  { tabela: "votacao_legenda", desc: "Votos de legenda", questoes: "Q5" },
  { tabela: "eleitorado", desc: "Perfil do eleitorado", questoes: "Q3, Q4, Q6" },
  { tabela: "totalizacao_municipio", desc: "Abstenção, brancos e nulos", questoes: "Q3" },
  { tabela: "indicador_municipal", desc: "PIB, população, IDHM", questoes: "Q3, Q6" },
];
const CASOS = [
  {
    id: "tamboara", aba: "Um título, várias pessoas", titulo: "037697100620",
    texto: "Em Tamboara (PR), 2004, três vereadores eleitos aparecem com o mesmo título: o de ARNALDO ALVES DOS SANTOS, que o usa de 2004 a 2016. EDSON CATHCART veio ainda com o CPF de ANTONIO CAUNETO FILHO. Se o título fosse a chave, os três virariam uma pessoa só. A carga separa porque nome e nascimento não batem, e o EDSON aparece com o título verdadeiro dele de 2008 em diante, já ligado à mesma pessoa.",
  },
  {
    id: "manoel", aba: "Uma pessoa, dois títulos", titulo: "000217462143",
    texto: "Em 2002 o título veio com os dígitos deslocados (000217462143 em vez de 002174462143). Pelo título seriam duas pessoas: um suplente de deputado e um prefeito eleito duas vezes. O CPF, igual nos três registros, une a carreira.",
  },
  {
    id: "jessica", aba: "Mudança de nome", titulo: "058842961392",
    texto: "Mesmo título, CPF e nascimento, com o nome mudando entre as eleições. A pessoa guarda o nome mais recente, e a busca da Q10 encontra qualquer um dos nomes usados.",
  },
];

const PARES_Q5 =[[2018, "DEPUTADO FEDERAL"], [2018, "DEPUTADO ESTADUAL"], [2020, "VEREADOR"], [2022, "DEPUTADO FEDERAL"], [2022, "DEPUTADO ESTADUAL"], [2024, "VEREADOR"], [2026, "DEPUTADO FEDERAL"], [2026, "DEPUTADO ESTADUAL"]];
const parSel = (pares) => ({ nome: "par", tipo: "par", pares });
const dePar = (f) => { const [ano, cargo] = f.par.split("|"); return { ano: Number(ano), cargo }; };
async function pares(url) { return (await resposta(url)).dados; }

/* cadeiras de uma casa, uma linha por eleito (vw_site_cadeira, dados/site/cadeiras_<ano>_<cargo>_<uf>.json) */
const COL_CADEIRA = ["cod_ibge", "municipio", "id_candidatura", "id_pessoa", "nome_urna", "partido", "votos", "posicao_votos", "vagas", "quociente", "pct_do_quociente", "por_legenda", "fora_dos_mais_votados"];
const CAPITAL = { AL: 2704302, PA: 1501402, PB: 2507507, PR: 4106902, SC: 4205407, SE: 2800308 };
async function cadeirasCasa(ano, cargo, uf) {
  const f = await arquivo(`site/cadeiras_${ano}_${cargo.replace(/ /g, "_")}_${uf}.json`);
  return f.linhas.map((l) => Object.fromEntries(COL_CADEIRA.map((c, i) => [c, l[i]])));
}
/* o mapa em pé (relevo.js) com o botão Plano / Em pé; a escolha vale para todas as perguntas até recarregar */
let vistaPe = false; // o mapa abre no plano; "Em pé" fica a um clique
/* uf: o estado escolhido; com ele, aparece o botão que volta ao Brasil */
const mapaRelevo = (id, nota, uf = "TODAS") => `<div class="vista">${uf !== "TODAS" ? `<button type="button" class="vista__volta" data-volta="${id}">← Brasil</button>` : ""}<div class="seg" role="group" aria-label="Vista do mapa" data-vista="${id}"><button type="button" data-pe="0" aria-pressed="${!vistaPe}">Plano</button><button type="button" data-pe="1" aria-pressed="${vistaPe}">Em pé</button></div><span class="vista__nota">${nota}</span></div><div id="${id}"></div>`;
async function ligaRelevo(id, opcoes) {
  const volta = document.querySelector(`[data-volta="${id}"]`);
  if (volta) volta.onclick = () => mudou("uf", "TODAS");
  const ctl = await window.Relevo.monta(document.getElementById(id), { ...opcoes, emPe: vistaPe });
  const seg = document.querySelector(`[data-vista="${id}"]`);
  if (!ctl || !seg) return;
  seg.onclick = (e) => {
    const b = e.target.closest("button[data-pe]");
    if (!b) return;
    vistaPe = b.dataset.pe === "1";
    seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    ctl.modo(vistaPe);
  };
}
const painelMapa = (sub) => painel({ titulo: "Município por município", sub, corpo: `<div class="mapa-q" id="mapa-q"></div>` });
const ligaMapa = (camada, uf) => window.Mapa?.monta(document.getElementById("mapa-q"), { camada, uf });
const nomeMun = (s) => String(s ?? "").replace(/(?<=\s)(Do|Da|De|Dos|Das|E)(?=\s)/g, (p) => p.toLowerCase());
function fichaCadeira(p, m, comCarreira) {
  const pct = Math.min(m.pct_do_quociente, 200);
  const sozinho = !m.por_legenda;
  return `<div class="ficha-q__topo">${foto(m.id_candidatura, `Foto de ${titulo(m.nome_urna)} no registro da candidatura`, "foto-g")}
      <div><p class="ficha-q__nome">${esc(titulo(m.nome_urna))}</p><p class="ficha-q__partido"><i style="background:${p.cor}"></i>${esc(m.partido)}${m.municipio ? ` · ${esc(nomeMun(m.municipio))}` : ""}</p></div></div>
    <dl class="ficha-q__dados num">
      <dt>Votos</dt><dd>${fmt.int(m.votos)}</dd>
      <dt>Quociente eleitoral</dt><dd>${fmt.int(m.quociente)}</dd>
      <dt>Do quociente</dt><dd>${fmt.pct(m.pct_do_quociente)}</dd>
      <dt>Posição nos votos</dt><dd>${m.posicao_votos}º de ${m.vagas} vagas</dd>
    </dl>
    <div class="ficha-q__quoc" aria-hidden="true"><i style="width:${(pct / 200) * 100}%"></i><b></b></div>
    <span class="ficha-q__selo${sozinho ? " sozinho" : ""}">${sozinho ? "Atingiu o quociente sozinho" : m.fora_dos_mais_votados ? "Entrou com menos votos que um derrotado" : "Eleito pela soma do partido"}</span>
    ${comCarreira ? `<a class="ficha-q__link" href="#q10?id=${m.id_pessoa}">Ver a carreira</a>` : ""}`;
}

const PERGUNTAS = {
  q1: {
    n: 1, titulo: "Quanto custa uma cadeira",
    async filtros() {
      // presidente: o arquivo de vagas do TSE não traz a vaga; a view conta uma por eleição (só 2018 e 2022 têm contas)
      const p = await pares("/api/q1/opcoes");
      return { defs: [parSel(p), F.uf(), F.seg("zero", "Quem não declarou gasto", [{ v: "true", t: "Conta como zero" }, { v: "false", t: "Fica de fora" }])], inicial: { par: "2022|DEPUTADO FEDERAL", uf: "TODAS", zero: "true" } };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      // presidente é eleito no país inteiro: não há recorte por estado nem por cidade
      const nacional = cargo === "PRESIDENTE";
      if (nacional) f = { ...f, uf: "TODAS" };
      const [custo, el] = await Promise.all([resposta("/api/q1/custo-cadeira"), resposta(`/api/q1/eleitos?${qs({ ano, cargo, uf: f.uf, suplentes: true, zero: f.zero })}`)]);
      const linhas = custo.dados.filter((r) => r.ano === ano && r.cargo === cargo).sort((a, b) => b.custo_por_cadeira - a.custo_por_cadeira);
      const alvo = f.uf === "TODAS" ? linhas : linhas.filter((r) => r.uf === f.uf);
      const g = alvo.reduce((s, r) => s + r.gasto_total, 0), c = alvo.reduce((s, r) => s + r.cadeiras, 0), n = alvo.reduce((s, r) => s + r.candidatos, 0);
      const [ele, nao] = [el.dados.find((r) => r.resultado.startsWith("ELEITO")), el.dados.find((r) => !r.resultado.startsWith("ELEITO"))];
      const vezes = ele && nao && nao.mediana > 0 ? ele.mediana / nao.mediana : null;
      const municipal = cargo === "VEREADOR" || cargo === "PREFEITO";
      return {
        achado: `Cada cadeira de ${cargoTxt(cargo).toLowerCase()} custou <b>${fmt.brl(c ? g / c : null)}</b> ${ufTxt(f.uf)} em ${ano}${vezes ? `, e o eleito típico gastou <b>${fmt.dec(vezes)} vezes</b> o que gastou o derrotado típico` : ""}.`,
        sql: [custo.sql.replace("ORDER BY", `-- filtrado na tela: ano = ${ano} AND cargo = '${cargo}'\nORDER BY`), el.sql],
        html: kpis([
          { rot: `Custo por cadeira ${ufTxt(f.uf)}`, val: fmt.brlCurto(c ? g / c : null), lider: true },
          { rot: "Gasto total das campanhas", val: fmt.brlCurto(g) },
          { rot: "Cadeiras em disputa", val: fmt.int(c) },
          { rot: "Candidatos por cadeira", val: fmt.dec(c ? n / c : null) },
        ]) + (nacional ? painel({
          titulo: "Uma cadeira para o país inteiro", sub: "Presidente é eleito no Brasil todo, por isso não há preço por estado nem por cidade. O custo é o gasto de todas as campanhas a presidente dividido por uma vaga.",
          corpo: barras(custo.dados.filter((r) => r.cargo === cargo).sort((a, b) => a.ano - b.ano).map((r) => ({ rot: String(r.ano), sub: `${fmt.int(r.candidatos)} candidatos`, v: r.custo_por_cadeira, txt: fmt.brlCurto(r.custo_por_cadeira), ano: r.ano })), { forte: (l) => l.ano === ano }),
        }) : painel({
          titulo: `O preço da cadeira de ${cargoTxt(cargo).toLowerCase()}, estado a estado`, sub: f.uf === "TODAS" ? "Gasto de todos os candidatos do cargo dividido pelas vagas. Clique num estado para escolhê-lo." : "Gasto de todos os candidatos do cargo dividido pelas vagas. Clique no estado de novo, ou em Brasil, para voltar ao país.", span: 7,
          corpo: mapaRelevo("q1-mapa", "Em pé, a altura é o custo por cadeira.", f.uf) + `<p class="escala"><span>${fmt.brlCurto(linhas.at(-1)?.custo_por_cadeira)}</span><i></i><span>${fmt.brlCurto(linhas[0]?.custo_por_cadeira)}</span></p>`,
        }) + (municipal && f.uf !== "TODAS" ? painel({
          titulo: `As cidades ${DO_UF[f.uf]}, da mais cara à mais barata`, sub: `Custo por cadeira de ${cargoTxt(cargo).toLowerCase()} em ${ano}, município a município.`, span: 5,
          corpo: `<div class="barras--justa rolagem" id="q1-cidades"><p class="muted">Carregando as cidades…</p></div>`,
        }) : painel({
          titulo: "Do mais caro ao mais barato", sub: f.uf !== "TODAS" && !municipal ? `Custo por cadeira em cada estado. Para ${cargoTxt(cargo).toLowerCase()}, a disputa é o estado inteiro, por isso não há preço por cidade.` : "Custo por cadeira e a disputa em cada estado.", span: 5,
          corpo: `<div class="barras--justa rolagem">${barras(linhas.map((r) => ({ rot: NOME_UF[r.uf], sub: `${fmt.int(r.candidatos)} candidatos, ${fmt.int(r.cadeiras)} ${r.cadeiras === 1 ? "cadeira" : "cadeiras"}`, v: r.custo_por_cadeira, txt: fmt.brlCurto(r.custo_por_cadeira), uf: r.uf })), { forte: (l) => f.uf === "TODAS" || l.uf === f.uf })}</div>`,
          dados: { nome: `q1_custo_${ano}_${cargo}`.replace(/ /g, "_"), linhas, cols: [["Estado", (r) => NOME_UF[r.uf]], ["UF", (r) => r.uf], ["Candidatos", (r) => fmt.int(r.candidatos), 1], ["Cadeiras", (r) => fmt.int(r.cadeiras), 1], ["Gasto total", (r) => fmt.brl(r.gasto_total), 1], ["Custo por cadeira", (r) => fmt.brl(r.custo_por_cadeira), 1]] },
        }))) + painel({
          titulo: "Quem ganhou gastou quanto?", sub: `Gasto por candidato ${ufTxt(f.uf)}. Não eleitos inclui os suplentes.`,
          corpo: (ele && nao ? `<div class="duelo"><div><span>Eleito típico</span><b class="num">${fmt.brlCurto(ele.mediana)}</b><small>mediana de ${fmt.int(ele.candidatos)} eleitos</small></div><div class="duelo__x">${vezes ? `<b class="num">${fmt.dec(vezes)}×</b><small>a diferença</small>` : ""}</div><div><span>Derrotado típico</span><b class="num">${fmt.brlCurto(nao.mediana)}</b><small>mediana de ${fmt.int(nao.candidatos)} não eleitos</small></div></div>` : "") + tabela([
            { t: "Grupo", f: (r) => (r.resultado.startsWith("ELEITO") ? "Eleitos" : "Não eleitos") },
            { t: "Candidatos", num: 1, f: (r) => fmt.int(r.candidatos) },
            { t: "Média", num: 1, f: (r) => fmt.brl(r.media) },
            { t: "Mediana", num: 1, f: (r) => fmt.brl(r.mediana) },
          ], el.dados),
        }) + (municipal ? painel({
          titulo: "Por município", sub: `Custo de uma cadeira de ${cargoTxt(cargo).toLowerCase()} em cada cidade, em 2020 e 2024.`,
          corpo: `<label class="campo"><span>Município</span><input type="search" id="q1-mun" placeholder="Digite o nome da cidade" autocomplete="off"></label><div id="q1-mun-res" style="margin-top:16px"></div>`,
        }) : ""),
        depois: () => {
          const maxC = linhas[0]?.custo_por_cadeira || 1;
          if (!nacional) ligaRelevo("q1-mapa", {
            itens: new Map(linhas.map((r) => [r.uf, {
              cor: f.uf === "TODAS" || f.uf === r.uf ? window.Relevo.rampa(r.custo_por_cadeira / maxC) : "#d9d3c5", altura: r.custo_por_cadeira / maxC,
              dica: `<b>${NOME_UF[r.uf]}</b>${fmt.brl(r.custo_por_cadeira)} por cadeira · ${fmt.int(r.candidatos)} candidatos para ${fmt.int(r.cadeiras)}`,
            }])),
            aoClicar: (u) => mudou("uf", u === f.uf ? "TODAS" : u),
          });
          if (municipal) ligaMunicipio(cargo, f.uf);
          if (municipal && f.uf !== "TODAS") cidadesQ1(cargo, ano, f.uf);
        },
      };
    },
  },

  q2: {
    n: 2, titulo: "Patrimônio e sucesso eleitoral",
    async filtros() {
      const p = await pares("/api/q2/opcoes");
      return { defs: [parSel(p), F.uf(), F.seg("sem", "Quem não declarou bens", [{ v: "entra", t: "Entra na conta" }, { v: "fora", t: "Fica de fora" }]), F.seg("divide", "Dividir os candidatos", [{ v: "faixa", t: "Por faixa de valor" }, { v: "quinto", t: "Em quintos de pessoas" }])], inicial: { par: "2022|DEPUTADO FEDERAL", uf: "TODAS", sem: "entra", divide: "faixa" }, pares: p };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q2?${qs({ ano, cargo, uf: f.uf })}`);
      const { resumo, quintis } = r.dados;
      const fora = f.sem === "fora", porQuinto = f.divide === "quinto";
      const faixas = r.dados.faixas.filter((x) => !fora || x.ordem > 0);
      const cand = faixas.reduce((t, x) => t + x.candidatos, 0), elei = faixas.reduce((t, x) => t + x.eleitos, 0);
      const taxa = cand ? (100 * elei) / cand : null;
      const sem = quintis.find((q) => q.quintil === 0), rico = quintis.find((q) => q.quintil === 5), pobre = quintis.find((q) => q.quintil === 1);
      const QUINTO = ["Sem bens", "Quinto mais pobre", "Segundo quinto", "Terceiro quinto", "Quarto quinto", "Quinto mais rico"];
      const qs5 = quintis.filter((q) => !fora || q.quintil > 0);
      const pares2 = estado.extra?.pares ?? [];
      return {
        achado: rico && (fora ? pobre : sem)
          ? (fora ? `Entre quem declarou algum bem, <b>${fmt.pct(rico.taxa_sucesso)}</b> do quinto mais rico se elegeram, contra <b>${fmt.pct(pobre.taxa_sucesso)}</b> do quinto mais pobre.`
            : `No quinto mais rico, <b>${fmt.pct(rico.taxa_sucesso)}</b> se elegeram; entre quem não declarou bens, <b>${fmt.pct(sem.taxa_sucesso)}</b>.`) : "",
        sql: [r.sql],
        html: kpis([
          { rot: fora ? "Taxa de sucesso de quem declarou bens" : "Taxa de sucesso geral", val: fmt.pct(taxa), lider: true },
          { rot: "Candidatos na conta", val: fmt.int(cand) },
          { rot: "Sem bens declarados", val: fmt.pct(resumo.pct_sem_bens), uni: fora ? "fora da conta" : "" },
          { rot: "Patrimônio mediano, eleitos", val: fmt.brlCurto(resumo.mediana_eleitos) },
          { rot: "Patrimônio mediano, não eleitos", val: fmt.brlCurto(resumo.mediana_nao_eleitos) },
        ]) + (porQuinto ? painel({
          titulo: porQuinto ? "Quem tem mais se elege mais? Em quintos" : "Em cinco partes iguais", sub: `Quem declarou algum bem, dividido em cinco grupos com o mesmo número de pessoas, do patrimônio menor ao maior${fora ? "" : "; o grupo sem bens à parte"}.`, span: porQuinto ? 7 : 5,
          corpo: porQuinto
            ? colunas(qs5.map((q) => ({ rot: QUINTO[q.quintil], sub: q.quintil === 0 ? `${fmt.int(q.candidatos)} cand.` : `${fmt.brlCurto(q.patrimonio_min)} a ${fmt.brlCurto(q.patrimonio_max)}`, v: q.taxa_sucesso, txt: fmt.pct(q.taxa_sucesso), forte: q.quintil > 0, apagada: q.quintil === 0 })), { ref: { v: taxa, txt: `todos: ${fmt.pct(taxa)}` } })
            : barras(qs5.map((q) => ({ rot: QUINTO[q.quintil], sub: q.quintil === 0 ? `${fmt.int(q.candidatos)} candidatos` : `${fmt.brlCurto(q.patrimonio_min)} a ${fmt.brlCurto(q.patrimonio_max)}`, v: q.taxa_sucesso, txt: fmt.pct(q.taxa_sucesso), q: q.quintil })), { forte: (l) => l.q > 0 }),
          dados: { nome: `q2_quintos_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: qs5, cols: [["Grupo", (q) => QUINTO[q.quintil]], ["De", (q) => fmt.brl(q.patrimonio_min), 1], ["Até", (q) => fmt.brl(q.patrimonio_max), 1], ["Candidatos", (q) => fmt.int(q.candidatos), 1], ["Eleitos", (q) => fmt.int(q.eleitos), 1], ["Taxa de sucesso", (q) => fmt.pct(q.taxa_sucesso), 1]] },
        }) + painel({
          titulo: porQuinto ? "Por faixa de valor" : "Quem tem mais se elege mais?", sub: `${cargoTxt(cargo)}, ${ano}, ${ufTxt(f.uf)}: de cada 100 candidatos de cada faixa de patrimônio declarado, quantos se elegeram.`, span: porQuinto ? 5 : 7,
          corpo: porQuinto
            ? barras(faixas.map((x) => ({ rot: x.faixa.replace(" declarados", ""), sub: `${fmt.int(x.candidatos)} candidatos`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso), o: x.ordem })), { forte: (l) => l.o > 0 })
            : colunas(faixas.map((x) => ({ rot: x.faixa.replace(" declarados", ""), sub: `${fmt.int(x.candidatos)} cand.`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso), forte: x.ordem > 0, apagada: x.ordem === 0 })), { ref: { v: taxa, txt: `todos: ${fmt.pct(taxa)}` } }),
          dados: { nome: `q2_faixas_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: faixas, cols: [["Faixa de patrimônio", (x) => x.faixa], ["Candidatos", (x) => fmt.int(x.candidatos), 1], ["Eleitos", (x) => fmt.int(x.eleitos), 1], ["Taxa de sucesso", (x) => fmt.pct(x.taxa_sucesso), 1], ["Patrimônio mediano", (x) => fmt.brl(x.patrimonio_mediano), 1]] },
        }) : painel({
          titulo: porQuinto ? "Por faixa de valor" : "Quem tem mais se elege mais?", sub: `${cargoTxt(cargo)}, ${ano}, ${ufTxt(f.uf)}: de cada 100 candidatos de cada faixa de patrimônio declarado, quantos se elegeram.`, span: porQuinto ? 5 : 7,
          corpo: porQuinto
            ? barras(faixas.map((x) => ({ rot: x.faixa.replace(" declarados", ""), sub: `${fmt.int(x.candidatos)} candidatos`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso), o: x.ordem })), { forte: (l) => l.o > 0 })
            : colunas(faixas.map((x) => ({ rot: x.faixa.replace(" declarados", ""), sub: `${fmt.int(x.candidatos)} cand.`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso), forte: x.ordem > 0, apagada: x.ordem === 0 })), { ref: { v: taxa, txt: `todos: ${fmt.pct(taxa)}` } }),
          dados: { nome: `q2_faixas_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: faixas, cols: [["Faixa de patrimônio", (x) => x.faixa], ["Candidatos", (x) => fmt.int(x.candidatos), 1], ["Eleitos", (x) => fmt.int(x.eleitos), 1], ["Taxa de sucesso", (x) => fmt.pct(x.taxa_sucesso), 1], ["Patrimônio mediano", (x) => fmt.brl(x.patrimonio_mediano), 1]] },
        }) + painel({
          titulo: porQuinto ? "Quem tem mais se elege mais? Em quintos" : "Em cinco partes iguais", sub: `Quem declarou algum bem, dividido em cinco grupos com o mesmo número de pessoas, do patrimônio menor ao maior${fora ? "" : "; o grupo sem bens à parte"}.`, span: porQuinto ? 7 : 5,
          corpo: porQuinto
            ? colunas(qs5.map((q) => ({ rot: QUINTO[q.quintil], sub: q.quintil === 0 ? `${fmt.int(q.candidatos)} cand.` : `${fmt.brlCurto(q.patrimonio_min)} a ${fmt.brlCurto(q.patrimonio_max)}`, v: q.taxa_sucesso, txt: fmt.pct(q.taxa_sucesso), forte: q.quintil > 0, apagada: q.quintil === 0 })), { ref: { v: taxa, txt: `todos: ${fmt.pct(taxa)}` } })
            : barras(qs5.map((q) => ({ rot: QUINTO[q.quintil], sub: q.quintil === 0 ? `${fmt.int(q.candidatos)} candidatos` : `${fmt.brlCurto(q.patrimonio_min)} a ${fmt.brlCurto(q.patrimonio_max)}`, v: q.taxa_sucesso, txt: fmt.pct(q.taxa_sucesso), q: q.quintil })), { forte: (l) => l.q > 0 }),
          dados: { nome: `q2_quintos_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: qs5, cols: [["Grupo", (q) => QUINTO[q.quintil]], ["De", (q) => fmt.brl(q.patrimonio_min), 1], ["Até", (q) => fmt.brl(q.patrimonio_max), 1], ["Candidatos", (q) => fmt.int(q.candidatos), 1], ["Eleitos", (q) => fmt.int(q.eleitos), 1], ["Taxa de sucesso", (q) => fmt.pct(q.taxa_sucesso), 1]] },
        }))
        + painel({
          titulo: "Vale para todos os cargos?", sub: `Cada linha é uma disputa ${ufTxt(f.uf)}. O quadrado laranja é a chance de eleição do quinto que declarou menos bens; o azul, a do quinto que declarou mais. Clique numa linha para abrir a disputa.`,
          corpo: `<div id="q2-halteres"><p class="muted">Carregando as ${pares2.length} disputas…</p></div>`,
        }),
        depois: async () => {
          const alvo = document.getElementById("q2-halteres");
          const todas = await Promise.all(pares2.map((p) => resposta(`/api/q2?${qs({ ano: p.ano, cargo: p.cargo, uf: f.uf })}`).then((x) => ({ ...p, q: x.dados.quintis }), () => null)));
          if (!alvo.isConnected) return;
          const linhas = todas.filter(Boolean).map((d) => ({ ...d, a: d.q.find((q) => q.quintil === 1), b: d.q.find((q) => q.quintil === 5) })).filter((d) => d.a?.candidatos > 0 && d.b?.candidatos > 0);
          if (!linhas.length) { alvo.innerHTML = `<p class="vazio">Não há candidatos suficientes para dividir em quintos.</p>`; return; }
          const sobe = linhas.filter((d) => d.b.taxa_sucesso > d.a.taxa_sucesso).length;
          const max = teto(Math.max(...linhas.map((d) => Math.max(d.a.taxa_sucesso, d.b.taxa_sucesso))));
          const grupo = (tipo, nome) => {
            const cargos = [...new Set(linhas.filter((d) => (d.ano % 4 === 2) === tipo).map((d) => d.cargo))].sort((x, y) => ORDEM_CARGO.indexOf(x) - ORDEM_CARGO.indexOf(y));
            return cargos.length ? `<div class="halteres__lado"><p class="halteres__tipo">${nome}</p>${halteres(cargos.map((c) => ({ titulo: cargoTxt(c), linhas: linhas.filter((d) => d.cargo === c).sort((x, y) => x.ano - y.ano).map((d) => ({ rot: d.ano, a: d.a.taxa_sucesso, b: d.b.taxa_sucesso, v: `${d.ano}|${d.cargo}`, atual: d.ano === ano && d.cargo === cargo })) })), { max })}</div>` : "";
          };
          alvo.innerHTML = `<p class="placar"><b class="num">${sobe}</b><span>de ${linhas.length}</span><small>disputas em que o quinto que declarou mais bens se elegeu mais que o quinto que declarou menos</small></p>
            ${chave([["var(--second)", "Quinto que declarou menos bens"], ["var(--accent)", "Quinto que declarou mais bens"]])}
            <div class="halteres__cols">${grupo(true, "Eleições gerais")}${grupo(false, "Eleições municipais")}</div>`;
          alvo.onclick = (e) => { const b = e.target.closest("button[data-nome]"); if (b && !b.classList.contains("is-atual")) { mudou("par", b.dataset.v); document.getElementById("canvas").scrollIntoView({ behavior: "smooth" }); } };
        },
      };
    },
  },

  q3: {
    n: 3, titulo: "Índices do município e o voto",
    async filtros() {
      return {
        defs: [F.seg("ano", "Eleição municipal", [{ v: 2008, t: "2008" }, { v: 2012, t: "2012" }]), F.seg("dim", "Agrupar por", [{ v: "IDHM", t: "IDHM" }, { v: "PIB", t: "PIB per capita" }]), F.seg("cargo", "Cargo", [{ v: "PREFEITO", t: "Prefeito" }, { v: "VEREADOR", t: "Vereador" }]), F.uf()],
        inicial: { ano: 2008, dim: "IDHM", cargo: "PREFEITO", uf: "TODAS" },
      };
    },
    async monta(f) {
      const r = await resposta(`/api/q3?${qs({ ano: f.ano, dim: f.dim, cargo: f.cargo, uf: f.uf })}`);
      const { grupos, partidos, correlacao } = r.dados;
      const NOMES = f.dim === "IDHM" ? ["", "IDHM muito baixo", "IDHM baixo", "IDHM médio", "IDHM alto", "IDHM muito alto"] : ["", "Quarto mais pobre", "Segundo quarto", "Terceiro quarto", "Quarto mais rico"];
      const gs = grupos.filter((g) => g.grupo_ordem > 0 && g.municipios > 0).sort((a, b) => a.grupo_ordem - b.grupo_ordem);
      const tot = grupos.find((g) => g.grupo_ordem === 0);
      const max = Math.max(...gs.map((g) => g.pct_abstencao + g.pct_nulos + g.pct_brancos), 1);
      const c = Object.fromEntries(correlacao.map((x) => [x.medida, x.correlacao]));
      const pilha = `${chave([["var(--accent)", "Abstenção"], ["var(--second)", "Nulos"], ["var(--grey-mark)", "Brancos"]])}<div class="pilha" style="margin-top:14px">${gs.map((g) => `
        <div class="pilha__linha"><span class="pilha__rot">${NOMES[g.grupo_ordem]}<small>${fmt.int(g.municipios)} municípios${f.dim === "IDHM" ? ` · IDHM ${fmt.dec(g.idhm_min, 3)} a ${fmt.dec(g.idhm_max, 3)}` : ` · PIB per capita mediano ${fmt.brl(g.pib_per_capita_mediano)}`}</small></span>
          <span class="pilha__trilho" title="Abstenção ${fmt.pct(g.pct_abstencao)}, nulos ${fmt.pct(g.pct_nulos)}, brancos ${fmt.pct(g.pct_brancos)}">
            <i style="width:${(g.pct_abstencao / max) * 100}%;background:var(--accent)"></i><i style="width:${(g.pct_nulos / max) * 100}%;background:var(--second)"></i><i style="width:${(g.pct_brancos / max) * 100}%;background:var(--grey-mark)"></i></span>
          <span class="pilha__val">${fmt.pct(g.pct_isentos)}</span></div>`).join("")}</div>`;
      const topo = gs.map((g) => {
        const ps = partidos.filter((p) => p.grupo_ordem === g.grupo_ordem).sort((a, b) => a.posicao - b.posicao).slice(0, 3);
        return { g, ps };
      });
      return {
        achado: `Os isentos (abstenção, nulos e brancos) foram <b>${fmt.pct(tot?.pct_isentos)}</b> dos eleitores aptos; a correlação do ${f.dim === "IDHM" ? "IDHM" : "PIB per capita"} com os votos nulos é de <b>${fmt.corr(c.pct_nulos)}</b>.`,
        sql: [r.sql],
        html: kpis([
          { rot: "Isentos, sobre os aptos", val: fmt.pct(tot?.pct_isentos), lider: true },
          { rot: "Correlação com nulos", val: fmt.corr(c.pct_nulos) },
          { rot: "Correlação com abstenção", val: fmt.corr(c.pct_abstencao) },
          { rot: "Correlação com brancos", val: fmt.corr(c.pct_brancos) },
          { rot: "Municípios", val: fmt.int(tot?.municipios) },
        ]) + painel({ titulo: "Isentos por grupo de municípios", sub: "Percentual dos eleitores aptos, somados os municípios do grupo. Votações anuladas ficam de fora.", span: 7, corpo: pilha,
          dados: { nome: `q3_grupos_${f.ano}_${f.dim}_${f.cargo}_${f.uf}`, linhas: gs, cols: [["Grupo", (g) => NOMES[g.grupo_ordem]], ["Municípios", (g) => fmt.int(g.municipios), 1], ["Abstenção", (g) => fmt.pct(g.pct_abstencao), 1], ["Nulos", (g) => fmt.pct(g.pct_nulos), 1], ["Brancos", (g) => fmt.pct(g.pct_brancos), 1], ["Isentos", (g) => fmt.pct(g.pct_isentos), 1]] } })
          + painel({
            titulo: "Partidos que mais elegeram", sub: `${cargoTxt(f.cargo)}s eleitos em ${f.ano}, por grupo.`, span: 5,
            corpo: tabela([
              { t: "Grupo", f: (x) => NOMES[x.g.grupo_ordem] },
              { t: "Partidos", f: (x) => x.ps.map((p) => `<span class="ponto" style="background:${H.cor(p.partido)}"></span>${esc(p.partido)} ${fmt.pct(p.pct_do_grupo, 0)}`).join("<br>") || "—" },
            ], topo),
          })
          + painelMapa("Nulos, abstenção, IDHM e PIB per capita de cada cidade. Toque num estado, depois num município, ou busque pelo nome."),
        depois: () => ligaMapa("q3", f.uf),
      };
    },
  },

  q4: {
    n: 4, titulo: "Escolaridade do candidato e do eleitorado",
    async filtros() {
      const p = await pares("/api/q4/opcoes");
      return { defs: [parSel(p), F.uf()], inicial: { par: "2024|VEREADOR", uf: "TODAS", grau: "SUPERIOR COMPLETO" } };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q4?${qs({ ano, cargo, uf: f.uf })}`);
      const { sucesso, representacao, grupos, correlacao } = r.dados;
      const CURTO = { "ANALFABETO": "Analfabeto", "LÊ E ESCREVE": "Lê e escreve", "ENSINO FUNDAMENTAL INCOMPLETO": "Fundamental incompleto", "ENSINO FUNDAMENTAL COMPLETO": "Fundamental completo", "ENSINO MÉDIO INCOMPLETO": "Médio incompleto", "ENSINO MÉDIO COMPLETO": "Médio completo", "SUPERIOR INCOMPLETO": "Superior incompleto", "SUPERIOR COMPLETO": "Superior completo" };
      const nomeG = (g) => CURTO[g] ?? titulo(g);
      const rep = [...representacao].sort((a, b) => a.ordem - b.ordem);
      const sup = rep.find((x) => x.grau === "SUPERIOR COMPLETO");
      const alvo = rep.find((x) => x.grau === f.grau) ?? sup ?? rep.at(-1);
      const CORES = ["#ece7db", "#e2ddd0", "#d6d6d2", "#c5cdd6", "#b3c3d8", "#9fb6d5", "#8aa6cb", "#7393bd"];
      const soma = (k) => rep.reduce((t, x) => t + (x[k] ?? 0), 0);
      const etapa = (rot, sub, k) => ({ rot, sub, partes: rep.map((x) => ({ id: x.grau, nome: nomeG(x.grau), pct: x[k] ?? 0 })) });
      const suc = [...sucesso].sort((a, b) => a.ordem - b.ordem);
      const sucAlvo = suc.find((x) => x.grau === alvo?.grau);
      const totC = suc.reduce((t, x) => t + x.candidatos, 0), totE = suc.reduce((t, x) => t + x.eleitos, 0);
      const media = totC ? (100 * totE) / totC : null;
      const qG = grupos.filter((g) => g.grupo_ordem > 0).sort((a, b) => a.grupo_ordem - b.grupo_ordem);
      const pond = qG.some((g) => g.anos_votados_medio != null);
      const GRUPO = ["", "Quarto menos escolarizado", "Segundo quarto", "Terceiro quarto", "Quarto mais escolarizado"];
      return {
        achado: sup ? `<b>${fmt.pct(sup.pct_eleitorado)}</b> do eleitorado tem superior completo, contra <b>${fmt.pct(sup.pct_eleitos)}</b> dos eleitos; a correlação entre a escolaridade do município e a dos eleitos é de <b>${fmt.corr(correlacao?.correlacao_votados ?? correlacao?.correlacao)}</b>.` : "",
        sql: [r.sql],
        html: kpis([
          { rot: "Eleitos com superior completo", val: fmt.pct(sup?.pct_eleitos), lider: true },
          { rot: "Eleitorado com superior completo", val: fmt.pct(sup?.pct_eleitorado) },
          { rot: "Correlação município e eleitos", val: fmt.corr(correlacao?.correlacao_votados ?? correlacao?.correlacao) },
          { rot: "Municípios", val: fmt.int(correlacao?.municipios) },
        ]) + painel({
          titulo: "Do eleitor ao eleito", sub: `Em cada etapa, a parte de cada grau de escolaridade. Escolha um grau para seguir a fita.`,
          corpo: `<div class="seg seg--graus" role="group" aria-label="Grau em destaque" id="q4-graus">${rep.map((x, k) => `<button type="button" data-grau="${esc(x.grau)}" aria-pressed="${x.grau === alvo?.grau}"><i style="background:${CORES[k]}"></i>${nomeG(x.grau)}</button>`).join("")}</div>`
            + funil([etapa("O eleitorado", `${fmt.brlCurto(soma("eleitores")).replace("R$ ", "")} de eleitores`, "pct_eleitorado"), etapa("Quem se candidatou", `${fmt.int(soma("candidatos"))} candidatos`, "pct_candidatos"), etapa("Quem se elegeu", `${fmt.int(soma("eleitos"))} eleitos`, "pct_eleitos")], { cores: CORES, destaque: alvo?.grau })
            + (alvo ? `<p class="funil__frase"><b>${nomeG(alvo.grau)}:</b> ${fmt.pct(alvo.pct_eleitorado)} do eleitorado, ${fmt.pct(alvo.pct_candidatos)} dos candidatos e ${fmt.pct(alvo.pct_eleitos)} dos eleitos.${sucAlvo ? ` Dos candidatos com esse grau, <b>${fmt.pct(sucAlvo.taxa_sucesso)}</b> se elegeram.` : ""}</p>` : ""),
          dados: { nome: `q4_etapas_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: rep, cols: [["Grau de instrução", (x) => nomeG(x.grau)], ["Eleitores", (x) => fmt.int(x.eleitores), 1], ["% do eleitorado", (x) => fmt.pct(x.pct_eleitorado), 1], ["Candidatos", (x) => fmt.int(x.candidatos), 1], ["% dos candidatos", (x) => fmt.pct(x.pct_candidatos), 1], ["Eleitos", (x) => fmt.int(x.eleitos), 1], ["% dos eleitos", (x) => fmt.pct(x.pct_eleitos), 1]] },
        }) + painel({
          titulo: "Quantos dos candidatos se elegem", sub: `A chance de cada grau virar cadeira. Média do cargo: ${fmt.pct(media)}.`, span: 6,
          corpo: barras([...suc].reverse().map((x) => ({ rot: nomeG(x.grau), sub: `${fmt.int(x.eleitos)} de ${fmt.int(x.candidatos)} candidatos`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso), on: x.grau === alvo?.grau })), { forte: (l) => l.on }),
          dados: { nome: `q4_sucesso_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: suc, cols: [["Grau de instrução", (x) => nomeG(x.grau)], ["Candidatos", (x) => fmt.int(x.candidatos), 1], ["Eleitos", (x) => fmt.int(x.eleitos), 1], ["Taxa de sucesso", (x) => fmt.pct(x.taxa_sucesso), 1]] },
        }) + painel({
          titulo: "Onde o eleitor estudou mais, o eleito também?", sub: pond ? "Municípios em quatro grupos pela escolaridade do eleitorado, em anos de estudo equivalentes. Para deputados, a média dos eleitos é ponderada pelos votos que o município deu a cada um." : "Municípios em quatro grupos pela escolaridade do eleitorado, em anos de estudo equivalentes (fundamental completo 9, médio 12, superior 16).", span: 6,
          corpo: halteres([{ titulo: "Anos de estudo: eleitorado (laranja) e eleitos (azul)", linhas: qG.map((g) => ({ rot: ["", "Menos escolarizado", "Segundo quarto", "Terceiro quarto", "Mais escolarizado"][g.grupo_ordem], a: g.anos_eleitorado_medio, b: g.anos_votados_medio ?? g.anos_eleitos_medio, v: "" })) }], { max: 20, nome: "", unidade: "anos", rotulo: "9.5rem" }),
          dados: { nome: `q4_grupos_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: qG, cols: [["Grupo", (g) => GRUPO[g.grupo_ordem]], ["Municípios", (g) => fmt.int(g.municipios), 1], ["Anos, eleitorado", (g) => fmt.dec(g.anos_eleitorado_medio), 1], [pond ? "Anos, eleitos (ponderado)" : "Anos, eleitos", (g) => fmt.dec(g.anos_votados_medio ?? g.anos_eleitos_medio), 1], ["Superior, eleitorado", (g) => fmt.pct(g.pct_superior_eleitorado), 1], ["Superior, eleitos", (g) => fmt.pct(g.pct_superior_votados ?? g.pct_superior_eleitos), 1]] },
        })
          + painelMapa("Escolaridade do eleitorado, dos vereadores e do prefeito eleitos em 2024 em cada cidade."),
        depois: () => {
          ligaMapa("q4", f.uf);
          document.getElementById("q4-graus").onclick = (e) => { const b = e.target.closest("button[data-grau]"); if (b) mudou("grau", b.dataset.grau); };
          document.querySelector(".funil svg").onclick = (e) => { const g = e.target.dataset?.id; if (g) mudou("grau", g); };
        },
      };
    },
  },

  q5: {
    n: 5, titulo: "Eleitos por votos de legenda",
    async filtros() {
      return {
        defs: [parSel(PARES_Q5.map(([ano, cargo]) => ({ ano, cargo }))), F.uf(), F.seg("forma", "Cadeiras", [{ v: "circulo", t: "Círculos" }, { v: "quadrado", t: "Quadrados" }])],
        inicial: { par: "2022|DEPUTADO FEDERAL", uf: "TODAS", forma: "circulo", mun: "" },
      };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q5?${qs({ ano, cargo, uf: f.uf })}`);
      const { resumo: s, partidos, menos, barrados } = r.dados;
      const fq5 = await arquivo("site/fotos_q5.json").catch(() => ({}));
      const idFoto = (e) => fq5[`${ano}|${cargo}|${e.sg_uf}|${e.nome_urna}|${e.partido}|${e.votos}`];
      const pessoa = (e) => `<span class="pessoa">${foto(idFoto(e), `Foto de ${titulo(e.nome_urna)}`)}<span>${esc(titulo(e.nome_urna))}<br><span class="muted">${esc(e.partido)} · ${esc(e.municipio ? titulo(e.municipio) : e.sg_uf)}</span></span></span>`;
      const casa = cargo === "VEREADOR" ? (f.uf === "TODAS" ? "Câmaras municipais do Brasil" : `Câmaras municipais ${DO_UF[f.uf]}`)
        : cargo === "DEPUTADO ESTADUAL" ? (f.uf === "TODAS" ? "As Assembleias Legislativas" : `Assembleia Legislativa ${DO_UF[f.uf]}`)
          : (f.uf === "TODAS" ? "A Câmara dos Deputados" : `Bancada ${DO_UF[f.uf]} na Câmara dos Deputados`);
      const ps = [...partidos].sort((a, b) => b.eleitos - a.eleitos || a.partido.localeCompare(b.partido));
      /* cadeira por cadeira: com um estado escolhido, cada ponto é um eleito (na câmara municipal, a de um município) */
      let assentos = null, muns = [], mun = null;
      if (f.uf !== "TODAS") {
        const [cad, idx] = await Promise.all([cadeirasCasa(ano, cargo, f.uf).catch(() => null), arquivo("q10_indice.json").catch(() => ({ indice: [] }))]);
        if (cad) {
          assentos = cad;
          if (cargo === "VEREADOR") {
            muns = [...new Map(cad.map((l) => [l.cod_ibge, l.municipio])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
            mun = [Number(f.mun), CAPITAL[f.uf], muns[0]?.[0]].find((c) => muns.some(([k]) => k === c));
            assentos = cad.filter((l) => l.cod_ibge === mun);
          }
          assentos.carreira = new Set(idx.indice.map((i) => i.achado.id_pessoa));
        }
      }
      const nomeCasa = cargo === "VEREADOR" ? `Câmara Municipal de ${nomeMun(muns.find(([k]) => k === mun)?.[1] ?? "")}` : cargo === "DEPUTADO ESTADUAL" ? `Assembleia Legislativa ${DO_UF[f.uf]}` : `Bancada ${DO_UF[f.uf]} na Câmara dos Deputados`;
      const corpoCadeiras = f.uf === "TODAS"
        ? `<p class="vazio">Escolha um estado nos filtros para ver quem ocupa cada cadeira.</p>`
        : !assentos ? `<p class="vazio">As cadeiras desta casa não foram gravadas.</p>`
          : `${muns.length ? `<label class="campo campo--mun"><span>Município</span><select id="q5-mun">${muns.map(([k, n]) => `<option value="${k}"${k === mun ? " selected" : ""}>${esc(nomeMun(n))}</option>`).join("")}</select></label>` : ""}
            <div class="seg seg--tipos" role="group" aria-label="Destacar as cadeiras por tipo de eleito" id="q5-tipos"></div>
            <div class="cadeiras"><div><div class="hemi" id="hemi-pessoas"></div><p class="hemi-nota">Passe o mouse ou toque numa cadeira. Com o foco no gráfico, as setas percorrem a casa.</p></div><aside class="ficha-q" id="ficha-q" aria-live="polite"></aside></div>`;
      return {
        achado: `<b>${fmt.int(s.eleitos_por_legenda)} de ${fmt.int(s.eleitos)}</b> eleitos (${fmt.pct(s.pct_por_legenda)}) tiveram menos votos que o quociente eleitoral; <b>${fmt.pct(s.pct_fora_dos_mais_votados)}</b> ocuparam a vaga de alguém mais votado.`,
        sql: [r.sql],
        html: kpis([
          { rot: "Eleitos abaixo do quociente", val: fmt.pct(s.pct_por_legenda), lider: true },
          { rot: "Cadeiras", val: fmt.int(s.vagas) },
          { rot: "Fora dos mais votados", val: fmt.pct(s.pct_fora_dos_mais_votados) },
          { rot: "Votos de legenda", val: fmt.pct(s.pct_votos_legenda), uni: "dos válidos" },
          { rot: "Mediana do quociente atingida", val: fmt.pct(s.mediana_pct_quociente) },
        ]) + painel({
          titulo: casa, sub: `${cargoTxt(cargo)}, ${ano}. Cada fatia é um partido, do maior ao menor.`, span: 7, id: "p-hemi",
          corpo: `<div class="hemi" id="hemi"></div><p class="hemi-nota" id="hemi-nota"></p><div class="legenda-partidos" id="hemi-legenda"></div>`,
        }) + painel({
          titulo: "Por partido", sub: "Eleitos, quantos abaixo do quociente e os votos.", span: 5,
          corpo: tabela([
            { t: "Partido", f: (p) => `<span class="ponto" style="background:${H.cor(p.partido)}"></span>${esc(p.partido)}` },
            { t: "Eleitos", num: 1, f: (p) => fmt.int(p.eleitos) },
            { t: "Pela legenda", num: 1, f: (p) => fmt.int(p.eleitos_por_legenda) },
            { t: "Votos nominais", num: 1, f: (p) => fmt.int(p.votos_nominais) },
          ], ps.slice(0, 14)) + (ps.length > 14 ? `<p class="muted" style="margin-top:10px;font-size:13px">Mais ${ps.length - 14} partidos com ${fmt.int(ps.slice(14).reduce((t, p) => t + p.eleitos, 0))} eleitos.</p>` : ""),
        }) + painel({
          titulo: "Eleitos com menos votos", sub: "Em percentual do quociente eleitoral da disputa.", span: 6,
          corpo: tabela([
            { t: "Eleito", f: pessoa },
            { t: "Votos", num: 1, f: (e) => fmt.int(e.votos) },
            { t: "Do quociente", num: 1, f: (e) => fmt.pct(e.pct_do_quociente) },
          ], menos.slice(0, 6)),
        }) + painel({
          titulo: "Mais votados que ficaram de fora", sub: "Tiveram mais votos que algum eleito da mesma disputa.", span: 6,
          corpo: tabela([
            { t: "Candidato", f: pessoa },
            { t: "Votos", num: 1, f: (e) => fmt.int(e.votos) },
            { t: "Posição", num: 1, f: (e) => `${fmt.int(e.posicao_votos)}º de ${fmt.int(e.vagas)} vagas` },
          ], barrados.slice(0, 6)),
        }) + painel({
          titulo: "Cadeira por cadeira", sub: f.uf === "TODAS" ? "Quem ocupa cada cadeira, com os votos e o quociente." : `${nomeCasa}, ${ano}. Cada ponto é um eleito.`, id: "p-cadeiras", corpo: corpoCadeiras,
        }),
        depois: () => {
          if (assentos?.length) {
            const porP = new Map();
            for (const l of assentos) (porP.get(l.partido) ?? porP.set(l.partido, []).get(l.partido)).push(l);
            const membros = [...porP].map(([nome, ms]) => ({ nome, cadeiras: ms.length, cor: H.cor(nome), membros: ms.sort((a, b) => b.votos - a.votos) }))
              .sort((a, b) => b.cadeiras - a.cadeiras || a.nome.localeCompare(b.nome));
            const el = document.getElementById("hemi-pessoas"), ficha = document.getElementById("ficha-q");
            el.addEventListener("assento", (e) => { ficha.innerHTML = fichaCadeira(e.detail.partido, e.detail.membro, assentos.carreira.has(e.detail.membro.id_pessoa)); });
            const casaCtl = H.desenha(el, { partidos: membros, forma: f.forma, legendaCentro: assentos.length === 1 ? "cadeira" : "cadeiras" });
            casaCtl.seleciona?.((m) => m.posicao_votos === 1);
            /* destaca as cadeiras de um tipo: os três selos da ficha (sozinho, pela soma do partido, com menos votos que um derrotado) */
            const TIPOS = [["todos", "Todos", null], ["sozinho", "Atingiu o quociente sozinho", (m) => !m.por_legenda], ["soma", "Eleito pela soma do partido", (m) => m.por_legenda && !m.fora_dos_mais_votados], ["menos", "Entrou com menos votos que um derrotado", (m) => m.por_legenda && m.fora_dos_mais_votados]];
            const tipos = document.getElementById("q5-tipos");
            tipos.innerHTML = TIPOS.map(([id, rot, fn], k) => { const n = fn ? assentos.filter(fn).length : assentos.length; return `<button type="button" data-tipo="${id}" aria-pressed="${k === 0}">${rot} <b class="num">${fmt.int(n)}</b></button>`; }).join("");
            tipos.onclick = (e) => {
              const b = e.target.closest("button[data-tipo]");
              if (!b) return;
              tipos.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
              casaCtl.marca?.(TIPOS.find(([id]) => id === b.dataset.tipo)[2]);
            };
            if (!ficha.innerHTML) ficha.innerHTML = fichaCadeira(membros[0], membros[0].membros[0], assentos.carreira.has(membros[0].membros[0].id_pessoa));
          } else if (f.uf !== "TODAS" && assentos) document.getElementById("hemi-pessoas").innerHTML = `<p class="vazio">Os votos de vereador deste município não foram publicados completos pelo TSE.</p>`;
          document.getElementById("q5-mun")?.addEventListener("change", (e) => mudou("mun", e.target.value));
          const alvo = document.getElementById("hemi");
          const dados = ps.filter((p) => p.eleitos > 0).map((p) => ({ nome: p.partido, cadeiras: p.eleitos, cor: H.cor(p.partido) }));
          const { unidade, realca } = H.desenha(alvo, { partidos: dados, forma: f.forma });
          document.getElementById("hemi-nota").textContent = unidade > 1 ? `Cada ${f.forma === "quadrado" ? "quadrado" : "círculo"} representa ${unidade} cadeiras.` : "";
          const leg = document.getElementById("hemi-legenda");
          leg.innerHTML = dados.map((p) => `<button type="button" data-p="${esc(p.nome)}"><i style="background:${p.cor}"></i><span>${esc(p.nome)}</span><b>${fmt.int(p.cadeiras)}</b></button>`).join("");
          leg.onpointerover = (e) => { const b = e.target.closest("button"); if (b) realca(b.dataset.p); };
          leg.onfocusin = (e) => { const b = e.target.closest("button"); if (b) realca(b.dataset.p); };
          leg.onpointerleave = () => realca(null);
          alvo.addEventListener("partido", (e) => leg.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.p === e.detail)));
        },
      };
    },
  },

  q6: {
    n: 6, titulo: "Idade do município, alternância e idade dos eleitos",
    async filtros() {
      return { defs: [F.seg("cargo", "Cargo", [{ v: "PREFEITO", t: "Prefeito" }, { v: "VEREADOR", t: "Vereador" }]), F.uf()], inicial: { cargo: "PREFEITO", uf: "TODAS" } };
    },
    async monta(f) {
      const r = await resposta(`/api/q6?${qs({ cargo: f.cargo, uf: f.uf })}`);
      const { grupos, idade, correlacao, alternancia } = r.dados;
      const anos = [...new Set(idade.map((x) => x.ano))].sort();
      const serie = (g) => anos.map((a) => idade.find((x) => x.ano === a && x.grupo_ordem === g)?.idade_media ?? null);
      const nome = Object.fromEntries(grupos.map((g) => [g.grupo_ordem, g.grupo]));
      const ult = anos[anos.length - 1];
      const corrUlt = correlacao.find((c) => c.ano === ult);
      const alt = alternancia.filter((a) => a.grupo_ordem === 0).sort((a, b) => a.ano - b.ano);
      const altUlt = alt[alt.length - 1];
      const series = [
        { g: 0, cor: "var(--accent)", larg: 2.5, nome: "Todos os municípios" },
        { g: 1, cor: "var(--second)", larg: 2, nome: "Mais jovens" },
        { g: 4, cor: "#6b7280", larg: 2, nome: "Mais envelhecidos" },
      ].map((s) => ({ ...s, v: serie(s.g) }));
      return {
        achado: `Os ${f.cargo === "PREFEITO" ? "prefeitos" : "vereadores"} eleitos passaram de <b>${fmt.dec(series[0].v[0])}</b> para <b>${fmt.dec(series[0].v[series[0].v.length - 1])} anos</b> em média de ${anos[0]} a ${ult}; a correlação com a idade do município em ${ult} é de <b>${fmt.corr(corrUlt?.correlacao)}</b>.`,
        sql: [r.sql],
        html: kpis([
          { rot: `Idade média dos eleitos, ${ult}`, val: fmt.dec(series[0].v[series[0].v.length - 1]), uni: "anos", lider: true },
          { rot: `Correlação com a idade do município, ${ult}`, val: fmt.corr(corrUlt?.correlacao) },
          { rot: `Partido do prefeito mudou, ${altUlt?.ano ?? "—"}`, val: fmt.pct(altUlt?.pct_partido_mudou) },
          { rot: `Reeleitos entre os que tentaram, ${altUlt?.ano ?? "—"}`, val: fmt.pct(altUlt?.pct_reeleicao) },
        ]) + painel({ titulo: "Idade média dos eleitos", sub: "Municípios agrupados pela idade mediana da população (Censo 2022).", span: 7, corpo: `${chave(series.map((s) => [s.cor, s.nome]))}<div class="linhas" id="q6-linhas" style="margin-top:12px"></div>`,
          dados: { nome: `q6_idade_${f.cargo}_${f.uf}`, linhas: anos.map((a, i) => ({ a, i })), cols: [["Eleição", (l) => l.a], ...series.map((se) => [se.nome, (l) => fmt.dec(se.v[l.i]), 1])] } })
          + painel({
            titulo: "Grupos de municípios", sub: `Idade média dos eleitos em ${ult}.`, span: 5,
            corpo: tabela([
              { t: "Grupo", f: (g) => esc(nome[g.grupo_ordem]) },
              { t: "Municípios", num: 1, f: (g) => fmt.int(g.municipios) },
              { t: "Idade", num: 1, f: (g) => fmt.dec(g.idade_media) },
              { t: "60 anos ou mais", num: 1, f: (g) => fmt.pct(g.pct_60_mais) },
            ], idade.filter((x) => x.ano === ult).sort((a, b) => a.grupo_ordem - b.grupo_ordem)),
          })
          + (alt.length ? painel({
            titulo: "Em quantas cidades o partido do prefeito mudou", sub: "Cada eleição comparada à anterior; renomeações e fusões contam como o mesmo partido.", span: 7,
            corpo: colunas(alt.map((a) => ({ rot: String(a.ano), sub: `${fmt.int(a.transicoes)} municípios`, v: a.pct_partido_mudou, txt: fmt.pct(a.pct_partido_mudou), forte: true }))),
            dados: { nome: `q6_alternancia_${f.uf}`, linhas: alt, cols: [["Eleição", (a) => a.ano], ["Municípios comparados", (a) => fmt.int(a.transicoes), 1], ["Partido mudou", (a) => fmt.pct(a.pct_partido_mudou), 1], ["Prefeito mudou", (a) => fmt.pct(a.pct_prefeito_mudou), 1], ["Tentaram a reeleição", (a) => fmt.pct(a.pct_tentou_reeleicao), 1], ["Reeleitos, entre esses", (a) => fmt.pct(a.pct_reeleicao), 1]] },
          }) + painel({
            titulo: "Quem tenta ficar, fica?", sub: "Dos prefeitos que tentaram a reeleição, a parte que conseguiu.", span: 5,
            corpo: barras(alt.map((a) => ({ rot: String(a.ano), sub: `${fmt.pct(a.pct_tentou_reeleicao)} tentaram`, v: a.pct_reeleicao, txt: fmt.pct(a.pct_reeleicao) })), { forte: () => true }),
          }) : painel({ titulo: "Alternância de poder", corpo: `<p class="vazio">A alternância é medida pelo partido do prefeito; escolha o cargo de prefeito.</p>` }))
          + painelMapa("Idade do prefeito, da população e dos vereadores, e as trocas de partido de 2004 a 2024. No município, o prefeito e a Câmara eleitos em 2024."),
        depois: () => { linhas(document.getElementById("q6-linhas"), anos, series); ligaMapa("q6", f.uf); },
      };
    },
  },

  q7: {
    n: 7, titulo: "Viés político",
    async filtros() {
      const r = await resposta("/api/q7");
      const anos = [...new Set(r.dados.territorios.map((t) => t.ano))].sort();
      /* os cargos de cada ano saem do Brasil; o distrital (só o DF) fica junto do deputado estadual */
      const cargosDe = (a) => cargosQ7(r.dados.territorios.find((t) => t.escopo === "BRASIL" && t.ano === Number(a)))
        .map((c) => c.cargo).filter((c) => c !== "DEPUTADO DISTRITAL").sort((x, y) => ORDEM_CARGO.indexOf(x) - ORDEM_CARGO.indexOf(y));
      return {
        defs: [
          F.seg("ano", "Eleição", anos.map((a) => ({ v: String(a), t: String(a) }))),
          // "Geral" e "Municipal" são a média de todos os cargos do ano (o valor fica TODOS nos dois)
          F.seg("cargo", "Cargo", (f) => [{ v: "TODOS", t: Number(f.ano) % 4 === 2 ? "Geral" : "Municipal" }, ...cargosDe(f.ano).map((c) => ({ v: c, t: cargoTxt(c) }))]),
          // o turno só aparece nos cargos que têm 2º turno
          { ...F.seg("turno", "Turno", [{ v: "1", t: "1º turno" }, { v: "2", t: "2º turno" }]), mostra: (f) => CARGOS_2T.includes(f.cargo) },
          F.uf(),
        ],
        inicial: { ano: String(anos.at(-1)), cargo: "TODOS", turno: "1", uf: "TODAS" },
      };
    },
    // trocar de eleição geral para municipal (ou o contrário) volta o cargo para a média do ano
    ajusta(f) {
      const gerais = ["PRESIDENTE", "GOVERNADOR", "SENADOR", "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"], municipais = ["PREFEITO", "VEREADOR"];
      if (!(Number(f.ano) % 4 === 2 ? gerais : municipais).includes(f.cargo)) f.cargo = "TODOS";
      if (!CARGOS_2T.includes(f.cargo)) f.turno = "1";
    },
    async monta(f) {
      const V = window.Vies;
      const ano = Number(f.ano), geral = ano % 4 === 2;
      const cargo = f.cargo ?? "TODOS", todos = cargo === "TODOS";
      /* com um cargo escolhido, o viés de cada território e município passa a ser o daquele cargo (lido de vies_por_cargo) */
      const doCargo = (x) => {
        if (!x || todos) return x;
        const cs = cargosQ7(x), c = cs.find((c) => c.cargo === cargo) ?? (cargo === "DEPUTADO ESTADUAL" ? cs.find((c) => c.cargo === "DEPUTADO DISTRITAL") : null);
        return { ...x, vies: c ? c.v : null };
      };
      const cargoNome = todos ? "" : (cargo === "DEPUTADO ESTADUAL" && f.uf === "DF" ? "deputado distrital" : cargoTxt(cargo).toLowerCase());
      const r = await resposta("/api/q7");
      const T = r.dados.territorios;
      const de = (escopo, ter, a = ano) => T.find((t) => t.escopo === escopo && t.territorio === ter && t.ano === a);
      const [escopo, ter] = f.uf === "TODAS" ? ["BRASIL", "BR"] : ["UF", f.uf];
      const media = de(escopo, ter), primeiro = doCargo(media);
      let alvo = primeiro, ant = doCargo(de(escopo, ter, ano - 4));
      let ufs = T.filter((t) => t.escopo === "UF" && t.ano === ano).map(doCargo).filter((t) => t.vies != null).sort((a, b) => a.vies - b.vies);
      /* 2º turno: outra fonte (mv_q7_turno2). Estado e Brasil somam só os municípios que tiveram 2º turno, então a
         comparação com 4 anos antes só vale quando o conjunto é o mesmo: presidente, ou governador num estado. */
      const t2 = f.turno === "2" && CARGOS_2T.includes(cargo);
      const mesmoConjunto = cargo === "PRESIDENTE" || (cargo === "GOVERNADOR" && escopo === "UF");
      let r2 = null;
      if (t2 && media) {
        r2 = await resposta("/api/q7/turno2");
        const de2 = (esc_, ter_, a = ano) => r2.dados.find((t) => t.escopo === esc_ && t.territorio === ter_ && t.ano === a && t.cargo === cargo);
        alvo = de2(escopo, ter) ?? { vies: null };
        ant = mesmoConjunto ? de2(escopo, ter, ano - 4) : null;
        ufs = r2.dados.filter((t) => t.escopo === "UF" && t.ano === ano && t.cargo === cargo && t.vies != null).sort((a, b) => a.vies - b.vies);
      }
      const partidos = r.dados.partidos.filter((p) => p.ano === ano);
      const onda = partidos.find((p) => p.onda)?.onda;
      const lugar = f.uf === "TODAS" ? "no Brasil" : EM_UF[f.uf];
      if (!media) {
        return {
          achado: `${NOME_UF[f.uf]} não tem eleição municipal: não há viés ${lugar} em ${ano}.`,
          sql: [r.sql],
          html: painel({ titulo: "Sem eleição", corpo: `<p class="vazio">O Distrito Federal não tem prefeito nem vereadores. Escolha uma eleição geral (2018, 2022 ou 2026) ou outro estado.</p>` }),
        };
      }
      if (t2 && alvo.vies == null) {
        return {
          achado: `Não houve 2º turno para ${cargoNome} ${lugar} em ${ano}.`,
          sql: [r2.sql],
          html: painel({ titulo: "Sem 2º turno", corpo: `<p class="vazio">${cargo === "PREFEITO" ? "Só há 2º turno para prefeito nas cidades com mais de 200 mil eleitores, e nenhuma delas teve 2º turno aqui nesse ano." : "A eleição terminou no 1º turno."} Escolha o 1º turno ou outro estado.</p>` }),
        };
      }
      if (alvo.vies == null) {
        return {
          achado: `Não há viés do voto para ${cargoNome} ${lugar} em ${ano}.`,
          sql: [r.sql],
          html: painel({ titulo: "Sem dados para o cargo", corpo: `<p class="vazio">${ano === 2026 && f.uf === "AP" ? "No download do TSE de 16/11/2026, os deputados do Amapá ainda vinham sem votos." : "Nenhum voto com viés para esse cargo aqui."} Escolha outro cargo ou "Geral".</p>` }),
        };
      }
      let muns = null, msql = null;
      if (f.uf !== "TODAS") {
        const m = await resposta(t2 ? `/api/q7/turno2/municipios?${qs({ ano, cargo, uf: f.uf })}` : `/api/q7/municipios?${qs({ ano, uf: f.uf })}`);
        muns = (t2 ? m.dados : m.dados.map(doCargo)).filter((x) => x.vies != null);
        msql = m.sql;
      }
      const ordem = muns ? [...muns].sort((a, b) => a.vies - b.vies) : ufs;
      const nomeDe = (x) => (muns ? `${esc(nomeMun(titulo(x.municipio)))}` : NOME_UF[x.territorio]);
      const [esq, dir] = [ordem[0], ordem.at(-1)];
      const delta = ant?.vies != null ? alvo.vies - ant.vies : null;
      const cargos = cargosQ7(media);
      const extremos = muns ? [...ordem.slice(0, 8), ...ordem.slice(-8).filter((x) => !ordem.slice(0, 8).includes(x))] : ordem;
      const notaOnda = `Notas dos partidos: onda de ${onda ?? "—"} da pesquisa com especialistas (Bolognesi, Codato, Ribeiro e Silva)${ano > (onda ?? ano) ? `, estendida até ${ano}, o que os autores desaconselham` : ""}.`;
      return {
        achado: `Em ${ano}, o voto ${todos ? "" : `para ${cargoNome} `}${t2 ? "no 2º turno " : ""}${lugar}${t2 && !mesmoConjunto ? ` (${cargo === "PREFEITO" ? `${fmt.int(alvo.municipios)} cidades com 2º turno` : `${ufs.length} estados com 2º turno`})` : ""} ficou ${V.lado(alvo.vies) === "centro" ? "no <b>centro</b>" : `na <b>${V.lado(alvo.vies)}</b>`}: viés de <b>${V.fmt(alvo.vies)}</b>, numa escala de −100 a +100${delta != null ? `, ${Math.abs(delta) < 0.05 ? "igual a" : `${fmt.dec(Math.abs(delta))} pontos mais à ${delta > 0 ? "direita" : "esquerda"} que em`} ${ano - 4}` : ""}.`,
        sql: [r.sql, ...(r2 ? [r2.sql] : []), ...(msql ? [msql] : [])],
        html: (ano === 2026 ? `<p class="nota-2026"><b>2026:</b> arquivos do TSE baixados em 16/11/2026, com o 2º turno já decidido. Nesse download, os deputados federais e estaduais do Amapá ainda vinham sem votos, então o viés do Amapá usa só presidente, governador e senador. <a href="sobre.html#limites">Limitações</a></p>` : "")
          + kpis([
            { rot: todos ? `Viés ${lugar}` : `Viés ${lugar}, ${cargoNome}${t2 ? ", 2º turno" : ""}`, val: V.fmt(alvo.vies), uni: V.lado(alvo.vies), lider: true },
            { rot: `Desde ${ano - 4}`, val: delta == null ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${fmt.dec(Math.abs(delta))}`, uni: delta == null ? "" : "pontos" },
            todos ? { rot: "Votos com viés", val: fmt.pct(alvo.cobertura_pct), uni: "dos válidos" }
              : t2 && mesmoConjunto ? { rot: "No 1º turno", val: V.fmt(primeiro.vies), uni: V.lado(primeiro.vies) }
              : t2 ? (cargo === "PREFEITO" ? { rot: "Cidades com 2º turno", val: fmt.int(alvo.municipios), uni: "" } : { rot: "Estados com 2º turno", val: String(ufs.length), uni: "" })
              : { rot: "Média dos cargos", val: V.fmt(media.vies), uni: V.lado(media.vies) },
            { rot: muns ? "Município mais à esquerda" : "Estado mais à esquerda", val: `${nomeDe(esq)} <small>${V.fmt(esq.vies)}</small>`, texto: true },
            { rot: muns ? "Município mais à direita" : "Estado mais à direita", val: `${nomeDe(dir)} <small>${V.fmt(dir.vies)}</small>`, texto: true },
          ])
          + painel({
            titulo: `${muns ? `Os municípios ${DO_UF[f.uf]}` : "Os estados"} em ${ano}${todos ? "" : `: ${cargoNome}`}${t2 ? ", 2º turno" : ""}`,
            sub: muns ? "Passe o mouse sobre um município para ver o viés. O botão Brasil volta ao mapa dos estados." : "Passe o mouse sobre um estado para ver o viés e clique para ver os municípios dele.",
            span: 7, corpo: `${mapaRelevo("q7-mapa", "Em pé, a altura é a distância do centro.", f.uf)}${V.legenda()}`,
          })
          + painel({
            titulo: muns ? "Os extremos" : "Do mais à esquerda ao mais à direita",
            sub: muns ? `Os 8 municípios mais à esquerda e os 8 mais à direita, entre ${fmt.int(muns.length)} com viés.` : `${todos ? "Viés de cada estado, com os cargos em peso igual." : `Viés de cada estado no voto para ${cargoNome}${cargo === "DEPUTADO ESTADUAL" ? " (no DF, deputado distrital)" : ""}${t2 ? " no 2º turno, só onde houve" : ""}.`} Faixas: esquerda abaixo de −40, centro-esquerda até −10, centro até +10, centro-direita até +40 e direita acima disso.`,
            span: 5, corpo: V.divergentes(extremos.map((x) => ({ rot: nomeDe(x), v: x.vies, forte: !muns && x.territorio === f.uf })), 60),
          })
          + painel({
            titulo: "Cargo por cargo", sub: `O viés ${lugar} é a média simples destes ${cargos.length} cargos (${geral ? "1º turno" : "prefeito e vereador, 1º turno"}).`,
            span: 5, corpo: V.divergentes(cargos.map((c) => ({ rot: cargoTxt(c.cargo), v: c.v, forte: c.cargo === cargo || (cargo === "DEPUTADO ESTADUAL" && c.cargo === "DEPUTADO DISTRITAL") })), 60),
          })
          + painel({
            titulo: `A régua dos partidos em ${ano}`, sub: `${notaOnda} Partidos sem nota ficam fora da conta: ${partidos.filter((p) => p.vies == null).map((p) => esc(p.sigla)).join(", ") || "nenhum"}.`,
            span: 7, corpo: V.regua(partidos),
          }),
        depois: () => ligaRelevo("q7-mapa", {
          uf: muns ? f.uf : null,
          itens: new Map((muns ?? ufs).map((x) => [String(muns ? x.cod_ibge : x.territorio), {
            cor: V.cor(x.vies), altura: Math.abs(x.vies) / 60,
            dica: `<b>${muns ? esc(nomeMun(titulo(x.municipio))) : NOME_UF[x.territorio]}</b>${V.fmt(x.vies)} · ${V.lado(x.vies)}`,
          }])),
          aoClicar: muns ? null : (u) => { if (NOME_UF[u]) mudou("uf", u); },
        }),
      };
    },
  },

  banco: {
    crumb: "O banco", titulo: "O que está no banco",
    async filtros() { return { defs: [], inicial: {} }; },
    async monta() {
      const r = await resposta("/api/resumo");
      const linhas = Object.fromEntries(r.dados.tabelas.map((t) => [t.tabela, t.linhas]));
      const anos = r.dados.anos;
      return {
        achado: `O banco eleicoes tem <b>${fmt.int(linhas.candidatura)} candidaturas</b> de ${fmt.int(linhas.pessoa)} pessoas, em ${anos.length} pleitos de ${anos[0].ano} a ${anos[anos.length - 1].ano}.`,
        sql: [r.sql],
        html: kpis([
          { rot: "Candidaturas", val: fmt.int(linhas.candidatura), lider: true },
          { rot: "Pessoas", val: fmt.int(linhas.pessoa) },
          { rot: "Despesas de campanha", val: fmt.int(linhas.despesa) },
          { rot: "Municípios", val: fmt.int(linhas.municipio) },
        ]) + painel({
          titulo: "Candidaturas por pleito", sub: "Eleições municipais têm cerca de 20 vezes mais candidatos que as gerais, por causa dos vereadores.", span: 6,
          corpo: barras(anos.map((a) => ({ rot: String(a.ano), sub: a.tipo_eleicao === "GERAL" ? "eleição geral" : "eleição municipal", v: a.candidaturas, txt: fmt.int(a.candidaturas), extra: `${fmt.int(a.eleitos)} eleitos`, geral: a.tipo_eleicao === "GERAL" })), { forte: (l) => !l.geral }),
        }) + painel({
          titulo: "As 14 tabelas do modelo", sub: "Linhas contadas agora no banco (ou na última gravação).", span: 6,
          corpo: tabela([
            { t: "Tabela", f: (t) => `<code>${t.tabela}</code>` },
            { t: "Conteúdo", f: (t) => t.desc },
            { t: "Perguntas", f: (t) => t.questoes },
            { t: "Linhas", num: 1, f: (t) => fmt.int(linhas[t.tabela]) },
          ], TABELAS),
        }),
      };
    },
  },

  qualidade: {
    crumb: "O banco", titulo: "Quem é quem: identidade dos políticos",
    async filtros() {
      return { defs: [F.seg("caso", "Caso real", CASOS.map((c) => ({ v: c.id, t: c.aba })))], inicial: { caso: CASOS[0].id } };
    },
    async monta(f) {
      const caso = CASOS.find((c) => c.id === f.caso) ?? CASOS[0];
      const q = await resposta("/api/qualidade");
      const v = Object.fromEntries(q.dados.map((i) => [i.indicador, i.valor]));
      // os exemplos mostram título e CPF: só existem com a API ligada, nunca nos arquivos gravados
      const ex = await resposta(`/api/exemplo?${qs({ titulo: caso.titulo })}`).catch(() => null);
      return {
        achado: `O título de eleitor parecia a chave natural de uma pessoa, mas <b>erra nos dois sentidos</b>. Por isso PESSOA ganhou chave própria (<code>id_pessoa</code>), e título e CPF ficaram na candidatura, como o TSE publicou.`,
        sql: [q.sql, ...(ex ? [ex.sql] : [])],
        html: kpis([
          { rot: "Pessoas com mais de um título", val: fmt.int(v.pessoas_com_mais_de_um_titulo), lider: true },
          { rot: "Títulos usados por pessoas diferentes", val: fmt.int(v.titulos_de_mais_de_uma_pessoa) },
          { rot: "CPF recuperado em 2024", val: fmt.int(v.candidaturas_2024_cpf_recuperado), uni: fmt.pct((100 * v.candidaturas_2024_cpf_recuperado) / v.candidaturas_2024) },
          { rot: "Registros repetidos no mesmo ano", val: fmt.int(v.mesma_pessoa_duas_vezes_no_ano) },
        ]) + painel({
          titulo: caso.aba, sub: caso.texto,
          corpo: ex
            ? tabela([
              { t: "id_pessoa", num: 1, f: (l) => l.id_pessoa },
              { t: "Nome declarado", f: (l) => esc(l.nome_declarado) },
              { t: "Nascimento", f: (l) => (l.data_nascimento ? l.data_nascimento.split("-").reverse().join("/") : "—") },
              { t: "Ano", num: 1, f: (l) => l.ano },
              { t: "Cargo", f: (l) => esc(cargoTxt(l.cargo)) },
              { t: "Local", f: (l) => esc(l.local) },
              { t: "Título declarado", f: (l) => (l.titulo_declarado ? `<code>${l.titulo_declarado}</code>` : "—") },
              { t: "CPF declarado", f: (l) => `<code>${l.cpf_declarado ?? "oculto"}</code>` },
              { t: "Resultado", f: (l) => esc(l.situacao_resultado ?? "—") },
            ], ex.dados)
            : `<p class="vazio">Os registros do caso trazem título de eleitor e CPF, então só aparecem com a API ligada (npm start em api/), nunca nos arquivos publicados.</p>`,
        }),
      };
    },
  },

  q8: {
    n: 8, titulo: "Recursos públicos e privados",
    async filtros() {
      const p = await pares("/api/q8/opcoes");
      return { defs: [parSel(p), F.uf(), F.seg("sem", "Quem não declarou receita", [{ v: "entra", t: "Entra na conta" }, { v: "fora", t: "Fica de fora" }])], inicial: { par: "2024|VEREADOR", uf: "TODAS", sem: "entra" } };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q8?${qs({ ano, cargo, uf: f.uf })}`);
      const { resumo: s, origem } = r.dados;
      const fora = f.sem === "fora";
      const faixas = r.dados.faixas.filter((x) => !fora || x.ordem > 0);
      const cand = faixas.reduce((t, x) => t + x.candidatos, 0), elei = faixas.reduce((t, x) => t + x.eleitos, 0);
      const taxa = cand ? (100 * elei) / cand : null;
      const CURTA = { "Sem receita declarada": "Sem receita", "Nenhum dinheiro público": "0%", "Menos de 25% público": "até 25%", "25% a 50% público": "25% a 50%", "50% a 75% público": "50% a 75%", "75% a 99% público": "75% a 99%", "100% público": "100%" };
      const cats = [...new Set(origem.map((o) => o.categoria))];
      const linhasO = cats.map((c) => {
        const e = origem.find((o) => o.categoria === c && o.grupo === "Eleitos"), n = origem.find((o) => o.categoria === c && o.grupo !== "Eleitos");
        return { c, publico: (e ?? n)?.publico, e: e?.valor, n: n?.valor };
      }).sort((a, b) => (b.e ?? 0) + (b.n ?? 0) - (a.e ?? 0) - (a.n ?? 0));
      const melhor = [...faixas].filter((x) => x.ordem > 0).sort((a, b) => b.taxa_sucesso - a.taxa_sucesso)[0];
      const tudo = faixas.find((x) => x.faixa === "100% público");
      const vezes = s.mediana_receita_nao_eleitos > 0 ? s.mediana_receita_eleitos / s.mediana_receita_nao_eleitos : null;
      return {
        achado: `${fmt.pct(s.pct_publico_do_dinheiro)} do dinheiro arrecadado era público. A maior taxa de sucesso foi na faixa <b>${esc(melhor?.faixa.toLowerCase())}</b> (${fmt.pct(melhor?.taxa_sucesso)}); quem dependeu só de dinheiro público se elegeu <b>${fmt.pct(tudo?.taxa_sucesso)}</b> das vezes.`,
        sql: [r.sql],
        html: kpis([
          { rot: "Parte pública da arrecadação", val: fmt.pct(s.pct_publico_do_dinheiro), lider: true },
          { rot: "Arrecadação total", val: fmt.brlCurto(s.receita_total) },
          { rot: "Candidatos na conta", val: fmt.int(cand) },
          { rot: "Sem receita declarada", val: fmt.int(s.sem_receita), uni: fora ? "fora da conta" : "" },
        ]) + painel({
          titulo: "Quanto da receita veio de fundos públicos", sub: `${cargoTxt(cargo)}, ${ano}, ${ufTxt(f.uf)}: de cada 100 candidatos de cada faixa, quantos se elegeram. Fundo Especial e Fundo Partidário são públicos; o resto é privado.`, span: 7,
          corpo: colunas(faixas.map((x) => ({ rot: CURTA[x.faixa] ?? x.faixa, sub: `${fmt.int(x.candidatos)} cand.`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso), forte: x.ordem > 0, apagada: x.ordem === 0 })), { ref: { v: taxa, txt: `todos: ${fmt.pct(taxa)}` } }) + `<p class="colunas__eixo-x">parte pública da receita do candidato →</p>`,
          dados: { nome: `q8_faixas_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: faixas, cols: [["Faixa", (x) => x.faixa], ["Candidatos", (x) => fmt.int(x.candidatos), 1], ["Eleitos", (x) => fmt.int(x.eleitos), 1], ["Taxa de sucesso", (x) => fmt.pct(x.taxa_sucesso), 1], ["Receita mediana", (x) => fmt.brl(x.receita_mediana), 1]] },
        }) + painel({
          titulo: "De onde veio o dinheiro", sub: "Valor arrecadado por origem; em cobalto, o dinheiro público.", span: 5,
          corpo: barras(linhasO.map((o) => ({ rot: esc(o.c), sub: `eleitos ${fmt.brlCurto(o.e)} · não eleitos ${fmt.brlCurto(o.n)}`, v: (o.e ?? 0) + (o.n ?? 0), txt: fmt.brlCurto((o.e ?? 0) + (o.n ?? 0)), publico: o.publico })), { forte: (l) => l.publico }),
          dados: { nome: `q8_origem_${ano}_${cargo}_${f.uf}`.replace(/ /g, "_"), linhas: linhasO, cols: [["Origem", (o) => o.c], ["Público", (o) => (o.publico ? "sim" : "não")], ["Eleitos", (o) => fmt.brl(o.e), 1], ["Não eleitos", (o) => fmt.brl(o.n), 1]] },
        }) + painel({
          titulo: "Quanto arrecadou quem ganhou", sub: `Receita por candidato ${ufTxt(f.uf)}, na mediana.`,
          corpo: `<div class="duelo"><div><span>Eleito típico</span><b class="num">${fmt.brlCurto(s.mediana_receita_eleitos)}</b><small>receita mediana dos eleitos</small></div><div class="duelo__x">${vezes ? `<b class="num">${fmt.dec(vezes)}×</b><small>a diferença</small>` : ""}</div><div><span>Derrotado típico</span><b class="num">${fmt.brlCurto(s.mediana_receita_nao_eleitos)}</b><small>receita mediana dos não eleitos</small></div></div>`,
        }),
      };
    },
  },

  q9: {
    n: 9, titulo: "Onde o candidato investe em propaganda",
    async filtros() {
      const cargos = (await resposta("/api/q9/opcoes")).dados;
      return {
        defs: [F.select("cargo", "Cargo", [{ v: "TODOS", t: "Todos os cargos" }, ...cargos.map((c) => ({ v: c, t: cargoTxt(c) }))]), F.seg("ano", "Eleição", [2018, 2020, 2022, 2024].map((a) => ({ v: a, t: String(a) }))), F.seg("escopo", "Palavras de", [{ v: "PROPAGANDA", t: "Propaganda" }, { v: "TODAS", t: "Todas as despesas" }]), F.uf()],
        inicial: { cargo: "VEREADOR", ano: 2024, escopo: "PROPAGANDA", uf: "TODAS" },
      };
    },
    async monta(f) {
      const cat = await resposta(`/api/q9/categorias?${qs({ cargo: f.cargo, uf: f.uf })}`);
      const linhasAno = cat.dados.filter((x) => x.ano === Number(f.ano));
      let pal;
      try { pal = await resposta(`/api/q9/palavras?${qs({ ano: f.ano, cargo: f.cargo, escopo: f.escopo, uf: f.uf })}`); } catch { pal = { sql: "", dados: [] }; }
      const total = linhasAno.reduce((s, x) => s + x.valor, 0);
      const porGrupo = Object.values(linhasAno.reduce((m, x) => { (m[x.grupo] ??= { grupo: x.grupo, propaganda: x.propaganda, valor: 0 }).valor += x.valor; return m; }, {})).sort((a, b) => b.valor - a.valor);
      const prop = porGrupo.filter((g) => g.propaganda).reduce((s, g) => s + g.valor, 0);
      const net = porGrupo.find((g) => g.grupo === "Internet")?.valor ?? 0;
      const ps = pal.dados.slice(0, 40);
      const max = ps[0]?.despesas ?? 1;
      if (!linhasAno.length) return { achado: "Sem despesas para esse cargo nesse ano.", sql: [cat.sql], html: painel({ titulo: "Sem dados", corpo: `<p class="vazio">O cargo escolhido não disputou eleição em ${f.ano}.</p>` }) };
      return {
        achado: `Em ${f.ano}, <b>${fmt.pct((prop / total) * 100)}</b> do gasto foi propaganda; a internet ficou com <b>${fmt.pct((net / total) * 100)}</b> do total.`,
        sql: [cat.sql, pal.sql].filter(Boolean),
        html: kpis([
          { rot: "Parte do gasto em propaganda", val: fmt.pct((prop / total) * 100), lider: true },
          { rot: "Gasto total", val: fmt.brlCurto(total) },
          { rot: "Internet, do total", val: fmt.pct((net / total) * 100) },
          { rot: "Categorias de despesa", val: fmt.int(linhasAno.length) },
        ]) + painel({
          titulo: "Para onde foi o dinheiro", sub: "As 41 categorias do TSE reunidas em seis grupos.", span: 6,
          corpo: barras(porGrupo.map((g) => ({ rot: g.grupo, sub: g.propaganda ? "Propaganda" : "Não é propaganda", v: g.valor, txt: fmt.pct((g.valor / total) * 100), extra: fmt.brlCurto(g.valor), propaganda: g.propaganda })), { forte: (l) => l.propaganda }),
          dados: { nome: `q9_grupos_${f.ano}_${f.cargo}_${f.uf}`.replace(/ /g, "_"), linhas: porGrupo, cols: [["Grupo", (g) => g.grupo], ["Propaganda", (g) => (g.propaganda ? "sim" : "não")], ["Valor", (g) => fmt.brl(g.valor), 1], ["Parte do total", (g) => fmt.pct((g.valor / total) * 100), 1]] },
        }) + painel({
          titulo: "Palavras mais escritas", sub: "Nas descrições das despesas; cada palavra conta uma vez por despesa.", span: 6,
          corpo: ps.length ? `<div class="nuvem" id="q9-nuvem" role="img" aria-label="Nuvem de palavras: ${esc(ps.slice(0, 8).map((w) => w.palavra.toLowerCase()).join(", "))} e outras"></div>` : `<p class="vazio">Sem palavras gravadas para esses filtros.</p>`,
          dados: { nome: `q9_palavras_${f.ano}_${f.cargo}_${f.escopo}_${f.uf}`.replace(/ /g, "_"), linhas: ps, cols: [["Palavra", (w) => esc(w.palavra.toLowerCase())], ["Despesas", (w) => fmt.int(w.despesas), 1], ["Valor", (w) => fmt.brl(w.valor), 1]] },
        }) + painel({
          titulo: "Categorias do TSE", sub: "As dez maiores no ano.",
          corpo: tabela([
            { t: "Categoria", f: (x) => esc(x.tipo_despesa) },
            { t: "Grupo", f: (x) => esc(x.grupo) },
            { t: "Candidatos", num: 1, f: (x) => fmt.int(x.candidatos) },
            { t: "Despesas", num: 1, f: (x) => fmt.int(x.despesas) },
            { t: "Valor", num: 1, f: (x) => fmt.brlCurto(x.valor) },
          ], [...linhasAno].sort((a, b) => b.valor - a.valor).slice(0, 10)),
        }),
        depois: () => { const alvo = document.getElementById("q9-nuvem"); if (alvo) nuvemDePalavras(alvo, ps.map((w) => ({ texto: w.palavra.toLowerCase(), peso: w.despesas, dica: `${fmt.int(w.despesas)} despesas, ${fmt.brlCurto(w.valor)}` }))); },
      };
    },
  },

  q10: {
    n: 10, titulo: "Carreira de um político",
    async filtros() {
      return { defs: [{ html: `<div class="campo busca-pessoa"><label for="q10-nome"><span>Buscar pelo nome</span></label><input id="q10-nome" type="search" autocomplete="off" placeholder="Ex.: Requião, Barbalho, Amin" role="combobox" aria-expanded="false" aria-controls="q10-sug"><div class="sugestoes" id="q10-sug" role="listbox" hidden></div></div>` }], inicial: { id: 16894 } };
    },
    async monta(f) {
      const [r, idx, fp, ce] = await Promise.all([resposta(`/api/q10/pessoa/${f.id}`), arquivo("q10_indice.json"), arquivo("site/fotos_pessoa.json").catch(() => ({})),
        arquivo(`site/carreira/${Number(f.id) % 32}.json`).catch(() => null)]);
      const c = r.dados.carreira;
      /* escolaridade e gasto de cada candidatura (vw_site_carreira), ligados por ano, cargo e local */
      const ex = (ce?.pessoas[f.id] ?? []).map((l) => Object.fromEntries(ce.colunas.map((k, i) => [k, l[i]])));
      const porCand = new Map(ex.map((e) => [`${e.ano}|${e.cargo}|${semAcento(e.local)}`, e]));
      const extra = (x) => porCand.get(`${x.ano}|${x.cargo}|${semAcento(x.local)}`) ?? ex.find((e) => e.ano === x.ano && e.cargo === x.cargo);
      const sentenca = (t) => t.charAt(0) + t.slice(1).toLowerCase();
      const grau = (g) => (g ? sentenca(g.replace(/^ENSINO /, "")) : "Não informado");
      const centavos = (v) => `R$ ${nf(2).format(v)}`;
      const porVoto = (e) => (e?.votos > 0 && e.gasto != null ? e.gasto / e.votos : null);
      const variacao = (de, para) => (de > 0 ? (para / de >= 1.95 ? `×${nf(1).format(para / de)}` : `${para >= de ? "+" : "−"}${nf(0).format(Math.abs(para / de - 1) * 100)}%`) : "");
      const ex2 = c.map(extra);
      const comConta = ex2.filter((e) => e && e.gasto !== null);
      const graus = ex2.filter((e) => e?.grau_instrucao);
      const pat = ex2.filter((e) => e && e.patrimonio != null);
      const prop = ex2.filter((e) => porVoto(e) != null);
      let antPat = null;
      const fichas = ex2.map((e, i) => {
        const ant = i ? ex2[i - 1] : null;
        const itens = [["Escolaridade", grau(e?.grau_instrucao), "forte", ant && ant.grau_instrucao === e?.grau_instrucao],
          ["Ocupação", e?.ocupacao ? sentenca(e.ocupacao) : "Não informada", "", ant && ant.ocupacao === e?.ocupacao]];
        if (e?.gasto != null) {
          itens.push(["Gasto", fmt.brlCurto(e.gasto), "forte"]);
          const v = antPat > 0 ? variacao(antPat, e.patrimonio) : "";
          itens.push(["Patrimônio", `${e.patrimonio > 0 ? fmt.brlCurto(e.patrimonio) : "nada declarado"}${v ? ` <small class="muted" title="Em relação ao patrimônio declarado na candidatura anterior">${v}</small>` : ""}`]);
          antPat = e.patrimonio;
          if (porVoto(e) != null) itens.push(["Votos", fmt.int(e.votos)], ["Custo por voto", centavos(porVoto(e))]);
        }
        return `<dl class="etapa__ficha">${itens.map(([t, v, cls, igual]) => `<div class="${cls}${igual ? " igual" : ""}"><dt>${t}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
      });
      // com a API, a foto de cada candidatura vem dela (qualquer pessoa); sem ela, do índice gravado
      const fotos = r.dados.fotos?.length ? r.dados.fotos : fp[String(f.id)] ?? [];
      const porAno = new Map(fotos.map(([ano, idc]) => [ano, idc]));
      const ultima = fotos[fotos.length - 1];
      const achado = idx.indice.find((i) => i.achado.id_pessoa === Number(f.id))?.achado;
      const vit = c.filter((x) => x.resultado === "VITÓRIA").length;
      const partidos = [...new Set(c.map((x) => x.partido))];
      const nome = titulo(achado?.nome ?? r.dados.nomes[r.dados.nomes.length - 1]);
      return {
        achado: `<b>${esc(nome)}</b> ${c.length === 1 ? `concorreu uma vez, em ${c[0].ano}, pelo ${esc(c[0].partido)}, e ${vit ? "venceu" : "não venceu"}.` : `concorreu ${c.length} vezes de ${c[0].ano} a ${c[c.length - 1].ano} e venceu ${vit}, por ${partidos.length} ${partidos.length === 1 ? "partido" : "partidos"}.`}`,
        sql: [idx.sql.replaceAll("{{nome}}", nome.toUpperCase()), r.sql],
        html: kpis([
          { rot: "Candidaturas", val: fmt.int(c.length), lider: true },
          { rot: "Vitórias", val: fmt.int(vit) },
          { rot: "Partidos", val: fmt.int(partidos.length) },
          { rot: "Escolaridade", val: graus.length ? grau(graus[graus.length - 1].grau_instrucao) : "—", texto: true },
          { rot: "Gasto desde 2018", val: comConta.length ? fmt.brlCurto(comConta.reduce((t, e) => t + e.gasto, 0)) : "—" },
          { rot: pat.length ? `Patrimônio em ${pat[pat.length - 1].ano}` : "Patrimônio", val: pat.length ? fmt.brlCurto(pat[pat.length - 1].patrimonio) : "—", uni: pat.length > 1 ? `${variacao(pat[0].patrimonio, pat[pat.length - 1].patrimonio)} desde ${pat[0].ano}`.replace(/^ desde.*/, "") : "" },
          { rot: "Custo por voto", val: prop.length ? centavos(porVoto(prop[prop.length - 1])) : "—", uni: prop.length ? `em ${prop[prop.length - 1].ano}` : "" },
        ]) + painel({
          titulo: "A carreira, pleito a pleito", sub: "Cada ponto é uma candidatura, na linha do cargo disputado. A sigla aparece na estreia e a cada troca de partido.",
          corpo: `<div class="trilha__graf" id="q10-trilha"></div>${chave([["var(--accent)", "Venceu"], ["var(--surface)", "Suplente"], ["var(--second)", "Perdeu"]])}`,
          dados: { nome: `q10_carreira_${f.id}`, linhas: c, cols: [["Ano", (x) => x.ano], ["Cargo", (x) => esc(cargoTxt(x.cargo))], ["Local", (x) => esc(x.local === "BR" ? "Brasil" : x.local.length === 2 ? x.local : titulo(x.local))], ["Partido", (x) => esc(x.partido)], ["Resultado", (x) => (x.resultado === "VITÓRIA" ? "Eleito" : esc(titulo(x.detalhe_resultado || x.resultado)))]] },
        }) + painel({
          titulo: nome, sub: `${r.dados.nomes.length > 1 ? `Também registrado como ${r.dados.nomes.filter((n) => titulo(n) !== nome).map((n) => esc(titulo(n))).join(", ")}. ` : ""}${achado?.data_nascimento ? `Nascido em ${achado.data_nascimento.split("-").reverse().join("/")}.` : ""}`,
          corpo: `${ultima ? `<div class="pessoa-topo">${foto(ultima[1], `Foto de ${nome} no registro da candidatura de ${ultima[0]}`, "foto-g")}<p class="muted">Fotos do registro de cada candidatura no TSE, de 2018 em diante. Gasto, patrimônio e votos só existem de 2018 em diante; para prefeito, governador e senador, os votos são os do 1º turno. Em cinza, o que repete a candidatura anterior.</p></div>` : ""}<ol class="carreira">${c.map((x, i) => `
            <li class="etapa"><span class="etapa__ano">${x.ano}</span><span class="etapa__foto">${porAno.has(x.ano) ? foto(porAno.get(x.ano), `Foto de ${nome} em ${x.ano}`) : ""}</span>
              <span class="etapa__o"><b>${esc(cargoTxt(x.cargo))}, ${esc(x.local === "BR" ? "Brasil" : x.local.length === 2 ? x.local : titulo(x.local))}</b><span>${esc(x.partido)}${x.evento ? ` · ${esc(x.evento.charAt(0) + x.evento.slice(1).toLowerCase())}` : ""}${x.troca_partido ? ` · ${esc(x.troca_partido)}` : ""}</span></span>
              <span class="selo${x.resultado === "VITÓRIA" ? " ganhou" : ""}">${x.resultado === "VITÓRIA" ? "Eleito" : esc(titulo(x.detalhe_resultado || x.resultado))}</span>${fichas[i]}</li>`).join("")}</ol>`,
        }),
        depois: () => {
          ligaBuscaPessoa(idx.indice);
          const t = window.Trilha.desenha(document.getElementById("q10-trilha"), c, { soTrocas: true });
          t.svg.dataset.passo = 2;
          t.siglas.classList.add("is-on");
          t.caminho.style.strokeDashoffset = t.comp;
          setTimeout(() => { t.caminho.style.strokeDashoffset = 0; t.svg.classList.add("is-visto"); }, 60);
        },
      };
    },
  },
};
const ORDEM = ["q1", "q2", "q8", "q9", "q5", "q3", "q4", "q6", "q7", "q10", "banco", "qualidade"];

/* ---------- nuvem de palavras (Q9): as de mais peso no centro, as outras em volta ----------
   Cada palavra procura lugar numa espiral que sai do centro; a primeira posição sem encostar nas já postas vale.
   Como entram da maior para a menor, as grandes ficam no meio. A largura de cada palavra é medida num canvas. */
async function nuvemDePalavras(alvo, palavras) {
  try { await document.fonts.ready; } catch {}
  if (!alvo.isConnected || !palavras.length) return;
  const W = alvo.clientWidth || 560, H = Math.round(Math.min(440, Math.max(300, W * 0.72)));
  const max = palavras[0].peso || 1, min = palavras.at(-1).peso || 0;
  const ctx = document.createElement("canvas").getContext("2d");
  const familia = getComputedStyle(alvo).fontFamily;
  const postas = [];
  const livre = (r) => postas.every((p) => r.x + r.w + 6 < p.x || p.x + p.w + 6 < r.x || r.y + r.h + 2 < p.y || p.y + p.h + 2 < r.y);
  let html = "";
  palavras.forEach((p, i) => {
    const t = max > min ? (p.peso - min) / (max - min) : 1;
    const tam = Math.round(13 + Math.sqrt(t) * (W > 480 ? 46 : 32));
    const peso = t > 0.3 ? 800 : t > 0.08 ? 600 : 500;
    ctx.font = `${peso} ${tam}px ${familia}`;
    const w = ctx.measureText(p.texto).width + 2, h = tam * 0.92;
    for (let k = 0; k < 2400; k++) {
      const a = k * 0.22, raio = 1.15 * a;
      const r = { x: W / 2 + raio * 1.75 * Math.cos(a) - w / 2, y: H / 2 + raio * Math.sin(a) - h / 2, w, h };
      if (r.x < 0 || r.y < 0 || r.x + w > W || r.y + h > H || !livre(r)) continue;
      postas.push(r);
      html += `<span style="left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;font-size:${tam}px;font-weight:${peso};--i:${i}" class="${t > 0.3 ? "n1" : t > 0.08 ? "n2" : "n3"}" title="${esc(p.dica)}">${esc(p.texto)}</span>`;
      break;
    }
  });
  alvo.style.height = `${H}px`;
  alvo.innerHTML = html;
}

/* ---------- busca por município (Q1) ---------- */
/* Q1 com um estado escolhido: o preço da cadeira em cada cidade dele, no lugar da lista de estados */
async function cidadesQ1(cargo, ano, uf) {
  const caixa = document.getElementById("q1-cidades");
  if (!caixa) return;
  const f = await arquivo(`q1_municipio_${cargo}.json`);
  const ms = f.linhas.filter((l) => l.uf === uf && l.ano === ano && l.custo_por_cadeira != null).sort((a, b) => b.custo_por_cadeira - a.custo_por_cadeira);
  if (!document.body.contains(caixa)) return;
  caixa.innerHTML = ms.length
    ? barras(ms.map((m) => ({ rot: esc(m.municipio), sub: `${fmt.int(m.candidatos)} candidatos, ${fmt.int(m.cadeiras)} ${m.cadeiras === 1 ? "cadeira" : "cadeiras"}`, v: m.custo_por_cadeira, txt: fmt.brlCurto(m.custo_por_cadeira) })), { forte: () => true })
    : `<p class="vazio">Nenhuma cidade com gasto declarado nesse ano.</p>`;
}
async function ligaMunicipio(cargo, uf) {
  const input = document.getElementById("q1-mun"), saida = document.getElementById("q1-mun-res");
  const f = await arquivo(`q1_municipio_${cargo}.json`);
  const por = new Map();
  for (const l of f.linhas) {
    if (uf !== "TODAS" && l.uf !== uf) continue;
    const k = `${l.municipio_busca}|${l.uf}`;
    if (!por.has(k)) por.set(k, { nome: l.municipio, uf: l.uf, busca: l.municipio_busca, anos: {} });
    por.get(k).anos[l.ano] = l;
  }
  const todos = [...por.values()];
  const mostra = () => {
    const q = semAcento(input.value.trim());
    const achados = (q.length >= 2 ? todos.filter((m) => m.busca.includes(q)) : todos.filter((m) => m.anos[2024]).sort((a, b) => b.anos[2024].custo_por_cadeira - a.anos[2024].custo_por_cadeira)).slice(0, 8);
    saida.innerHTML = q.length < 2 ? `<p class="muted" style="font-size:14px;margin-bottom:8px">As oito cadeiras mais caras em 2024${uf === "TODAS" ? "" : ` em ${NOME_UF[uf]}`}.</p>` + tab(achados) : tab(achados);
  };
  const tab = (ms) => tabela([
    { t: "Município", f: (m) => `${esc(m.nome)} <span class="muted">${m.uf}</span>` },
    { t: "Candidatos 2024", num: 1, f: (m) => fmt.int(m.anos[2024]?.candidatos) },
    { t: "Cadeiras", num: 1, f: (m) => fmt.int(m.anos[2024]?.cadeiras ?? m.anos[2020]?.cadeiras) },
    { t: "Por cadeira, 2020", num: 1, f: (m) => fmt.brl(m.anos[2020]?.custo_por_cadeira) },
    { t: "Por cadeira, 2024", num: 1, f: (m) => fmt.brl(m.anos[2024]?.custo_por_cadeira) },
  ], ms);
  input.addEventListener("input", mostra);
  mostra();
  const sql = document.getElementById("sql");
  sql.textContent += `\n\n${f.sql.replaceAll("{{nome}}", input.value || "...")}`;
}

/* ---------- busca de político (Q10) ---------- */
function ligaBuscaPessoa(indice) {
  const input = document.getElementById("q10-nome"), lista = document.getElementById("q10-sug");
  const abre = (id) => { estado.f.id = id; vai(); };
  /* com a API ligada (npm start em api/), a busca pergunta ao banco e acha qualquer uma das 1,8 milhão de pessoas;
     sem ela, procura no índice gravado (q10_indice.json) */
  let vez = 0;
  input.addEventListener("input", async () => {
    const meu = ++vez;
    const palavras = input.value.trim().split(/\s+/).filter((p) => p.length >= 2).map(semAcento);
    if (!palavras.length) { lista.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    let achados;
    if (await window.Dados.aoVivo) {
      await new Promise((r) => setTimeout(r, 180));
      if (meu !== vez) return;
      achados = ((await resposta(`/api/q10/busca?${qs({ nome: input.value.trim() })}`).catch(() => ({ dados: [] }))).dados ?? []).slice(0, 8);
      if (meu !== vez) return;
    } else achados = indice.filter((i) => i.nomes.some((n) => palavras.every((p) => n.includes(p)))).slice(0, 8).map((i) => i.achado);
    lista.innerHTML = achados.length
      ? achados.map((a, i) => `<button type="button" role="option" aria-selected="${i === 0}" data-id="${a.id_pessoa}"><span>${esc(titulo(a.nome))}</span><small class="num">${a.candidaturas} candidaturas, ${a.primeira} a ${a.ultima}</small></button>`).join("")
      : `<button type="button" disabled><span>Ninguém com esse nome entre os políticos da busca: os 2.500 com mais candidaturas, os candidatos a presidente e quem já se elegeu governador, senador ou deputado federal.</span></button>`;
    lista.hidden = false;
    input.setAttribute("aria-expanded", "true");
  });
  input.addEventListener("keydown", (e) => {
    const ops = [...lista.querySelectorAll("[data-id]")];
    const i = ops.findIndex((o) => o.getAttribute("aria-selected") === "true");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ops.length) return;
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + ops.length) % ops.length;
      ops.forEach((o, j) => o.setAttribute("aria-selected", String(j === n)));
    } else if (e.key === "Enter" && ops[i]) { e.preventDefault(); abre(ops[i].dataset.id); }
    else if (e.key === "Escape") lista.hidden = true;
  });
  lista.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) abre(b.dataset.id); });
}

/* ---------- gráfico de linhas (Q6) ---------- */
function linhas(el, anos, series) {
  const W = el.clientWidth || 640, Hh = 260, esq = 36, dir = 16, cima = 10, baixo = 28;
  const vals = series.flatMap((s) => s.v).filter((v) => v != null);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const x = (i) => esq + (i / (anos.length - 1)) * (W - esq - dir);
  const y = (v) => cima + (1 - (v - lo) / (hi - lo)) * (Hh - cima - baixo);
  const passo = hi - lo > 6 ? 2 : 1;
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Idade média dos eleitos por eleição">`;
  for (let v = Math.ceil(lo / passo) * passo; v <= hi; v += passo) s += `<line x1="${esq}" x2="${W - dir}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${esq - 8}" y="${y(v)}" text-anchor="end" dominant-baseline="middle" font-size="12" fill="var(--muted)">${v}</text>`;
  anos.forEach((a, i) => (s += `<text x="${x(i)}" y="${Hh - 6}" text-anchor="middle" font-size="12" fill="var(--muted)">${a}</text>`));
  for (const se of series) s += `<path d="${se.v.map((v, i) => (v == null ? "" : `${i ? "L" : "M"}${x(i)},${y(v)}`)).join("")}" fill="none" stroke="${se.cor}" stroke-width="${se.larg}" stroke-linejoin="round"/>`;
  s += `<line id="q6-guia" y1="${cima}" y2="${Hh - baixo}" stroke="var(--text)" stroke-width="1" opacity="0"/><rect id="q6-hit" x="${esq}" y="0" width="${W - esq - dir}" height="${Hh}" fill="transparent"/></svg><p class="muted num" id="q6-leitura" style="font-size:13px;min-height:1.5em;margin-top:6px">Passe o mouse sobre o gráfico para ler cada eleição.</p>`;
  el.innerHTML = s;
  const hit = el.querySelector("#q6-hit"), guia = el.querySelector("#q6-guia"), leitura = el.querySelector("#q6-leitura");
  hit.addEventListener("pointermove", (e) => {
    const r = el.querySelector("svg").getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(anos.length - 1, Math.round(((px - esq) / (W - esq - dir)) * (anos.length - 1))));
    guia.setAttribute("x1", x(i)); guia.setAttribute("x2", x(i)); guia.setAttribute("opacity", 0.4);
    leitura.innerHTML = `<b>${anos[i]}</b>: ${series.map((se) => `${se.nome.toLowerCase()} ${fmt.dec(se.v[i])} anos`).join(" · ")}`;
  });
  hit.addEventListener("pointerleave", () => guia.setAttribute("opacity", 0));
}

/* ---------- navegação e estado ---------- */
const estado = { q: "q1", f: {}, defs: [], extra: {} };
let pedido = 0;

function leHash() {
  const [q, busca] = location.hash.slice(1).split("?");
  return { q: PERGUNTAS[q] ? q : "q1", f: Object.fromEntries(new URLSearchParams(busca ?? "")) };
}
function escreveHash() {
  const p = new URLSearchParams(estado.f).toString();
  history.replaceState(null, "", `#${estado.q}${p ? `?${p}` : ""}`);
}

async function abrePergunta(q, fHash = {}) {
  const P = PERGUNTAS[q];
  estado.q = q;
  document.querySelectorAll("#menu a").forEach((a) => (a.dataset.q === q ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.getElementById("menu-fone").value = q;
  document.getElementById("crumb").textContent = P.crumb ?? `Pergunta ${P.n}`;
  /* o "voltar à história" leva ao fecho do capítulo desta pergunta (as telas do banco voltam ao começo) */
  document.querySelectorAll("[data-volta]").forEach((a) => (a.href = P.n ? `index.html#q${P.n}-fim` : "index.html"));
  document.getElementById("titulo").textContent = P.titulo;
  // o título da aba é o mesmo em todo o site
  const { defs, inicial, ...extra } = await P.filtros();
  estado.defs = defs;
  estado.extra = extra;
  estado.f = { ...inicial };
  for (const [k, v] of Object.entries(fHash)) if (k in inicial) estado.f[k] = v;
  vai();
}

/* A eleição de 2026 entra com o que o TSE já tinha publicado no dia do download; a nota aparece quando o filtro é 2026. */
const nota2026 = (f) => `<p class="nota-2026"><b>2026:</b> arquivos do TSE baixados em 16/11/2026, com o 2º turno já decidido.${String(f.par ?? "").includes("DEPUTADO") ? " Nesse download, os deputados federais e estaduais do Amapá ainda vinham sem resultado e sem votos nominais, e ficam de fora." : ""} <a href="sobre.html#limites">Limitações</a></p>`;
const ehDe2026 = (f) => String(f.par ?? f.ano ?? "").startsWith("2026");

async function vai() {
  const meu = ++pedido;
  const P = PERGUNTAS[estado.q];
  const corpo = document.getElementById("corpo");
  corpo.classList.add("carregando");
  P.ajusta?.(estado.f);
  desenhaFiltros(estado.defs, estado.f, mudou);
  escreveHash();
  try {
    const antes = dadosDosPaineis;
    dadosDosPaineis = [];
    const t = await P.monta(estado.f);
    if (meu !== pedido) { dadosDosPaineis = antes; return; }
    if (meu !== pedido) return;
    document.getElementById("achado").innerHTML = t.achado ?? "";
    corpo.innerHTML = (ehDe2026(estado.f) && estado.q !== "q7" ? nota2026(estado.f) : "") + t.html;
    document.getElementById("sql").textContent = t.sql.join("\n\n");
    t.depois?.();
  } catch (e) {
    if (meu !== pedido) return;
    document.getElementById("achado").textContent = "";
    corpo.innerHTML = `<p class="erro painel">Não foi possível carregar esta consulta: ${esc(e.message)}</p>`;
    document.getElementById("sql").textContent = "";
  }
  corpo.classList.remove("carregando");
}
function mudou(nome, v) { estado.f[nome] = v; vai(); }

/* menu do celular */
const sel = document.getElementById("menu-fone");
sel.innerHTML = ORDEM.map((q) => `<option value="${q}">${PERGUNTAS[q].n ? `${PERGUNTAS[q].n}. ` : ""}${PERGUNTAS[q].titulo}</option>`).join("");
sel.addEventListener("change", () => { location.hash = sel.value; });

/* o SQL fica recolhido: abre no botão do bloco ou no "Ver SQL" de qualquer gráfico */
function abreSql(abrir) {
  const caixa = document.getElementById("sql-caixa"), botao = document.getElementById("ver-sql");
  caixa.hidden = !abrir;
  document.getElementById("copiar").hidden = !abrir;
  botao.setAttribute("aria-expanded", String(abrir));
  botao.textContent = abrir ? "Esconder SQL" : "Ver SQL";
}
document.getElementById("ver-sql").addEventListener("click", () => abreSql(document.getElementById("sql-caixa").hidden));
document.getElementById("corpo").addEventListener("click", (e) => { if (e.target.closest('.ferr a[href="#sql-t"]')) abreSql(true); });

document.getElementById("copiar").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText(document.getElementById("sql").textContent); e.target.textContent = "Copiado"; }
  catch { e.target.textContent = "Selecione e copie"; }
  setTimeout(() => (e.target.textContent = "Copiar SQL"), 1600);
});

document.getElementById("corpo").addEventListener("click", (e) => { const b = e.target.closest("button[data-ferr]"); if (b) ferramenta(b); });

/* as teclas de 1 a 9 abrem a pergunta de mesmo número, e o 0 abre a décima, como na história */
addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (!/^[0-9]$/.test(e.key)) return;
  const q = `q${e.key === "0" ? 10 : e.key}`;
  if (q !== estado.q) { location.hash = q; scrollTo({ top: 0 }); }
});

addEventListener("hashchange", () => { const h = leHash(); if (h.q !== estado.q) abrePergunta(h.q, h.f); });
const inicio = leHash();
abrePergunta(inicio.q, inicio.f);
