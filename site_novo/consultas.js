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
const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Em)\b/g, (w) => w.toLowerCase()).replace(/(^|\s)(?!Dr\b)([B-DF-HJ-NP-TV-Z][b-df-hj-np-tv-z]{1,3})(?=\s|$)/g, (m, a, w) => a + w.toUpperCase());
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const UFS = ["TODAS", "AL", "PA", "PB", "PR", "SC", "SE"];
const NOME_UF = { TODAS: "Seis estados", AL: "Alagoas", PA: "Pará", PB: "Paraíba", PR: "Paraná", SC: "Santa Catarina", SE: "Sergipe" };
const cargoTxt = (c) => titulo(c).replace("Deputado Federal", "Deputado federal").replace("Deputado Estadual", "Deputado estadual");
const parTxt = (p) => `${p.ano} · ${cargoTxt(p.cargo)}`;
const DO_UF = { AL: "de Alagoas", PA: "do Pará", PB: "da Paraíba", PR: "do Paraná", SC: "de Santa Catarina", SE: "de Sergipe" };
const EM_UF = { AL: "em Alagoas", PA: "no Pará", PB: "na Paraíba", PR: "no Paraná", SC: "em Santa Catarina", SE: "em Sergipe" };
const ufTxt = (u) => (u === "TODAS" ? "nos seis estados" : EM_UF[u]);

