/* O mapa dos municípios nas consultas (perguntas 3, 4 e 6), em três níveis: Brasil → estado → município.
   Mapa.monta(el, { camada: "q3" | "q4" | "q6", uf }) desenha o mapa dentro de el, com as medidas da pergunta.
   Indicadores por município: vw_site_municipio (dados/site/municipios.json, de api/exportacao/exporta_mapa.py).
   Contornos: malhas do IBGE (dados/site/mapa_brasil.json e mapa_<UF>.json).
   As cores usam quintis calculados sobre todos os municípios, para que os estados sejam comparáveis entre si.
   No município, mostra o prefeito de 2024 e a Câmara Municipal (cadeiras da Q5): tocar numa cadeira mostra quem a ocupa.
   Precisa de dados.js e hemiciclo.js antes. */
(() => {
  const { arquivo } = window.Dados;
  const H = window.Hemiciclo;

  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /* o cadastro grava "Entre Rios Do Oeste": as preposições vão para minúscula na exibição */
  const nomeMun = (s) => String(s ?? "").replace(/(?<=\s)(Do|Da|De|Dos|Das|E)(?=\s)/g, (p) => p.toLowerCase());
  const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase()).replace(/(^|\s)(?!Dr\b)([B-DF-HJ-NP-TV-Z][b-df-hj-np-tv-z]{1,3})(?=\s|$)/g, (m, a, w) => a + w.toUpperCase());
  const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const { NOME: NOME_UF, DO: DO_UF } = window.UFs;
  const SEIS = window.UFs.LISTA; // nome antigo: hoje são as 27 unidades da federação
  const RAMPA = ["#b4c6de", "#8aa6cb", "#5f84b4", "#3a6399", "#1a3f6e"]; // validada (dataviz, ordinal)
  const SEM = "#d9d3c5";
  const GRAU = { 2: "lê e escreve", 5: "fundamental incompleto", 9: "fundamental completo", 10: "médio incompleto", 12: "médio completo", 14: "superior incompleto", 16: "superior completo" };
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const f = {
    pct: (v) => `${nf(1).format(v)}%`,
    anos: (v) => `${nf(1).format(v)} anos`,
    idhm: (v) => nf(3).format(v),
    brl: (v) => `R$ ${nf(0).format(v)}`,
    int: (v) => nf(0).format(v),
  };

  /* ----- as medidas que o mapa pode pintar em cada pergunta ----- */
  const CAMADAS = {
    q3: [
      { id: "nulos_2008", rot: "Nulos 2008", campo: "nulos_2008", fmt: f.pct, anulada: "anulada_2008", desc: "Votos nulos para prefeito em 2008, em percentual dos aptos. Municípios em que o TSE anulou a votação ficam hachurados e fora das medidas." },
      { id: "isentos_2008", rot: "Isentos 2008", campo: "isentos_2008", fmt: f.pct, anulada: "anulada_2008", desc: "Abstenção, brancos e nulos na eleição para prefeito de 2008, em percentual dos eleitores aptos." },
      { id: "isentos_2012", rot: "Isentos 2012", campo: "isentos_2012", fmt: f.pct, anulada: "anulada_2012", desc: "Abstenção, brancos e nulos na eleição para prefeito de 2012, em percentual dos eleitores aptos." },
      { id: "idhm", rot: "IDHM", campo: "idhm", fmt: f.idhm, desc: "Índice de Desenvolvimento Humano Municipal de 2010 (Atlas Brasil). Quanto mais escuro, mais desenvolvido." },
      { id: "pib_per_capita", rot: "PIB per capita", campo: "pib_per_capita", fmt: f.brl, desc: "PIB per capita de 2010 (IBGE), em reais da época." },
    ],
    q4: [
      { id: "anos_vereadores_2024", rot: "Vereadores eleitos", campo: "anos_vereadores_2024", fmt: f.anos, desc: "Escolaridade média dos vereadores eleitos em 2024, em anos de estudo equivalentes (fundamental completo 9, médio 12, superior 16)." },
      { id: "anos_eleitorado_2024", rot: "Eleitorado", campo: "anos_eleitorado_2024", fmt: f.anos, desc: "Escolaridade média do eleitorado em 2024, em anos de estudo equivalentes." },
      { id: "anos_prefeito_2024", rot: "Prefeito eleito", campo: "anos_prefeito_2024", fmt: (v) => GRAU[v] ?? f.anos(v), desc: "Grau de instrução do prefeito eleito em 2024.", discreto: [9, 12, 14, 16], rotulos: ["até fundamental incompleto", "fundamental completo", "médio completo", "superior incompleto", "superior completo"] },
      { id: "pct_superior_eleitorado_2024", rot: "Eleitorado com superior", campo: "pct_superior_eleitorado_2024", fmt: f.pct, desc: "Parte do eleitorado com ensino superior completo em 2024." },
    ],
    q6: [
      { id: "idade_prefeito_2024", rot: "Idade do prefeito", campo: "idade_prefeito_2024", fmt: f.anos, desc: "Idade do prefeito eleito em 2024, em 1º de outubro." },
      { id: "idade_mediana", rot: "Idade da população", campo: "idade_mediana", fmt: f.anos, desc: "Idade mediana da população no Censo 2022. Os grupos da pergunta 6 são os quartos desta medida." },
      { id: "idade_vereadores_2024", rot: "Idade dos vereadores", campo: "idade_vereadores_2024", fmt: f.anos, desc: "Idade média dos vereadores eleitos em 2024." },
      { id: "trocas_partido", rot: "Trocas de partido", campo: "trocas_partido", fmt: (v) => `${f.int(v)} ${v === 1 ? "troca" : "trocas"}`, desc: "Quantas vezes o partido do prefeito mudou de uma eleição para a seguinte, de 2004 a 2024. Renomeações e fusões contam como o mesmo partido.", discreto: [2, 3, 4, 5], rotulos: ["0 ou 1 troca", "2 trocas", "3 trocas", "4 trocas", "5 trocas"] },
    ],
  };

  /* ----- os dados dos municípios, carregados uma vez ----- */
  let base = null;
  async function municipios() {
    if (!base) {
      base = arquivo("site/municipios.json").then((b) => {
        const MUN = b.linhas.map((l) => Object.fromEntries(b.colunas.map((c, i) => [c, l[i]])));
        return { MUN, porCod: new Map(MUN.map((m) => [m.cod_ibge, m])) };
      });
      base.catch(() => (base = null));
    }
    return base;
  }
  const valor = (m, med) => (med.anulada && m[med.anulada] ? null : m[med.campo]);
  const mediana = (vs) => { const s = vs.filter((v) => v != null).sort((a, b) => a - b); if (!s.length) return null; const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
  const classe = (v, cs) => (v == null ? -1 : cs.filter((c) => v >= c).length);

  /* ----- zoom suave entre os níveis: anima o viewBox do SVG ----- */
  const vbDe = (svg) => svg.getAttribute("viewBox").split(/\s+/).map(Number);
  const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function anima(svg, de, para, ms = 700) {
    if (reduz || !svg) { svg?.setAttribute("viewBox", para.join(" ")); return Promise.resolve(); }
    return new Promise((ok) => {
      const t0 = performance.now();
      const passo = (agora) => {
        const t = Math.min(1, (agora - t0) / ms), k = suave(t);
        svg.setAttribute("viewBox", de.map((v, i) => v + (para[i] - v) * k).join(" "));
        if (t < 1) requestAnimationFrame(passo); else ok();
      };
      requestAnimationFrame(passo);
    });
  }
  /* caixa de um contorno com folga, para o município aparecer com os vizinhos em volta */
  const caixa = (el, folga, cheio) => {
    const b = el.getBBox();
    const lado = Math.min(Math.max(b.width, b.height) * folga, Math.max(cheio[2], cheio[3]));
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    return [cx - lado / 2, cy - lado / 2, lado, lado];
  };

  async function monta(raiz, { camada, uf = null }) {
    const MEDIDAS = CAMADAS[camada];
    raiz.innerHTML = `
      <div class="mapa-q__ctrl"><div class="seg" role="group" aria-label="O que o mapa mostra" data-r="medidas"></div></div>
      <div class="mapa-q__palco">
        <div class="mapa-q__mapa">
          <div class="mapa-q__barra">
            <nav class="mapa-q__trilha" data-r="trilha" aria-label="Nível do mapa"></nav>
            <div class="mapa-q__busca"><input type="search" autocomplete="off" placeholder="Buscar município" aria-label="Buscar município" data-r="busca"></div>
          </div>
          <div class="mapa-q__svg" data-r="svg" role="img" aria-label="Mapa"></div>
          <div class="mapa-q__dica" data-r="dica" hidden></div>
          <div class="mapa-q__legenda" data-r="legenda"></div>
        </div>
        <aside class="mapa-q__painel" data-r="painel" aria-live="polite"><p class="muted">Carregando o mapa…</p></aside>
        <section class="mapa-q__camara" data-r="camara" aria-label="Câmara Municipal" hidden></section>
      </div>`;
    const $ = (r) => raiz.querySelector(`[data-r="${r}"]`);
    const elSvg = $("svg"), dica = $("dica"), painel = $("painel"), mapaCaixa = elSvg.parentElement;

    let MUN, porCod;
    try { ({ MUN, porCod } = await municipios()); }
    catch { painel.innerHTML = `<p class="vazio">Não foi possível carregar o mapa.</p>`; return; }
    if (!raiz.isConnected) return;

    const cortes = new Map();
    const cortesDe = (med) => {
      if (med.discreto) return med.discreto;
      if (!cortes.has(med.id)) {
        const vs = MUN.map((m) => valor(m, med)).filter((v) => v != null).sort((a, b) => a - b);
        cortes.set(med.id, [0.2, 0.4, 0.6, 0.8].map((p) => vs[Math.floor(p * (vs.length - 1))]));
      }
      return cortes.get(med.id);
    };
    const corDe = (m, med) => {
      if (med.anulada && m[med.anulada]) return "url(#hachura)";
      const v = valor(m, med);
      return v == null ? SEM : RAMPA[classe(v, cortesDe(med))];
    };

    const st = { medida: MEDIDAS[0].id, uf: SEIS.includes(uf) ? uf : null, cod: null };
    const med = () => MEDIDAS.find((m) => m.id === st.medida);

    function controles() {
      const el = $("medidas");
      el.innerHTML = MEDIDAS.map((m) => `<button type="button" data-m="${m.id}" aria-pressed="${m.id === st.medida}">${m.rot}</button>`).join("");
      el.onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) { st.medida = b.dataset.m; tudo(); } };
    }

    function trilha() {
      const el = $("trilha");
      const partes = [st.uf ? `<button type="button" data-ir="brasil">Brasil</button>` : `<span>Brasil</span>`];
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

    function legenda(md) {
      const cs = cortesDe(md);
      const faixas = md.rotulos
        ? md.rotulos
        : [`até ${md.fmt(cs[0])}`, ...cs.slice(0, -1).map((c, i) => `${md.fmt(c)} a ${md.fmt(cs[i + 1])}`), `${md.fmt(cs[cs.length - 1])} ou mais`];
      const extra = md.anulada ? `<span><i style="background:repeating-linear-gradient(135deg,#918b80 0 2px,#e8e3d8 2px 5px)"></i>votação anulada</span>` : "";
      $("legenda").innerHTML = `<b>${md.rot}</b>${faixas.map((t, i) => `<span><i style="background:${RAMPA[i]}"></i>${t}</span>`).join("")}<span><i style="background:${SEM}"></i>sem dado</span>${extra}`;
    }

    async function desenha() {
      const md = med();
      const geo = await arquivo(st.uf ? `site/mapa_${st.uf}.json` : "site/mapa_brasil.json");
      /* no Brasil, folga à direita para os rótulos dos estados pequenos do litoral */
      const vb = st.uf ? `0 0 ${geo.largura} ${geo.altura}` : `-10 -10 ${geo.largura + 90} ${geo.altura + 20}`;
      const partes = [`<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><defs><pattern id="hachura-${camada}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e8e3d8"/><line x1="0" y1="0" x2="0" y2="6" stroke="#918b80" stroke-width="2.5"/></pattern></defs>`];
      if (!st.uf) {
        for (const a of geo.areas) {
          if (!SEIS.includes(a.id)) { partes.push(`<path class="fora" d="${a.d}"/>`); continue; }
          const v = mediana(MUN.filter((m) => m.uf === a.id).map((m) => valor(m, md)));
          partes.push(`<path class="alvo" data-uf="${a.id}" d="${a.d}" fill="${v == null ? SEM : RAMPA[classe(v, cortesDe(md))]}"/>`);
        }
        /* os estados pequenos do litoral ganham o rótulo fora, ligado por uma linha; os outros, dentro */
        const ROT = { RN: [55, -14], PB: [62, 0], PE: [70, 14], AL: [62, 26], SE: [55, 38], ES: [50, 4], RJ: [48, 22], DF: [-46, -30] };
        for (const a of geo.areas.filter((x) => SEIS.includes(x.id))) {
          const [dx, dy, dentro] = ROT[a.id] ?? [0, 0, true];
          if (dentro) partes.push(`<text class="rot" x="${a.c[0]}" y="${a.c[1] + 5}" text-anchor="middle">${a.id}</text>`);
          else partes.push(`<path class="linha-rot" d="M${a.c[0]},${a.c[1]}L${a.c[0] + dx - 6},${a.c[1] + dy - 5}"/><text class="rot fora-rot" x="${a.c[0] + dx}" y="${a.c[1] + dy}">${a.id}</text>`);
        }
      } else {
        for (const a of geo.areas) {
          const m = porCod.get(a.id);
          partes.push(`<path class="alvo${a.id === st.cod ? " sel" : ""}" data-cod="${a.id}" d="${a.d}" fill="${m ? corDe(m, md).replace("#hachura", `#hachura-${camada}`) : SEM}"/>`);
        }
      }
      partes.push("</svg>");
      elSvg.innerHTML = partes.join("");
      elSvg.setAttribute("aria-label", st.uf ? `Mapa dos municípios ${DO_UF[st.uf]}: ${md.rot}` : `Mapa do Brasil: ${md.rot}`);
      /* o município escolhido vai para a frente, para o contorno não ficar escondido pelos vizinhos */
      const sel = elSvg.querySelector(".sel");
      if (sel) sel.parentNode.appendChild(sel);
      legenda(md);
    }

    elSvg.addEventListener("pointermove", (e) => {
      const p = e.target.closest("path.alvo");
      if (!p) { dica.hidden = true; return; }
      const md = med();
      let html;
      if (p.dataset.uf) {
        const v = mediana(MUN.filter((m) => m.uf === p.dataset.uf).map((m) => valor(m, md)));
        html = `<b>${NOME_UF[p.dataset.uf]}</b>${md.rot}, mediana dos municípios: ${v == null ? "sem dado" : md.fmt(v)}`;
      } else {
        const m = porCod.get(Number(p.dataset.cod));
        const v = m && valor(m, md);
        html = `<b>${esc(nomeMun(m?.nome))}</b>${md.anulada && m?.[md.anulada] ? "votação anulada pelo TSE" : `${md.rot}: ${v == null ? "sem dado" : md.fmt(v)}`}`;
      }
      dica.innerHTML = html;
      dica.hidden = false;
      const r = mapaCaixa.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      dica.style.left = `${Math.max(8, Math.min(x + 16, r.width - dica.offsetWidth - 8))}px`;
      dica.style.top = `${Math.max(8, y - dica.offsetHeight - 14)}px`;
    });
    elSvg.addEventListener("pointerleave", () => (dica.hidden = true));
    elSvg.addEventListener("click", async (e) => {
      const p = e.target.closest("path.alvo");
      if (!p) return;
      dica.hidden = true;
      if (p.dataset.uf) {
        /* antes de sair do Brasil, a câmera chega perto do estado escolhido */
        const svg = elSvg.querySelector("svg");
        await anima(svg, vbDe(svg), caixa(p, 1.1, vbDe(svg)), 650);
        st.uf = p.dataset.uf; st.cod = null;
      } else st.cod = Number(p.dataset.cod) === st.cod ? null : Number(p.dataset.cod);
      tudo();
    });

    /* ----- o painel ao lado ----- */
    function painelGeral(md) {
      const linhas = SEIS.map((u) => ({ u, v: mediana(MUN.filter((m) => m.uf === u).map((m) => valor(m, md))) })).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
      const max = Math.max(...linhas.map((l) => l.v ?? 0)) || 1;
      painel.innerHTML = `
        <h3>Brasil</h3>
        <p class="sub">${f.int(MUN.length)} municípios</p>
        <p class="desc">${md.desc}</p>
        <div class="ranking-uf">${linhas.map((l) => `<button type="button" data-uf="${l.u}">${NOME_UF[l.u]}<span>${l.v == null ? "—" : md.fmt(l.v)}</span><i style="--w:${(((l.v ?? 0) / max) * 100).toFixed(1)}%"></i></button>`).join("")}</div>
        <p class="sub">Mediana dos municípios de cada estado. Toque num estado para ver as cidades.</p>`;
      painel.querySelector(".ranking-uf").onclick = (e) => { const b = e.target.closest("[data-uf]"); if (b) { st.uf = b.dataset.uf; st.cod = null; tudo(); } };
    }

    function painelUf(md) {
      const ms = MUN.filter((m) => m.uf === st.uf);
      const comV = ms.filter((m) => valor(m, md) != null).sort((a, b) => valor(a, md) - valor(b, md));
      const lo = comV[0], hi = comV[comV.length - 1];
      painel.innerHTML = `
        <h3>${NOME_UF[st.uf]}</h3>
        <p class="sub">${f.int(ms.length)} municípios</p>
        <p class="desc">${md.desc}</p>
        ${comV.length ? `<dl>
          <div class="atual"><dt>Mediana dos municípios</dt><dd>${md.fmt(mediana(comV.map((m) => valor(m, md))))}</dd></div>
          <div><dt>Mais alto</dt><dd>${md.fmt(valor(hi, md))}<small>${esc(nomeMun(hi.nome))}</small></dd></div>
          <div><dt>Mais baixo</dt><dd>${md.fmt(valor(lo, md))}<small>${esc(nomeMun(lo.nome))}</small></dd></div>
        </dl>` : ""}
        <p class="sub">Toque num município para ver os números dele.</p>`;
    }

    function painelMun(md) {
      const m = porCod.get(st.cod);
      const doUf = MUN.filter((x) => x.uf === m.uf);
      const posicao = (mm) => {
        const v = valor(m, mm);
        if (v == null) return "";
        const vs = doUf.map((x) => valor(x, mm)).filter((x) => x != null);
        return `maior que em ${f.int(Math.round((100 * vs.filter((x) => x < v).length) / vs.length))}% dos municípios ${DO_UF[m.uf]}`;
      };
      const linhas = MEDIDAS.map((mm) => {
        const anulada = mm.anulada && m[mm.anulada];
        const v = valor(m, mm);
        return `<div${mm.id === md.id ? ' class="atual"' : ""}><dt>${mm.rot}</dt><dd>${anulada ? "anulada" : v == null ? "—" : mm.fmt(v)}${anulada ? "<small>votação anulada pelo TSE</small>" : v == null ? "" : `<small>${posicao(mm)}</small>`}</dd></div>`;
      }).join("");
      let extra = "";
      if (camada === "q6" && m.partidos_prefeito) {
        const seq = m.partidos_prefeito.split(" ").map((p) => p.split(":"));
        extra = `<p class="sub" style="margin-top:1.25rem">Partido do prefeito eleito, de 2004 a 2024${m.prefeito_reeleito_2024 ? "; o de 2024 foi reeleito" : ""}:</p>
          <div class="partidos-pref">${seq.map(([ano, sig], i) => `<span${i && sig !== seq[i - 1][1] ? ' class="troca"' : ""}><small>${ano}</small>${esc(sig)}</span>`).join("")}</div>`;
      }
      if (camada === "q3" && m.populacao != null) extra = `<p class="sub" style="margin-top:1rem">População em 2010: ${f.int(m.populacao)} habitantes.</p>`;
      const prefeito = m.nome_prefeito_2024 ? `
        <div class="prefeito">${m.id_prefeito_2024 ? `<img src="fotos/${m.id_prefeito_2024}.webp" alt="Foto de ${esc(titulo(m.nome_prefeito_2024))}" width="161" height="225" onerror="this.remove()">` : ""}
          <p><span>Prefeito eleito em 2024</span><b>${esc(titulo(m.nome_prefeito_2024))}</b><small>${esc(m.partido_prefeito_2024)} · ${f.int(m.idade_prefeito_2024)} anos${m.prefeito_reeleito_2024 ? " · reeleito" : ""}</small></p>
        </div>` : "";
      painel.innerHTML = `<h3>${esc(nomeMun(m.nome))}</h3><p class="sub">${NOME_UF[m.uf]}</p>${prefeito}<dl>${linhas}</dl>${extra}`;
      camara(m);
    }

    /* a Câmara do município (cadeiras da Q5) e o custo de cada cadeira (Q1) */
    async function camara(m) {
      const el = $("camara");
      const topo = (n) => `<div class="camara__topo"><h4>Câmara Municipal de ${esc(nomeMun(m.nome))}</h4><span>2024${n ? ` · ${f.int(n)} cadeiras` : ""}</span></div>`;
      el.innerHTML = `${topo()}<p class="camara__aviso">Carregando…</p>`;
      el.hidden = false;
      try {
        const [cad, q1] = await Promise.all([arquivo(`site/cadeiras_2024_VEREADOR_${m.uf}.json`), arquivo("q1_municipio_VEREADOR.json").catch(() => ({ linhas: [] }))]);
        if (!el.isConnected || st.cod !== m.cod_ibge) return;
        const linhas = cad.linhas.filter((l) => l[0] === m.cod_ibge)
          .map((l) => ({ id: l[2], nome: l[4], partido: l[5], votos: l[6], posicao: l[7], sozinho: !l[11] }));
        if (!linhas.length) { el.innerHTML = `${topo()}<p class="camara__aviso">Os votos de vereador deste município não foram publicados completos pelo TSE em 2024.</p>`; return; }
        const custo = q1.linhas.find((l) => l.ano === 2024 && l.uf === m.uf && l.municipio_busca === semAcento(m.nome));
        const por = new Map();
        for (const l of linhas) (por.get(l.partido) ?? por.set(l.partido, []).get(l.partido)).push(l);
        const partidos = [...por].map(([nome, membros]) => ({ nome, cadeiras: membros.length, cor: H.cor(nome), membros: membros.sort((a, b) => b.votos - a.votos) }))
          .sort((a, b) => b.cadeiras - a.cadeiras || a.nome.localeCompare(b.nome));
        const top = linhas.find((l) => l.posicao === 1) ?? [...linhas].sort((a, b) => b.votos - a.votos)[0];
        const pessoa = (l, rotulo) => `<img src="fotos/${l.id}.webp" alt="" width="161" height="225" onerror="this.remove()">
          <p><span>${rotulo}</span><b>${esc(titulo(l.nome))}</b><small>${esc(l.partido)} · ${f.int(l.votos)} votos${l.sozinho ? " · atingiu o quociente sozinho" : ""}</small></p>`;
        el.innerHTML = `
          ${topo(linhas.length)}
          <div class="hemi camara__hemi" data-r="hemi"></div>
          <div class="camara__lado">
            <div class="camara__pessoa" data-r="vereador">${pessoa(top, "Maior votação")}</div>
            <ul class="camara__legenda">${partidos.map((p) => `<li><i style="background:${p.cor}"></i>${esc(p.nome)}<b>${p.cadeiras}</b></li>`).join("")}</ul>
            ${custo ? `<p class="camara__custo"><b>R$ ${nf(0).format(custo.custo_por_cadeira)}</b>por cadeira, somando o gasto dos ${f.int(custo.candidatos)} candidatos (pergunta 1)</p>` : ""}
            <a class="camara__link" href="#q5?par=2024%7CVEREADOR&uf=${m.uf}&mun=${m.cod_ibge}">Abrir esta Câmara na pergunta 5</a>
          </div>`;
        const hemi = $("hemi");
        hemi.addEventListener("assento", (e) => { $("vereador").innerHTML = pessoa(e.detail.membro, "Nesta cadeira"); });
        H.desenha(hemi, { partidos, legendaCentro: "cadeiras" });
      } catch {
        el.innerHTML = `${topo()}<p class="camara__aviso">Não foi possível carregar a Câmara.</p>`;
      }
    }

    /* ----- busca ----- */
    const busca = $("busca");
    const lista = `mapa-lista-${camada}`;
    busca.setAttribute("list", lista);
    busca.insertAdjacentHTML("afterend", `<datalist id="${lista}">${MUN.map((m) => `<option value="${esc(nomeMun(m.nome))} (${m.uf})">`).join("")}</datalist>`);
    busca.addEventListener("change", () => {
      const t = busca.value.trim();
      const m = MUN.find((x) => `${nomeMun(x.nome)} (${x.uf})` === t) ?? MUN.find((x) => semAcento(x.nome) === semAcento(t.replace(/\s*\(\w\w\)$/, "")));
      if (!m) return;
      st.uf = m.uf; st.cod = m.cod_ibge;
      busca.value = "";
      tudo();
    });

    /* ----- transição entre os níveis ----- */
    let ant = { uf: null, cod: null }, vbAnt = null;
    async function transicao() {
      const svg = elSvg.querySelector("svg");
      if (!svg) return;
      const cheio = vbDe(svg);
      if (!st.uf && ant.uf) {
        const p = svg.querySelector(`path[data-uf="${ant.uf}"]`);
        if (p) { const de = caixa(p, 1.1, cheio); svg.setAttribute("viewBox", de.join(" ")); await anima(svg, de, cheio); }
      }
      if (st.uf && st.cod) {
        const p = svg.querySelector(`path[data-cod="${st.cod}"]`);
        if (p) await anima(svg, ant.uf === st.uf && vbAnt ? vbAnt : cheio, caixa(p, 5, cheio));
      } else if (st.uf && ant.cod && ant.uf === st.uf && vbAnt) {
        await anima(svg, vbAnt, cheio);
      }
      vbAnt = vbDe(svg);
      ant = { uf: st.uf, cod: st.cod };
    }

    let pedido = 0;
    async function tudo() {
      const meu = ++pedido;
      controles();
      trilha();
      try { await desenha(); } catch { elSvg.innerHTML = `<p class="vazio">Não foi possível carregar o contorno do mapa.</p>`; }
      if (meu !== pedido || !raiz.isConnected) return;
      transicao();
      const md = med();
      if (!st.cod) $("camara").hidden = true;
      if (st.cod) painelMun(md);
      else if (st.uf) painelUf(md);
      else painelGeral(md);
    }
    tudo();
  }

  window.Mapa = { monta };
})();
