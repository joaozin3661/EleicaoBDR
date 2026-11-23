/* Nuvem de pontos em canvas, para os gráficos da história com milhares de pontos (um por candidato ou por município).
   Com as 27 UFs, um <circle> de SVG por ponto deixava a página lenta; aqui todos os pontos vão num canvas só e as
   transições são calculadas a cada quadro. Eixos, rótulos e anotações continuam num SVG por cima, no mesmo viewBox.

   Uso:
     const n = Nuvem.cria(caixa, { W, H, n: 9970, r: 2, svg });   // svg: o <svg viewBox="0 0 W H"> que vai por cima
     n.classes({ base: ["--muted", 1], eleito: ["--accent", 1] }); // cor (variável CSS ou cor) e opacidade de cada classe
     n.classe(i, "eleito");                                        // a classe de cada ponto
     n.vai(posicoes, { atraso: (i) => ms, dur: 1100 });            // posicoes: [[x, y], ...] no sistema do viewBox
     n.estilo({ base: ["--muted", 0.3] }, 500);                    // muda cor/opacidade de classes, com transição
     n.raio(1.6, 600);                                             // muda o raio, com transição */
(() => {
  const reduz = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease-in-out

  function cor(caixa, v) {
    if (!v.startsWith("--")) return v;
    return getComputedStyle(caixa).getPropertyValue(v).trim() || "#888";
  }

  function cria(caixa, { W, H, n, r = 2, svg = null }) {
    caixa.classList.add("nuvem");
    caixa.style.setProperty("--aspecto", (W / H).toFixed(4));
    const canvas = document.createElement("canvas");
    canvas.className = "nuvem__canvas";
    canvas.setAttribute("aria-hidden", "true");
    caixa.prepend(canvas);
    if (svg) svg.classList.add("nuvem__svg");
    const ctx = canvas.getContext("2d");

    const x = new Float32Array(n), y = new Float32Array(n);      // posição atual
    const x0 = new Float32Array(n), y0 = new Float32Array(n);    // de onde saiu
    const x1 = new Float32Array(n), y1 = new Float32Array(n);    // para onde vai
    const atraso = new Float32Array(n);
    const cls = new Uint8Array(n);
    const nomes = [], estilos = []; // estilos[k] = { cor, a, cor0, a0, t0, dur }
    let raio = r, raio0 = r, raio1 = r, tRaio = 0, durRaio = 0;
    let tMov = 0, durMov = 0, fimMov = 0, quadro = 0, escala = 1, dpr = 1;

    function mede() {
      const larg = caixa.clientWidth;
      if (!larg) return false;
      dpr = devicePixelRatio || 1;
      escala = larg / W;
      // só o tamanho em pixels do canvas muda; a largura na tela é 100% (CSS), para a caixa poder encolher
      canvas.width = Math.round(larg * dpr);
      canvas.height = Math.round(H * escala * dpr);
      return true;
    }

    function desenha(agora) {
      quadro = 0;
      let segue = false;
      // posições
      if (agora < fimMov) {
        segue = true;
        for (let i = 0; i < n; i++) {
          const t = Math.min(1, Math.max(0, (agora - tMov - atraso[i]) / durMov));
          const e = suave(t);
          x[i] = x0[i] + (x1[i] - x0[i]) * e;
          y[i] = y0[i] + (y1[i] - y0[i]) * e;
        }
      } else if (durMov) {
        x.set(x1); y.set(y1); durMov = 0;
      }
      // raio
      let rr = raio1;
      if (durRaio && agora < tRaio + durRaio) { segue = true; rr = raio0 + (raio1 - raio0) * suave((agora - tRaio) / durRaio); }
      raio = rr;
      // cada classe é um caminho só (um fill por classe)
      ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const px = Math.max(raio, 0.55 / escala); // nunca menor que ~1 pixel de diâmetro na tela
      estilos.forEach((s, k) => {
        let a = s.a;
        if (s.dur && agora < s.t0 + s.dur) { segue = true; a = s.a0 + (s.a - s.a0) * suave((agora - s.t0) / s.dur); }
        if (a <= 0.003) return;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.cor;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (cls[i] !== k) continue;
          ctx.moveTo(x[i] + px, y[i]);
          ctx.arc(x[i], y[i], px, 0, 6.2832);
        }
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (segue) pede();
    }
    const pede = () => { if (!quadro) quadro = requestAnimationFrame(desenha); };

    function idx(nome) {
      let k = nomes.indexOf(nome);
      if (k < 0) { k = nomes.length; nomes.push(nome); estilos.push({ cor: "#888", a: 1, a0: 1, t0: 0, dur: 0 }); }
      return k;
    }

    const api = {
      classes(mapa) { for (const [nome, [c, a]] of Object.entries(mapa)) { const s = estilos[idx(nome)]; s.cor = cor(caixa, c); s.a = s.a0 = a; } pede(); return api; },
      classe(i, nome) { cls[i] = idx(nome); },
      estilo(mapa, dur = 500) {
        const agora = performance.now(), d = reduz() ? 0 : dur;
        for (const [nome, [c, a]] of Object.entries(mapa)) {
          const s = estilos[idx(nome)];
          // a opacidade parte de onde está agora, mesmo no meio de outra transição
          const atual = s.dur && agora < s.t0 + s.dur ? s.a0 + (s.a - s.a0) * suave((agora - s.t0) / s.dur) : s.a;
          s.a0 = atual; s.a = a; s.cor = cor(caixa, c); s.t0 = agora; s.dur = d;
        }
        pede();
      },
      vai(pos, { atraso: f = null, dur = 1100 } = {}) {
        const agora = performance.now(), d = reduz() ? 0 : dur;
        let maior = 0;
        for (let i = 0; i < n; i++) {
          x0[i] = x[i]; y0[i] = y[i];
          x1[i] = pos[i][0]; y1[i] = pos[i][1];
          atraso[i] = d && f ? f(i) : 0;
          if (atraso[i] > maior) maior = atraso[i];
        }
        if (!d) { x.set(x1); y.set(y1); durMov = 0; fimMov = 0; }
        else { tMov = agora; durMov = d; fimMov = agora + d + maior; }
        pede();
      },
      poe(pos) { for (let i = 0; i < n; i++) { x[i] = x1[i] = pos[i][0]; y[i] = y1[i] = pos[i][1]; } pede(); },
      raio(novo, dur = 600) { raio0 = raio; raio1 = novo; tRaio = performance.now(); durRaio = reduz() ? 0 : dur; pede(); },
    };

    mede();
    new ResizeObserver(() => { if (mede()) pede(); }).observe(caixa);
    // as cores vêm do CSS: se o tema mudar (claro/escuro), relê
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => pede());
    return api;
  }

  window.Nuvem = { cria };
})();
