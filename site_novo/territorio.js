/* O território: mapa interativo das perguntas 3, 4 e 6, em três níveis (seis estados → estado → município).
   Indicadores por município: vw_site_municipio (dados/site/municipios.json, de scripts/exporta_mapa.py).
   Contornos: malhas do IBGE (dados/site/mapa_brasil.json e mapa_<UF>.json).
   Achados de cada pergunta: as respostas das views mv_q3_*, mv_q4_* e mv_q6_* (dados.js).
   As cores usam quintis calculados sobre os 1.238 municípios, para que os estados sejam comparáveis entre si. */

(async () => {
  const elSvg = document.getElementById("terr-svg");
  if (!elSvg) return;
  const { resposta, arquivo, qs } = window.Dados;
  const H = window.Hemiciclo;

  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /* o cadastro grava "Entre Rios Do Oeste": as preposições vão para minúscula na exibição */
  const nomeMun = (s) => String(s ?? "").replace(/(?<=\s)(Do|Da|De|Dos|Das|E)(?=\s)/g, (p) => p.toLowerCase());
  const corr = (v) => nf(2).format(Math.abs(v) < 0.005 ? 0 : v);
  const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase()).replace(/(^|\s)(?!Dr\b)([B-DF-HJ-NP-TV-Z][b-df-hj-np-tv-z]{1,3})(?=\s|$)/g, (m, a, w) => a + w.toUpperCase());
  const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const NOME_UF = { AL: "Alagoas", PA: "Pará", PB: "Paraíba", PR: "Paraná", SC: "Santa Catarina", SE: "Sergipe" };
  const DO_UF = { AL: "de Alagoas", PA: "do Pará", PB: "da Paraíba", PR: "do Paraná", SC: "de Santa Catarina", SE: "de Sergipe" };
  const SEIS = Object.keys(NOME_UF);
  const RAMPA = ["#9aa3f2", "#7480ee", "#5260e9", "#3040de", "#1a239f"]; // validada (dataviz, ordinal, fundo #eef0f3)
  const SEM = "#d6dae1";
  const GRAU = { 2: "lê e escreve", 5: "fundamental incompleto", 9: "fundamental completo", 10: "médio incompleto", 12: "médio completo", 14: "superior incompleto", 16: "superior completo" };

  const f = {
    pct: (v) => `${nf(1).format(v)}%`,
    anos: (v) => `${nf(1).format(v)} anos`,
    idhm: (v) => nf(3).format(v),
    brl: (v) => `R$ ${nf(0).format(v)}`,
    int: (v) => nf(0).format(v),
  };

  /* ----- as camadas: cada pergunta e as medidas que o mapa pode pintar ----- */
  const CAMADAS = {
    q3: {
      nome: "Desenvolvimento e voto", n: 3,
      medidas: [
        { id: "idhm", rot: "IDHM", campo: "idhm", fmt: f.idhm, desc: "Índice de Desenvolvimento Humano Municipal de 2010 (Atlas Brasil). Quanto mais escuro, mais desenvolvido.", dim: "IDHM", ano: 2008 },
        { id: "pib_per_capita", rot: "PIB per capita", campo: "pib_per_capita", fmt: f.brl, desc: "PIB per capita de 2010 (IBGE), em reais da época.", dim: "PIB", ano: 2008 },
        { id: "isentos_2008", rot: "Isentos 2008", campo: "isentos_2008", fmt: f.pct, anulada: "anulada_2008", desc: "Abstenção, brancos e nulos na eleição para prefeito de 2008, em percentual dos eleitores aptos.", dim: "IDHM", ano: 2008 },
        { id: "nulos_2008", rot: "Nulos 2008", campo: "nulos_2008", fmt: f.pct, anulada: "anulada_2008", desc: "Votos nulos para prefeito em 2008, em percentual dos aptos. Municípios em que o TSE anulou a votação ficam hachurados e fora das medidas.", dim: "IDHM", ano: 2008 },
        { id: "isentos_2012", rot: "Isentos 2012", campo: "isentos_2012", fmt: f.pct, anulada: "anulada_2012", desc: "Abstenção, brancos e nulos na eleição para prefeito de 2012, em percentual dos eleitores aptos.", dim: "IDHM", ano: 2012 },
      ],
    },
    q4: {
      nome: "Escolaridade", n: 4,
      medidas: [
        { id: "anos_eleitorado_2024", rot: "Eleitorado", campo: "anos_eleitorado_2024", fmt: f.anos, desc: "Escolaridade média do eleitorado em 2024, em anos de estudo equivalentes (fundamental completo 9, médio 12, superior 16).", cargo: "VEREADOR" },
        { id: "anos_vereadores_2024", rot: "Vereadores eleitos", campo: "anos_vereadores_2024", fmt: f.anos, desc: "Escolaridade média dos vereadores eleitos em 2024, em anos de estudo equivalentes.", cargo: "VEREADOR" },
        { id: "anos_prefeito_2024", rot: "Prefeito eleito", campo: "anos_prefeito_2024", fmt: (v) => GRAU[v] ?? f.anos(v), desc: "Grau de instrução do prefeito eleito em 2024.", cargo: "PREFEITO", discreto: [9, 12, 14, 16], rotulos: ["até fundamental incompleto", "fundamental completo", "médio completo", "superior incompleto", "superior completo"] },
        { id: "pct_superior_eleitorado_2024", rot: "Eleitorado com superior", campo: "pct_superior_eleitorado_2024", fmt: f.pct, desc: "Parte do eleitorado com ensino superior completo em 2024.", cargo: "VEREADOR" },
      ],
    },
    q6: {
      nome: "Idade e alternância", n: 6,
      medidas: [
        { id: "idade_mediana", rot: "Idade da população", campo: "idade_mediana", fmt: f.anos, desc: "Idade mediana da população no Censo 2022. Os grupos da pergunta 6 são os quartos desta medida.", cargo: "PREFEITO" },
        { id: "idade_prefeito_2024", rot: "Idade do prefeito", campo: "idade_prefeito_2024", fmt: f.anos, desc: "Idade do prefeito eleito em 2024, em 1º de outubro.", cargo: "PREFEITO" },
        { id: "idade_vereadores_2024", rot: "Idade dos vereadores", campo: "idade_vereadores_2024", fmt: f.anos, desc: "Idade média dos vereadores eleitos em 2024.", cargo: "VEREADOR" },
        { id: "trocas_partido", rot: "Trocas de partido", campo: "trocas_partido", fmt: (v) => `${f.int(v)} ${v === 1 ? "troca" : "trocas"}`, desc: "Quantas vezes o partido do prefeito mudou de uma eleição para a seguinte, de 2004 a 2024: cinco comparações, menos nos municípios criados no período. Renomeações e fusões contam como o mesmo partido.", cargo: "PREFEITO", discreto: [2, 3, 4, 5], rotulos: ["0 ou 1 troca", "2 trocas", "3 trocas", "4 trocas", "5 trocas"] },
      ],
    },
  };
  const medidaDe = (q, id) => CAMADAS[q].medidas.find((m) => m.id === id) ?? CAMADAS[q].medidas[0];

  /* ----- dados ----- */
  const base = await arquivo("site/municipios.json");
  const MUN = base.linhas.map((l) => Object.fromEntries(base.colunas.map((c, i) => [c, l[i]])));
  const porCod = new Map(MUN.map((m) => [m.cod_ibge, m]));
  const valor = (m, med) => (med.anulada && m[med.anulada] ? null : m[med.campo]);

  const cortes = new Map();
  function cortesDe(med) {
    if (med.discreto) return med.discreto;
    if (!cortes.has(med.id)) {
      const vs = MUN.map((m) => valor(m, med)).filter((v) => v != null).sort((a, b) => a - b);
      cortes.set(med.id, [0.2, 0.4, 0.6, 0.8].map((p) => vs[Math.floor(p * (vs.length - 1))]));
    }
    return cortes.get(med.id);
  }
  const classe = (v, cs) => (v == null ? -1 : cs.filter((c) => v >= c).length);
  const corDe = (m, med) => {
    if (med.anulada && m[med.anulada]) return "url(#hachura)";
    const v = valor(m, med);
    return v == null ? SEM : RAMPA[classe(v, cortesDe(med))];
  };
  const mediana = (vs) => { const s = vs.filter((v) => v != null).sort((a, b) => a - b); if (!s.length) return null; const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

  /* ----- estado ----- */
  const st = { q: "q3", medida: "nulos_2008", uf: null, cod: null };
  const dica = document.getElementById("terr-dica");
  const painel = document.getElementById("terr-painel");
  const mapaCaixa = elSvg.parentElement;

  function controles() {
    const pergs = document.getElementById("terr-perguntas");
    pergs.innerHTML = Object.entries(CAMADAS).map(([q, c]) => `<button type="button" class="tab" role="tab" data-q="${q}" aria-selected="${q === st.q}">${c.nome}</button>`).join("");
    pergs.onclick = (e) => { const b = e.target.closest("[data-q]"); if (b && b.dataset.q !== st.q) { st.q = b.dataset.q; st.medida = CAMADAS[st.q].medidas[0].id; tudo(); } };
    const meds = document.getElementById("terr-medidas");
    meds.innerHTML = CAMADAS[st.q].medidas.map((m) => `<button type="button" data-m="${m.id}" aria-pressed="${m.id === st.medida}">${m.rot}</button>`).join("");
    meds.onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) { st.medida = b.dataset.m; tudo(); } };
  }

  function trilha() {
    const el = document.getElementById("terr-trilha");
    const partes = [st.uf ? `<button type="button" data-ir="brasil">Seis estados</button>` : `<span>Seis estados</span>`];
    if (st.uf) partes.push(st.cod ? `<button type="button" data-ir="uf">${NOME_UF[st.uf]}</button>` : `<span>${NOME_UF[st.uf]}</span>`);
    if (st.cod) partes.push(`<span>${esc(nomeMun(porCod.get(st.cod).nome))}</span>`);
    el.innerHTML = partes.join('<i aria-hidden="true">›</i>');
    el.onclick = (e) => {
      const b = e.target.closest("[data-ir]");
      if (!b) return;
      if (b.dataset.ir === "brasil") { st.uf = null; st.cod = null; } else st.cod = null;
      tudo();
    };
  }

  function legenda(med) {
    const cs = cortesDe(med);
    const faixas = med.rotulos
      ? med.rotulos
      : [`até ${med.fmt(cs[0])}`, ...cs.slice(0, -1).map((c, i) => `${med.fmt(c)} a ${med.fmt(cs[i + 1])}`), `${med.fmt(cs[cs.length - 1])} ou mais`];
    const extra = med.anulada ? `<span><i style="background:repeating-linear-gradient(135deg,#8a919c 0 2px,#e2e5ea 2px 5px)"></i>votação anulada</span>` : ""; // taste-skill-ignore: amostra da hachura do mapa
    document.getElementById("terr-legenda").innerHTML = `<b>${med.rot}</b>${faixas.map((t, i) => `<span><i style="background:${RAMPA[i]}"></i>${t}</span>`).join("")}<span><i style="background:${SEM}"></i>sem dado</span>${extra}`;
  }

  /* ----- o desenho ----- */
  const NS = "http://www.w3.org/2000/svg";
  async function desenha() {
    const med = medidaDe(st.q, st.medida);
    const geo = await arquivo(st.uf ? `site/mapa_${st.uf}.json` : "site/mapa_brasil.json");
    let vb = `0 0 ${geo.largura} ${geo.altura}`;
    if (!st.uf) {
      /* recorta o Brasil para a faixa leste, onde estão os seis estados, e deixa o contexto à esquerda */
      vb = `120 -10 ${geo.largura - 90} ${geo.altura + 20}`;
    }
    const partes = [`<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><defs><pattern id="hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e2e5ea"/><line x1="0" y1="0" x2="0" y2="6" stroke="#8a919c" stroke-width="2.5"/></pattern></defs>`];
    if (!st.uf) {
      for (const a of geo.areas) {
        if (!SEIS.includes(a.id)) { partes.push(`<path class="fora" d="${a.d}"/>`); continue; }
        const v = mediana(MUN.filter((m) => m.uf === a.id).map((m) => valor(m, med)));
        const cor = v == null ? SEM : RAMPA[classe(v, cortesDe(med))];
        partes.push(`<path class="alvo" data-uf="${a.id}" d="${a.d}" fill="${cor}"/>`);
      }
      const ROT = { PA: [0, 0, true], PR: [0, 0, true], SC: [70, 18], PB: [70, -14], AL: [70, 6], SE: [70, 26] };
      for (const a of geo.areas.filter((x) => SEIS.includes(x.id))) {
        const [dx, dy, dentro] = ROT[a.id];
        if (dentro) partes.push(`<text class="rot" x="${a.c[0]}" y="${a.c[1] + 5}" text-anchor="middle">${a.id}</text>`);
        else partes.push(`<path class="linha-rot" d="M${a.c[0]},${a.c[1]}L${a.c[0] + dx - 6},${a.c[1] + dy - 5}"/><text class="rot fora-rot" x="${a.c[0] + dx}" y="${a.c[1] + dy}">${a.id}</text>`);
      }
    } else {
      for (const a of geo.areas) {
        const m = porCod.get(a.id);
        partes.push(`<path class="alvo${a.id === st.cod ? " sel" : ""}" data-cod="${a.id}" d="${a.d}" fill="${m ? corDe(m, med) : SEM}"/>`);
      }
    }
    partes.push("</svg>");
    elSvg.innerHTML = partes.join("");
    elSvg.setAttribute("aria-label", st.uf ? `Mapa dos municípios ${DO_UF[st.uf]}: ${med.rot}` : `Mapa dos seis estados: ${med.rot}`);
    /* o município escolhido vai para a frente, para o contorno não ficar escondido pelos vizinhos */
    const sel = elSvg.querySelector(".sel");
    if (sel) sel.parentNode.appendChild(sel);
    legenda(med);
  }

  elSvg.addEventListener("pointermove", (e) => {
    const p = e.target.closest("path.alvo");
    if (!p) { dica.hidden = true; return; }
    const med = medidaDe(st.q, st.medida);
    let html;
    if (p.dataset.uf) {
      const v = mediana(MUN.filter((m) => m.uf === p.dataset.uf).map((m) => valor(m, med)));
      html = `<b>${NOME_UF[p.dataset.uf]}</b>${med.rot}, mediana dos municípios: ${v == null ? "sem dado" : med.fmt(v)}`;
    } else {
      const m = porCod.get(Number(p.dataset.cod));
      const v = m && valor(m, med);
      html = `<b>${esc(nomeMun(m?.nome))}</b>${med.anulada && m?.[med.anulada] ? "votação anulada pelo TSE" : `${med.rot}: ${v == null ? "sem dado" : med.fmt(v)}`}`;
    }
    dica.innerHTML = html;
    dica.hidden = false;
    const r = mapaCaixa.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    dica.style.left = `${Math.min(x + 16, r.width - dica.offsetWidth - 8)}px`;
    dica.style.top = `${Math.max(8, y - dica.offsetHeight - 14)}px`;
  });
  elSvg.addEventListener("pointerleave", () => (dica.hidden = true));
  elSvg.addEventListener("click", (e) => {
    const p = e.target.closest("path.alvo");
    if (!p) return;
    dica.hidden = true;
    if (p.dataset.uf) { st.uf = p.dataset.uf; st.cod = null; }
    else st.cod = Number(p.dataset.cod) === st.cod ? null : Number(p.dataset.cod);
    tudo();
  });

  /* ----- o painel ----- */
  async function achado(med, uf) {
    try {
      if (st.q === "q3") {
        const r = (await resposta(`/api/q3?${qs({ ano: med.ano, dim: med.dim, cargo: "PREFEITO", uf })}`)).dados;
        const c = Object.fromEntries(r.correlacao.map((x) => [x.medida, x]));
        const ind = med.dim === "IDHM" ? "do IDHM" : "do PIB per capita (em logaritmo)";
        return `Correlação ${ind} com os votos nulos em ${med.ano}: <b>${corr(c.pct_nulos.correlacao)}</b>; com a abstenção: <b>${corr(c.pct_abstencao.correlacao)}</b>; com os isentos: <b>${corr(c.pct_isentos.correlacao)}</b> (${f.int(c.pct_nulos.municipios)} municípios).`;
      }
      if (st.q === "q4") {
        const r = (await resposta(`/api/q4?${qs({ ano: 2024, cargo: med.cargo, uf })}`)).dados;
        return `Correlação entre a escolaridade do eleitorado e a ${med.cargo === "PREFEITO" ? "do prefeito eleito" : "dos vereadores eleitos"} em 2024: <b>${corr(r.correlacao.correlacao)}</b> (${f.int(r.correlacao.municipios)} municípios). Na pergunta 4, só o superior completo aumenta a chance de vitória.`;
      }
      const r = (await resposta(`/api/q6?${qs({ cargo: med.cargo, uf })}`)).dados;
      const c = r.correlacao.find((x) => x.ano === 2024);
      const a = r.alternancia.find((x) => x.ano === 2024 && x.grupo_ordem === 0);
      return `Correlação entre a idade do município e a dos ${med.cargo === "PREFEITO" ? "prefeitos" : "vereadores"} eleitos em 2024: <b>${corr(c.correlacao)}</b>.${a ? ` Em 2024, o partido do prefeito mudou em <b>${f.pct(a.pct_partido_mudou)}</b> dos municípios, e <b>${f.pct(a.pct_reeleicao)}</b> dos prefeitos que tentaram se reeleger conseguiram.` : ""}`;
    } catch {
      return "";
    }
  }

  async function painelGeral(med) {
    const linhas = SEIS.map((u) => ({ u, v: mediana(MUN.filter((m) => m.uf === u).map((m) => valor(m, med))) })).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
    const max = Math.max(...linhas.map((l) => l.v ?? 0)) || 1;
    painel.innerHTML = `
      <h3>Seis estados</h3>
      <p class="sub">Pergunta ${CAMADAS[st.q].n} · ${MUN.length.toLocaleString("pt-BR")} municípios</p>
      <p class="desc">${med.desc}</p>
      <div class="ranking-uf">${linhas.map((l) => `<button type="button" data-uf="${l.u}">${NOME_UF[l.u]}<span>${l.v == null ? "—" : med.fmt(l.v)}</span><i style="--w:${(((l.v ?? 0) / max) * 100).toFixed(1)}%"></i></button>`).join("")}</div>
      <p class="sub">Mediana dos municípios de cada estado. Toque num estado para ver as cidades.</p>
      <p class="achado" id="terr-achado"></p>`;
    painel.querySelector(".ranking-uf").onclick = (e) => { const b = e.target.closest("[data-uf]"); if (b) { st.uf = b.dataset.uf; st.cod = null; tudo(); } };
    const t = await achado(med, "TODAS");
    const el = document.getElementById("terr-achado");
    if (el) { el.innerHTML = t; el.hidden = !t; }
  }

  async function painelUf(med) {
    const ms = MUN.filter((m) => m.uf === st.uf);
    const comV = ms.filter((m) => valor(m, med) != null).sort((a, b) => valor(a, med) - valor(b, med));
    const lo = comV[0], hi = comV[comV.length - 1];
    painel.innerHTML = `
      <h3>${NOME_UF[st.uf]}</h3>
      <p class="sub">Pergunta ${CAMADAS[st.q].n} · ${f.int(ms.length)} municípios</p>
      <p class="desc">${med.desc}</p>
      <dl>
        <div class="atual"><dt>Mediana dos municípios</dt><dd>${med.fmt(mediana(comV.map((m) => valor(m, med))))}</dd></div>
        <div><dt>Mais alto</dt><dd>${med.fmt(valor(hi, med))}<small>${esc(nomeMun(hi.nome))}</small></dd></div>
        <div><dt>Mais baixo</dt><dd>${med.fmt(valor(lo, med))}<small>${esc(nomeMun(lo.nome))}</small></dd></div>
      </dl>
      <p class="achado" id="terr-achado"></p>
      <p class="sub">Toque num município para ver os números dele.</p>`;
    const t = await achado(med, st.uf);
    const el = document.getElementById("terr-achado");
    if (el) { el.innerHTML = t; el.hidden = !t; }
  }

  async function painelMun(med) {
    const m = porCod.get(st.cod);
    const doUf = MUN.filter((x) => x.uf === m.uf);
    const posicao = (md) => {
      const v = valor(m, md);
      if (v == null) return "";
      const vs = doUf.map((x) => valor(x, md)).filter((x) => x != null);
      const abaixo = vs.filter((x) => x < v).length;
      return `maior que em ${f.int(Math.round((100 * abaixo) / vs.length))}% dos municípios ${DO_UF[m.uf]}`;
    };
    const linhas = CAMADAS[st.q].medidas.map((md) => {
      const anulada = md.anulada && m[md.anulada];
      const v = valor(m, md);
      return `<div${md.id === med.id ? ' class="atual"' : ""}><dt>${md.rot}</dt><dd>${anulada ? "anulada" : v == null ? "—" : md.fmt(v)}${anulada ? "<small>votação anulada pelo TSE</small>" : v == null ? "" : `<small>${posicao(md)}</small>`}</dd></div>`;
    }).join("");
    let extra = "";
    if (st.q === "q6" && m.partidos_prefeito) {
      const seq = m.partidos_prefeito.split(" ").map((p) => p.split(":"));
      extra = `<p class="sub" style="margin-top:1.5rem">Partido do prefeito eleito, de 2004 a 2024${m.prefeito_reeleito_2024 ? "; o de 2024 foi reeleito" : ""}:</p>
        <div class="partidos-pref">${seq.map(([ano, sig], i) => `<span${i && sig !== seq[i - 1][1] ? ' class="troca"' : ""}><small>${ano}</small>${esc(sig)}</span>`).join("")}</div>`;
    }
    if (st.q === "q3" && m.idhm != null) extra = `<p class="sub" style="margin-top:1rem">População em 2010: ${f.int(m.populacao)} habitantes.</p>`;
    const prefeito = m.nome_prefeito_2024 ? `
      <div class="prefeito">${m.id_prefeito_2024 ? `<img src="fotos/${m.id_prefeito_2024}.webp" alt="Foto de ${esc(titulo(m.nome_prefeito_2024))}" width="161" height="225" onerror="this.remove()">` : ""}
        <p><span>Prefeito eleito em 2024</span><b>${esc(titulo(m.nome_prefeito_2024))}</b><small>${esc(m.partido_prefeito_2024)} · ${f.int(m.idade_prefeito_2024)} anos${m.prefeito_reeleito_2024 ? " · reeleito" : ""}</small></p>
      </div>` : "";
    painel.innerHTML = `
      <h3>${esc(nomeMun(m.nome))}</h3>
      <p class="sub">${NOME_UF[m.uf]} · pergunta ${CAMADAS[st.q].n}</p>
      ${prefeito}
      <dl>${linhas}</dl>
      ${extra}`;
    const el = document.getElementById("terr-camara");
    el.innerHTML = `<div class="camara__topo"><h4>Câmara Municipal de ${esc(nomeMun(m.nome))}</h4><span>2024</span></div><p class="camara__aviso">Carregando…</p>`;
    el.hidden = false;
    camara(m);
  }

  /* a Câmara do município (cadeiras da Q5) e o custo de cada cadeira (Q1) */
  async function camara(m) {
    const el = document.getElementById("terr-camara");
    const topo = (n) => `<div class="camara__topo"><h4>Câmara Municipal de ${esc(nomeMun(m.nome))}</h4><span>2024${n ? ` · ${f.int(n)} cadeiras` : ""}</span></div>`;
    const vazio = (t) => (el.innerHTML = `${topo()}<p class="camara__aviso">${t}</p>`);
    try {
      const [cad, q1] = await Promise.all([arquivo(`site/cadeiras_2024_VEREADOR_${m.uf}.json`), arquivo("q1_municipio_VEREADOR.json")]);
      if (!el.isConnected || st.cod !== m.cod_ibge) return;
      const linhas = cad.linhas.filter((l) => l[0] === m.cod_ibge)
        .map((l) => ({ id: l[2], nome: l[4], partido: l[5], votos: l[6], posicao: l[7], sozinho: !l[11] }));
      const custo = q1.linhas.find((l) => l.ano === 2024 && l.uf === m.uf && l.municipio_busca === semAcento(m.nome));
      if (!linhas.length) { vazio("Os votos de vereador deste município não foram publicados completos pelo TSE em 2024."); return; }
      const por = new Map();
      for (const l of linhas) (por.get(l.partido) ?? por.set(l.partido, []).get(l.partido)).push(l);
      const partidos = [...por].map(([nome, membros]) => ({ nome, cadeiras: membros.length, cor: H.cor(nome), membros: membros.sort((a, b) => b.votos - a.votos) }))
        .sort((a, b) => b.cadeiras - a.cadeiras || a.nome.localeCompare(b.nome));
      const top = linhas.find((l) => l.posicao === 1) ?? [...linhas].sort((a, b) => b.votos - a.votos)[0];
      const pessoa = (l, rotulo) => `<img src="fotos/${l.id}.webp" alt="" width="161" height="225" onerror="this.remove()">
        <p><span>${rotulo}</span><b>${esc(titulo(l.nome))}</b><small>${esc(l.partido)} · ${f.int(l.votos)} votos${l.sozinho ? " · atingiu o quociente sozinho" : ""}</small></p>`;
      el.innerHTML = `
        ${topo(linhas.length)}
        <div class="hemi camara__hemi" id="terr-hemi"></div>
        <div class="camara__lado">
          <div class="camara__pessoa" id="terr-vereador">${pessoa(top, "Maior votação")}</div>
          <ul class="camara__legenda">${partidos.map((p) => `<li><i style="background:${p.cor}"></i>${esc(p.nome)}<b>${p.cadeiras}</b></li>`).join("")}</ul>
          ${custo ? `<p class="camara__custo"><b>R$ ${nf(0).format(custo.custo_por_cadeira)}</b>por cadeira, somando o gasto dos ${f.int(custo.candidatos)} candidatos (pergunta 1)</p>` : ""}
          <button type="button" class="camara__botao" id="terr-ver-casa">Abrir no hemiciclo da pergunta 5</button>
        </div>`;
      const hemi = document.getElementById("terr-hemi");
      hemi.addEventListener("assento", (e) => { document.getElementById("terr-vereador").innerHTML = pessoa(e.detail.membro, "Nesta cadeira"); });
      H.desenha(hemi, { partidos, legendaCentro: "cadeiras" });
      document.getElementById("terr-ver-casa").addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("abre-casa", { detail: { uf: m.uf, cod: m.cod_ibge } }));
        document.getElementById("casa").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
    } catch {
      vazio("Não foi possível carregar a Câmara.");
    }
  }

  /* ----- busca ----- */
  const busca = document.getElementById("terr-busca");
  document.getElementById("terr-busca-lista").innerHTML = MUN.map((m) => `<option value="${esc(nomeMun(m.nome))} (${m.uf})">`).join("");
  busca.addEventListener("change", () => {
    const t = busca.value.trim();
    const m = MUN.find((x) => `${nomeMun(x.nome)} (${x.uf})` === t) ?? MUN.find((x) => semAcento(x.nome) === semAcento(t.replace(/\s*\(\w\w\)$/, "")));
    if (!m) return;
    st.uf = m.uf; st.cod = m.cod_ibge;
    busca.value = "";
    tudo();
  });

  /* ----- os blocos de conclusão abaixo do mapa ----- */
  document.querySelectorAll(".ver-mapa").forEach((b) => b.addEventListener("click", () => {
    st.q = b.dataset.camada; st.medida = b.dataset.medida;
    tudo();
    document.getElementById("territorio").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }));

  /* a dispersão da Q3 a fundo pede um município */
  document.addEventListener("abre-municipio", (e) => {
    const m = porCod.get(e.detail.cod);
    if (!m) return;
    st.q = e.detail.camada; st.medida = e.detail.medida; st.uf = m.uf; st.cod = m.cod_ibge;
    tudo();
    document.getElementById("territorio").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  let pedido = 0;
  async function tudo() {
    const meu = ++pedido;
    controles();
    trilha();
    await desenha();
    if (meu !== pedido) return;
    const med = medidaDe(st.q, st.medida);
    if (!st.cod) document.getElementById("terr-camara").hidden = true;
    if (st.cod) await painelMun(med);
    else if (st.uf) await painelUf(med);
    else await painelGeral(med);
  }
  tudo();
})();
