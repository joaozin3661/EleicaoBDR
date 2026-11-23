/* Hemiciclo: o semicírculo de cadeiras de uma casa legislativa.

   Hemiciclo.desenha(el, {
     partidos: [{ nome: "PT", cadeiras: 12, cor: "#d7191c" }, ...],  // na ordem em que as fatias aparecem
     forma: "circulo" | "quadrado",
     centro: "92",              // texto grande no centro (padrão: total de cadeiras)
     legendaCentro: "cadeiras",
     maxPontos: 600,            // acima disso cada ponto vale mais de uma cadeira
   })

   Cada partido pode trazer `membros` (um objeto por cadeira, na ordem em que devem aparecer na fatia). Aí cada
   ponto é uma pessoa: o elemento recebe o evento "assento" com { partido, membro } ao passar o mouse, tocar ou
   navegar pelo teclado, e marca(fn) destaca as cadeiras cujo membro satisfaz fn.

   Serve para qualquer casa: o total, os partidos e as cores vêm dos dados. As cadeiras ficam em fileiras
   concêntricas com o mesmo espaçamento; cada partido ocupa uma fatia contínua do centro até a borda,
   porque as posições são ordenadas pelo ângulo e preenchidas partido a partido. */

(() => {
  const NS = "http://www.w3.org/2000/svg";
  const R_EXT = 200, R_INT_FRAC = 0.42;

  /* Quantas fileiras e quantas cadeiras em cada uma. As fileiras ocupam a faixa entre o miolo (onde vai o total) e a
     borda; o número de fileiras é o que deixa a distância entre cadeiras ao longo do arco parecida com a distância entre
     fileiras, para os pontos ficarem com o mesmo espaçamento em toda a casa. As cadeiras se repartem em proporção ao
     raio (as fileiras de fora levam mais) e o ponto tem o tamanho que esse espaçamento permite. */
  function fileiras(n) {
    const banda = 1 - R_INT_FRAC;
    const linhas = Math.max(1, Math.round(Math.sqrt((2 * n * banda) / (Math.PI * (1 + R_INT_FRAC)))));
    const passo = banda / linhas;
    const raios = Array.from({ length: linhas }, (_, i) => R_INT_FRAC + (i + 0.5) * passo);
    const soma = raios.reduce((a, b) => a + b, 0);
    const bruto = raios.map((r) => (n * r) / soma);
    const por = bruto.map(Math.floor);
    let falta = n - por.reduce((a, b) => a + b, 0);
    bruto.map((b, i) => [b - Math.floor(b), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (falta > 0) { por[i]++; falta--; } });
    const arco = Math.min(...raios.map((r, i) => (por[i] > 1 ? (Math.PI * r) / (por[i] - 1) : Infinity)));
    const diam = Math.min(passo, arco) * R_EXT;
    return { raios: raios.map((r) => r * R_EXT), por, diam };
  }

  /* Distribui pontos entre partidos pelo maior resto, quando cada ponto vale mais de uma cadeira. */
  function escala(partidos, unidade) {
    if (unidade === 1) return partidos.map((p) => ({ ...p, pontos: p.cadeiras }));
    const alvo = Math.round(partidos.reduce((s, p) => s + p.cadeiras, 0) / unidade);
    const bruto = partidos.map((p) => p.cadeiras / unidade);
    const pontos = bruto.map(Math.floor);
    let falta = alvo - pontos.reduce((a, b) => a + b, 0);
    bruto.map((b, i) => [b - Math.floor(b), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (falta > 0) { pontos[i]++; falta--; } });
    return partidos.map((p, i) => ({ ...p, pontos: pontos[i] }));
  }

  function desenha(el, opcoes) {
    const { partidos, forma = "circulo", legendaCentro = "cadeiras", maxPontos = 600 } = opcoes;
    const total = partidos.reduce((s, p) => s + p.cadeiras, 0);
    el.innerHTML = "";
    if (!total) { el.innerHTML = `<p class="vazio">Nenhuma cadeira para mostrar com esses filtros.</p>`; return { unidade: 1 }; }
    const unidade = total > maxPontos ? Math.ceil(total / maxPontos / 5) * 5 : 1;
    const comPontos = escala(partidos, unidade);
    const n = comPontos.reduce((s, p) => s + p.pontos, 0);
    const { raios, por, diam } = fileiras(n);

    const lugares = [];
    raios.forEach((r, i) => {
      const k = por[i];
      for (let j = 0; j < k; j++) {
        const ang = k === 1 ? Math.PI / 2 : Math.PI - (j * Math.PI) / (k - 1);
        lugares.push({ ang, r, x: R_EXT + r * Math.cos(ang), y: R_EXT - r * Math.sin(ang) });
      }
    });
    lugares.sort((a, b) => b.ang - a.ang || a.r - b.r);

    const svg = document.createElementNS(NS, "svg");
    const pad = diam * 0.6;
    svg.setAttribute("viewBox", `${-pad} ${-pad} ${2 * R_EXT + 2 * pad} ${R_EXT + 2 * pad}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${total} cadeiras: ` + partidos.filter((p) => p.cadeiras).map((p) => `${p.nome} ${p.cadeiras}`).join(", "));
    const lado = diam * 0.82;
    let k = 0;
    comPontos.forEach((p, pi) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("fill", p.cor);
      g.dataset.partido = p.nome;
      g.dataset.i = pi;
      for (let j = 0; j < p.pontos; j++, k++) {
        const l = lugares[k];
        let m;
        const membro = unidade === 1 ? p.membros?.[j] : undefined;
        if (forma === "quadrado") {
          m = document.createElementNS(NS, "rect");
          m.setAttribute("x", (l.x - lado / 2).toFixed(2));
          m.setAttribute("y", (l.y - lado / 2).toFixed(2));
          m.setAttribute("width", lado.toFixed(2));
          m.setAttribute("height", lado.toFixed(2));
          m.setAttribute("rx", (lado * 0.18).toFixed(2));
        } else {
          m = document.createElementNS(NS, "circle");
          m.setAttribute("cx", l.x.toFixed(2));
          m.setAttribute("cy", l.y.toFixed(2));
          m.setAttribute("r", (lado / 2).toFixed(2));
        }
        m.style.setProperty("--d", `${Math.round(((Math.PI - l.ang) / Math.PI) * 500)}ms`);
        if (membro) { m.dataset.m = j; m.classList.add("assento"); }
        g.appendChild(m);
      }
      svg.appendChild(g);
    });
    const livre = raios[0] - lado / 2;
    const corpo = Math.max(22, Math.min(64, livre * 0.55));
    const t1 = document.createElementNS(NS, "text");
    t1.setAttribute("x", R_EXT); t1.setAttribute("y", R_EXT - corpo * 0.42); t1.setAttribute("text-anchor", "middle");
    t1.style.fontSize = `${corpo.toFixed(0)}px`;
    t1.setAttribute("class", "hemi-total");
    t1.textContent = opcoes.centro ?? total.toLocaleString("pt-BR");
    const t2 = document.createElementNS(NS, "text");
    t2.setAttribute("x", R_EXT); t2.setAttribute("y", R_EXT + corpo * 0.12); t2.setAttribute("text-anchor", "middle");
    t2.style.fontSize = `${Math.max(12, corpo * 0.32).toFixed(0)}px`;
    t2.setAttribute("class", "hemi-sub");
    t2.textContent = legendaCentro;
    svg.append(t1, t2);
    el.appendChild(svg);

    /* realce de um partido ao passar o mouse (no gráfico ou na legenda) */
    const realca = (nome) => {
      el.classList.toggle("is-hover", !!nome);
      svg.querySelectorAll("g[data-partido]").forEach((g) => g.classList.toggle("is-on", g.dataset.partido === nome));
      el.dispatchEvent(new CustomEvent("partido", { detail: nome }));
    };
    const temMembros = comPontos.some((p) => p.membros?.length) && unidade === 1;
    let atual = null;
    const escolhe = (alvo) => {
      const g = alvo?.closest?.("g[data-partido]");
      if (!g || alvo.dataset.m == null) return;
      atual?.classList.remove("is-sel");
      atual = alvo;
      alvo.classList.add("is-sel");
      const p = comPontos[g.dataset.i];
      el.dispatchEvent(new CustomEvent("assento", { detail: { partido: p, membro: p.membros[alvo.dataset.m] } }));
    };
    if (temMembros) {
      el.classList.add("com-membros");
      svg.addEventListener("pointerover", (e) => escolhe(e.target));
      svg.addEventListener("click", (e) => escolhe(e.target));
      /* teclado: o semicírculo é um único ponto de foco; as setas percorrem as cadeiras na ordem das fatias */
      const todos = () => [...svg.querySelectorAll(".assento")];
      svg.setAttribute("tabindex", "0");
      svg.addEventListener("keydown", (e) => {
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const lista = todos();
        let i = atual ? lista.indexOf(atual) : -1;
        i = e.key === "Home" ? 0 : e.key === "End" ? lista.length - 1 : i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
        escolhe(lista[(i + lista.length) % lista.length]);
      });
    } else {
      svg.addEventListener("pointerover", (e) => { const g = e.target.closest("g[data-partido]"); if (g) realca(g.dataset.partido); });
      svg.addEventListener("pointerleave", () => realca(null));
    }
    const marca = (fn) => {
      el.classList.toggle("is-marcado", !!fn);
      svg.querySelectorAll(".assento").forEach((m) => {
        const p = comPontos[m.parentNode.dataset.i];
        m.classList.toggle("is-alvo", !!fn && fn(p.membros[m.dataset.m], p));
      });
    };
    const primeiro = () => escolhe(svg.querySelector(".assento"));
    const seleciona = (fn) => escolhe([...svg.querySelectorAll(".assento")].find((m) => { const p = comPontos[m.parentNode.dataset.i]; return fn(p.membros[m.dataset.m], p); }));
    return { unidade, realca, marca, primeiro, seleciona };
  }

  /* Cor fixa por partido: a mesma sigla tem a mesma cor em qualquer casa e em qualquer ano.
     Renomeações herdam a cor do partido atual (PMDB → MDB, PR → PL, PRB → REPUBLICANOS, PPS → CIDADANIA). */
  const CORES = {
    "PT": "#d7191c", "PL": "#1f3a93", "MDB": "#2ca25f", "PSD": "#f39c12", "PP": "#56b4e9",
    "UNIÃO": "#00a19a", "REPUBLICANOS": "#7b3fa0", "PSB": "#f1c40f", "PSDB": "#2f6fd6", "PDT": "#e7298a",
    "PODE": "#8c564b", "PSOL": "#ff8c69", "PC do B": "#8b1a1a", "AVANTE": "#17becf", "SOLIDARIEDADE": "#d35400",
    "CIDADANIA": "#e377c2", "NOVO": "#ff6f00", "PV": "#66a61e", "REDE": "#3d7a2e", "DEM": "#0b6e4f",
    "PSL": "#4a5d23", "PTB": "#b8860b", "PSC": "#5d6d7e", "PROS": "#b03a6e", "PATRIOTA": "#1abc9c",
    "PRD": "#6c5ce7", "AGIR": "#a0522d", "MOBILIZA": "#95a5a6", "DC": "#7f8c8d", "PMN": "#bdc3c7",
  };
  const ALIAS = { "PMDB": "MDB", "PR": "PL", "PRB": "REPUBLICANOS", "PPS": "CIDADANIA", "PODEMOS": "PODE", "PTN": "PODE", "PT DO B": "AVANTE", "PCDOB": "PC do B", "PEN": "PATRIOTA", "SD": "SOLIDARIEDADE", "PHS": "PODE", "PRP": "PATRIOTA" };
  const OUTROS = "#a3a9b3";
  function cor(sigla) {
    const s = (sigla ?? "").toUpperCase().trim();
    const chave = Object.keys(CORES).find((k) => k.toUpperCase() === s) ?? ALIAS[s];
    return CORES[chave] ?? OUTROS;
  }

  window.Hemiciclo = { desenha, cor, OUTROS };
})();
