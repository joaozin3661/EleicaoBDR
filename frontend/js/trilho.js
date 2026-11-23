/* Trilho das perguntas: os números na borda direita da tela, na ordem em que as perguntas aparecem.
   Marcação: data-trilho="8" data-trilho-rot="Financiamento" no primeiro elemento de cada pergunta
   (vários elementos podem ter o mesmo número); data-trilho="" encerra a última pergunta;
   data-trilho-pendente deixa o número tracejado; data-fim="8" marca o fim do capítulo.
   - clicar num número, ou apertar a tecla dele (0 vale 10), leva ao começo da pergunta;
   - o endereço #q8 abre no começo da pergunta 8, e #q8-fim no fecho dela (é para onde as consultas
     devolvem o leitor);
   - o link "Consultas" da faixa do topo (#volta-hist) segue a pergunta da vez e leva à mesma pergunta nas
     consultas (data-destino; data-tem, se houver, lista as perguntas que existem lá).
   Usa window.Encaixe (js/encaixe.js) para pular sem parar nas telas do caminho. */
(() => {
  const marcos = [...document.querySelectorAll("[data-trilho]")];
  const itens = [];
  for (const el of marcos) {
    const n = el.dataset.trilho;
    if (n && !itens.some((i) => i.n === n)) itens.push({ n, el, rot: el.dataset.trilhoRot ?? "", pendente: el.hasAttribute("data-trilho-pendente") });
  }
  if (!itens.length) return;

  const nav = document.createElement("nav");
  nav.className = "trilho";
  nav.setAttribute("aria-label", "Perguntas");
  nav.innerHTML = itens.map((i) => `<a href="#q${i.n}" data-n="${i.n}"${i.pendente ? ' class="pendente"' : ""} aria-label="Pergunta ${i.n}: ${i.rot}">${i.n}<span>${i.rot}</span></a>`).join("");
  document.body.appendChild(nav);
  const volta = document.getElementById("volta-hist");
  /* a casinha no alto do trilho leva de volta à tela inicial (o topo da página) */
  const casa = document.createElement("a");
  casa.href = "#topo";
  casa.className = "trilho__casa";
  casa.setAttribute("aria-label", "Tela inicial");
  casa.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.6 1.2 7.4h1.9v6.9h3.6V9.9h2.6v4.4h3.6V7.4h1.9z" fill="currentColor"/></svg><span>Tela inicial</span>`;
  nav.prepend(casa);
  casa.addEventListener("click", (e) => {
    e.preventDefault();
    if (window.Encaixe) window.Encaixe.ir(0); else scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", location.pathname);
  });

  /* o post-it no pé do trilho leva aos dez achados, no fim da história */
  const fim = document.getElementById("respostas");
  if (fim) {
    const achados = document.createElement("a");
    achados.href = "#respostas";
    achados.className = "trilho__achados";
    achados.setAttribute("aria-label", "Os dez achados");
    achados.innerHTML = `<i aria-hidden="true"></i><span>Os dez achados</span>`;
    nav.append(achados);
    achados.addEventListener("click", (e) => {
      e.preventDefault();
      vai(fim);
      history.replaceState(null, "", "#respostas");
    });
    const acende = () => (fim.getBoundingClientRect().top <= innerHeight / 2 ? achados.setAttribute("aria-current", "true") : achados.removeAttribute("aria-current"));
    addEventListener("scroll", acende, { passive: true });
    acende();
  }

  const yDe = (el) => (window.Encaixe ? window.Encaixe.yDe(el) : el.getBoundingClientRect().top + scrollY);
  function vai(el, suave = true) {
    const y = yDe(el);
    if (window.Encaixe) window.Encaixe.ir(y, suave);
    else scrollTo({ top: y, behavior: suave && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  }
  const alvo = (hash) => {
    const m = /^#q(\d+)(-fim)?$/.exec(hash);
    if (!m) return null;
    return (m[2] && document.querySelector(`[data-fim="${m[1]}"]`)) || itens.find((i) => i.n === m[1])?.el || null;
  };
  function pula(n) {
    const item = itens.find((i) => i.n === String(n));
    if (!item) return;
    vai(item.el);
    history.replaceState(null, "", `#q${item.n}`);
  }

  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-n]");
    if (!a) return;
    e.preventDefault();
    pula(a.dataset.n);
  });
  addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (/^[0-9]$/.test(e.key)) pula(e.key === "0" ? 10 : e.key);
  });

  // a pergunta da vez: o último marco que já passou do meio da tela
  let atual = null;
  function marca() {
    const meio = innerHeight / 2;
    let n = "";
    for (const el of marcos) if (el.getBoundingClientRect().top <= meio) n = el.dataset.trilho;
    if (n === atual) return;
    atual = n;
    nav.querySelectorAll("a[data-n]").forEach((a) => (a.dataset.n === n ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    if (volta) {
      const { destino, tem } = volta.dataset;
      const existe = n && (tem === undefined || tem.split(" ").includes(n));
      volta.href = existe ? `${destino}#q${n}${"fim" in volta.dataset ? "-fim" : ""}` : destino;
    }
  }
  let quadro = 0;
  addEventListener("scroll", () => { if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; marca(); }); }, { passive: true });
  addEventListener("resize", marca);
  marca();

  // chegou com #q8 ou #q8-fim: os gráficos ainda estão carregando e mudam a altura da página,
  // então o salto se repete até a página assentar ou o leitor mexer
  const inicial = alvo(location.hash);
  if (inicial) {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    let livre = true;
    const solta = () => { livre = false; };
    ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) => addEventListener(ev, solta, { once: true, passive: true }));
    const repete = () => { if (livre) { vai(inicial, false); marca(); } };
    repete();
    [150, 500, 1200, 2500].forEach((ms) => setTimeout(repete, ms));
    addEventListener("load", repete);
  }
  addEventListener("hashchange", () => { const el = alvo(location.hash); if (el) vai(el); });
})();
