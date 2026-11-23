/* "Desenhe": o leitor desenha o que acha que os dados mostram e só depois vê a resposta.
   Cada desenho é um <div class="desenhe" data-desenhe="..."> com .desenhe__palco, .desenhe__ver e .desenhe__msg.
   - data-desenhe="mulheres": a linha das mulheres eleitas (dados/extra/mulheres.json); data-cargo escolhe o cargo
     (vereador por padrão) e botões [data-cargo] dentro de .desenhe__cargos trocam o cargo e recomeçam o desenho;
   - data-desenhe="escada": a chance de eleição em cada faixa de patrimônio, vereador 2024 (/api/q2 e
     dados/extra/ricos_vereador_2024.json); a primeira barra vem pronta e o leitor desenha as outras.
   A parte comum (o SVG, o arrastar, o botão) fica em monta(); cada tema diz como desenhar e como revelar. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, pai) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); pai?.appendChild(e); return e; };
  const nf = (d = 1) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const reais = (v) => v >= 1e9 ? `R$ ${nf(1).format(v / 1e9)} bi` : v >= 1e6 ? `R$ ${nf(1).format(v / 1e6)} mi` : `R$ ${nf(0).format(v / 1e3)} mil`;
  const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());
  const json = (url) => fetch(url).then((r) => r.json());
  const animaLinha = (p) => {
    const comp = p.getTotalLength();
    p.style.strokeDasharray = comp; p.style.strokeDashoffset = comp;
    requestAnimationFrame(() => requestAnimationFrame(() => (p.style.strokeDashoffset = 0)));
  };

  /* o esqueleto comum: escala, grade do eixo y, arrastar e botão.
     n = quantas posições no eixo x; livre = a partir de qual posição o leitor desenha;
     posX(i) = x da posição i; indice(px) = posição sob o ponteiro (ou -1); desenha(palpite) e revela(palpite) são do tema */
  /* a resposta vai para baixo do texto da esquerda (.desenhe__resposta), onde se lê melhor; a linha de instruções some */
  function responde(msg, html) {
    const resp = msg.closest(".desenhe").querySelector(".desenhe__resposta");
    if (!resp) { msg.innerHTML = html; return; }
    msg.hidden = true;
    resp.hidden = false;
    resp.innerHTML = html;
  }

  function monta(raiz, { W, H, M, YMAX, passoY, sufixo = "%", n, livre = 1, inicial = [], posX, indice, lacunas = false, rotulo, desenha, revela, pronto }) {
    const palco = raiz.querySelector(".desenhe__palco");
    const btn = raiz.querySelector(".desenhe__ver"), msg = raiz.querySelector(".desenhe__msg");
    // chamado de novo (outro cargo): começa do zero
    msg.dataset.inicial ??= msg.textContent;
    msg.textContent = msg.dataset.inicial;
    msg.hidden = false;
    const resp = raiz.querySelector(".desenhe__resposta");
    if (resp) { resp.hidden = true; resp.innerHTML = ""; }
    palco.replaceChildren();
    raiz.classList.remove("is-revelado");
    btn.hidden = false;
    const y = (v) => H - M.b - (v / YMAX) * (H - M.t - M.b);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": rotulo }, palco);
    for (let v = 0; v <= YMAX; v += passoY) {
      el("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: "grade" }, svg);
      el("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end", class: "rot" }, svg).textContent = `${v}${sufixo}`;
    }
    const palpite = Array.from({ length: n }, (_, i) => inicial[i] ?? null);
    let revelado = false;
    const ctx = { svg, y, W, H, M, el, msg };

    const atualiza = () => {
      desenha(palpite, ctx);
      const falta = palpite.slice(livre).filter((v) => v == null).length;
      btn.disabled = falta > 0;
      if (!falta) msg.textContent = pronto ?? "Pronto. Confira os dados.";
    };
    const ponto = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W, py = ((ev.clientY - r.top) / r.height) * H;
      const i = indice(px);
      if (i < livre || i >= n) return;
      const v = Math.max(0, Math.min(YMAX, ((H - M.b - py) / (H - M.t - M.b)) * YMAX));
      if (lacunas) for (let k = livre; k <= i; k++) if (palpite[k] == null) palpite[k] = palpite[k - 1] ?? v; // ao arrastar rápido
      palpite[i] = v;
      atualiza();
    };
    let arrastando = false;
    svg.addEventListener("pointerdown", (e) => { if (revelado) return; arrastando = true; svg.setPointerCapture(e.pointerId); ponto(e); });
    svg.addEventListener("pointermove", (e) => { if (arrastando && !revelado) ponto(e); });
    svg.addEventListener("pointerup", () => (arrastando = false));
    svg.addEventListener("pointercancel", () => (arrastando = false));
    btn.onclick = () => {
      revelado = true;
      raiz.classList.add("is-revelado");
      btn.hidden = true;
      revela(palpite, ctx);
    };
    atualiza();
    return ctx;
  }

  /* ---------- as mulheres eleitas (pergunta 5): vereador na história; no explorar, o leitor escolhe o cargo ---------- */
  const NOMES = { VEREADOR: ["vereador", "vereadores"], PREFEITO: ["prefeito", "prefeitos"], "DEPUTADO ESTADUAL": ["deputado estadual", "deputados estaduais"], "DEPUTADO FEDERAL": ["deputado federal", "deputados federais"] };
  document.querySelectorAll('[data-desenhe="mulheres"]').forEach((raiz) => json("dados/extra/mulheres.json").then(({ dados }) => {
    const botoes = [...raiz.querySelectorAll(".desenhe__cargos [data-cargo]")];
    const troca = (cargo) => {
      botoes.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cargo === cargo)));
      desenhaMulheres(raiz, dados.filter((d) => d.cargo === cargo).sort((a, b) => a.ano - b.ano), cargo);
    };
    botoes.forEach((b) => b.addEventListener("click", () => troca(b.dataset.cargo)));
    troca(raiz.dataset.cargo || "VEREADOR");
  }));

  function desenhaMulheres(raiz, serie, cargo) {
    const n = serie.length, [um, plural] = NOMES[cargo];
    raiz.querySelectorAll("[data-d]").forEach((b) => (b.textContent = { cargo: um, ano0: serie[1].ano, ano1: serie.at(-1).ano }[b.dataset.d] ?? b.textContent));
    const W = 640, H = 333, M = { l: 40, r: 74, t: 18, b: 34 };
    const YMAX = Math.ceil((Math.max(...serie.map((d) => Math.max(d.candidatas, d.eleitas))) * 1.1) / 10) * 10;
    const x = (i) => M.l + (i / (n - 1)) * (W - M.l - M.r);
    const linha = (pts, y) => pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    let pDes, zona;
    monta(raiz, {
      W, H, M, YMAX, passoY: 10, n, lacunas: true, inicial: [serie[0].eleitas],
      rotulo: `Gráfico para desenhar a parte de mulheres entre os ${plural} eleitos`,
      posX: x,
      indice: (px) => Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1)),
      desenha: (p, { svg, y }) => {
        if (!pDes) {
          serie.forEach((d, i) => { el("text", { x: x(i), y: H - 10, "text-anchor": "middle", class: "rot" }, svg).textContent = d.ano; });
          el("path", { d: linha(serie.map((d, i) => [i, d.candidatas]), y), class: "ref" }, svg);
          el("text", { x: x(n - 1) + 8, y: y(serie.at(-1).candidatas) + 4, class: "rot ref-rot" }, svg).textContent = "candidatas";
          zona = el("rect", { x: x(1) - 10, y: M.t, width: x(n - 1) - x(1) + 20, height: H - M.t - M.b, class: "zona" }, svg);
          pDes = el("path", { class: "palpite" }, svg);
          el("circle", { cx: x(0), cy: y(p[0]), r: 4, class: "palpite-ponto", "aria-hidden": "true" }, svg);
        }
        const pts = [];
        for (let i = 0; i < n && p[i] != null; i++) pts.push([i, p[i]]);
        pDes.setAttribute("d", linha(pts, y));
      },
      revela: (p, { svg, y, msg }) => {
        zona.remove();
        const pReal = el("path", { class: "real", d: linha(serie.map((d, i) => [i, d.eleitas]), y) }, svg);
        animaLinha(pReal);
        // o rótulo "eleitas" não pode encostar no "candidatas" quando as linhas terminam perto
        const yE = y(serie.at(-1).eleitas), yC = y(serie.at(-1).candidatas);
        el("text", { x: x(n - 1) + 8, y: (Math.abs(yE - yC) < 16 ? yC + (yE >= yC ? 16 : -16) : yE) + 4, class: "rot real-rot" }, svg).textContent = "eleitas";
        serie.forEach((d, i) => { el("circle", { cx: x(i), cy: y(d.eleitas), r: 3.5, class: "real-ponto" }, svg); });
        const ult = serie.at(-1), seu = p.at(-1), erro = seu - ult.eleitas;
        const fim = cargo === "PREFEITO"
          ? " Para prefeito não há cota: as candidatas ainda são poucas, mas se elegem quase na mesma proporção em que concorrem."
          : ` A cota aumentou as candidatas, mas as eleitas subiram bem menos: de ${nf().format(serie[0].eleitas)}% em ${serie[0].ano} para ${nf().format(ult.eleitas)}%.`;
        responde(msg, `Em ${ult.ano}, <b>${nf().format(ult.eleitas)}%</b> dos ${plural} eleitos eram mulheres, contra ${nf().format(ult.candidatas)}% das candidaturas. ` +
          (Math.abs(erro) < 2 ? "Você acertou em cheio." : `Seu palpite foi ${nf().format(seu)}%, ${nf().format(Math.abs(erro))} pontos ${erro > 0 ? "acima" : "abaixo"}.`) + fim);
      },
    });
  }

  /* ---------- a escada do patrimônio, vereador 2024 (pergunta 2) ---------- */
  const escada = document.querySelector('[data-desenhe="escada"]');
  if (escada && window.Dados) (async () => {
    const { resposta, qs } = window.Dados;
    const [r, ricos] = await Promise.all([resposta(`/api/q2?${qs({ ano: 2024, cargo: "VEREADOR", uf: "TODAS" })}`), json("dados/extra/ricos_vereador_2024.json")]);
    const { resumo, faixas } = r.dados;
    const fs = [...faixas].sort((a, b) => a.ordem - b.ordem);
    const n = fs.length, taxa = fs.map((f) => f.taxa_sucesso), rico = ricos.dados[0];
    const ROT = [["Sem bens", ""], ["Até", "R$ 50 mil"], ["R$ 50 a", "200 mil"], ["R$ 200 mil", "a 1 mi"], ["R$ 1 a", "5 mi"], ["Mais de", "R$ 5 mi"]];
    const W = 760, H = 440, M = { l: 44, r: 8, t: 20, b: 78 };
    const YMAX = Math.ceil((Math.max(...taxa) * 1.2) / 10) * 10;
    const larg = (W - M.l - M.r) / n, folga = 10;
    const bx = (i) => M.l + i * larg + folga, bw = larg - 2 * folga;

    // os textos do topo vêm dos dados
    const valores = { semPct: `${nf(0).format(resumo.pct_sem_bens)}%`, sem: `${nf().format(taxa[0])}%` };
    escada.querySelectorAll("[data-esc]").forEach((b) => (b.textContent = valores[b.dataset.esc] ?? b.textContent));

    let barras;
    monta(escada, {
      W, H, M, YMAX, passoY: 10, n, inicial: [taxa[0]],
      rotulo: "Gráfico para desenhar a chance de eleição em cada faixa de patrimônio, vereador 2024",
      posX: (i) => bx(i) + bw / 2,
      indice: (px) => Math.floor((px - M.l) / larg),
      pronto: "Pronto. Confira os dados (dá para ajustar as barras antes).",
      desenha: (p, { svg, y }) => {
        if (!barras) {
          barras = fs.map((f, i) => {
            const [l1, l2] = ROT[f.ordem] ?? [f.faixa, ""];
            el("text", { x: bx(i), y: H - M.b + 24, class: "rot forte" }, svg).textContent = l1;
            el("text", { x: bx(i), y: H - M.b + 44, class: "rot forte" }, svg).textContent = l2;
            el("text", { x: bx(i), y: H - M.b + 64, class: "rot" }, svg).textContent = `${nf(0).format(f.candidatos)} cand.`;
            if (i === 0) {
              el("rect", { x: bx(0), y: y(taxa[0]), width: bw, height: y(0) - y(taxa[0]), class: "barra-dada" }, svg);
              el("text", { x: bx(0), y: y(taxa[0]) - 10, class: "val nums" }, svg).textContent = `${nf().format(taxa[0])}%`;
              return null;
            }
            const vazia = el("rect", { x: bx(i), y: M.t, width: bw, height: y(0) - M.t, class: "zona" }, svg);
            const q = el("text", { x: bx(i) + bw / 2, y: y(0) - 14, "text-anchor": "middle", class: "rot interroga" }, svg);
            q.textContent = "?";
            const rect = el("rect", { x: bx(i), width: bw, class: "palpite-barra" }, svg);
            const val = el("text", { x: bx(i), class: "val palpite-val nums" }, svg);
            return { vazia, q, rect, val };
          });
        }
        barras.forEach((b, i) => {
          if (!b) return;
          const v = p[i];
          b.q.style.display = v == null ? "" : "none";
          if (v == null) { b.rect.setAttribute("height", 0); b.val.textContent = ""; return; }
          b.rect.setAttribute("y", y(v)); b.rect.setAttribute("height", y(0) - y(v));
          b.val.setAttribute("y", y(v) - 10); b.val.textContent = `${nf(0).format(v)}%`;
        });
      },
      revela: (p, { svg, y, msg }) => {
        barras.forEach((b) => { if (!b) return; b.vazia.remove(); b.q.remove(); b.val.remove(); });
        // as barras reais crescem por baixo do palpite, que fica só como contorno
        const gReal = el("g", { class: "reais" }, svg);
        svg.insertBefore(gReal, svg.querySelector(".palpite-barra"));
        fs.forEach((f, i) => {
          if (i === 0) return;
          el("rect", { x: bx(i), y: y(taxa[i]), width: bw, height: y(0) - y(taxa[i]), class: `barra-real${i === n - 1 ? " topo" : ""}`, style: `--d:${(i - 1) * 120}ms` }, gReal);
          el("text", { x: bx(i), y: y(Math.max(taxa[i], p[i] ?? 0)) - 10, class: "val nums real-val", style: `--d:${(i - 1) * 120 + 500}ms` }, gReal).textContent = `${nf().format(taxa[i])}%`;
        });
        // a média de todos fica por baixo das barras, para não riscar os números
        const ref = el("g", { class: "ref-geral" });
        svg.insertBefore(ref, gReal);
        el("line", { x1: M.l, x2: W - M.r, y1: y(resumo.taxa_sucesso), y2: y(resumo.taxa_sucesso), class: "ref" }, ref);
        el("text", { x: bx(0), y: y(resumo.taxa_sucesso) - 8, class: "rot ref-rot" }, ref).textContent = `todos juntos: ${nf().format(resumo.taxa_sucesso)}%`;
        requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add("is-revelado")));

        const seu = p[n - 1], erro = seu - taxa[n - 1];
        responde(msg, `Acima de R$ 5 milhões, <b>${nf().format(taxa[n - 1])}%</b> se elegeram: <b>${nf().format(taxa[n - 1] / taxa[0])} vezes</b> a chance de quem não declarou nada. ` +
          (Math.abs(erro) < 2 ? "Você acertou em cheio. " : `Você apostou em ${nf(0).format(seu)}%. `) +
          `O mais rico de todos, ${titulo(rico.nome_urna)} (${rico.partido}, ${titulo(rico.municipio)}-${rico.uf}), declarou ${reais(rico.patrimonio)} e se elegeu. Pode ser erro de digitação no registro, mas é o que está nos dados do TSE.`);
      },
    });
  })();
})();
