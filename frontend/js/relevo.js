/* O mapa "em pé": o Brasil (ou um estado) deitado em perspectiva, com cada área subindo conforme o valor.
   Relevo.monta(el, { uf, itens, emPe, aoClicar, aoPassar }) desenha e devolve { modo(emPe), emPe() }.
     itens: Map de id (sigla da UF ou código IBGE, como texto) para { cor, altura (0 a 1), dica (HTML) }
     uf: sigla do estado para desenhar os municípios dele; nulo desenha os estados
   Plano e em pé são o mesmo desenho: só mudam a matriz do grupo e o deslocamento de cada camada, com transição.
   A parede de cada área é a própria forma repetida de baixo para cima (camadas de <use>), mais escura que o topo.
   As áreas são pintadas do norte para o sul, para as da frente cobrirem as de trás.
   Contornos: dados/site/mapa_brasil.json e mapa_<UF>.json. Precisa de dados.js e ufs.js antes. */
(() => {
  const { arquivo } = window.Dados;
  const TINTA = [27, 26, 23];
  const SEM = "#e3ded2";
  const HMAX_UF = 105;   // altura do estado mais alto, em unidades do desenho
  const USES = 3600;     // teto de camadas num mapa de municípios, para a página não pesar
  const PASSO = 3;       // distância entre as camadas da parede
  const INCL = -0.14;    // quanto o mapa deita para o lado
  const ACHATA = 0.6;    // quanto o mapa encolhe na vertical
  let serie = 0;

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mistura = (hex, t) => { const c = rgb(hex); return `rgb(${c.map((v, i) => Math.round(v + (TINTA[i] - v) * t)).join(",")})`; };

  async function monta(el, { uf = null, itens, emPe = true, aoClicar = null }) {
    const geo = await arquivo(uf ? `site/mapa_${uf}.json` : "site/mapa_brasil.json");
    if (!el.isConnected) return null;
    const id = `rl${++serie}`;
    const W = geo.largura, H = geo.altura;
    /* nos municípios as áreas são pequenas e muitas: sobem menos e com menos camadas */
    const HMAX = uf ? (geo.areas.length > 400 ? 44 : 72) : HMAX_UF;
    const NMAX = uf ? Math.max(2, Math.floor(USES / geo.areas.length)) : Infinity;
    /* a caixa do desenho é mais baixa que o mapa plano: os dois modos cabem nela, cada um com a sua escala */
    const HB = Math.round(Math.min(H, W * 0.8));
    const zp = HB / H;                                  // plano: o mapa inteiro, centrado
    const z = Math.min(W / (W + Math.abs(INCL) * H), (HB - HMAX - 24) / (ACHATA * H)); // em pé: cabe na largura e na altura
    const larg = z * W + Math.abs(z * INCL * H);
    const M_PLANO = [zp, 0, 0, zp, (W - zp * W) / 2, 0];
    const M_PE = [z, 0, z * INCL, z * ACHATA, (W - larg) / 2 + Math.abs(z * INCL * H), HMAX + (HB - HMAX - z * ACHATA * H) / 2];
    const css = (m) => `matrix(${m.map((v) => v.toFixed(4)).join(",")})`;
    /* subir h na tela, escrito nas coordenadas de dentro do grupo inclinado */
    const sobe = (h) => { const dy = -h / (z * ACHATA); return `translate(${(-INCL * dy).toFixed(2)}px,${dy.toFixed(2)}px)`; };

    const areas = [...geo.areas].sort((a, b) => a.c[1] - b.c[1]);
    const partes = [`<svg viewBox="0 0 ${W} ${HB}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa ${uf ? `dos municípios ${window.UFs.DO[uf]}` : "dos estados do Brasil"}"><defs>`];
    for (const a of areas) partes.push(`<path id="${id}-${a.id}" d="${a.d}"/>`);
    partes.push(`</defs><g class="rl-plano">`);
    for (const a of areas) {
      const it = itens.get(String(a.id));
      const h = it ? Math.max(0, Math.min(1, it.altura ?? 0)) * HMAX : 0;
      const cor = it?.cor ?? SEM;
      const n = Math.min(Math.ceil(h / PASSO), NMAX);
      partes.push(`<g class="rl-area" data-id="${a.id}">`);
      for (let i = 0; i < n; i++) partes.push(`<use href="#${id}-${a.id}" class="rl-parede" data-h="${((i * h) / n).toFixed(1)}" fill="${mistura(cor, 0.5 - 0.22 * (i / n))}"/>`);
      partes.push(`<use href="#${id}-${a.id}" class="rl-topo${aoClicar && it ? " clica" : ""}" data-h="${h.toFixed(1)}" fill="${cor}"/></g>`);
    }
    partes.push(`</g>`);
    if (!uf) {
      partes.push(`<g class="rl-rots">`);
      for (const a of areas) partes.push(`<text class="rl-rot" data-id="${a.id}" data-h="${((itens.get(String(a.id))?.altura ?? 0) * HMAX).toFixed(1)}" data-x="${a.c[0]}" data-y="${a.c[1]}">${a.id}</text>`);
      partes.push(`</g>`);
    }
    partes.push(`</svg><div class="rl-dica" hidden></div>`);
    el.classList.add("relevo");
    el.innerHTML = partes.join("");

    const svg = el.querySelector("svg"), plano = el.querySelector(".rl-plano"), dica = el.querySelector(".rl-dica");
    const camadas = [...el.querySelectorAll("use[data-h]")], rots = [...el.querySelectorAll(".rl-rot")];
    let modoAtual = null;
    function modo(pe) {
      if (pe === modoAtual) return;
      modoAtual = pe;
      el.classList.toggle("is-pe", pe);
      const m = pe ? M_PE : M_PLANO;
      plano.style.transform = css(m);
      for (const u of camadas) u.style.transform = pe ? sobe(Number(u.dataset.h)) : "translate(0px,0px)";
      for (const t of rots) {
        const x = Number(t.dataset.x), y = Number(t.dataset.y);
        const sx = m[0] * x + m[2] * y + m[4], sy = m[1] * x + m[3] * y + m[5] - (pe ? Number(t.dataset.h) : 0);
        t.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
      }
    }
    /* nasce plano e, no quadro seguinte, levanta: a transição do CSS faz o movimento */
    el.classList.add("sem-transicao");
    modo(false);
    svg.getBoundingClientRect();
    el.classList.remove("sem-transicao");
    if (emPe) setTimeout(() => modo(true), 80);

    const areaDe = (alvo) => alvo.closest?.(".rl-area");
    let acesa = null;
    svg.addEventListener("pointermove", (e) => {
      const g = e.target.classList?.contains("rl-topo") ? areaDe(e.target) : null;
      if (g !== acesa) { acesa?.classList.remove("is-acesa"); g?.classList.add("is-acesa"); acesa = g; }
      const it = g && itens.get(g.dataset.id);
      if (!it?.dica) { dica.hidden = true; return; }
      dica.innerHTML = it.dica;
      dica.hidden = false;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      dica.style.left = `${Math.max(0, Math.min(x + 14, r.width - dica.offsetWidth))}px`;
      dica.style.top = `${Math.max(0, y - dica.offsetHeight - 12)}px`;
    });
    svg.addEventListener("pointerleave", () => { acesa?.classList.remove("is-acesa"); acesa = null; dica.hidden = true; });
    if (aoClicar) svg.addEventListener("click", (e) => { const g = e.target.classList?.contains("rl-topo") ? areaDe(e.target) : null; if (g && itens.has(g.dataset.id)) aoClicar(g.dataset.id); });

    return { modo, emPe: () => modoAtual };
  }

  /** Cor entre o cobalto claro e o escuro, para medidas que só crescem (t de 0 a 1). */
  const CLARO = [195, 210, 230], ESCURO = [26, 63, 110];
  const rampa = (t) => { const k = Math.max(0, Math.min(1, t)); return `#${CLARO.map((v, i) => Math.round(v + (ESCURO[i] - v) * k).toString(16).padStart(2, "0")).join("")}`; };

  window.Relevo = { monta, rampa };
})();
