/* As histórias contadas com scroll dinâmico (ver scrolly.js). Cada uma lê os dados extras de dados/extra/*.json,
   gerados por api/exportacao/exporta_extra.py a partir das views do banco. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const reais = (v) => v >= 1e9 ? `R$ ${nf(1).format(v / 1e9)} bi` : v >= 1e6 ? `R$ ${nf(1).format(v / 1e6)} mi` : v >= 1e3 ? `R$ ${nf(0).format(v / 1e3)} mil` : `R$ ${nf(0).format(v)}`;
  const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());
  const json = (url) => fetch(url).then((r) => r.json());
  const el = (tag, attrs = {}, pai) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    pai?.appendChild(e);
    return e;
  };
  const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  /* embaralha com semente fixa, para a grade inicial ser sempre a mesma */
  const embaralha = (n, semente = 7) => {
    const idx = Array.from({ length: n }, (_, i) => i);
    let x = semente;
    for (let i = n - 1; i > 0; i--) { x = (x * 16807) % 2147483647; const j = x % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx;
  };
  /* no celular os desenhos encolhem; com isso os textos e as posições mudam (decidido uma vez, ao carregar) */
  const fone = () => window.matchMedia("(max-width: 47.99rem)").matches;
  const preenche = (raiz, nome, texto) => raiz.querySelectorAll(`[data-${nome}]`).forEach((b) => (b.textContent = texto(b.dataset[nome]) ?? b.textContent));
  /* arredonda partes para somarem 100 (maiores restos) */
  const em100 = (ps) => {
    const tot = ps.reduce((a, b) => a + b, 0), cru = ps.map((p) => (100 * p) / tot), n = cru.map(Math.floor);
    let falta = 100 - n.reduce((a, b) => a + b, 0);
    cru.map((c, i) => [c - Math.floor(c), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (falta > 0) { n[i]++; falta--; } });
    return n;
  };


  /* ---------- 1. O preço da cadeira: um ponto por candidato a deputado federal em 2022 ----------
     São quase 10 mil pontos no Brasil: ficam num canvas (nuvem.js) e cada arranjo calcula o tamanho do ponto
     para caber no quadro, em vez de usar um tamanho fixo. */
  (async () => {
    const box = document.getElementById("preco-pontos");
    if (!box || !window.Scrolly || !window.Nuvem) return;
    const [df, ext, custos] = await Promise.all([json("dados/extra/df2022.json"), json("dados/extra/extremos.json"), window.Dados.resposta("/api/q1/custo-cadeira").then((r) => r.dados)]);
    const cand = df.dados.map(([gasto, eleito], i) => ({ gasto, eleito: !!eleito, i }));
    const N = cand.length;
    const F = fone(), K = F ? 1.85 : 1; // K: quanto o texto cresce no celular
    const W = 800, H = 470, BASE = F ? 418 : 430;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cada ponto é um candidato a deputado federal em 2022" }, box);
    const eixo = el("g", { class: "eixo" }, svg);
    const nuvem = Nuvem.cria(box, { W, H, n: N, svg });
    nuvem.classes({ base: ["--muted", 1], eleito: ["--muted", 1] });
    cand.forEach((c) => nuvem.classe(c.i, c.eleito ? "eleito" : "base"));

    /* passo 0: grade que ocupa o quadro; o lado da célula sai do número de pontos */
    const ordem = embaralha(N);
    const grade = (() => {
      const gx = 22, gy = 36, aw = W - 10 - gx, ah = H - 30 - gy;
      let s = Math.sqrt((aw * ah) / N), cols;
      for (;;) { cols = Math.floor(aw / s); if (cols * Math.floor(ah / s) >= N) break; s *= 0.99; }
      const pos = new Array(N), col = new Float32Array(N);
      ordem.forEach((ci, k) => { pos[ci] = [gx + s / 2 + (k % cols) * s, gy + s / 2 + Math.floor(k / cols) * s]; col[ci] = k % cols; });
      return { pos, raio: s * 0.36, col, cols };
    })();

    /* passos 1 e 2: cada um no lugar do gasto (escala log), empilhados em colunas.
       O espaçamento é o maior que deixa a coluna mais alta caber entre a base e o topo do quadro. */
    const X0 = 70, X1 = 785, LMIN = 3, LMAX = 7; // R$ 1 mil a R$ 10 mi
    const xDe = (g) => g <= 0 ? 26 : X0 + ((Math.min(Math.max(Math.log10(g), LMIN), LMAX) - LMIN) / (LMAX - LMIN)) * (X1 - X0);
    const LARG = 13, LARG0 = 40, ALT = BASE - 34; // LARG0: a coluna de quem gastou R$ 0, mais larga
    const colunas = new Map();
    cand.forEach((c) => { const k = c.gasto <= 0 ? -1 : Math.round((xDe(c.gasto) - X0) / LARG); (colunas.get(k) ?? colunas.set(k, []).get(k)).push(c); });
    let d = LARG / 2;
    const cabe = () => [...colunas].every(([k, cs]) => { const p = Math.max(1, Math.floor((k === -1 ? LARG0 : LARG) / d)); return Math.ceil(cs.length / p) * d <= ALT; });
    while (!cabe()) d *= 0.96;
    const pilha = new Map();
    for (const [k, cs] of colunas) {
      cs.sort((a, b) => a.eleito - b.eleito || a.gasto - b.gasto);
      const cx = k === -1 ? 24 : X0 + k * LARG;
      const por = Math.max(1, Math.floor((k === -1 ? LARG0 : LARG) / d));
      cs.forEach((c, j) => pilha.set(c.i, [cx + ((j % por) - (por - 1) / 2) * d, BASE - d / 2 - Math.floor(j / por) * d]));
    }
    const raioPilha = d * 0.42;
    const ROTULOS = F ? ["0", "1 mil", "10 mil", "100 mil", "1 mi", "10 mi"] : ["R$ 0", "R$ 1 mil", "R$ 10 mil", "R$ 100 mil", "R$ 1 mi", "R$ 10 mi"];
    [0, 1e3, 1e4, 1e5, 1e6, 1e7].forEach((v, k) => {
      const t = ROTULOS[k];
      const x = v === 0 ? 22 : xDe(v);
      el("line", { x1: x, x2: x, y1: BASE + 6, y2: BASE + 12 }, eixo);
      el("text", { x, y: BASE + 14 + 16 * K, "text-anchor": "middle" }, eixo).textContent = t;
    });

    /* passo 3: uma cadeira por eleito, cada uma com o eleito e os derrotados que dividem a conta com ele.
       Os blocos (MC x MR pontos) se arrumam no espaço abaixo do texto; o tamanho do ponto sai do número de cadeiras. */
    const eleitos = cand.filter((c) => c.eleito), outros = cand.filter((c) => !c.eleito);
    const E = eleitos.length;
    const grupos = eleitos.map((e) => [e]);
    outros.forEach((c, j) => grupos[j % E].push(c));
    const MC = 5, MR = Math.ceil(Math.max(...grupos.map((g) => g.length)) / MC);
    const TOPO = F ? 236 : 196, AW = W - 10 - 22, AH = H - 8 - TOPO;
    let s = 10, gc, bw, bh;
    for (;;) { bw = (MC + 1.3) * s; bh = (MR + 1.3) * s; gc = Math.floor(AW / bw); if (Math.ceil(E / gc) * bh <= AH) break; s *= 0.97; }
    const sobra = (AW - gc * bw + 1.3 * s) / 2; // centra a grade de blocos
    const cadeira = new Map(), grupoDe = new Float32Array(N);
    grupos.forEach((g, gi) => {
      const gx = 22 + sobra + (gi % gc) * bw, gy = TOPO + Math.floor(gi / gc) * bh;
      g.forEach((c, j) => { cadeira.set(c.i, [gx + s / 2 + (j % MC) * s, gy + s / 2 + Math.floor(j / MC) * s]); grupoDe[c.i] = gi; });
    });
    const raioCadeira = s * 0.38;

    /* anotações: o eleito que mais e o que menos gastou (o texto fica numa altura fixa, acima das colunas) */
    const dfEl = ext.dados.filter((x) => x.ano === 2022 && x.cargo === "DEPUTADO FEDERAL").sort((a, b) => a.gasto - b.gasto);
    const barato = dfEl[0], caro = dfEl.at(-1);
    const acha = (g) => eleitos.reduce((m, c) => (Math.abs(c.gasto - g) < Math.abs(m.gasto - g) ? c : m));
    const anota = (c, nome, linhas, dx, yTexto) => {
      const [x, y] = pilha.get(c.i);
      const g = el("g", { class: "anota" }, svg);
      el("line", { x1: x, y1: y - 3, x2: x + dx, y2: yTexto + 6 + 18 * K * linhas.length }, g);
      const t = el("text", { x: x + dx, y: yTexto, "text-anchor": dx < 0 ? "end" : "start" }, g);
      t.textContent = nome;
      linhas.forEach((l, k) => { const tt = el("text", { x: x + dx, y: yTexto + 18 * K * (k + 1), "text-anchor": dx < 0 ? "end" : "start" }, g); tt.textContent = l; });
      return g;
    };
    const aCaro = anota(acha(caro.gasto), `${titulo(caro.nome_urna)} (${caro.partido}-${caro.uf})`, [`gastou ${reais(caro.gasto)}`], -24, F ? 40 : 34);
    const aBarato = anota(acha(barato.gasto), `${titulo(barato.nome_urna)} (${barato.partido}-${barato.uf})`, [`gastou ${reais(barato.gasto)}`], -40, F ? 150 : 104);
    const total = cand.reduce((s, c) => s + c.gasto, 0);
    const aTotal = el("g", { class: "anota" }, svg);
    const ys = F ? [52, 112, 162, 200] : [50, 98, 136, 164];
    el("text", { x: 22, y: ys[0], class: "forte" }, aTotal).textContent = `${reais(total)} ÷ ${nf(0).format(E)} cadeiras`;
    el("text", { x: 22, y: ys[1], class: "forte" }, aTotal).textContent = `= ${reais(total / E)} por cadeira`;
    el("text", { x: 22, y: ys[2] }, aTotal).textContent = F ? "Cada bloco é uma cadeira: o eleito" : "Cada bloco é uma cadeira: o eleito em azul";
    el("text", { x: 22, y: ys[3] }, aTotal).textContent = F ? "em azul e os derrotados atrás dele." : "e os derrotados que dividem a conta com ele.";

    /* passo 5: a cadeira de deputado federal como um quadrado, e a de vereador como um quadradinho dentro dele.
       A área é proporcional ao preço: cabem tantos quadradinhos quanto cadeiras de vereador no preço de uma. */
    const custo = (ano, cargo) => { const ls = custos.filter((r) => r.ano === ano && r.cargo === cargo); return ls.reduce((s, r) => s + r.gasto_total, 0) / ls.reduce((s, r) => s + r.cadeiras, 0); };
    const cDep = custo(2022, "DEPUTADO FEDERAL"), cVer = custo(2024, "VEREADOR");
    const cabem = Math.round(cDep / cVer), LADO = Math.ceil(Math.sqrt(cabem));
    const QX = 22, QY = F ? 60 : 24, QS = F ? 372 : 406, CEL = QS / LADO;
    const comp = el("g", { class: "comp" }, svg);
    const quadrinhos = [];
    for (let k = 0; k < cabem; k++) {
      const q = el("rect", { x: QX + (k % LADO) * CEL + 1, y: QY + Math.floor(k / LADO) * CEL + 1, width: CEL - 2, height: CEL - 2, class: k === 0 ? "um" : "" }, comp);
      q.style.setProperty("--d", `${Math.round((k % LADO + Math.floor(k / LADO)) * 28)}ms`);
      quadrinhos.push(q);
    }
    el("rect", { x: QX, y: QY, width: QS, height: QS, class: "borda" }, comp);
    const TX = QX + QS + (F ? 30 : 46);
    const texto = (y, t, classe) => { const e = el("text", { x: TX, y, class: classe ?? "" }, comp); e.textContent = t; return e; };
    texto(QY + 34 * K, reais(cDep), "forte");
    texto(QY + 34 * K + 24 * K, "uma cadeira de deputado federal, 2022");
    texto(QY + QS - 58 * K, new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cVer), "forte ver");
    texto(QY + QS - 58 * K + 24 * K, "uma de vereador, 2024: o quadradinho azul");
    texto(QY + QS / 2 + 8 * K, `${cabem} quadradinhos cabem no quadrado`, "meio");

    /* números do texto */
    const sec = box.closest(".scrolly");
    const medEl = mediana(eleitos.map((c) => c.gasto)), medOut = mediana(outros.map((c) => c.gasto));
    const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    const valores = { mediana: reais(mediana(cand.map((c) => c.gasto))), zero: nf(0).format(cand.filter((c) => c.gasto <= 0).length), medEleito: reais(medEl),
      vezes: `${nf(0).format(medEl / medOut)} vezes`, caro: titulo(caro.nome_urna), caroV: reais(caro.gasto), barato: titulo(barato.nome_urna), baratoV: reais(barato.gasto), total: reais(total), porCadeira: reais(total / E), vereador: brl.format(cVer), cabem: nf(0).format(cabem),
      candidatos: nf(0).format(N), cadeiras: nf(0).format(E) };
    preenche(sec, "preco", (k) => valores[k]);

    /* cada passo: para onde vão os pontos, com que atraso, de que tamanho e de que cor */
    const em = (mapa) => cand.map((c) => mapa.get(c.i));
    const POS = { grade: grade.pos, pilha: em(pilha), cadeira: em(cadeira) };
    const COR = [
      { base: ["--muted", 1], eleito: ["--muted", 1] },
      { base: ["--muted", 1], eleito: ["--muted", 1] },
      { base: ["--muted", 0.28], eleito: ["--accent", 1] },
      { base: ["--muted", 0.55], eleito: ["--accent", 1] },
      { base: ["--muted", 0], eleito: ["--accent", 0] },
    ];
    nuvem.poe(grade.pos);
    nuvem.raio(grade.raio, 0);
    const tituloGraf = sec.querySelector(".graf__titulo"), tituloPontos = tituloGraf?.textContent;
    Scrolly.registra("preco", (i) => {
      box.dataset.passo = i;
      if (tituloGraf) tituloGraf.textContent = i === 4 ? "O preço de uma cadeira, em área: deputado federal em 2022 e vereador em 2024" : tituloPontos;
      if (i === 0) { nuvem.vai(POS.grade, { atraso: (k) => (grade.col[k] / grade.cols) * 240 }); nuvem.raio(grade.raio); }
      else if (i <= 2) { nuvem.vai(POS.pilha, { atraso: i === 1 ? (k) => (xDe(cand[k].gasto) / W) * 400 : null }); nuvem.raio(raioPilha); }
      else if (i === 3) { nuvem.vai(POS.cadeira, { atraso: (k) => (grupoDe[k] / E) * 550 }); nuvem.raio(raioCadeira); }
      nuvem.estilo(COR[i], i === 4 ? 300 : 500);
      eixo.classList.toggle("is-on", i === 1 || i === 2);
      aCaro.classList.toggle("is-on", i === 2);
      aBarato.classList.toggle("is-on", i === 2);
      aTotal.classList.toggle("is-on", i === 3);
      comp.classList.toggle("is-on", i === 4);
    });
  })();
  /* ---------- 2. A casa: as cadeiras de deputado federal de 2022 (513 no Brasil) ---------- */
  (async () => {
    const box = document.getElementById("hist-hemi");
    if (!box || !window.Scrolly || !window.Hemiciclo) return;
    const H = window.Hemiciclo;
    const COL = ["cod_ibge", "municipio", "id_candidatura", "id_pessoa", "nome_urna", "partido", "votos", "posicao_votos", "vagas", "quociente", "pct_do_quociente", "por_legenda", "fora_dos_mais_votados"];
    const UFS = window.UFs.LISTA;
    const vazio = { linhas: [] }; // o DF não tem vereador
    const [extra, ...arqs] = await Promise.all([json("dados/extra/cadeiras_extra.json"), ...UFS.map((u) => json(`dados/site/cadeiras_2022_DEPUTADO_FEDERAL_${u}.json`)),
      ...UFS.map((u) => (u === "DF" ? Promise.resolve(vazio) : json(`dados/site/cadeiras_2024_VEREADOR_${u}.json`).catch(() => vazio)))]);
    const vers = arqs.splice(UFS.length).flatMap((f) => f.linhas.map((l) => !l[COL.indexOf("por_legenda")]));
    const linhas = arqs.flatMap((f, k) => f.linhas.map((l) => {
      const m = Object.fromEntries(COL.map((c, i) => [c, l[i]]));
      const [gasto, mulher, patrimonio] = extra.dados[`2022_DEPUTADO_FEDERAL_${UFS[k]}`]?.[String(m.id_candidatura)] ?? [0, false, 0];
      return { ...m, uf: UFS[k], gasto, mulher, patrimonio };
    }));
    const porPartido = new Map();
    linhas.forEach((l) => (porPartido.get(l.partido) ?? porPartido.set(l.partido, []).get(l.partido)).push(l));
    const partidos = [...porPartido].map(([nome, membros]) => ({ nome, cadeiras: membros.length, cor: H.cor(nome), membros: membros.sort((a, b) => b.votos - a.votos) }))
      .sort((a, b) => b.cadeiras - a.cadeiras || a.nome.localeCompare(b.nome));
    const h = H.desenha(box, { partidos });
    document.getElementById("hist-legenda").innerHTML = partidos.map((p) => `<span><i style="background:${p.cor}"></i>${p.nome} ${p.cadeiras}</span>`).join("");

    const n = (f) => linhas.filter(f).length;
    const verSozinho = vers.filter(Boolean).length;
    const valores = { sozinho: n((l) => !l.por_legenda), resto: n((l) => l.por_legenda), puxado: n((l) => l.fora_dos_mais_votados),
      mulheres: n((l) => l.mulher), vereadores: nf(0).format(vers.length), verSozinho: nf(0).format(verSozinho),
      verPct: `${nf(1).format((100 * (vers.length - verSozinho)) / vers.length)}%` };
    preenche(box.closest(".scrolly"), "casa", (k) => String(valores[k]));

    /* o último passo: os vereadores de 2024, um quadradinho cada; os que chegaram ao quociente sozinhos ficam acesos.
       Dois canvas: a base apagada e, por cima, os acesos (que entram depois, por CSS) */
    const fig = box.closest(".scrolly__grafico"), ver = document.getElementById("hist-ver"), nome = fig.querySelector(".casa__nome");
    const nomeDep = nome.textContent, nomeVer = "Os vereadores eleitos no Brasil, 2024";
    const ordem = embaralha(vers.length, 11);
    function pintaVer() {
      const [base, acesos] = ver.querySelectorAll("canvas");
      const larg = ver.clientWidth, alt = ver.clientHeight;
      if (!larg || !alt) return;
      // o lado da célula que faz caber todos os pontos no espaço
      let lado = Math.sqrt((larg * alt) / vers.length);
      let cols = Math.floor(larg / lado);
      while (cols * Math.floor(alt / lado) < vers.length) { lado *= 0.98; cols = Math.floor(larg / lado); }
      const linhasN = Math.ceil(vers.length / cols), dpr = devicePixelRatio || 1;
      const w = cols * lado, hh = linhasN * lado;
      for (const c of [base, acesos]) {
        c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
        c.style.width = `${w}px`; c.style.height = `${hh}px`;
      }
      const cb = base.getContext("2d"), ca = acesos.getContext("2d");
      cb.scale(dpr, dpr); ca.scale(dpr, dpr);
      cb.fillStyle = "#3a3731"; ca.fillStyle = "#f3f0e8";
      const q = Math.max(1, lado - Math.max(1, lado * 0.25));
      ordem.forEach((k, pos) => {
        const x = (pos % cols) * lado, y = Math.floor(pos / cols) * lado;
        (vers[k] ? ca : cb).fillRect(x, y, q, q);
      });
    }
    let pintado = false;
    addEventListener("resize", () => { if (pintado) pintaVer(); });
    const MARCAS = [null, (m) => !m.por_legenda, (m) => m.fora_dos_mais_votados, (m) => m.mulher, null];
    Scrolly.registra("casa", (i) => {
      const noVer = i === 4;
      if (noVer && !pintado) { pintado = true; pintaVer(); }
      fig.classList.toggle("is-ver", noVer);
      nome.textContent = noVer ? nomeVer : nomeDep;
      // no último passo os vereadores ocupam o quadro inteiro: o título sobe para o alto, acima deles
      nome.style.transform = noVer ? `translateY(${-(nome.offsetTop - 18)}px)` : "";
      h.marca(MARCAS[i]);
    });
  })();
  /* ---------- 4. Quem estudou se elege: 100 bonecos coloridos pela escolaridade ---------- */
  (async () => {
    const box = document.getElementById("escola-bonecos");
    if (!box || !window.Scrolly || !window.Dados) return;
    const { resposta, qs } = window.Dados;
    const [df, vr] = await Promise.all([
      resposta(`/api/q4?${qs({ ano: 2022, cargo: "DEPUTADO FEDERAL", uf: "TODAS" })}`).then((r) => r.dados),
      resposta(`/api/q4?${qs({ ano: 2024, cargo: "VEREADOR", uf: "TODAS" })}`).then((r) => r.dados),
    ]);
    // três grupos: sem ensino médio completo (ordem 0 a 4), ensino médio (5 e 6) e superior completo (7)
    const grupo = (o) => (o >= 7 ? 2 : o >= 5 ? 1 : 0);
    const somas = (rep, k) => rep.reduce((acc, r) => { acc[grupo(r.ordem)] += r[k]; return acc; }, [0, 0, 0]);
    const eleitores = em100(somas(df.representacao, "pct_eleitorado"));
    const deputados = em100(somas(df.representacao, "pct_eleitos"));
    const vereadores = em100(somas(vr.representacao, "pct_eleitos"));
    const pobre = [...df.grupos].filter((g) => g.grupo_ordem > 0).sort((a, b) => a.pct_superior_eleitorado - b.pct_superior_eleitorado)[0];
    const votos = [100 - Math.round(pobre.pct_superior_votados), 0, Math.round(pobre.pct_superior_votados)];

    // 20 colunas por 5 linhas, preenchidas por coluna: cada grupo vira uma faixa
    const COLS = 20, LINS = 5, CW = 50, CH = 86;
    const svg = el("svg", { viewBox: `0 0 ${COLS * CW} ${LINS * CH}`, role: "img", "aria-label": "Cem bonecos" }, box);
    const bonecos = Array.from({ length: 100 }, (_, k) => {
      const c = Math.floor(k / LINS), l = k % LINS;
      const g = el("g", { transform: `translate(${c * CW},${l * CH})`, class: "boneco", style: `--d:${c * 22}ms` }, svg);
      el("circle", { cx: CW / 2, cy: 17, r: 9 }, g);
      el("path", { d: `M${CW / 2 - 15},72 v-26 a15,15 0 0 1 30,0 v26 z` }, g);
      return g;
    });
    const leg = document.getElementById("escola-leg"), tit = document.getElementById("escola-titulo");
    const NOMES = ["Sem ensino médio completo", "Médio completo ou superior incompleto", "Superior completo"];
    const QUADROS = [
      { n: eleitores, titulo: "100 eleitores brasileiros" },
      { n: deputados, titulo: "100 deputados federais eleitos em 2022" },
      { n: vereadores, titulo: "100 vereadores eleitos em 2024" },
      { n: votos, titulo: `100 votos para deputado federal nos ${nf(0).format(pobre.municipios)} municípios menos escolarizados`, nomes: ["Para candidatos sem faculdade", "", "Para candidatos com faculdade"] },
    ];
    function pinta(i) {
      const q = QUADROS[i], [a, b] = q.n;
      bonecos.forEach((g, k) => g.setAttribute("data-g", k < a ? 0 : k < a + b ? 1 : 2));
      tit.textContent = q.titulo;
      const nomes = q.nomes ?? NOMES;
      leg.innerHTML = q.n.map((v, k) => (nomes[k] ? `<span><i class="g${k}"></i>${nomes[k]} <b>${v}</b></span>` : "")).join("");
    }
    const pct = (v) => `${nf(1).format(v)}%`;
    const valores = { elSup: eleitores[2], elSem: eleitores[0], dfSup: deputados[2], dfSem: deputados[0], vrSup: vereadores[2],
      gMun: nf(0).format(pobre.municipios), gEl: pct(pobre.pct_superior_eleitorado), gVot: `${nf(0).format(pobre.pct_superior_votados)}%` };
    preenche(box.closest(".scrolly"), "escola", (k) => String(valores[k]));
    pinta(0);
    Scrolly.registra("escola", pinta);
  })();
  /* ---------- 8. De onde veio: a fila dos candidatos que vira 7 colunas ---------- */
  (async () => {
    const box = document.getElementById("fila-graf");
    if (!box || !window.Scrolly || !window.Dados) return;
    const { resposta, qs } = window.Dados;
    const r = (await resposta(`/api/q8?${qs({ ano: 2022, cargo: "DEPUTADO FEDERAL", uf: "TODAS" })}`)).dados;
    const fs = [...r.faixas].sort((a, b) => a.ordem - b.ordem);
    const total = fs.reduce((s, f) => s + f.candidatos, 0);
    const ROT = ["Sem receita", "Nada público", "Até 25%", "25% a 50%", "50% a 75%", "75% a 99%", "100% público"];
    const W = 1000, H = 520, BASE = 400, TOPO = 60, GAP = 3;
    const tMax = Math.max(...fs.map((f) => f.taxa_sucesso)) * 1.15;
    const larg = W / fs.length;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Candidatos a deputado federal de 2022 por parte pública do dinheiro" }, box);
    // posição na fila (passo 0) e na coluna (passos 1 e 2)
    let acc = 0;
    const fila = fs.map((f) => { const w = (f.candidatos / total) * W; const x = acc; acc += w; return { x, w: Math.max(1, w - GAP), y: 200, h: 90 }; });
    const coluna = fs.map((f, i) => { const h = Math.max(2, (f.taxa_sucesso / tMax) * (BASE - TOPO)); return { x: i * larg + 14, w: larg - 28, y: BASE - h, h }; });
    const barras = fs.map((f, i) => el("rect", { class: `fila__barra f${i}` }, svg));
    const vals = fs.map((f, i) => {
      const t = el("text", { x: coluna[i].x, y: coluna[i].y - 12, class: "fila__val nums" }, svg);
      t.textContent = `${nf(1).format(f.taxa_sucesso)}%`;
      return t;
    });
    const rots = el("g", { class: "fila__rots" }, svg);
    fs.forEach((f, i) => {
      el("text", { x: coluna[i].x, y: BASE + 28, class: "forte" }, rots).textContent = ROT[f.ordem] ?? f.faixa;
      el("text", { x: coluna[i].x, y: BASE + 50 }, rots).textContent = `${nf(0).format(f.eleitos)} de ${nf(0).format(f.candidatos)}`;
    });
    // passo 0: as pontas da fila e os dois grupos grandes
    const notas = el("g", { class: "fila__notas" }, svg);
    el("text", { x: 0, y: 320, class: "fraco" }, notas).textContent = "← nenhum dinheiro público";
    el("text", { x: W, y: 320, "text-anchor": "end", class: "fraco" }, notas).textContent = "só dinheiro público →";
    [5, 6].forEach((i) => {
      const cx = fila[i].x + fila[i].w / 2;
      el("text", { x: cx, y: 170, "text-anchor": "middle", class: "forte" }, notas).textContent = nf(0).format(fs[i].candidatos);
      el("text", { x: cx, y: 145, "text-anchor": "middle" }, notas).textContent = i === 6 ? "só com dinheiro público" : "com 75% a 99% público";
    });
    function poe(i) {
      const pos = i === 0 ? fila : coluna;
      barras.forEach((b, k) => {
        const p = pos[k];
        for (const [a, v] of [["x", p.x], ["y", p.y], ["width", p.w], ["height", p.h]]) { b.style[a] = `${v}px`; b.setAttribute(a, v); }
        b.style.transitionDelay = `${i === 0 ? 0 : k * 70}ms`;
      });
      svg.dataset.passo = i;
    }
    const pct = (v) => `${nf(1).format(v)}%`;
    const so = fs.at(-1), mist = fs.find((f) => f.ordem === 2);
    const valores = { pub: pct(r.resumo.pct_publico_do_dinheiro), soPub: `${so.eleitos} de ${nf(0).format(so.candidatos)}`, soPubPct: pct(so.taxa_sucesso), mist: `${nf(0).format(mist.taxa_sucesso)}%` };
    preenche(box.closest(".scrolly"), "fila", (k) => valores[k]);
    poe(0);
    Scrolly.registra("fila", poe);
  })();

  /* ---------- 9. Onde gastou: cada R$ 100 das campanhas de 2024 em 100 quadrados ---------- */
  (async () => {
    const box = document.getElementById("cem-graf");
    if (!box || !window.Scrolly || !window.Dados) return;
    const { resposta, qs } = window.Dados;
    const cats = (await resposta(`/api/q9/categorias?${qs({ cargo: "TODOS", uf: "TODAS" })}`)).dados.filter((c) => c.ano === 2024);
    const ORDEM = ["Impressos e adesivos", "Internet", "Rádio, TV, vídeo e som", "Militância, comícios e eventos", "Estrutura da campanha", "Outras despesas"];
    const soma = ORDEM.map((g) => cats.filter((c) => c.grupo === g).reduce((s, c) => s + c.valor, 0));
    const n = em100(soma);
    const total = soma.reduce((a, b) => a + b, 0);
    // 10 por 10, preenchido por linha: cada grupo é um bloco seguido
    const L = 10, C = 46, Q = 40;
    const svg = el("svg", { viewBox: `0 0 ${L * C} ${L * C}`, role: "img", "aria-label": "Cem quadrados" }, box);
    let k = 0;
    const quads = [];
    n.forEach((qtd, g) => { for (let j = 0; j < qtd; j++, k++) quads.push(el("rect", { x: (k % L) * C, y: Math.floor(k / L) * C, width: Q, height: Q, class: "cem__q", "data-g": g, style: `--d:${k * 8}ms` }, svg)); });
    const leg = document.getElementById("cem-leg");
    const NOMES = ["Impressos e adesivos", "Internet", "Rádio, TV, vídeo e som", "Militância e eventos", "Estrutura da campanha", "Outras despesas"];
    const ACESOS = [[], [0], [0, 1], [4]];
    function pinta(i) {
      svg.dataset.passo = i;
      const on = ACESOS[i];
      quads.forEach((q) => q.classList.toggle("is-on", on.includes(+q.dataset.g)));
      leg.innerHTML = (on.length ? on : [0, 1, 2, 3, 4, 5]).map((g) => `<span><i class="c${g}${on.length ? " on" : ""}"></i>${NOMES[g]} <b>R$ ${n[g]}</b></span>`).join("");
    }
    const valores = { total: reais(total), imp: n[0], net: n[1], est: n[4] };
    preenche(box.closest(".scrolly"), "cem", (k) => String(valores[k]));
    pinta(0);
    Scrolly.registra("cem", pinta);
  })();
  /* ---------- 6. Quem governa a cidade: 30 prefeituras ---------- */
  (async () => {
    const box = document.getElementById("trinta-graf");
    if (!box || !window.Scrolly || !window.Dados) return;
    const { resposta, qs } = window.Dados;
    const r = (await resposta(`/api/q6?${qs({ cargo: "PREFEITO", uf: "TODAS" })}`)).dados;
    const idade = (ano) => r.idade.find((x) => x.ano === ano && x.grupo_ordem === 0);
    const alt = r.alternancia.filter((x) => x.grupo_ordem === 0).sort((a, b) => b.ano - a.ano)[0];
    const i04 = idade(2004), i24 = idade(2024);
    const em30 = (p) => Math.round((p * 30) / 100);
    const mudou = em30(alt.pct_partido_mudou), tentou = em30(alt.pct_tentou_reeleicao), reeleito = Math.round((tentou * alt.pct_reeleicao) / 100);
    const v04 = em30(i04.pct_60_mais), v24 = em30(i24.pct_60_mais);
    const COLS = 10, CW = 96, CH = 112;
    const svg = el("svg", { viewBox: `0 0 ${COLS * CW} ${3 * CH}`, role: "img", "aria-label": "Trinta prefeituras" }, box);
    const casas = Array.from({ length: 30 }, (_, k) => {
      const g = el("g", { transform: `translate(${(k % COLS) * CW + 8},${Math.floor(k / COLS) * CH + 10})`, class: "casa30", style: `--d:${k * 25}ms` }, svg);
      el("path", { d: "M0,34 L40,4 L80,34 V88 H0 Z" }, g);
      el("rect", { x: 31, y: 58, width: 18, height: 30, class: "porta" }, g);
      return g;
    });
    // em cada passo, quantas casas acendem e com que cor (a = primeira cor, b = segunda)
    const PASSOS = [
      { a: mudou, b: 0, leg: [["a", "Partido mudou em 2024", mudou], ["", "Mesmo partido", 30 - mudou]] },
      { a: 0, b: tentou, leg: [["b", "Prefeito tentou a reeleição", tentou], ["", "Não tentou", 30 - tentou]] },
      { a: 0, b: tentou, c: reeleito, leg: [["c", "Reeleito", reeleito], ["b", "Tentou e perdeu", tentou - reeleito], ["", "Não tentou", 30 - tentou]] },
      { c: v04, leg: [["c", "Prefeito com 60 anos ou mais, 2004", v04]] },
      { c: v24, leg: [["c", "Prefeito com 60 anos ou mais, 2024", v24]] },
    ];
    const leg = document.getElementById("trinta-leg");
    function pinta(i) {
      const p = PASSOS[i];
      casas.forEach((g, k) => {
        let cor = "";
        if (p.c != null && k < p.c) cor = "c";
        else if (p.b && k < p.b) cor = "b";
        else if (p.a && k < p.a) cor = "a";
        g.setAttribute("data-cor", cor);
      });
      leg.innerHTML = p.leg.map(([c, nome, n]) => `<span><i class="casa-i ${c}"></i>${nome} <b>${n}</b></span>`).join("");
    }
    const valores = { mudou, tentou, reeleito, reelPct: `${nf(0).format(alt.pct_reeleicao)}%`, velho04: v04, velho24: v24, media04: nf(1).format(i04.idade_media), media24: nf(1).format(i24.idade_media) };
    preenche(box.closest(".scrolly"), "trinta", (k) => String(valores[k]));
    pinta(0);
    Scrolly.registra("trinta", pinta);
  })();

  /* ---------- 3. Desenvolvimento e voto: os municípios pelo IDHM, que viram cinco barras ---------- */
  (async () => {
    const box = document.getElementById("idh-graf");
    if (!box || !window.Scrolly || !window.Nuvem) return;
    const base = await json("dados/site/municipios.json");
    const M = base.linhas.map((l) => Object.fromEntries(base.colunas.map((c, i) => [c, l[i]]))).filter((m) => m.idhm != null);
    const W = 1000, H = 560, ML = 56, MR = 16, MT = 24, MB = 56;
    const X0 = 0.4, X1 = 0.86;
    const x = (v) => ML + ((v - X0) / (X1 - X0)) * (W - ML - MR);
    const escala = (lo, hi) => (v) => H - MB - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - MT - MB);
    const yPop = escala(30, 200), yIse = escala(0, 40);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Municípios pelo IDHM" }, box);
    // eixos de cada passo
    const eixoX = el("g", { class: "idh__eixo is-on" }, svg);
    [0.5, 0.6, 0.7, 0.8].forEach((v) => { el("text", { x: x(v), y: H - MB + 28, "text-anchor": "middle" }, eixoX).textContent = nf(1).format(v); });
    el("text", { x: W - MR, y: H - 6, "text-anchor": "end" }, eixoX).textContent = "IDHM 2010 →";
    const eixoY = (ticks, y, rot, extra) => {
      const g = el("g", { class: "idh__eixo" }, svg);
      ticks.forEach((v) => { el("line", { x1: ML, x2: W - MR, y1: y(v), y2: y(v), class: v === extra ? "forte" : "" }, g); el("text", { x: ML - 10, y: y(v) + 5, "text-anchor": "end" }, g).textContent = v; });
      el("text", { x: ML, y: MT - 8 }, g).textContent = rot;
      return g;
    };
    const ePop = eixoY([50, 100, 150, 200], yPop, "eleitores por 100 moradores, 2012", 100);
    const eIse = eixoY([0, 10, 20, 30, 40], yIse, "% que faltou, anulou ou votou em branco, prefeito 2008");
    // os pontos (um por município, mais de 5 mil no Brasil) vão num canvas por baixo do SVG: ver nuvem.js.
    // Passo 0: numa faixa com sorteio fixo, alta o bastante para os pontos não virarem uma mancha só.
    const nuvem = Nuvem.cria(box, { W, H, n: M.length, r: 2.3, svg });
    nuvem.classes({ p: ["--accent", 0.5], acima: ["--orange", 1], falta: ["--accent", 0] });
    const ordem = embaralha(M.length, 5);
    const faixa = (k) => H / 2 - 120 + (ordem[k] / M.length) * 220;
    const atrasoX = (k) => ((M[k].idhm - X0) / (X1 - X0)) * 500;
    // as cinco barras: quintis do IDHM entre os municípios com voto válido em 2008
    const validos = M.filter((m) => !m.anulada_2008 && m.isentos_2008 != null).sort((a, b) => a.idhm - b.idhm);
    const n = validos.length;
    const quintis = [0, 1, 2, 3, 4].map((q) => {
      const g = validos.slice(Math.floor((q * n) / 5), Math.floor(((q + 1) * n) / 5));
      return { lo: g[0].idhm, hi: g.at(-1).idhm, media: g.reduce((s, m) => s + m.isentos_2008, 0) / g.length };
    });
    const barras = el("g", { class: "idh__barras" }, svg);
    quintis.forEach((q, i) => {
      const x0 = x(q.lo), x1 = x(q.hi);
      el("rect", { x: x0 + 2, y: yIse(q.media), width: Math.max(4, x1 - x0 - 4), height: H - MB - yIse(q.media), class: "idh__barra", style: `--d:${i * 120}ms` }, barras);
      el("text", { x: (x0 + x1) / 2, y: yIse(q.media) - 12, "text-anchor": "middle", class: "idh__val nums" }, barras).textContent = `${nf(1).format(q.media)}%`;
    });
    // o recorde de eleitores por 100 moradores em 2012 (nacional: Oliveira de Fátima-TO)
    const rec = M.filter((m) => m.eleitores_pop_2012 != null).reduce((a, m) => (!a || m.eleitores_pop_2012 > a.eleitores_pop_2012 ? m : a), null);
    const recNome = rec ? rec.nome.replace(/ (D[aeo]s?|E) /g, (w) => w.toLowerCase()) : "";
    const anota = el("g", { class: "idh__anota" }, svg);
    if (rec) {
      el("line", { x1: x(rec.idhm) + 6, y1: yPop(rec.eleitores_pop_2012), x2: x(rec.idhm) + 60, y2: yPop(rec.eleitores_pop_2012) - 6 }, anota);
      el("text", { x: x(rec.idhm) + 66, y: yPop(rec.eleitores_pop_2012) - 2 }, anota).textContent = `${recNome}-${rec.uf}: ${nf(1).format(rec.eleitores_pop_2012)}`;
    }
    // quem some num passo fica onde estava (invisível), para não cruzar a tela à toa
    const yAtual = M.map((m, k) => faixa(k));
    const ALFA = [0.5, 0.28, 0.42, 0.1];
    function poe(i) {
      svg.dataset.passo = i;
      ePop.classList.toggle("is-on", i === 1);
      eIse.classList.toggle("is-on", i >= 2);
      anota.classList.toggle("is-on", i === 1);
      barras.classList.toggle("is-on", i === 3);
      const pos = M.map((m, k) => {
        let y = faixa(k), some = false;
        if (i === 1) { if (m.eleitores_pop_2012 == null) some = true; else y = yPop(m.eleitores_pop_2012); }
        if (i >= 2) { if (m.anulada_2008 || m.isentos_2008 == null) some = true; else y = yIse(m.isentos_2008); }
        if (some) y = yAtual[k]; else yAtual[k] = y;
        nuvem.classe(k, some ? "falta" : i === 1 && m.eleitores_pop_2012 > 100 ? "acima" : "p");
        return [x(m.idhm), y];
      });
      nuvem.vai(pos, { atraso: atrasoX, dur: 1000 });
      nuvem.estilo({ p: ["--accent", ALFA[i]], acima: ["--orange", 1] }, 500);
    }
    const acima = M.filter((m) => m.eleitores_pop_2012 > 100).length;
    const valores = { acima, recorde: rec ? nf(1).format(rec.eleitores_pop_2012) : "191,5", q1: `${nf(1).format(quintis[0].media)}%`, q5: `${nf(1).format(quintis[4].media)}%` };
    preenche(box.closest(".scrolly"), "idh", (k) => String(valores[k]));
    nuvem.poe(M.map((m, k) => [x(m.idhm), faixa(k)]));
    poe(0);
    Scrolly.registra("idh", poe);
  })();
  /* ---------- 7. Para que lado pende o voto: o mapa dos estados, que troca de eleição a cada passo ---------- */
  (async () => {
    const box = document.getElementById("vies-mapa");
    if (!box || !window.Scrolly || !window.Vies) return;
    const V = window.Vies;
    const T = (await window.Dados.resposta("/api/q7")).dados.territorios.filter((t) => t.escopo === "UF");
    const valores = (ano) => new Map(T.filter((t) => t.ano === ano).map((t) => [t.territorio, t.vies]));
    const rotulo = (id, v) => `${window.UFs.NOME[id] ?? id}: ${v == null ? "sem eleição" : `${V.fmt(v)} (${V.lado(v)})`}`;
    const PASSOS = [
      { ano: 2018, titulo: "O viés de cada estado, 2018 (eleição geral)" },
      { ano: 2018, titulo: "O viés de cada estado, 2018 (eleição geral)", destaque: ["CE", "MA", "BA", "GO", "RR"] },
      { ano: 2022, titulo: "O viés de cada estado, 2022 (eleição geral)", destaque: ["CE"] },
      { ano: 2026, titulo: "O viés de cada estado, 2026 (eleição geral)", destaque: ["CE", "PI", "BA", "RR", "RO"] },
      { ano: 2024, titulo: "O viés de cada estado, 2024 (eleição municipal)" },
    ];
    await V.mapa(box, { valores: valores(2018), rotulo });
    document.getElementById("vies-leg").innerHTML = V.legenda();
    const tit = document.getElementById("vies-titulo");
    Scrolly.registra("vies", (i) => {
      const p = PASSOS[Math.min(i, PASSOS.length - 1)];
      V.pinta(box, valores(p.ano), rotulo);
      box.querySelectorAll("path[data-id]").forEach((el) => el.classList.toggle("destaque", (p.destaque ?? []).includes(el.dataset.id)));
      tit.textContent = p.titulo;
    });
  })();

  /* ---------- 10. Uma carreira, pleito a pleito: a trilha de Tarcizo Freire (id_pessoa 16894 na carga de 16/11/2026; muda se o banco for recarregado) ---------- */
  (async () => {
    const box = document.getElementById("trilha-graf");
    if (!box || !window.Scrolly || !window.Dados || !window.Trilha) return;
    const c = (await window.Dados.resposta("/api/q10/pessoa/16894")).dados.carreira;
    /* o desenho da trilha é o mesmo das consultas (js/trilha.js); aqui entram os passos e o destaque do fim */
    const { svg, caminho, comp, siglas, W } = window.Trilha.desenha(box, c);
    const raro = el("g", { class: "trilha__raro" }, svg);
    // 13 das 1.856.184 pessoas do banco se candidataram nas treze eleições (candidatura em cada id_eleicao)
    const fundo = el("rect", { x: W - 400, y: 4, width: 400, height: 58 }, raro);
    const rotulo = el("text", { x: W - 385, y: 42, class: "forte" }, raro);
    rotulo.textContent = "13 em 1.856.184";
    el("tspan", { "font-size": 18, dx: 10 }, rotulo).textContent = "pessoas";
    try { const bb = rotulo.getBBox(); if (bb.width) { fundo.setAttribute("x", W - bb.width - 30); fundo.setAttribute("width", bb.width + 30); rotulo.setAttribute("x", W - bb.width - 15); } } catch (e) {}
    const leg = document.getElementById("trilha-leg");
    const LEG = '<span><i class="tr v"></i>Venceu</span><span><i class="tr s"></i>Suplente</span><span><i class="tr d"></i>Perdeu</span>';
    function poe(i) {
      svg.dataset.passo = i;
      leg.innerHTML = i >= 1 ? LEG : "";
      siglas.classList.toggle("is-on", i >= 2);
      raro.classList.toggle("is-on", i === 3);
    }
    caminho.style.strokeDashoffset = comp;
    const partidos = [...new Set(c.map((p) => p.partido))];
    const nome = (p) => (p === "SOLIDARIEDADE" ? "Solidariedade" : p);
    const valores = { vitorias: c.filter((p) => p.resultado === "VITÓRIA").length, partidos: partidos.length,
      lista: partidos.map(nome).slice(0, -1).join(", ") + " e " + nome(partidos.at(-1)) };
    preenche(box.closest(".scrolly"), "trilha", (k) => String(valores[k]));
    // a linha se desenha quando o gráfico aparece na tela
    new IntersectionObserver((es, io) => { if (es.some((e) => e.isIntersecting)) { caminho.style.strokeDashoffset = 0; svg.classList.add("is-visto"); io.disconnect(); } }, { threshold: 0.4 }).observe(box);
    Scrolly.registra("trilha", poe);
  })();

  /* ---------- as dez respostas: a frase do fecho de cada capítulo, na ordem da história ---------- */
  (() => {
    const lista = document.getElementById("respostas-lista");
    if (!lista) return;
    lista.innerHTML = [...document.querySelectorAll("section.cap[data-trilho]")].map((cap) => {
      const n = cap.dataset.trilho, t = cap.querySelector(".cap__titulo")?.textContent ?? "", r = cap.querySelector(".cap__resposta");
      return r ? `<li><a href="#q${n}"><span class="respostas__n nums">${n}</span><b>${t}</b><span class="respostas__r">${r.innerHTML}</span></a></li>` : "";
    }).join("");
  })();
})();
