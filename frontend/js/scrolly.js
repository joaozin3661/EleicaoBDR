/* Scroll dinâmico: o gráfico fica fixo e cada parágrafo que passa pelo meio da tela vira um "passo".
   Marcação:
     <section class="scrolly" data-historia="nome">
       <div class="scrolly__grafico"> ...o desenho... </div>
       <div class="scrolly__passos"><div class="passo">...</div> ...</div>
     </section>
   Uso: Scrolly.registra("nome", (i, sentido) => { ...desenha o passo i... });
   O passo ativo ganha .is-ativo. Sem IntersectionObserver, todos os passos ficam visíveis e o último vale. */
(() => {
  const historias = new Map();
  const ultimo = new Map();

  function ativa(sec, i) {
    const nome = sec.dataset.historia;
    if (ultimo.get(nome) === i) return;
    const antes = ultimo.get(nome) ?? -1;
    ultimo.set(nome, i);
    sec.querySelectorAll(".passo").forEach((p, k) => p.classList.toggle("is-ativo", k === i));
    sec.dataset.passo = i;
    historias.get(nome)?.(i, i >= antes ? 1 : -1);
  }

  function liga(sec) {
    const passos = [...sec.querySelectorAll(".passo")];
    if (!("IntersectionObserver" in window)) { ativa(sec, passos.length - 1); return; }
    // Espera o passo assentar no meio da tela antes de trocar o gráfico: num scroll rápido,
    // os passos do caminho são pulados em vez de tocar meia animação.
    let espera = 0;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        clearTimeout(espera);
        espera = setTimeout(() => ativa(sec, passos.indexOf(e.target)), 160);
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    passos.forEach((p) => io.observe(p));
    ativa(sec, 0);
  }

  function registra(nome, fn) {
    historias.set(nome, fn);
    const sec = document.querySelector(`.scrolly[data-historia="${nome}"]`);
    if (sec) liga(sec);
  }

  // Teclado: dentro de uma história, ↓/↑ (e Page Down/Up, espaço) avançam um passo de cada vez.
  addEventListener("keydown", (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    const frente = ev.key === "ArrowDown" || ev.key === "PageDown" || (ev.key === " " && !ev.shiftKey);
    const tras = ev.key === "ArrowUp" || ev.key === "PageUp" || (ev.key === " " && ev.shiftKey);
    if (!frente && !tras) return;
    const meio = innerHeight / 2;
    const sec = [...document.querySelectorAll(".scrolly")].find((s) => { const r = s.getBoundingClientRect(); return r.top < meio && r.bottom > meio; });
    if (!sec) return;
    const passos = [...sec.querySelectorAll(".passo")];
    const atual = passos.findIndex((p) => { const r = p.getBoundingClientRect(); return r.top <= meio && r.bottom >= meio; });
    const alvo = passos[(atual < 0 ? (frente ? -1 : passos.length) : atual) + (frente ? 1 : -1)];
    if (!alvo) return; // no último (ou primeiro) passo, a tecla rola a página normalmente
    ev.preventDefault();
    alvo.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  window.Scrolly = { registra };
})();
