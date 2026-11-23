/* Eleições 2002–2024. As respostas das perguntas vêm do dados.js (API ao vivo ou JSON gravados em dados/). */

const fmt = {
  int: new Intl.NumberFormat("pt-BR"),
  brl: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
  pct: (v) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
  dec: (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
};
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const titulo = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase()).replace(/(^|\s)(?!Dr\b)([B-DF-HJ-NP-TV-Z][b-df-hj-np-tv-z]{1,3})(?=\s|$)/g, (m, a, w) => a + w.toUpperCase());
const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- dados ---------- */
const { arquivo } = window.Dados;
const api = async (url) => (await window.Dados.resposta(url)).dados;

/* ---------- reveal ---------- */
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { revela(e.target); e.target.closest(".cap__fecha")?.querySelectorAll("[data-reveal]:not(.is-in)").forEach(revela); } }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 })
  : null;
/* no fecho de cada pergunta, o botão fica na base da tela, abaixo da margem do observador: entra junto com a frase */
function revela(el) { if (el.classList.contains("is-in")) return; el.classList.add("is-in"); el.dispatchEvent(new Event("in")); io?.unobserve(el); }
function observa(el) { if (io) io.observe(el); else { el.classList.add("is-in"); el.dispatchEvent(new Event("in")); } }
document.querySelectorAll("[data-reveal]").forEach(observa);
addEventListener("load", () => setTimeout(() => {
  document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) { el.classList.add("is-in"); el.dispatchEvent(new Event("in")); } });
}, 2500));

/* ---------- busca da cidade ---------- */
const cidade = (() => {
  const input = document.getElementById("city-input");
  const lista = document.getElementById("city-list");
  const saida = document.getElementById("city-result");
  if (!input) return; // a busca da cidade fica na página de explorar
  let cargo = "VEREADOR";
  let atual = null;
  const porCargo = {};

  async function linhas(c) {
    if (!porCargo[c]) {
      porCargo[c] = arquivo(`q1_municipio_${c}.json`).then((f) => {
        const m = new Map();
        for (const l of f.linhas) {
          const k = `${l.municipio_busca}|${l.uf}`;
          if (!m.has(k)) m.set(k, { chave: k, nome: l.municipio, busca: l.municipio_busca, uf: l.uf, anos: {} });
          m.get(k).anos[l.ano] = l;
        }
        return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      });
    }
    return porCargo[c];
  }

  function mostra(m) {
    atual = m.chave;
    const a24 = m.anos[2024], a20 = m.anos[2020];
    const r = a24 ?? a20;
    const nomeCargo = cargo === "VEREADOR" ? "vereador" : "prefeito";
    const itens = [];
    if (a24) itens.push(`2024: ${fmt.int.format(a24.candidatos)} candidatos para ${fmt.int.format(a24.cadeiras)} ${a24.cadeiras === 1 ? "cadeira" : "cadeiras"}, ${fmt.brl.format(a24.gasto_total)} gastos no total.`);
    if (a20) itens.push(`2020: ${fmt.brl.format(a20.custo_por_cadeira)} por cadeira, ${fmt.int.format(a20.candidatos)} candidatos.`);
    if (a24 && a20 && a20.custo_por_cadeira > 0) {
      const v = (a24.custo_por_cadeira / a20.custo_por_cadeira - 1) * 100;
      itens.push(`De uma eleição para a outra, ${v >= 0 ? "subiu" : "caiu"} ${fmt.int.format(Math.abs(Math.round(v)))}%.`);
    }
    saida.innerHTML = `
      <p class="city__price nums">${fmt.brl.format(r.custo_por_cadeira)}<small> por cadeira</small></p>
      <ul class="city__facts small nums">
        <li><b>${m.nome}, ${m.uf}</b>: custo de uma cadeira de ${nomeCargo} em ${a24 ? 2024 : 2020}, o gasto de todos os candidatos dividido pelas vagas.</li>
        ${itens.map((t) => `<li>${t}</li>`).join("")}
      </ul>`;
  }

  async function sugere() {
    const q = semAcento(input.value.trim());
    if (q.length < 2) { fecha(); return; }
    const todos = await linhas(cargo);
    const achados = todos.filter((m) => m.busca.includes(q)).sort((a, b) => (b.busca.startsWith(q) - a.busca.startsWith(q))).slice(0, 8);
    lista.innerHTML = achados.length
      ? achados.map((m, i) => `<button type="button" role="option" aria-selected="${i === 0}" data-k="${m.chave}"><span>${m.nome}</span><span>${m.uf}</span></button>`).join("")
      : `<button type="button" disabled><span>Nenhum município com esse nome</span></button>`;
    lista.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function fecha() { lista.hidden = true; input.setAttribute("aria-expanded", "false"); }
  async function escolhe(k) {
    const m = (await linhas(cargo)).find((x) => x.chave === k);
    if (m) { mostra(m); input.value = m.nome; fecha(); }
  }

  input.addEventListener("input", sugere);
  input.addEventListener("keydown", (e) => {
    const ops = [...lista.querySelectorAll("[data-k]")];
    const i = ops.findIndex((o) => o.getAttribute("aria-selected") === "true");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ops.length) return;
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + ops.length) % ops.length;
      ops.forEach((o, j) => o.setAttribute("aria-selected", String(j === n)));
      ops[n].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && ops[i]) { e.preventDefault(); escolhe(ops[i].dataset.k); }
    else if (e.key === "Escape") fecha();
  });
  lista.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) escolhe(b.dataset.k); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".city__search")) fecha(); });
  document.getElementById("city-random").addEventListener("click", async () => {
    const todos = (await linhas(cargo)).filter((m) => m.anos[2024]);
    const m = todos[Math.floor(Math.random() * todos.length)];
    mostra(m);
    input.value = "";
  });
  document.querySelectorAll(".city .tab").forEach((t) => t.addEventListener("click", async () => {
    document.querySelectorAll(".city .tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    cargo = t.dataset.cargo;
    const todos = await linhas(cargo);
    const m = atual && todos.find((x) => x.chave === atual);
    if (m) mostra(m);
    else saida.querySelector(".city__price").innerHTML = cargo === "VEREADOR" ? "R$&nbsp;34.905" : "R$&nbsp;586.201",
      saida.querySelector("li").textContent = `Custo médio de uma cadeira de ${cargo === "VEREADOR" ? "vereador" : "prefeito"} em 2024 no Brasil: o gasto de todos os candidatos dividido pelas vagas.`;
  }));
})();

