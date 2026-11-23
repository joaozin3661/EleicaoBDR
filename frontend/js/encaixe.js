/* Encaixe em telas: quando o scroll para, a página assenta na próxima "tela" no sentido do scroll.
   Telas são os elementos com data-tela (o topo encosta no topo da janela, menos data-tela-margem em px;
   data-tela="centro" centraliza o bloco), os passos das histórias (centralizados ao lado do gráfico)
   e, no fim, o nome no rodapé e o fim da página.
   Regras:
   - um gesto leva no máximo à próxima tela: nunca pula uma;
   - se a próxima tela está a mais de uma janela de distância, o trecho do meio rola livre, e a tela
     só puxa quando o leitor chega perto dela (ou passa um pouco);
   - um salto grande (link do menu, barra de rolagem) só se ajusta se cair perto de uma tela.
   Expõe window.Encaixe = { yDe, ir } para o trilho das perguntas (js/trilho.js). */
(() => {
  const calmo = matchMedia("(prefers-reduced-motion: reduce)");
  const filtro = document.getElementById("din-filtro");
  let nosso = false;
  let antes = scrollY;

  // a barra de filtros do dinheiro gruda no topo depois que aparece; desconta a altura dela
  const barra = (el) => (filtro && el.closest(".din") && (filtro.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) ? filtro.offsetHeight : 0;
  const visivel = (el) => el.getClientRects().length > 0;
  // a faixa fixa do topo cobre o alto da janela: as telas param logo abaixo dela e o meio é o meio do que sobra
  const faixa = document.querySelector(".dateline");
  const fixa = () => (faixa && getComputedStyle(faixa).position === "sticky" ? faixa.offsetHeight : 0);

  // onde a página para quando este elemento é a tela (o mesmo cálculo serve ao trilho das perguntas)
  function yDe(el) {
    const h = innerHeight, r = el.getBoundingClientRect(), b = barra(el) + fixa();
    const topo = r.top + scrollY;
    if (el.dataset.tela === "centro") return topo + r.height / 2 - (b + (h - b) / 2);
    return topo - b - (+el.dataset.telaMargem || 0);
  }

  function telas() {
    const h = innerHeight, ys = [];
    document.querySelectorAll("[data-tela]").forEach((el) => {
      if (visivel(el)) ys.push(yDe(el));
    });
    document.querySelectorAll(".scrolly .passo").forEach((p) => {
      if (!visivel(p)) return;
      const r = p.getBoundingClientRect(), b = barra(p) + fixa();
      ys.push(r.top + scrollY + r.height / 2 - (b + (h - b) / 2));
    });
    const max = document.documentElement.scrollHeight - h;
    const marca = document.querySelector(".foot__mark");
    if (marca) {
      // o rodapé fica grudado embaixo e é revelado pelo scroll: para mostrar só o nome,
      // a página para quando falta revelar o resto do rodapé
      const foot = marca.closest(".foot").getBoundingClientRect();
      const nome = foot.bottom - marca.getBoundingClientRect().top + 48;
      ys.push(max - (foot.height - nome));
    }
    ys.push(max);
    return ys.map((y) => Math.round(Math.max(0, Math.min(max, y)))).sort((a, b) => a - b)
      .filter((y, i, a) => i === 0 || y - a[i - 1] > 30);
  }

  function ir(y, suave = true) {
    antes = y;
    if (Math.abs(y - scrollY) < 3) return;
    nosso = true;
    scrollTo({ top: y, behavior: !suave || calmo.matches ? "auto" : "smooth" });
  }
  // salto pedido por outro script (trilho, teclas): vai direto, sem parar nas telas do caminho
  window.Encaixe = { yDe, ir: (y, suave) => ir(Math.round(Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, y))), suave) };

  function assentou() {
    const y1 = scrollY, y0 = antes, h = innerHeight;
    if (nosso) { nosso = false; antes = y1; return; }
    const sentido = Math.sign(y1 - y0);
    if (!sentido) return;
    const ys = telas();
    if (Math.abs(y1 - y0) > h * 2.2) {
      const perto = ys.find((y) => Math.abs(y - y1) < h * 0.25);
      if (perto !== undefined) ir(perto); else antes = y1;
      return;
    }
    const prox = sentido > 0 ? ys.find((y) => y > y0 + 3) : [...ys].reverse().find((y) => y < y0 - 3);
    if (prox === undefined) { antes = y1; return; }
    const longe = Math.abs(prox - y0) > h * 1.25;
    const chegando = sentido > 0 ? y1 >= prox - h * 0.35 && y1 <= prox + h * 0.5 : y1 <= prox + h * 0.35 && y1 >= prox - h * 0.5;
    if (!longe || chegando) ir(prox); else antes = y1;
  }

  if ("onscrollend" in window) {
    addEventListener("scrollend", assentou);
  } else {
    let t = 0;
    addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(assentou, 160); }, { passive: true });
  }
  // o leitor mexeu durante a nossa puxada: o controle volta para ele
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) => addEventListener(ev, () => { nosso = false; }, { passive: true }));

  // Carreiras: com a tela encaixada, a rodinha rola só os anos da carreira; no fim da lista, solta a página
  const carreiras = document.getElementById("carreiras");
  carreiras?.addEventListener("wheel", (ev) => {
    const anos = carreiras.querySelector(".career__anos");
    if (!anos || ev.ctrlKey || innerWidth < 768) return;
    const r = carreiras.getBoundingClientRect();
    if (Math.abs(r.top) > 40) return;
    const dy = ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaY;
    const cabe = dy > 0 ? anos.scrollTop + anos.clientHeight < anos.scrollHeight - 1 : anos.scrollTop > 0;
    if (!cabe) return;
    ev.preventDefault();
    anos.scrollBy({ top: dy, behavior: "auto" });
  }, { passive: false });
})();
