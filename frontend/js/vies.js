/* Viés político (pergunta 7): a escala de cores e o mapa, usados pela história e pelas consultas.
   O viés vai de −100 (extrema esquerda) a +100 (extrema direita): a média das notas dos especialistas para os partidos,
   pesada pelos votos de cada partido no território. As cinco faixas seguem os cortes do artigo (notas de 0 a 10):
   esquerda abaixo de −40 (nota até 3), centro-esquerda de −40 a −10, centro de −10 a +10 (4,5 a 5,5),
   centro-direita de +10 a +40 e direita acima de +40 (nota acima de 7). Os extremos do artigo entram em esquerda e direita.
   Vies.mapa(el, { uf, valores, rotulo, aoClicar }) desenha o Brasil por UF (uf nulo) ou os municípios de uma UF,
   com as malhas de dados/site/mapa_*.json; valores é um Map de id (sigla da UF ou código IBGE) para o viés.
   Precisa de dados.js e ufs.js antes. */
(() => {
  const { arquivo } = window.Dados;
  const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* divergente em cinco faixas: vermelho para a esquerda, azul para a direita, o centro em cinza quente */
  const CORTES = [-40, -10, 10, 40];
  const CORES = ["#a8322f", "#e5998d", "#ddd6c8", "#8aa6cb", "#1a3f6e"];
  const FAIXAS = ["esquerda", "centro-esquerda", "centro", "centro-direita", "direita"];
  const SEM = "#f3f0e8";
  const classe = (v) => CORTES.filter((c) => (c < 0 ? v >= c : v > c)).length;
  const cor = (v) => (v == null ? SEM : CORES[classe(v)]);
  const fmt = (v) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf1.format(Math.abs(v))}`);
  const lado = (v) => (v == null ? "sem dado" : FAIXAS[classe(v)]);

  function legenda() {
    const rot = ["", "−40", "−10", "+10", "+40"];
    return `<div class="vies-leg" aria-label="Legenda: cinco faixas, de esquerda a direita">
      <span class="vies-leg__faixa">${CORES.map((c, i) => `<span><i style="background:${c}"><b>${rot[i]}</b></i><em>${FAIXAS[i]}</em></span>`).join("")}</span>
      <span class="vies-leg__sem"><i></i>sem dado</span>
    </div>`;
  }

  async function mapa(el, { uf = null, valores, rotulo = (id, v) => `${id}: ${fmt(v)}`, aoClicar = null, destaque = null }) {
    const geo = await arquivo(uf ? `site/mapa_${uf}.json` : "site/mapa_brasil.json");
    const partes = [`<svg viewBox="0 0 ${geo.largura} ${geo.altura}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${uf ? `Municípios ${esc(window.UFs.DO[uf])}` : "Estados do Brasil"} pelo viés político">`];
    for (const a of geo.areas) {
      const v = valores.get(String(a.id));
      const d = destaque && destaque.includes(String(a.id)) ? " destaque" : "";
      partes.push(`<path class="vies-area${aoClicar ? " clica" : ""}${d}" data-id="${a.id}" d="${a.d}" fill="${cor(v)}"><title>${esc(rotulo(a.id, v))}</title></path>`);
    }
    if (!uf) for (const a of geo.areas) if (a.c) partes.push(`<text class="vies-rot" x="${a.c[0]}" y="${a.c[1]}">${a.id}</text>`);
    partes.push("</svg>");
    el.innerHTML = partes.join("");
    if (aoClicar) el.querySelector("svg").addEventListener("click", (e) => { const p = e.target.closest("path[data-id]"); if (p) aoClicar(p.dataset.id); });
  }

  /* repinta um mapa já desenhado (a história troca o ano sem redesenhar os contornos) */
  function pinta(el, valores, rotulo = (id, v) => `${id}: ${fmt(v)}`) {
    el.querySelectorAll("path[data-id]").forEach((p) => {
      const v = valores.get(p.dataset.id);
      p.setAttribute("fill", cor(v));
      const t = p.querySelector("title");
      if (t) t.textContent = rotulo(p.dataset.id, v);
    });
  }

  /** Barras que saem do zero para os dois lados: linhas = [{ rot, sub, v, forte }], max = o maior |v| da escala. */
  function divergentes(linhas, max = Math.max(10, ...linhas.map((l) => Math.abs(l.v ?? 0)))) {
    return `<div class="vies-barras">${linhas.map((l) => {
      const w = l.v == null ? 0 : (Math.abs(l.v) / max) * 50;
      const x = l.v < 0 ? 50 - w : 50;
      return `<div class="vies-barra${l.forte ? " forte" : ""}"><span class="rot">${l.rot}${l.sub ? `<small>${l.sub}</small>` : ""}</span>
        <span class="trilho"><i style="left:${x.toFixed(2)}%;width:${w.toFixed(2)}%;background:${cor(l.v)}"></i></span>
        <span class="val num">${fmt(l.v)}</span></div>`;
    }).join("")}</div>`;
  }

  /** A régua dos partidos: cada partido no lugar do seu viés, de −100 a +100, em fileiras para os nomes não se cobrirem. */
  function regua(partidos) {
    const com = partidos.filter((p) => p.vies != null).sort((a, b) => a.vies - b.vies);
    const FILAS = 5;
    return `<div class="vies-regua" style="--filas:${FILAS}">
      <div class="vies-regua__eixo"><span>−100</span><span>0</span><span>+100</span></div>
      ${com.map((p, i) => `<span class="vies-regua__p" style="left:${((p.vies + 100) / 2).toFixed(2)}%;--fila:${i % FILAS}" title="${esc(p.sigla)}: ${fmt(p.vies)}${p.origem && p.origem !== "direto" ? ` (${esc(p.origem)})` : ""}"><i style="background:${cor(p.vies)}"></i><b>${esc(p.sigla)}</b></span>`).join("")}
    </div>`;
  }

  window.Vies = { CORTES, CORES, FAIXAS, classe, cor, fmt, lado, legenda, mapa, pinta, divergentes, regua };
})();