/* ---------- carreiras ---------- */
(() => {
  const alvo = document.getElementById("career");
  const tabs = document.getElementById("people");
  const input = document.getElementById("person-input");
  const lista = document.getElementById("person-list");
  if (!alvo) return; // as carreiras ficam na página de explorar
  const local = (l) => (l.length === 2 ? l : titulo(l));

  /* fotos das candidaturas de 2018 em diante (vw_site_candidatura_foto): id_pessoa -> [[ano, id_candidatura, cargo]] */
  const fotosPessoa = arquivo("site/fotos_pessoa.json").catch(() => ({}));
  /* escolaridade e dinheiro de cada candidatura (vw_site_carreira), em 32 pedaços por id_pessoa % 32 */
  const extras = (id) => arquivo(`site/carreira/${id % 32}.json`).then((f) => (f.pessoas[id] ?? []).map((l) => Object.fromEntries(f.colunas.map((c, i) => [c, l[i]])))).catch(() => []);
  const sentenca = (t) => t.charAt(0) + t.slice(1).toLowerCase();
  const grau = (g) => (g ? sentenca(g.replace(/^ENSINO /, "")) : "Não informado");
  const ocupacao = (o) => (o ? sentenca(o) : "Não informada");
  const reais = (v) => (v >= 1e6 ? `R$ ${fmt.dec(v / 1e6)} mi` : v >= 1e4 ? `R$ ${fmt.int.format(Math.round(v / 1e3))} mil` : fmt.brl.format(v));
  const centavos = (v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const porVoto = (e) => (e?.votos > 0 && e.gasto != null ? e.gasto / e.votos : null);
  const variacao = (de, para) => {
    if (!(de > 0)) return "";
    const r = para / de;
    return r >= 1.95 ? `${fmt.dec(r)} vezes` : `${r >= 1 ? "+" : "−"}${fmt.int.format(Math.round(Math.abs(r - 1) * 100))}%`;
  };
  const quadro = (rot, val, sub, extra = "") => `<div class="ficha-c"><span>${rot}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}${extra}</div>`;
  const foto = (idc, alt, classe) => `<img class="${classe}" src="fotos/${idc}.webp" alt="${alt}" width="161" height="225" loading="lazy" onerror="this.remove()">`;

  /* mini gráficos lado a lado, um por medida, com o mesmo eixo: cada coluna é uma candidatura */
  function multiplos(c, ex2) {
    const W = 240, H = 96, B = 74, T = 14;
    const n = c.length, larg = Math.min(26, (W - 8) / n), x = (i) => 4 + i * ((W - 8) / n) + ((W - 8) / n - larg) / 2;
    const anos = c.map((cx, i) => (i === 0 || i === n - 1 || n <= 6) ? `<text x="${x(i) + larg / 2}" y="${H - 4}" text-anchor="middle">${cx.ano}</text>` : "").join("");
    const painel = (titulo, valores, fmtV, cor) => {
      const vs = valores.map((v) => (v == null ? null : v));
      const max = Math.max(0, ...vs.filter((v) => v != null));
      const barras = vs.map((v, i) => v == null
        ? `<line x1="${x(i)}" x2="${x(i) + larg}" y1="${B}" y2="${B}" class="sem"><title>${c[i].ano}: sem dado</title></line>`
        : `<rect x="${x(i)}" y="${B - (max ? (v / max) * (B - T) : 0)}" width="${larg}" height="${max ? Math.max(1.5, (v / max) * (B - T)) : 1.5}" fill="${typeof cor === "function" ? cor(i) : cor}"><title>${c[i].ano}: ${fmtV(v)}</title></rect>`).join("");
      const ultimo = [...vs].reverse().find((v) => v != null);
      return `<figure class="multiplo"><figcaption>${titulo}<b>${ultimo != null ? fmtV(ultimo) : "sem dado"}</b></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${titulo} por candidatura">${barras}<line x1="0" x2="${W}" y1="${B}" y2="${B}" class="base"/>${anos}</svg></figure>`;
    };
    const resultado = `<figure class="multiplo"><figcaption>Resultado e partido<b>${c.filter((x) => x.resultado === "VITÓRIA").length} de ${n}</b></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Resultado de cada candidatura">${c.map((cx, i) => {
      const cor = window.Hemiciclo ? window.Hemiciclo.cor(cx.partido) : "#888";
      const ganhou = cx.resultado === "VITÓRIA";
      return `<circle cx="${x(i) + larg / 2}" cy="${B - 26}" r="${Math.min(9, larg / 2)}" fill="${ganhou ? cor : "none"}" stroke="${cor}" stroke-width="2"><title>${cx.ano}: ${cx.partido}, ${ganhou ? "eleito" : "não eleito"}</title></circle>`;
    }).join("")}<line x1="0" x2="${W}" y1="${B}" y2="${B}" class="base"/>${anos}</svg></figure>`;
    return `<div class="career__multiplos nums">
      ${resultado}
      ${painel("Patrimônio declarado", ex2.map((e) => e?.patrimonio ?? null), reais, "var(--ink)")}
      ${painel("Gasto na campanha", ex2.map((e) => e?.gasto ?? null), reais, "var(--accent)")}
      ${painel("Custo por voto", ex2.map((e) => porVoto(e) ?? null), centavos, "var(--orange)")}
    </div>`;
  }

  async function abre(id, nomeIndice) {
    alvo.setAttribute("aria-busy", "true");
    try {
      const fp = (await fotosPessoa)[String(id)] ?? [];
      const porAno = new Map(fp.map(([ano, idc]) => [ano, idc]));
      const [d, ex] = await Promise.all([api(`/api/q10/pessoa/${id}`), extras(Number(id))]);
      const c = d.carreira;
      const chave = (x) => `${x.ano}|${x.cargo}|${semAcento(x.local)}`;
      const porCand = new Map(ex.map((e) => [chave(e), e]));
      const extra = (x) => porCand.get(chave(x)) ?? ex.find((e) => e.ano === x.ano && e.cargo === x.cargo);
      const ex2 = c.map(extra);
      const comConta = ex2.filter((e) => e && e.gasto !== null);
      const gastoTotal = comConta.reduce((t, e) => t + e.gasto, 0);
      const vit = c.filter((x) => x.resultado === "VITÓRIA").length;
      const partidos = new Set(c.map((x) => x.partido)).size;
      const nome = titulo(nomeIndice ?? d.nomes[d.nomes.length - 1]);
      const ultima = fp[fp.length - 1];

      /* quadros do topo: escolaridade, gasto, patrimônio (com a evolução) e custo por voto */
      const graus = ex2.map((e, i) => ({ ano: c[i].ano, g: e?.grau_instrucao })).filter((g) => g.g);
      const pat = ex2.map((e, i) => ({ ano: c[i].ano, v: e?.patrimonio })).filter((p) => p.v != null);
      const prop = ex2.map((e, i) => ({ e, x: c[i] })).filter(({ e }) => porVoto(e) != null);
      const quadros = [];
      if (graus.length) {
        const g0 = graus[0], g1 = graus[graus.length - 1];
        quadros.push(quadro("Escolaridade", grau(g1.g), g0.g !== g1.g ? `Declarava ${grau(g0.g).toLowerCase()} em ${g0.ano}` : (graus.length === 1 ? `Declarada em ${g1.ano}` : `A mesma nas ${graus.length} candidaturas`)));
      }
      if (comConta.length) quadros.push(quadro("Gasto em campanhas", reais(gastoTotal), `${comConta.length === 1 ? "Uma campanha" : `${comConta.length} campanhas`} de 2018 em diante`));
      if (pat.length) {
        const p0 = pat[0], p1 = pat[pat.length - 1], max = Math.max(...pat.map((p) => p.v));
        const v = pat.length > 1 ? variacao(p0.v, p1.v) : "";
        quadros.push(quadro("Patrimônio declarado", p1.v > 0 ? reais(p1.v) : "Nada declarado",
          pat.length > 1 ? (p0.v > 0 ? `${reais(p0.v)} em ${p0.ano}${v ? `; ${v.includes("vezes") ? `${v} mais` : v}` : ""}` : `Nada declarado em ${p0.ano}`) : `Em ${p1.ano}`,
          pat.length > 1 ? `<div class="mini" aria-hidden="true">${pat.map((p) => `<span title="${p.ano}: ${reais(p.v)}"><i style="height:${max ? Math.max(3, (p.v / max) * 100) : 0}%"></i><small>${p.ano}</small></span>`).join("")}</div>` : ""));
      }
      if (prop.length) {
        const u = prop[prop.length - 1];
        quadros.push(quadro("Custo por voto", centavos(porVoto(u.e)), `${fmt.int.format(u.e.votos)} votos para ${titulo(u.x.cargo).toLowerCase()} em ${u.x.ano}`));
      }

      /* segunda linha de cada candidatura */
      let antPat = null;
      const fichas = ex2.map((e, i) => {
        const ant = i ? ex2[i - 1] : null;
        const itens = [
          ["Escolaridade", grau(e?.grau_instrucao), "forte", ant && ant.grau_instrucao === e?.grau_instrucao],
          ["Ocupação", ocupacao(e?.ocupacao), "", ant && ant.ocupacao === e?.ocupacao],
        ];
        if (e?.gasto != null) {
          itens.push(["Gasto", reais(e.gasto), "forte"]);
          const v = antPat > 0 && e.patrimonio != null ? variacao(antPat, e.patrimonio) : "";
          itens.push(["Patrimônio", `${e.patrimonio > 0 ? reais(e.patrimonio) : "nada declarado"}${v ? ` <small title="Em relação ao patrimônio declarado na candidatura anterior">${v.includes("vezes") ? `×${v.replace(" vezes", "")}` : v}</small>` : ""}`]);
          if (e.patrimonio != null) antPat = e.patrimonio;
          if (porVoto(e) != null) itens.push(["Votos", fmt.int.format(e.votos)], ["Custo por voto", centavos(porVoto(e))]);
        }
        return `<dl class="band__ficha">${itens.map(([t, v, cls, igual]) => `<div class="${cls}${igual ? " igual" : ""}"><dt>${t}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
      });

      alvo.innerHTML = `
        <div class="career__topo">${ultima ? foto(ultima[1], `Foto de ${nome} no registro da candidatura de ${ultima[0]}`, "career__foto") : ""}<div>
        <p class="career__name">${nome}</p>
        <p class="career__sum nums">${c.length === 1 ? `Uma candidatura, em ${c[0].ano}` : `${c.length} candidaturas de ${c[0].ano} a ${c[c.length - 1].ano}`}, ${vit} ${vit === 1 ? "vitória" : "vitórias"}, ${partidos} ${partidos === 1 ? "partido" : "partidos"}.</p></div></div>
        ${quadros.length ? `<div class="career__quadros nums">${quadros.join("")}</div>` : ""}
        ${multiplos(c, ex2)}
        <div class="career__anos"><ol class="bands">${c.map((x, i) => `
          <li class="band${x.resultado === "VITÓRIA" ? " band--won" : ""}" style="--i:${i}">
            <span class="band__year">${x.ano}</span>
            <span class="band__foto">${porAno.has(x.ano) ? foto(porAno.get(x.ano), `Foto de ${nome} em ${x.ano}`, "") : ""}</span>
            <span class="band__what"><b>${titulo(x.cargo)}, ${local(x.local)}</b><span>${x.partido}${x.evento ? `. ${x.evento.charAt(0) + x.evento.slice(1).toLowerCase()}` : ""}${x.troca_partido ? `. ${x.troca_partido}` : ""}</span></span>
            <span class="band__res"><b>${x.resultado === "VITÓRIA" ? "Eleito" : titulo(x.detalhe_resultado || x.resultado)}</b></span>
            ${fichas[i]}
          </li>`).join("")}</ol>
        <p class="career__nota">Gasto, patrimônio e votos só existem de 2018 em diante: o banco não tem a prestação de contas nem os bens declarados das eleições anteriores. Para prefeito, governador e senador, os votos são os do 1º turno. Em cinza, o que repete a candidatura anterior.</p></div>`;
    } catch {
      alvo.innerHTML = `<p class="career__name">Carreira indisponível</p><p class="career__sum">Esta pessoa não está entre as gravadas na versão estática.</p>`;
    }
    alvo.removeAttribute("aria-busy");
  }

  fotosPessoa.then((fp) => tabs.querySelectorAll(".person").forEach((b) => {
    const l = fp[b.dataset.id];
    if (l?.length) b.insertAdjacentHTML("afterbegin", foto(l[l.length - 1][1], "", "person__foto"));
  }));

  tabs.addEventListener("click", (e) => {
    const b = e.target.closest(".person");
    if (!b) return;
    tabs.querySelectorAll(".person").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    abre(b.dataset.id);
  });

  let indice = null;
  const pegaIndice = () => (indice ??= arquivo("q10_indice.json").then((f) => f.indice));
  input.addEventListener("input", async () => {
    const palavras = input.value.trim().split(/\s+/).filter((p) => p.length >= 2).map(semAcento);
    if (!palavras.length) { lista.hidden = true; return; }
    const idx = await pegaIndice();
    const achados = idx.filter((i) => i.nomes.some((n) => palavras.every((p) => n.includes(p)))).slice(0, 8).map((i) => i.achado);
    lista.innerHTML = achados.length
      ? achados.map((a, i) => `<button type="button" role="option" aria-selected="${i === 0}" data-id="${a.id_pessoa}" data-nome="${a.nome}"><span>${titulo(a.nome)}</span><span class="nums">${a.candidaturas}</span></button>`).join("")
      : `<button type="button" disabled><span>Ninguém com esse nome entre os 2.500 políticos com mais candidaturas</span></button>`;
    lista.hidden = false;
    input.setAttribute("aria-expanded", "true");
  });
  input.addEventListener("keydown", (e) => {
    const ops = [...lista.querySelectorAll("[data-id]")];
    const i = ops.findIndex((o) => o.getAttribute("aria-selected") === "true");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ops.length) return;
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + ops.length) % ops.length;
      ops.forEach((o, j) => o.setAttribute("aria-selected", String(j === n)));
    } else if (e.key === "Enter" && ops[i]) { e.preventDefault(); ops[i].click(); }
    else if (e.key === "Escape") lista.hidden = true;
  });
  lista.addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (!b) return;
    tabs.querySelectorAll(".person").forEach((x) => x.setAttribute("aria-selected", "false"));
    abre(b.dataset.id, b.dataset.nome);
    input.value = "";
    lista.hidden = true;
    input.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".person-search")) lista.hidden = true; });

  /* a ficha de um eleito (capitulos.js) pede a carreira dele */
  document.addEventListener("abre-carreira", (e) => {
    tabs.querySelectorAll(".person").forEach((x) => x.setAttribute("aria-selected", "false"));
    abre(e.detail.id);
    document.getElementById("carreiras").scrollIntoView({ behavior: reduzido ? "auto" : "smooth" });
  });

  abre(16894); // Tarcizo Freire (id_pessoa da carga de 16/11/2026)
})();

