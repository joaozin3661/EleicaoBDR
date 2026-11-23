/* A trilha de uma carreira: uma linha por cargo, um ponto por candidatura, ligados na ordem das eleições.
   Trilha.desenha(box, carreira, { soTrocas }) devolve { svg, caminho, comp, siglas, W, H }.
     carreira: as linhas de /api/q10/pessoa/<id> (ano, cargo, partido, resultado, troca_partido)
     soTrocas: escreve a sigla só na primeira candidatura e quando o partido muda (padrão: em todas)
   O ponto leva a classe v (venceu), s (suplente) ou d (perdeu); as cores e as transições ficam no CSS
   (narrativa.css na história, consultas.css nas consultas). Usada pela pergunta 10 nos dois lugares. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, pai) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    pai?.appendChild(e);
    return e;
  };
  const ORDEM = ["PRESIDENTE", "VICE-PRESIDENTE", "GOVERNADOR", "VICE-GOVERNADOR", "SENADOR", "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL", "DEPUTADO DISTRITAL", "PREFEITO", "VICE-PREFEITO", "VEREADOR"];
  const lugar = (c) => { const i = ORDEM.indexOf(c); return i < 0 ? ORDEM.length : i; };
  const nomeCargo = (c) => c.charAt(0) + c.slice(1).toLowerCase();
  const CURTA = { SOLIDARIEDADE: "SD", REPUBLICANOS: "REP", CIDADANIA: "CID", PATRIOTA: "PATRI", DEMOCRATA: "DEM" };
  const tipo = (r) => (r === "VITÓRIA" ? "v" : r === "DERROTA" ? "d" : "s");

  function desenha(box, c, { soTrocas = false } = {}) {
    const LINHAS = [...new Set(c.map((p) => p.cargo))].sort((a, b) => lugar(a) - lugar(b));
    const W = 1000, ML = 150, MR = 30, T = 90, PASSO = 92, H = T + (LINHAS.length - 1) * PASSO + 104;
    const x = (i) => (c.length > 1 ? ML + (i / (c.length - 1)) * (W - ML - MR) : (ML + W - MR) / 2);
    const y = (cargo) => T + LINHAS.indexOf(cargo) * PASSO;
    box.replaceChildren();
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Linha do tempo das candidaturas" }, box);
    LINHAS.forEach((l) => {
      el("line", { x1: ML - 20, x2: W - MR + 10, y1: y(l), y2: y(l), class: "trilha__guia" }, svg);
      el("text", { x: 0, y: y(l) + 5, class: "trilha__cargo" }, svg).textContent = nomeCargo(l);
    });
    c.forEach((p, i) => { el("text", { x: x(i), y: H - 12, "text-anchor": "middle", class: "trilha__ano nums" }, svg).textContent = p.ano; });
    const caminho = el("path", { d: c.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.cargo)}`).join(""), class: "trilha__linha" }, svg);
    const comp = caminho.getTotalLength();
    caminho.style.strokeDasharray = comp;
    c.forEach((p, i) => {
      const ponto = el("circle", { cx: x(i), cy: y(p.cargo), r: 12, class: `trilha__p ${tipo(p.resultado)}`, style: `--d:${i * 90}ms` }, svg);
      el("title", {}, ponto).textContent = `${p.ano}: ${nomeCargo(p.cargo)}, ${p.partido}`;
    });
    const siglas = el("g", { class: "trilha__siglas" }, svg);
    c.forEach((p, i) => {
      const mudou = i === 0 || p.partido !== c[i - 1].partido;
      if (soTrocas && !mudou) return;
      // num vale da linha, a sigla vai para baixo do ponto, para não cruzar a linha
      const viz = [c[i - 1], c[i + 1]].filter(Boolean).map((q) => y(q.cargo));
      const vale = viz.length > 0 && viz.every((v) => v < y(p.cargo));
      const t = el("text", { x: x(i), y: y(p.cargo) + (vale ? 34 : -22), "text-anchor": "middle", class: p.troca_partido || i === 0 ? "troca" : "" }, siglas);
      t.textContent = CURTA[p.partido] ?? p.partido;
    });
    return { svg, caminho, comp, siglas, W, H };
  }

  window.Trilha = { desenha, el };
})();