/* ---------- blocos de tela ---------- */
function kpis(itens) {
  return `<div class="kpis" style="--n:${itens.length}">${itens.map((k) => `
    <div class="kpi${k.lider ? " lider" : ""}"><span>${k.rot}</span><b>${k.val}${k.uni ? ` <small>${k.uni}</small>` : ""}</b></div>`).join("")}</div>`;
}
function painel({ titulo: t, sub, span = 12, corpo, id }) {
  return `<section class="painel${span < 12 ? ` s${span}` : ""}"${id ? ` id="${id}"` : ""}>
    <h2>${t}</h2>${sub ? `<p>${sub}</p>` : ""}<div class="painel__corpo">${corpo}</div></section>`;
}
/** Lista em que a própria linha é a barra: largura = valor / maior valor. */
function barras(linhas, { forte } = {}) {
  const max = Math.max(...linhas.map((l) => l.v), 0) || 1;
  return `<div class="barras">${linhas.map((l) => `
    <div class="barra${forte && forte(l) ? " forte" : ""}" style="--w:${((l.v / max) * 100).toFixed(1)}%">
      <span class="rot">${l.rot}${l.sub ? `<small>${l.sub}</small>` : ""}</span>
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
  uf: () => F.seg("uf", "Estado", UFS.map((u) => ({ v: u, t: u === "TODAS" ? "Todos" : u }))),
};
function desenhaFiltros(defs, valores, aoMudar) {
  const form = document.getElementById("filtros");
  form.innerHTML = defs.map((d) => {
    if (d.tipo === "select") return `<label class="campo"><span>${d.rot}</span><select name="${d.nome}">${d.opcoes.map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(valores[d.nome]) ? " selected" : ""}>${esc(o.t)}</option>`).join("")}</select></label>`;
    if (d.tipo === "seg") return `<div class="campo"><span id="rot-${d.nome}">${d.rot}</span><div class="seg" role="group" aria-labelledby="rot-${d.nome}">${d.opcoes.map((o) => `<button type="button" data-nome="${d.nome}" data-v="${esc(o.v)}" aria-pressed="${String(o.v) === String(valores[d.nome])}">${esc(o.t)}</button>`).join("")}</div></div>`;
    return d.html;
  }).join("");
  form.onchange = (e) => { if (e.target.name) aoMudar(e.target.name, e.target.value); };
  form.onclick = (e) => { const b = e.target.closest("button[data-nome]"); if (b) aoMudar(b.dataset.nome, b.dataset.v); };
  form.onsubmit = (e) => e.preventDefault();
}

/* ---------- as perguntas ---------- */
const PARES_Q5 = [[2018, "DEPUTADO FEDERAL"], [2018, "DEPUTADO ESTADUAL"], [2020, "VEREADOR"], [2022, "DEPUTADO FEDERAL"], [2022, "DEPUTADO ESTADUAL"], [2024, "VEREADOR"]];
const parSel = (pares) => F.select("par", "Eleição", pares.map((p) => ({ v: `${p.ano}|${p.cargo}`, t: parTxt(p) })));
const dePar = (f) => { const [ano, cargo] = f.par.split("|"); return { ano: Number(ano), cargo }; };
async function pares(url) { return (await resposta(url)).dados; }

const PERGUNTAS = {
  q1: {
    n: 1, titulo: "Quanto custa uma cadeira",
    async filtros() {
      const p = await pares("/api/q1/opcoes");
      return { defs: [parSel(p), F.uf(), F.seg("zero", "Quem não declarou gasto", [{ v: "true", t: "Conta como zero" }, { v: "false", t: "Fica de fora" }])], inicial: { par: "2022|DEPUTADO FEDERAL", uf: "TODAS", zero: "true" } };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
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
          { rot: "Custo por cadeira", val: fmt.brl(c ? g / c : null), lider: true },
          { rot: "Gasto total das campanhas", val: fmt.brlCurto(g) },
          { rot: "Cadeiras em disputa", val: fmt.int(c) },
          { rot: "Candidatos por cadeira", val: fmt.dec(c ? n / c : null) },
        ]) + painel({
          titulo: "Custo por cadeira em cada estado", sub: "Gasto de todos os candidatos do cargo dividido pelas vagas.", span: 7,
          corpo: barras(linhas.map((r) => ({ rot: NOME_UF[r.uf], sub: `${fmt.int(r.candidatos)} candidatos para ${fmt.int(r.cadeiras)} ${r.cadeiras === 1 ? "cadeira" : "cadeiras"}`, v: r.custo_por_cadeira, txt: fmt.brl(r.custo_por_cadeira), uf: r.uf })), { forte: (l) => f.uf === "TODAS" || l.uf === f.uf }),
        }) + painel({
          titulo: "Eleitos e não eleitos", sub: "Gasto por candidato. Não eleitos inclui os suplentes.", span: 5,
          corpo: tabela([
            { t: "Grupo", f: (r) => (r.resultado.startsWith("ELEITO") ? "Eleitos" : "Não eleitos") },
            { t: "Candidatos", num: 1, f: (r) => fmt.int(r.candidatos) },
            { t: "Média", num: 1, f: (r) => fmt.brl(r.media) },
            { t: "Mediana", num: 1, f: (r) => fmt.brl(r.mediana) },
          ], el.dados),
        }) + (municipal ? painel({
          titulo: "Por município", sub: `Custo de uma cadeira de ${cargoTxt(cargo).toLowerCase()} em cada cidade, em 2020 e 2024.`,
          corpo: `<label class="campo"><span>Município</span><input type="search" id="q1-mun" placeholder="Digite o nome da cidade" autocomplete="off"></label><div id="q1-mun-res" style="margin-top:16px"></div>`,
        }) : ""),
        depois: municipal ? () => ligaMunicipio(cargo, f.uf) : null,
      };
    },
  },

  q2: {
    n: 2, titulo: "Patrimônio e sucesso eleitoral",
    async filtros() {
      const p = await pares("/api/q2/opcoes");
      return { defs: [parSel(p), F.uf()], inicial: { par: "2022|DEPUTADO FEDERAL", uf: "TODAS" } };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q2?${qs({ ano, cargo, uf: f.uf })}`);
      const { resumo, faixas, quintis } = r.dados;
      const sem = quintis.find((q) => q.quintil === 0), rico = quintis.find((q) => q.quintil === 5);
      return {
        achado: rico && sem ? `No quinto mais rico, <b>${fmt.pct(rico.taxa_sucesso)}</b> se elegeram; entre quem não declarou bens, <b>${fmt.pct(sem.taxa_sucesso)}</b>.` : "",
        sql: [r.sql],
        html: kpis([
          { rot: "Taxa de sucesso geral", val: fmt.pct(resumo.taxa_sucesso), lider: true },
          { rot: "Candidatos", val: fmt.int(resumo.candidatos) },
          { rot: "Sem bens declarados", val: fmt.pct(resumo.pct_sem_bens) },
          { rot: "Patrimônio mediano, eleitos", val: fmt.brlCurto(resumo.mediana_eleitos) },
          { rot: "Patrimônio mediano, não eleitos", val: fmt.brlCurto(resumo.mediana_nao_eleitos) },
        ]) + painel({
          titulo: "Taxa de sucesso por faixa de patrimônio", sub: "Soma dos bens declarados na candidatura.", span: 7,
          corpo: barras(faixas.map((x) => ({ rot: x.faixa, sub: `${fmt.int(x.eleitos)} eleitos de ${fmt.int(x.candidatos)} · mediana ${fmt.brlCurto(x.patrimonio_mediano)}`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso) })), { forte: () => true }),
        }) + painel({
          titulo: "Quintos de patrimônio", sub: "Entre quem declarou algum bem; o grupo sem bens à parte.", span: 5,
          corpo: tabela([
            { t: "Grupo", f: (q) => (q.quintil === 0 ? "Sem bens" : ["", "Quinto mais pobre", "Segundo quinto", "Terceiro quinto", "Quarto quinto", "Quinto mais rico"][q.quintil]) },
            { t: "Faixa", num: 1, f: (q) => (q.quintil === 0 ? "R$ 0" : `${fmt.brlCurto(q.patrimonio_min)} a ${fmt.brlCurto(q.patrimonio_max)}`) },
            { t: "Sucesso", num: 1, f: (q) => fmt.pct(q.taxa_sucesso) },
          ], quintis),
        }),
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
        ]) + painel({ titulo: "Isentos por grupo de municípios", sub: "Percentual dos eleitores aptos, somados os municípios do grupo. Votações anuladas ficam de fora.", span: 7, corpo: pilha })
          + painel({
            titulo: "Partidos que mais elegeram", sub: `${cargoTxt(f.cargo)}s eleitos em ${f.ano}, por grupo.`, span: 5,
            corpo: tabela([
              { t: "Grupo", f: (x) => NOMES[x.g.grupo_ordem] },
              { t: "Partidos", f: (x) => x.ps.map((p) => `<span class="ponto" style="background:${H.cor(p.partido)}"></span>${esc(p.partido)} ${fmt.pct(p.pct_do_grupo, 0)}`).join("<br>") || "—" },
            ], topo),
          }),
      };
    },
  },

  q4: {
    n: 4, titulo: "Escolaridade do candidato e do eleitorado",
    async filtros() {
      const p = await pares("/api/q4/opcoes");
      return { defs: [parSel(p), F.uf()], inicial: { par: "2024|VEREADOR", uf: "TODAS" } };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q4?${qs({ ano, cargo, uf: f.uf })}`);
      const { sucesso, representacao, grupos, correlacao } = r.dados;
      const CURTO = { "ANALFABETO": "Analfabeto", "LÊ E ESCREVE": "Lê e escreve", "ENSINO FUNDAMENTAL INCOMPLETO": "Fundamental incompleto", "ENSINO FUNDAMENTAL COMPLETO": "Fundamental completo", "ENSINO MÉDIO INCOMPLETO": "Médio incompleto", "ENSINO MÉDIO COMPLETO": "Médio completo", "SUPERIOR INCOMPLETO": "Superior incompleto", "SUPERIOR COMPLETO": "Superior completo" };
      const rep = [...representacao].sort((a, b) => a.ordem - b.ordem);
      const max = Math.max(...rep.flatMap((x) => [x.pct_eleitorado, x.pct_eleitos]), 1);
      const sup = rep.find((x) => x.grau === "SUPERIOR COMPLETO");
      const pares2 = `${chave([["var(--second)", "Eleitorado"], ["var(--accent)", "Eleitos"]])}<div class="pilha" style="margin-top:14px">${rep.map((x) => `
        <div class="pilha__linha" style="grid-template-columns:9.5rem minmax(0,1fr)"><span class="pilha__rot">${CURTO[x.grau] ?? titulo(x.grau)}</span>
          <span class="par__trilho"><div><i style="width:${(x.pct_eleitorado / max) * 100}%;background:var(--second)"></i>${fmt.pct(x.pct_eleitorado)}</div><div><i style="width:${(x.pct_eleitos / max) * 100}%;background:var(--accent)"></i>${fmt.pct(x.pct_eleitos)}</div></span></div>`).join("")}</div>`;
      const qG = grupos.filter((g) => g.grupo_ordem > 0).sort((a, b) => a.grupo_ordem - b.grupo_ordem);
      const pond = qG.some((g) => g.anos_votados_medio != null);
      return {
        achado: sup ? `<b>${fmt.pct(sup.pct_eleitorado)}</b> do eleitorado tem superior completo, contra <b>${fmt.pct(sup.pct_eleitos)}</b> dos eleitos; a correlação entre a escolaridade do município e a dos eleitos é de <b>${fmt.corr(correlacao?.correlacao_votados ?? correlacao?.correlacao)}</b>.` : "",
        sql: [r.sql],
        html: kpis([
          { rot: "Eleitos com superior completo", val: fmt.pct(sup?.pct_eleitos), lider: true },
          { rot: "Eleitorado com superior completo", val: fmt.pct(sup?.pct_eleitorado) },
          { rot: "Correlação município e eleitos", val: fmt.corr(correlacao?.correlacao_votados ?? correlacao?.correlacao) },
          { rot: "Municípios", val: fmt.int(correlacao?.municipios) },
        ]) + painel({ titulo: "Quem vota e quem se elege", sub: "Distribuição por grau de instrução.", span: 7, corpo: pares2 })
          + painel({
            titulo: "Taxa de sucesso por escolaridade", sub: "Eleitos sobre candidatos em cada grau.", span: 5,
            corpo: barras([...sucesso].sort((a, b) => a.ordem - b.ordem).map((x) => ({ rot: CURTO[x.grau] ?? titulo(x.grau), sub: `${fmt.int(x.eleitos)} de ${fmt.int(x.candidatos)}`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso), sup: x.grau === "SUPERIOR COMPLETO" })), { forte: (l) => l.sup }),
          })
          + painel({
            titulo: "Municípios agrupados pela escolaridade do eleitorado", sub: pond ? "Anos de estudo equivalentes. Para deputados, a média dos eleitos é ponderada pelos votos que o município deu a cada um." : "Anos de estudo equivalentes (fundamental completo 9, médio 12, superior 16).",
            corpo: tabela([
              { t: "Grupo", f: (g) => ["", "Quarto menos escolarizado", "Segundo quarto", "Terceiro quarto", "Quarto mais escolarizado"][g.grupo_ordem] },
              { t: "Municípios", num: 1, f: (g) => fmt.int(g.municipios) },
              { t: "Anos, eleitorado", num: 1, f: (g) => fmt.dec(g.anos_eleitorado_medio) },
              { t: pond ? "Anos, eleitos (ponderado)" : "Anos, eleitos", num: 1, f: (g) => fmt.dec(g.anos_votados_medio ?? g.anos_eleitos_medio) },
              { t: "Superior, eleitorado", num: 1, f: (g) => fmt.pct(g.pct_superior_eleitorado) },
              { t: "Superior, eleitos", num: 1, f: (g) => fmt.pct(g.pct_superior_votados ?? g.pct_superior_eleitos) },
            ], qG),
          }),
      };
    },
  },

  q5: {
    n: 5, titulo: "Eleitos por votos de legenda",
    async filtros() {
      return {
        defs: [parSel(PARES_Q5.map(([ano, cargo]) => ({ ano, cargo }))), F.uf(), F.seg("forma", "Cadeiras", [{ v: "circulo", t: "Círculos" }, { v: "quadrado", t: "Quadrados" }])],
        inicial: { par: "2022|DEPUTADO FEDERAL", uf: "TODAS", forma: "circulo" },
      };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q5?${qs({ ano, cargo, uf: f.uf })}`);
      const { resumo: s, partidos, menos, barrados } = r.dados;
      const fq5 = await arquivo("site/fotos_q5.json").catch(() => ({}));
      const idFoto = (e) => fq5[`${ano}|${cargo}|${e.sg_uf}|${e.nome_urna}|${e.partido}|${e.votos}`];
      const pessoa = (e) => `<span class="pessoa">${foto(idFoto(e), `Foto de ${titulo(e.nome_urna)}`)}<span>${esc(titulo(e.nome_urna))}<br><span class="muted">${esc(e.partido)} · ${esc(e.municipio ? titulo(e.municipio) : e.sg_uf)}</span></span></span>`;
      const casa = cargo === "VEREADOR" ? (f.uf === "TODAS" ? "Câmaras municipais dos seis estados" : `Câmaras municipais ${DO_UF[f.uf]}`)
        : cargo === "DEPUTADO ESTADUAL" ? (f.uf === "TODAS" ? "Seis Assembleias Legislativas" : `Assembleia Legislativa ${DO_UF[f.uf]}`)
          : (f.uf === "TODAS" ? "Bancadas dos seis estados na Câmara" : `Bancada ${DO_UF[f.uf]} na Câmara dos Deputados`);
      const ps = [...partidos].sort((a, b) => b.eleitos - a.eleitos || a.partido.localeCompare(b.partido));
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
        }),
        depois: () => {
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
        ]) + painel({ titulo: "Idade média dos eleitos", sub: "Municípios agrupados pela idade mediana da população (Censo 2022).", span: 7, corpo: `${chave(series.map((s) => [s.cor, s.nome]))}<div class="linhas" id="q6-linhas" style="margin-top:12px"></div>` })
          + painel({
            titulo: "Grupos de municípios", sub: `Idade média dos eleitos em ${ult}.`, span: 5,
            corpo: tabela([
              { t: "Grupo", f: (g) => esc(nome[g.grupo_ordem]) },
              { t: "Municípios", num: 1, f: (g) => fmt.int(g.municipios) },
              { t: "Idade", num: 1, f: (g) => fmt.dec(g.idade_media) },
              { t: "60 anos ou mais", num: 1, f: (g) => fmt.pct(g.pct_60_mais) },
            ], idade.filter((x) => x.ano === ult).sort((a, b) => a.grupo_ordem - b.grupo_ordem)),
          })
          + painel({
            titulo: "Alternância de poder", sub: "Cada eleição comparada à anterior; renomeações e fusões contam como o mesmo partido.",
            corpo: alt.length ? tabela([
              { t: "Eleição", f: (a) => a.ano },
              { t: "Municípios comparados", num: 1, f: (a) => fmt.int(a.transicoes) },
              { t: "Partido mudou", num: 1, f: (a) => fmt.pct(a.pct_partido_mudou) },
              { t: "Prefeito mudou", num: 1, f: (a) => fmt.pct(a.pct_prefeito_mudou) },
              { t: "Tentaram a reeleição", num: 1, f: (a) => fmt.pct(a.pct_tentou_reeleicao) },
              { t: "Reeleitos, entre esses", num: 1, f: (a) => fmt.pct(a.pct_reeleicao) },
            ], alt) : `<p class="vazio">A alternância é medida pelo partido do prefeito; escolha o cargo de prefeito.</p>`,
          }),
        depois: () => linhas(document.getElementById("q6-linhas"), anos, series),
      };
    },
  },

  q7: {
    n: 7, titulo: "Viés político do município",
    async filtros() { return { defs: [], inicial: {} }; },
    async monta() {
      return {
        achado: "Esta pergunta ainda não foi respondida.",
        sql: ["-- Aguardando a classificação ideológica dos partidos (PARTIDO.espectro_politico ainda está vazio)."],
        html: painel({
          titulo: "Em pesquisa", corpo: `<p class="vazio">A resposta depende de uma classificação ideológica atualizada dos partidos. Com ela, a votação por partido e município (VOTACAO e VOTACAO_LEGENDA, já carregadas) mostra como o viés de cada território mudou de 2018 a 2024.</p>`,
        }),
      };
    },
  },

  q8: {
    n: 8, titulo: "Recursos públicos e privados",
    async filtros() {
      const p = await pares("/api/q8/opcoes");
      return { defs: [parSel(p), F.uf()], inicial: { par: "2024|VEREADOR", uf: "TODAS" } };
    },
    async monta(f) {
      const { ano, cargo } = dePar(f);
      const r = await resposta(`/api/q8?${qs({ ano, cargo, uf: f.uf })}`);
      const { resumo: s, faixas, origem } = r.dados;
      const cats = [...new Set(origem.map((o) => o.categoria))];
      const linhasO = cats.map((c) => {
        const e = origem.find((o) => o.categoria === c && o.grupo === "Eleitos"), n = origem.find((o) => o.categoria === c && o.grupo !== "Eleitos");
        return { c, publico: (e ?? n)?.publico, e: e?.valor, n: n?.valor };
      }).sort((a, b) => (b.e ?? 0) + (b.n ?? 0) - (a.e ?? 0) - (a.n ?? 0));
      const melhor = [...faixas].filter((x) => x.ordem > 0).sort((a, b) => b.taxa_sucesso - a.taxa_sucesso)[0];
      const tudo = faixas.find((x) => x.faixa === "100% público");
      return {
        achado: `${fmt.pct(s.pct_publico_do_dinheiro)} do dinheiro arrecadado era público. A maior taxa de sucesso foi na faixa <b>${esc(melhor?.faixa.toLowerCase())}</b> (${fmt.pct(melhor?.taxa_sucesso)}); quem dependeu só de dinheiro público se elegeu <b>${fmt.pct(tudo?.taxa_sucesso)}</b> das vezes.`,
        sql: [r.sql],
        html: kpis([
          { rot: "Parte pública da arrecadação", val: fmt.pct(s.pct_publico_do_dinheiro), lider: true },
          { rot: "Arrecadação total", val: fmt.brlCurto(s.receita_total) },
          { rot: "Receita mediana, eleitos", val: fmt.brl(s.mediana_receita_eleitos) },
          { rot: "Receita mediana, não eleitos", val: fmt.brl(s.mediana_receita_nao_eleitos) },
          { rot: "Sem receita declarada", val: fmt.int(s.sem_receita) },
        ]) + painel({
          titulo: "Taxa de sucesso pela parte pública do dinheiro", sub: "Fundo Especial e Fundo Partidário são públicos; o resto é privado.", span: 7,
          corpo: barras(faixas.map((x) => ({ rot: x.faixa, sub: `${fmt.int(x.eleitos)} eleitos de ${fmt.int(x.candidatos)} · receita mediana ${fmt.brl(x.receita_mediana)}`, v: x.taxa_sucesso, txt: fmt.pct(x.taxa_sucesso) })), { forte: () => true }),
        }) + painel({
          titulo: "De onde veio o dinheiro", sub: "Valor arrecadado por origem.", span: 5,
          corpo: tabela([
            { t: "Origem", f: (o) => `${esc(o.c)}${o.publico ? ' <span class="muted">· público</span>' : ""}` },
            { t: "Eleitos", num: 1, f: (o) => fmt.brlCurto(o.e) },
            { t: "Não eleitos", num: 1, f: (o) => fmt.brlCurto(o.n) },
          ], linhasO),
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
        }) + painel({
          titulo: "Palavras mais escritas", sub: "Nas descrições das despesas; cada palavra conta uma vez por despesa.", span: 6,
          corpo: ps.length ? `<p class="palavras">${ps.map((w) => { const r = w.despesas / max; return `<span style="font-size:${(14 + r * 26).toFixed(0)}px;color:${r > 0.35 ? "var(--accent)" : "var(--text)"}" title="${fmt.int(w.despesas)} despesas, ${fmt.brlCurto(w.valor)}">${esc(w.palavra.toLowerCase())}</span>`; }).join(" ")}</p>` : `<p class="vazio">Sem palavras gravadas para esses filtros.</p>`,
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
      };
    },
  },

  q10: {
    n: 10, titulo: "Sobrevivência da carreira de um político",
    async filtros() {
      return { defs: [{ html: `<div class="campo busca-pessoa"><label for="q10-nome"><span>Buscar pelo nome</span></label><input id="q10-nome" type="search" autocomplete="off" placeholder="Ex.: Requião, Barbalho, Amin" role="combobox" aria-expanded="false" aria-controls="q10-sug"><div class="sugestoes" id="q10-sug" role="listbox" hidden></div></div>` }], inicial: { id: 2714 } };
    },
    async monta(f) {
      const [r, idx, fp] = await Promise.all([resposta(`/api/q10/pessoa/${f.id}`), arquivo("q10_indice.json"), arquivo("site/fotos_pessoa.json").catch(() => ({}))]);
      const c = r.dados.carreira;
      const fotos = fp[String(f.id)] ?? [];
      const porAno = new Map(fotos.map(([ano, idc]) => [ano, idc]));
      const ultima = fotos[fotos.length - 1];
      const achado = idx.indice.find((i) => i.achado.id_pessoa === Number(f.id))?.achado;
      const vit = c.filter((x) => x.resultado === "VITÓRIA").length;
      const partidos = [...new Set(c.map((x) => x.partido))];
      const cargos = [...new Set(c.map((x) => x.cargo))];
      const nome = titulo(achado?.nome ?? r.dados.nomes[r.dados.nomes.length - 1]);
      return {
        achado: `<b>${esc(nome)}</b> concorreu ${c.length} vezes de ${c[0].ano} a ${c[c.length - 1].ano} e venceu ${vit}, por ${partidos.length} ${partidos.length === 1 ? "partido" : "partidos"}.`,
        sql: [idx.sql.replaceAll("{{nome}}", nome.toUpperCase()), r.sql],
        html: kpis([
          { rot: "Candidaturas", val: fmt.int(c.length), lider: true },
          { rot: "Vitórias", val: fmt.int(vit) },
          { rot: "Partidos", val: fmt.int(partidos.length) },
          { rot: "Cargos disputados", val: fmt.int(cargos.length) },
        ]) + painel({
          titulo: nome, sub: `${r.dados.nomes.length > 1 ? `Também registrado como ${r.dados.nomes.filter((n) => titulo(n) !== nome).map((n) => esc(titulo(n))).join(", ")}. ` : ""}${achado?.data_nascimento ? `Nascido em ${achado.data_nascimento.split("-").reverse().join("/")}.` : ""}`,
          corpo: `${ultima ? `<div class="pessoa-topo">${foto(ultima[1], `Foto de ${nome} no registro da candidatura de ${ultima[0]}`, "foto-g")}<p class="muted">Fotos do registro de cada candidatura no TSE, de 2018 em diante.</p></div>` : ""}<ol class="carreira">${c.map((x) => `
            <li class="etapa"><span class="etapa__ano">${x.ano}</span><span class="etapa__foto">${porAno.has(x.ano) ? foto(porAno.get(x.ano), `Foto de ${nome} em ${x.ano}`) : ""}</span>
              <span class="etapa__o"><b>${esc(cargoTxt(x.cargo))}, ${esc(x.local.length === 2 ? x.local : titulo(x.local))}</b><span>${esc(x.partido)}${x.evento ? ` · ${esc(x.evento.charAt(0) + x.evento.slice(1).toLowerCase())}` : ""}${x.troca_partido ? ` · ${esc(x.troca_partido)}` : ""}</span></span>
              <span class="selo${x.resultado === "VITÓRIA" ? " ganhou" : ""}">${x.resultado === "VITÓRIA" ? "Eleito" : esc(titulo(x.detalhe_resultado || x.resultado))}</span></li>`).join("")}</ol>`,
        }),
        depois: () => ligaBuscaPessoa(idx.indice),
      };
    },
  },
};
const ORDEM = ["q1", "q2", "q8", "q9", "q5", "q3", "q4", "q6", "q7", "q10"];

/* ---------- busca por município (Q1) ---------- */
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
  input.addEventListener("input", () => {
    const palavras = input.value.trim().split(/\s+/).filter((p) => p.length >= 2).map(semAcento);
    if (!palavras.length) { lista.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    const achados = indice.filter((i) => i.nomes.some((n) => palavras.every((p) => n.includes(p)))).slice(0, 8).map((i) => i.achado);
    lista.innerHTML = achados.length
      ? achados.map((a, i) => `<button type="button" role="option" aria-selected="${i === 0}" data-id="${a.id_pessoa}"><span>${esc(titulo(a.nome))}</span><small class="num">${a.candidaturas} candidaturas, ${a.primeira} a ${a.ultima}</small></button>`).join("")
      : `<button type="button" disabled><span>Ninguém com esse nome entre os 2.500 políticos com mais candidaturas.</span></button>`;
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
const estado = { q: "q1", f: {}, defs: [] };
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
  document.getElementById("crumb").textContent = `Pergunta ${P.n}`;
  document.getElementById("titulo").textContent = P.titulo;
  document.title = `${P.titulo} · Consultas`;
  const { defs, inicial } = await P.filtros();
  estado.defs = defs;
  estado.f = { ...inicial };
  for (const [k, v] of Object.entries(fHash)) if (k in inicial) estado.f[k] = v;
  vai();
}

async function vai() {
  const meu = ++pedido;
  const P = PERGUNTAS[estado.q];
  const corpo = document.getElementById("corpo");
  corpo.classList.add("carregando");
  desenhaFiltros(estado.defs, estado.f, mudou);
  escreveHash();
  try {
    const t = await P.monta(estado.f);
    if (meu !== pedido) return;
    document.getElementById("achado").innerHTML = t.achado ?? "";
    corpo.innerHTML = t.html;
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
sel.innerHTML = ORDEM.map((q) => `<option value="${q}">${PERGUNTAS[q].n}. ${PERGUNTAS[q].titulo}</option>`).join("");
sel.addEventListener("change", () => { location.hash = sel.value; });

document.getElementById("copiar").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText(document.getElementById("sql").textContent); e.target.textContent = "Copiado"; }
  catch { e.target.textContent = "Selecione e copie"; }
  setTimeout(() => (e.target.textContent = "Copiar SQL"), 1600);
});

addEventListener("hashchange", () => { const h = leHash(); if (h.q !== estado.q) abrePergunta(h.q, h.f); });
const inicio = leHash();
abrePergunta(inicio.q, inicio.f);