/* ---------- gráficos ---------- */
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, pai) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (pai) pai.appendChild(n);
  return n;
}
function tooltip(box) {
  const t = document.createElement("div");
  t.className = "tip";
  box.appendChild(t);
  return {
    mostra(html, x, y) {
      t.innerHTML = html;
      t.classList.add("is-on");
      const w = t.offsetWidth, bw = box.clientWidth;
      t.style.left = `${Math.min(Math.max(0, x + 14), bw - w)}px`;
      t.style.top = `${Math.max(0, y - t.offsetHeight - 12)}px`;
    },
    esconde() { t.classList.remove("is-on"); },
  };
}
function tabela(box, cab, linhas) {
  const d = document.createElement("details");
  d.className = "chart-table";
  d.innerHTML = `<summary>Ver os números</summary><table class="nums"><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  box.parentElement.appendChild(d);
}
function desenhaQuandoVisivel(box, desenha) {
  let feito = false;
  const roda = () => { box.innerHTML = ""; desenha(); };
  roda();
  const alvo = box.closest("[data-reveal]") ?? box;
  const marca = () => { if (!feito) { feito = true; requestAnimationFrame(() => box.classList.add("is-drawn")); } };
  if (alvo.classList.contains("is-in")) marca(); else alvo.addEventListener("in", marca, { once: true });
  let w = box.clientWidth;
  new ResizeObserver(() => { if (Math.abs(box.clientWidth - w) > 4) { w = box.clientWidth; roda(); if (feito) box.classList.add("is-drawn"); } }).observe(box);
}

/* barras horizontais: grupos com segmentos empilhados (Q3) ou séries lado a lado (Q4) */
function barras(box, { grupos, series, empilhado, fim, dica }) {
  desenhaQuandoVisivel(box, () => {
    const W = box.clientWidth, H = box.clientHeight || 420;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, box);
    const tip = tooltip(box);
    const estreito = W < 520;
    const esq = estreito ? 0 : Math.min(210, W * 0.36), dir = estreito ? 52 : 64, topo = estreito ? 20 : 0;
    const n = grupos.length;
    const banda = H / n;
    const max = empilhado
      ? Math.max(...grupos.map((g) => series.reduce((s, se) => s + g.v[se.k], 0)))
      : Math.max(...grupos.flatMap((g) => series.map((se) => g.v[se.k])));
    const x = (v) => (v / max) * (W - esq - dir);
    grupos.forEach((g, i) => {
      const y0 = i * banda;
      const rotulo = el("text", { x: 0, y: estreito ? y0 + 12 : y0 + banda / 2, "dominant-baseline": "middle", class: "axis" }, svg);
      rotulo.textContent = g.rotulo;
      const marcas = [];
      if (empilhado) {
        const h = Math.min(72, (banda - topo) * 0.62);
        const cy = y0 + topo + (banda - topo) / 2;
        let acc = 0;
        series.forEach((se, j) => {
          const w = Math.max(0, x(g.v[se.k]) - (j < series.length - 1 ? 2 : 0));
          marcas.push(el("rect", { x: esq + x(acc), y: cy - h / 2, width: w, height: h, fill: se.cor, rx: j === series.length - 1 ? 4 : 0, class: "mark bar", style: `--i:${i}` }, svg));
          acc += g.v[se.k];
        });
        const t = el("text", { x: esq + x(acc) + 8, y: cy, "dominant-baseline": "middle", class: "val" }, svg);
        t.textContent = estreito ? fmt.pct(g.g.pct_isentos) : fim(g);
      } else {
        const h = Math.min(26, ((banda - topo) * 0.76) / series.length);
        series.forEach((se, j) => {
          const yy = y0 + topo + (banda - topo) / 2 - (series.length * (h + 2)) / 2 + j * (h + 2);
          marcas.push(el("rect", { x: esq, y: yy, width: Math.max(2, x(g.v[se.k])), height: h, fill: se.cor, rx: 3, class: "mark bar", style: `--i:${i}` }, svg));
          const t = el("text", { x: esq + Math.max(2, x(g.v[se.k])) + 8, y: yy + h / 2, "dominant-baseline": "middle", class: "val" }, svg);
          t.textContent = fmt.pct(g.v[se.k]);
        });
      }
      const hit = el("rect", { x: 0, y: y0, width: W, height: banda, class: "hit" }, svg);
      hit.addEventListener("pointermove", (e) => {
        box.classList.add("is-hover");
        svg.querySelectorAll(".mark").forEach((m) => m.classList.toggle("is-on", marcas.includes(m)));
        const r = box.getBoundingClientRect();
        tip.mostra(dica(g), e.clientX - r.left, e.clientY - r.top);
      });
      hit.addEventListener("pointerleave", () => { box.classList.remove("is-hover"); tip.esconde(); });
    });
  });
}

/* linhas no tempo (Q6) */
function linhas(box, { anos, series, dica }) {
  desenhaQuandoVisivel(box, () => {
    const W = box.clientWidth, H = box.clientHeight || 420;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, box);
    const tip = tooltip(box);
    const esq = 44, dir = 24, cima = 16, baixo = 36;
    const vals = series.flatMap((s) => s.v);
    const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
    const x = (i) => esq + (i / (anos.length - 1)) * (W - esq - dir);
    const y = (v) => cima + (1 - (v - lo) / (hi - lo)) * (H - cima - baixo);
    for (let v = Math.ceil(lo); v <= hi; v += 2) {
      el("line", { x1: esq, x2: W - dir, y1: y(v), y2: y(v), stroke: "#c8ccd4", "stroke-width": 1 }, svg);
      const t = el("text", { x: esq - 10, y: y(v), "text-anchor": "end", "dominant-baseline": "middle", class: "axis" }, svg);
      t.textContent = v;
    }
    anos.forEach((a, i) => { const t = el("text", { x: x(i), y: H - 8, "text-anchor": "middle", class: "axis" }, svg); t.textContent = a; });
    series.forEach((s) => {
      const d = s.v.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
      const p = el("path", { d, fill: "none", stroke: s.cor, "stroke-width": 2.5, "stroke-linejoin": "round", class: "line-path mark" }, svg);
      const len = p.getTotalLength?.() ?? 0;
      if (!reduzido && len && !box.classList.contains("is-drawn")) {
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        box.closest("[data-reveal]")?.addEventListener("in", () => requestAnimationFrame(() => (p.style.strokeDashoffset = 0)), { once: true });
        if (box.closest("[data-reveal]")?.classList.contains("is-in")) requestAnimationFrame(() => (p.style.strokeDashoffset = 0));
      }
      s.v.forEach((v, i) => el("circle", { cx: x(i), cy: y(v), r: 5, fill: s.cor, stroke: "var(--surface)", "stroke-width": 2, class: "mark" }, svg));
      const ult = s.v.length - 1;
      const t = el("text", { x: x(ult) - 4, y: y(s.v[ult]) + (s.acima ? -16 : 22), "text-anchor": "end", class: "val" }, svg);
      t.textContent = `${fmt.dec(s.v[ult])} anos`;
    });
    const guia = el("line", { y1: cima, y2: H - baixo, stroke: "var(--ink)", "stroke-width": 1, opacity: 0 }, svg);
    const hit = el("rect", { x: esq, y: 0, width: W - esq - dir, height: H, class: "hit" }, svg);
    hit.addEventListener("pointermove", (e) => {
      const r = box.getBoundingClientRect();
      const px = e.clientX - r.left;
      const i = Math.max(0, Math.min(anos.length - 1, Math.round(((px - esq) / (W - esq - dir)) * (anos.length - 1))));
      guia.setAttribute("x1", x(i)); guia.setAttribute("x2", x(i)); guia.setAttribute("opacity", 0.5);
      tip.mostra(dica(i), x(i), e.clientY - r.top);
    });
    hit.addEventListener("pointerleave", () => { guia.setAttribute("opacity", 0); tip.esconde(); });
  });
}

(async () => {
  const COB = "#1e4a80", LAR = "#e0701c", CLARO = "#7f9cc4";
  const FAIXAS = { 1: "Muito baixo", 2: "Baixo", 3: "Médio", 4: "Alto", 5: "Muito alto" };
  if (!document.getElementById("chart-q4")) return; // os dois gráficos ficam na página de explorar
  try {
    const q4 = await api("/api/q4?ano=2024&cargo=VEREADOR&uf=TODAS");
    const CURTO = { "ANALFABETO": "Analfabeto", "LÊ E ESCREVE": "Lê e escreve", "ENSINO FUNDAMENTAL INCOMPLETO": "Fundamental incompleto", "ENSINO FUNDAMENTAL COMPLETO": "Fundamental completo", "ENSINO MÉDIO INCOMPLETO": "Médio incompleto", "ENSINO MÉDIO COMPLETO": "Médio completo", "SUPERIOR INCOMPLETO": "Superior incompleto", "SUPERIOR COMPLETO": "Superior completo" };
    const gs = q4.representacao.sort((a, b) => a.ordem - b.ordem).map((r) => ({ rotulo: CURTO[r.grau] ?? titulo(r.grau), r, v: { el: r.pct_eleitorado, ei: r.pct_eleitos } }));
    const box = document.getElementById("chart-q4");
    barras(box, {
      grupos: gs,
      series: [{ k: "el", cor: LAR }, { k: "ei", cor: COB }],
      dica: (x) => `<b>${x.rotulo}</b><br>${fmt.pct(x.v.el)} do eleitorado<br>${fmt.pct(x.v.ei)} dos vereadores eleitos<br>${fmt.int.format(x.r.eleitos)} eleitos de ${fmt.int.format(x.r.candidatos)} candidatos`,
    });
    tabela(box, ["Escolaridade", "Eleitorado", "Eleitos"], gs.map((x) => [x.rotulo, fmt.pct(x.v.el), fmt.pct(x.v.ei)]));
  } catch {}

  try {
    const q6 = await api("/api/q6?cargo=PREFEITO&uf=TODAS");
    const anos = [...new Set(q6.idade.map((r) => r.ano))].sort();
    const serie = (g) => anos.map((a) => q6.idade.find((r) => r.ano === a && r.grupo_ordem === g).idade_media);
    const jov = serie(1), vel = serie(4), tot = serie(0);
    const box = document.getElementById("chart-q6");
    linhas(box, {
      anos,
      series: [{ v: jov, cor: LAR }, { v: vel, cor: COB, acima: true }],
      dica: (i) => `<b>${anos[i]}</b><br>Mais jovens: ${fmt.dec(jov[i])} anos<br>Mais envelhecidos: ${fmt.dec(vel[i])} anos<br>Todos: ${fmt.dec(tot[i])} anos`,
    });
    tabela(box, ["Eleição", "Mais jovens", "Mais envelhecidos", "Todos"], anos.map((a, i) => [a, fmt.dec(jov[i]), fmt.dec(vel[i]), fmt.dec(tot[i])]));
  } catch {}
})();

/* ---------- muitos registros, uma pessoa ---------- */
(() => {
  const svg = document.getElementById("many-svg");
  if (!svg) return;
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // três partes, cada uma em cima da sua coluna (Ler, Resolver, Responder): 48 registros espalhados,
  // os mesmos 48 juntos em grupos (um grupo por pessoa) e, à direita, só as pessoas (30, como 569 mil viraram 359 mil)
  const N = 144, L = 12, COL = [0, 410, 820], LARG = 380;
  const GRUPOS = [4, 2, 1, 3, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 2, 2, 1, 1]; // 30 pessoas, 48 registros
  const noGrupo = [];
  GRUPOS.forEach((n, g) => { for (let j = 0; j < n; j++) noGrupo.push([g, j]); });
  const finais = [];
  for (let i = 0; i < N; i++) {
    const zona = i % 3, k = Math.floor(i / 3);
    let x, y, cor, some = false;
    if (zona === 0) { x = COL[0] + 10 + rnd() * (LARG - 20); y = 10 + rnd() * 240; cor = rnd() > 0.5 ? "#b9bfca" : "#d6d0c4"; }
    else if (zona === 1) {
      const [g, j] = noGrupo[k];
      x = COL[1] + 20 + (g % 6) * 58 + (j % 2) * 14; y = 20 + Math.floor(g / 6) * 50 + Math.floor(j / 2) * 14; cor = "#5c574d";
    } else {
      some = k >= GRUPOS.length;
      const kk = Math.min(k, GRUPOS.length - 1);
      x = COL[2] + 20 + (kk % 6) * 62; y = 22 + Math.floor(kk / 6) * 50; cor = "#1e4a80";
    }
    finais.push({ x, y, cor, some });
  }
  finais.forEach((f, i) => {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("width", L); r.setAttribute("height", L);
    r.setAttribute("x", f.x); r.setAttribute("y", f.y); r.setAttribute("fill", f.cor);
    if (f.some) r.setAttribute("opacity", 0);
    if (!reduzido) { r.style.transform = `translate(${(rnd() - 0.5) * 120}px, ${(rnd() - 0.5) * 80}px)`; r.style.transitionDelay = `${(i % 48) * 12}ms`; }
    svg.appendChild(r);
  });
  const caixa = svg.closest("[data-reveal]");
  const assenta = () => svg.querySelectorAll("rect").forEach((r) => (r.style.transform = "none"));
  if (caixa) caixa.addEventListener("in", assenta, { once: true });
  if (caixa?.classList.contains("is-in")) assenta();
})();
