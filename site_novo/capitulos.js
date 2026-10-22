/* Capítulos interativos do relatório: Q1 (o preço da cadeira) e Q5 (a casa, cada ponto um eleito).
   Lê as respostas das views pelas funções de dados.js e as cadeiras exportadas de vw_site_cadeira
   (dados/site/cadeiras_<ano>_<cargo>_<uf>.json, gerados por scripts/exporta_cadeiras.py). */

(() => {
  const { resposta, arquivo, qs } = window.Dados;
  const H = window.Hemiciclo;
  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const brl = (v) => `R$ ${nf(0).format(v)}`;
  const curto = (v) => (v >= 1e6 ? `R$ ${nf(2).format(v / 1e6)} mi` : v >= 1e4 ? `R$ ${nf(1).format(v / 1e3)} mil` : brl(v));
  const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Em)\b/g, (w) => w.toLowerCase()).replace(/(^|\s)(?!Dr\b)([B-DF-HJ-NP-TV-Z][b-df-hj-np-tv-z]{1,3})(?=\s|$)/g, (m, a, w) => a + w.toUpperCase());
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const NOME_UF = { AL: "Alagoas", PA: "Pará", PB: "Paraíba", PR: "Paraná", SC: "Santa Catarina", SE: "Sergipe" };
  const DO_UF = { AL: "de Alagoas", PA: "do Pará", PB: "da Paraíba", PR: "do Paraná", SC: "de Santa Catarina", SE: "de Sergipe" };
  const CARGO = { VEREADOR: "vereador", PREFEITO: "prefeito", "DEPUTADO ESTADUAL": "deputado estadual", "DEPUTADO FEDERAL": "deputado federal", SENADOR: "senador", GOVERNADOR: "governador" };

  function botoes(el, itens, ativo, aoEscolher, { aria = "aria-pressed", classe = "" } = {}) {
    el.innerHTML = itens.map((i) => `<button type="button" class="${classe}" ${aria === "aria-selected" ? 'role="tab" ' : ""}data-v="${esc(i.v)}" ${aria}="${String(i.v) === String(ativo)}">${esc(i.t)}</button>`).join("");
    el.onclick = (e) => { const b = e.target.closest("button[data-v]"); if (b) aoEscolher(b.dataset.v); };
  }

  /* ---------- Q1 ---------- */
  (async () => {
    const elCargos = document.getElementById("custo-cargos");
    if (!elCargos) return;
    const [custo, opcoes] = await Promise.all([resposta("/api/q1/custo-cadeira"), resposta("/api/q1/opcoes")]);
    const ORDEM = ["VEREADOR", "PREFEITO", "DEPUTADO ESTADUAL", "DEPUTADO FEDERAL", "SENADOR", "GOVERNADOR"];
    const anosDe = (cargo) => opcoes.dados.filter((o) => o.cargo === cargo).map((o) => o.ano).sort();
    const st = { cargo: "DEPUTADO FEDERAL", ano: 2022 };

    async function mostra() {
      botoes(elCargos, ORDEM.map((c) => ({ v: c, t: CARGO[c][0].toUpperCase() + CARGO[c].slice(1) })), st.cargo, (v) => {
        const i = anosDe(st.cargo).indexOf(st.ano);
        st.cargo = v; st.ano = anosDe(v)[Math.max(0, i)] ?? anosDe(v).at(-1); mostra();
      }, { aria: "aria-selected", classe: "tab" });
      botoes(document.getElementById("custo-anos"), anosDe(st.cargo).map((a) => ({ v: a, t: a })), st.ano, (v) => { st.ano = Number(v); mostra(); });

      const linhas = custo.dados.filter((r) => r.ano === st.ano && r.cargo === st.cargo).sort((a, b) => b.custo_por_cadeira - a.custo_por_cadeira);
      const g = linhas.reduce((s, r) => s + r.gasto_total, 0), c = linhas.reduce((s, r) => s + r.cadeiras, 0);
      document.getElementById("custo-num").textContent = brl(g / c);
      document.getElementById("custo-leg").textContent = `por cadeira de ${CARGO[st.cargo]}, ${st.ano}: ${curto(g)} para ${nf(0).format(c)} ${c === 1 ? "vaga" : "vagas"}.`;
      const max = linhas[0]?.custo_por_cadeira ?? 1;
      document.getElementById("custo-ufs").innerHTML = linhas.map((r, i) => `
        <li class="${i === 0 ? "topo" : ""}"><span class="uf">${NOME_UF[r.uf]}<small>${nf(0).format(r.candidatos)} candidatos para ${nf(0).format(r.cadeiras)} ${r.cadeiras === 1 ? "cadeira" : "cadeiras"}</small></span>
          <span class="v">${curto(r.custo_por_cadeira)}</span><span class="trilho"><i style="--w:${((r.custo_por_cadeira / max) * 100).toFixed(1)}%"></i></span></li>`).join("");

      mostraDuelo();
    }

    /* eleitos contra não eleitos: mesma view do site antigo (mv_q1_eleitos_vs_nao), com os dois critérios */
    const du = { uf: "TODAS", suplentes: true, zero: true };
    const vezes = (a, b) => (b > 0 ? `${nf(a / b >= 100 ? 0 : 1).format(a / b)}×` : "—");
    let pedidoDuelo = 0;
    async function mostraDuelo() {
      const meu = ++pedidoDuelo;
      botoes(document.getElementById("duelo-ufs"), [{ v: "TODAS", t: "Todos" }, ...Object.keys(NOME_UF).map((u) => ({ v: u, t: u }))], du.uf, (v) => { du.uf = v; mostraDuelo(); });
      document.querySelectorAll("#duelo .opc").forEach((b) => b.setAttribute("aria-pressed", String(du[b.dataset.opc])));
      const r = await resposta(`/api/q1/eleitos?${qs({ ano: st.ano, cargo: st.cargo, uf: du.uf, suplentes: du.suplentes, zero: du.zero })}`).catch(() => null);
      if (meu !== pedidoDuelo) return;
      const e = r?.dados.find((x) => x.resultado.startsWith("ELEITO")), n = r?.dados.find((x) => !x.resultado.startsWith("ELEITO"));
      const nums = document.getElementById("duelo-nums"), barras = document.getElementById("duelo-barras");
      if (!e || !n) {
        nums.innerHTML = `<div><dd>—</dd><dt>Não há eleitos e não eleitos suficientes nessa combinação.</dt></div>`;
        barras.innerHTML = "";
        return;
      }
      const tot = e.candidatos + n.candidatos, gasto = e.gasto_total + n.gasto_total;
      const naoTxt = du.suplentes ? "não eleitos e suplentes" : "não eleitos";
      nums.innerHTML = `
        <div><dd class="forte">${vezes(e.media, n.media)}</dd><dt><b>pela média</b>: ${brl(e.media)} contra ${brl(n.media)}, puxada pelos que gastam muito</dt></div>
        <div><dd class="forte">${vezes(e.mediana, n.mediana)}</dd><dt><b>pela mediana</b>: ${brl(e.mediana)} contra ${brl(n.mediana)}, o candidato típico de cada grupo</dt></div>
        <div><dd>${nf(1).format((100 * e.candidatos) / tot)}%</dd><dt><b>dos candidatos se elegeram</b>: ${nf(0).format(e.candidatos)} de ${nf(0).format(tot)}</dt></div>
        <div><dd>${nf(1).format((100 * e.gasto_total) / gasto)}%</dd><dt><b>do gasto total foi dos eleitos</b>: ${curto(e.gasto_total)} de ${curto(gasto)}</dt></div>`;
      const par = (titulo, sub, campo) => {
        const max = Math.max(e[campo], n[campo]) || 1;
        return `<div class="duelo__par"><h4>${titulo}</h4><p>${sub}</p>
          <div class="duelo__linha"><span>Eleitos</span><div><i style="width:${(e[campo] / max) * 70}%;background:var(--accent)"></i>${curto(e[campo])}</div></div>
          <div class="duelo__linha"><span>${naoTxt[0].toUpperCase() + naoTxt.slice(1)}</span><div><i style="width:${(n[campo] / max) * 70}%;background:var(--orange)"></i>${curto(n[campo])}</div></div></div>`;
      };
      barras.innerHTML = par("Média de gasto por candidato", "Puxada pelos poucos que gastam muito.", "media") + par("Mediana de gasto por candidato", "O candidato típico de cada grupo.", "mediana");
    }
    document.querySelector("#duelo .duelo__opc").addEventListener("click", (e) => {
      const b = e.target.closest(".opc");
      if (!b) return;
      du[b.dataset.opc] = !du[b.dataset.opc];
      mostraDuelo();
    });
    mostra();
  })();

  /* ---------- Q5: a casa ---------- */
  (async () => {
    const elHemi = document.getElementById("casa-hemi");
    if (!elHemi) return;
    const CAPITAL = { AL: 2704302, PA: 1501402, PB: 2507507, PR: 4106902, SC: 4205407, SE: 2800308 };
    const ANOS = { "DEPUTADO FEDERAL": [2018, 2022], "DEPUTADO ESTADUAL": [2018, 2022], VEREADOR: [2020, 2024] };
    const st = { cargo: "DEPUTADO ESTADUAL", ano: 2022, uf: "PR", mun: CAPITAL.PR, marca: null };
    const ficha = document.getElementById("casa-ficha");
    const munBox = document.getElementById("casa-mun-box"), munIn = document.getElementById("casa-mun"), munLista = document.getElementById("casa-mun-lista");
    let indice = null;
    arquivo("q10_indice.json").then((f) => (indice = new Set(f.indice.map((i) => i.achado.id_pessoa)))).catch(() => {});

    const COL = ["cod_ibge", "municipio", "id_candidatura", "id_pessoa", "nome_urna", "partido", "votos", "posicao_votos", "vagas", "quociente", "pct_do_quociente", "por_legenda", "fora_dos_mais_votados"];
    const carrega = (ano, cargo, uf) => arquivo(`site/cadeiras_${ano}_${cargo.replace(/ /g, "_")}_${uf}.json`).then((f) => f.linhas.map((l) => Object.fromEntries(COL.map((c, i) => [c, l[i]]))));

    function iniciais(nome) {
      const p = nome.replace(/^(DR|DRA|PROF|PROFESSOR|PROFESSORA|PASTOR|DELEGADO|DELEGADA|CAPITÃO|SARGENTO|CORONEL)\.?\s+/i, "").split(/\s+/).filter((x) => x.length > 2);
      return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
    }

    function mostraFicha({ partido, membro: m }) {
      const ord = m.posicao_votos;
      const pct = Math.min(m.pct_do_quociente, 200);
      const sozinho = !m.por_legenda;
      ficha.innerHTML = `
        <div class="ficha__foto" style="background:${partido.cor}"><img src="fotos/${m.id_candidatura}.webp" alt="Foto de ${esc(titulo(m.nome_urna))} no registro da candidatura" width="161" height="225" onerror="this.remove()"><span aria-hidden="true">${esc(iniciais(m.nome_urna))}</span></div>
        <p class="ficha__nome">${esc(titulo(m.nome_urna))}</p>
        <p class="ficha__partido"><i style="background:${partido.cor}"></i>${esc(m.partido)}${m.municipio ? ` · ${esc(m.municipio)}` : ""}</p>
        <dl class="ficha__dados">
          <dt>Votos</dt><dd>${nf(0).format(m.votos)}</dd>
          <dt>Quociente eleitoral</dt><dd>${nf(0).format(m.quociente)}</dd>
          <dt>Do quociente</dt><dd>${nf(1).format(m.pct_do_quociente)}%</dd>
          <dt>Posição nos votos</dt><dd>${ord}º de ${m.vagas} vagas</dd>
        </dl>
        <div class="ficha__quoc" aria-hidden="true"><i style="width:${(pct / 200) * 100}%"></i><b style="left:50%"></b></div>
        <span class="ficha__selo${sozinho ? " ficha__selo--sozinho" : ""}">${sozinho ? "Atingiu o quociente sozinho" : m.fora_dos_mais_votados ? "Entrou com menos votos que um derrotado" : "Eleito pela soma do partido"}</span>
        ${indice?.has(m.id_pessoa) ? `<a class="ficha__link link" href="#carreiras" data-pessoa="${m.id_pessoa}">Ver a carreira</a>` : ""}`;
      const img = ficha.querySelector("img");
      img.addEventListener("load", () => ficha.querySelector(".ficha__foto span")?.remove());
    }
    ficha.addEventListener("click", (e) => {
      const a = e.target.closest("[data-pessoa]");
      if (a) document.dispatchEvent(new CustomEvent("abre-carreira", { detail: { id: Number(a.dataset.pessoa) } }));
    });

    let pedido = 0;
    async function mostra() {
      const meu = ++pedido;
      document.querySelectorAll("#casa-tipo .tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cargo === st.cargo)));
      botoes(document.getElementById("casa-anos"), ANOS[st.cargo].map((a) => ({ v: a, t: a })), st.ano, (v) => { st.ano = Number(v); mostra(); });
      botoes(document.getElementById("casa-ufs"), Object.keys(NOME_UF).map((u) => ({ v: u, t: u })), st.uf, (v) => { st.uf = v; st.mun = CAPITAL[v]; mostra(); });
      munBox.hidden = st.cargo !== "VEREADOR";

      let linhas = await carrega(st.ano, st.cargo, st.uf);
      if (meu !== pedido) return;
      let nome;
      if (st.cargo === "VEREADOR") {
        const muns = [...new Map(linhas.map((l) => [l.cod_ibge, l.municipio])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
        munLista.innerHTML = muns.map(([, n]) => `<option value="${esc(n)}">`).join("");
        if (!muns.some(([c]) => c === st.mun)) st.mun = muns[0][0];
        linhas = linhas.filter((l) => l.cod_ibge === st.mun);
        munIn.value = linhas[0]?.municipio ?? "";
        nome = `Câmara Municipal de ${linhas[0]?.municipio}, ${st.ano}`;
      } else {
        nome = st.cargo === "DEPUTADO ESTADUAL" ? `Assembleia Legislativa ${DO_UF[st.uf]}, ${st.ano}` : `Bancada ${DO_UF[st.uf]} na Câmara dos Deputados, ${st.ano}`;
      }
      document.getElementById("casa-nome").textContent = nome;

      const porPartido = new Map();
      for (const l of linhas) (porPartido.get(l.partido) ?? porPartido.set(l.partido, []).get(l.partido)).push(l);
      const partidos = [...porPartido.entries()]
        .map(([nomeP, membros]) => ({ nome: nomeP, cadeiras: membros.length, cor: H.cor(nomeP), membros: membros.sort((a, b) => b.votos - a.votos) }))
        .sort((a, b) => b.cadeiras - a.cadeiras || a.nome.localeCompare(b.nome));
      const h = H.desenha(elHemi, { partidos, legendaCentro: linhas.length === 1 ? "cadeira" : "cadeiras" });
      h.seleciona((m) => m.posicao_votos === 1);

      const nSoz = linhas.filter((l) => !l.por_legenda).length, nPux = linhas.filter((l) => l.fora_dos_mais_votados).length;
      const bts = document.querySelectorAll(".marca-btn");
      bts[0].textContent = `Atingiu o quociente sozinho (${nSoz})`;
      bts[1].textContent = `Entrou com menos votos que um derrotado (${nPux})`;
      const aplica = () => {
        bts.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.marca === st.marca)));
        h.marca(st.marca === "sozinho" ? (m) => !m.por_legenda : st.marca === "puxado" ? (m) => m.fora_dos_mais_votados : null);
      };
      document.querySelector(".casa__marcas").onclick = (e) => {
        const b = e.target.closest(".marca-btn");
        if (!b) return;
        st.marca = st.marca === b.dataset.marca ? null : b.dataset.marca;
        aplica();
      };
      aplica();
      document.getElementById("casa-legenda").innerHTML = partidos.map((p) => `<span><i style="background:${p.cor}"></i>${esc(p.nome)} ${p.cadeiras}</span>`).join("");
    }

    elHemi.addEventListener("assento", (e) => mostraFicha(e.detail));

    document.getElementById("casa-tipo").addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (!b || b.dataset.cargo === st.cargo) return;
      const i = ANOS[st.cargo].indexOf(st.ano);
      st.cargo = b.dataset.cargo;
      st.ano = ANOS[st.cargo][i];
      st.marca = null;
      mostra();
    });
    /* o mapa do território pede a Câmara de um município */
    document.addEventListener("abre-casa", (e) => {
      st.cargo = "VEREADOR"; st.ano = 2024; st.uf = e.detail.uf; st.mun = e.detail.cod; st.marca = null;
      mostra();
    });
    munIn.addEventListener("change", async () => {
      const linhas = await carrega(st.ano, st.cargo, st.uf);
      const alvo = linhas.find((l) => l.municipio.localeCompare(munIn.value.trim(), "pt-BR", { sensitivity: "base" }) === 0);
      if (alvo) { st.mun = alvo.cod_ibge; mostra(); }
    });
    mostra();
  })();

  /* ---------- O dinheiro: Q2 (patrimônio), Q8 (fundo público) e Q9 (propaganda) ----------
     Uma barra de filtros só (cargo, eleição, estado) para as três perguntas. As leituras reaproveitam as do
     site_eleicoes: "quinto mais rico × sem bens" com eleitos/candidatos crus e aviso de amostra pequena (Q2),
     "fonte privada × pública" pela maioria do dinheiro e a composição eleitos × não eleitos (Q8), a evolução
     dos canais e a nuvem por frequência ou valor (Q9). */
  (async () => {
    const elCargos = document.getElementById("din-cargos");
    if (!elCargos) return;
    const ORDEM = ["VEREADOR", "PREFEITO", "DEPUTADO ESTADUAL", "DEPUTADO FEDERAL", "SENADOR", "GOVERNADOR"];
    const opcoes = (await resposta("/api/q2/opcoes")).dados;
    const anosDe = (cargo) => opcoes.filter((o) => o.cargo === cargo).map((o) => o.ano).sort();
    const st = { cargo: "VEREADOR", ano: 2024, uf: "TODAS", escopo: "PROPAGANDA", medida: "despesas" };
    const pct = (v, d = 1) => (v == null || !isFinite(v) ? "—" : `${nf(d).format(v)}%`);
    const vezes = (r) => `${nf(r >= 100 ? 0 : 1).format(r)}×`;
    const cap = (t) => t[0].toUpperCase() + t.slice(1);
    const ondeTxt = () => (st.uf === "TODAS" ? "nos seis estados" : { AL: "em Alagoas", PA: "no Pará", PB: "na Paraíba", PR: "no Paraná", SC: "em Santa Catarina", SE: "em Sergipe" }[st.uf]);
    const POUCOS = 20;

    function filtros() {
      botoes(elCargos, ORDEM.map((c) => ({ v: c, t: cap(CARGO[c]) })), st.cargo, (v) => {
        const i = anosDe(st.cargo).indexOf(st.ano);
        st.cargo = v; st.ano = anosDe(v)[Math.max(0, i)] ?? anosDe(v).at(-1); tudo();
      }, { aria: "aria-selected", classe: "tab" });
      botoes(document.getElementById("din-anos"), anosDe(st.cargo).map((a) => ({ v: a, t: a })), st.ano, (v) => { st.ano = Number(v); tudo(); });
      botoes(document.getElementById("din-ufs"), [{ v: "TODAS", t: "Todos" }, ...Object.keys(NOME_UF).map((u) => ({ v: u, t: u }))], st.uf, (v) => { st.uf = v; tudo(); });
      document.getElementById("din-resumo").innerHTML = `<b>${cap(CARGO[st.cargo])}, ${st.ano}</b>, ${ondeTxt()}`;
    }

    /* ----- Q2: a escada ----- */
    const CURTO2 = ["Sem bens", "Até R$ 50 mil", "R$ 50 a 200 mil", "R$ 200 mil a 1 mi", "R$ 1 a 5 mi", "Mais de R$ 5 mi"];
    const NOME_Q = ["Sem bens", "Quinto mais pobre", "Segundo quinto", "Terceiro quinto", "Quarto quinto", "Quinto mais rico"];
    const taxa = (g) => (g && g.candidatos ? (100 * g.eleitos) / g.candidatos : null);
    async function q2() {
      const escada = document.getElementById("esc-escada");
      let r;
      try { r = (await resposta(`/api/q2?${qs({ ano: st.ano, cargo: st.cargo, uf: st.uf })}`)).dados; } catch { r = null; }
      if (!r?.resumo) { escada.innerHTML = `<p class="muted">Sem candidatos para essa combinação.</p>`; return; }
      const { resumo, faixas, quintis } = r;
      const geral = resumo.taxa_sucesso;
      const fs = [...faixas].sort((a, b) => a.ordem - b.ordem);
      const topo = Math.max(geral, ...fs.map((f) => f.taxa_sucesso)) * 1.2 || 1;
      escada.style.setProperty("--n", fs.length);
      escada.innerHTML = `<div class="esc__area">
        ${fs.map((f) => `<div class="degrau${f.ordem === 0 ? " degrau--sem" : ""}${f.candidatos < POUCOS ? " degrau--pouco" : ""}" title="${esc(f.faixa)}: ${nf(0).format(f.eleitos)} eleitos de ${nf(0).format(f.candidatos)} candidatos">
            <span class="degrau__val">${pct(f.taxa_sucesso)}</span>
            <span class="degrau__barra" style="--h:${((f.taxa_sucesso / topo) * 100).toFixed(1)}%"></span>
            <span class="degrau__rot">${CURTO2[f.ordem] ?? esc(f.faixa)}<small>${nf(0).format(f.candidatos)} cand.${f.candidatos < POUCOS ? ", poucos" : ""}</small></span>
          </div>`).join("")}
        <div class="esc__ref" style="bottom:${((geral / topo) * 100).toFixed(1)}%"></div></div>`;
      document.getElementById("esc-cap").textContent = `Taxa de sucesso por faixa de patrimônio. A linha tracejada é a taxa geral do cargo: ${pct(geral)}.`;

      const sem = quintis.find((q) => q.quintil === 0), ricos = quintis.find((q) => q.quintil === 5), pobres = quintis.find((q) => q.quintil === 1);
      const menor = Math.min(...quintis.filter((q) => q.quintil > 0).map((q) => q.candidatos), Infinity);
      const ok = !!ricos && menor >= POUCOS;
      const num = document.getElementById("esc-num"), leg = document.getElementById("esc-leg");
      if (!ok) {
        num.textContent = "";
        leg.textContent = "Poucos candidatos com bens declarados nesta seleção para dividir em quintos. A escada ao lado mostra as faixas, com as de poucos candidatos hachuradas.";
      } else if (!sem || sem.candidatos === 0) {
        num.textContent = pct(taxa(ricos));
        leg.textContent = `dos candidatos do quinto mais rico se elegeram. Todos declararam algum bem nesta seleção.`;
      } else if (sem.eleitos === 0) {
        num.textContent = `${pct(taxa(ricos), 0)} × 0%`;
        leg.textContent = `No quinto mais rico, ${pct(taxa(ricos))} se elegeram; entre os ${nf(0).format(sem.candidatos)} que não declararam bens, ninguém.`;
      } else {
        const razao = taxa(ricos) / taxa(sem);
        num.textContent = vezes(razao);
        leg.textContent = `${razao < 0.95 ? "Aqui os mais ricos se elegeram menos: " : razao < 1.05 ? "Praticamente a mesma chance: " : "O quinto mais rico se elegeu esse tanto de vezes mais que quem não declarou bens: "}${pct(taxa(ricos))} contra ${pct(taxa(sem))}.${sem.eleitos < 5 ? ` Só ${sem.eleitos} eleito(s) sem bens; leia com cautela.` : ""}`;
      }
      document.getElementById("esc-mais").innerHTML = `
        <div><dt>Contra o quinto mais pobre</dt><dd>${ok && pobres?.eleitos ? `${vezes(taxa(ricos) / taxa(pobres))} <small class="muted">${pct(taxa(ricos))} contra ${pct(taxa(pobres))}</small>` : "—"}</dd></div>
        <div><dt>Patrimônio mediano dos eleitos</dt><dd>${curto(resumo.mediana_eleitos ?? 0)} <small class="muted">contra ${curto(resumo.mediana_nao_eleitos ?? 0)}</small></dd></div>
        <div><dt>Não declararam nenhum bem</dt><dd>${pct(resumo.pct_sem_bens)} <small class="muted">dos ${nf(0).format(resumo.candidatos)} candidatos</small></dd></div>`;

      const qs6 = [...quintis].sort((a, b) => a.quintil - b.quintil);
      const faixaQ = (q) => (q.quintil === 0 ? "R$ 0" : q.quintil === 1 ? `até ${curto(q.patrimonio_max)}` : q.quintil === 5 ? `${curto(q.patrimonio_min)} ou mais` : `${curto(q.patrimonio_min)} a ${curto(q.patrimonio_max)}`);
      document.getElementById("esc-quintos").innerHTML = ok ? qs6.map((q) => `
        <div class="quinto${q.quintil === 5 ? " quinto--topo" : ""}"><strong>${NOME_Q[q.quintil]}</strong><b>${pct(taxa(q))}</b><span>${faixaQ(q)} · ${nf(0).format(q.eleitos)} de ${nf(0).format(q.candidatos)}</span></div>`).join("") : "";
    }

    /* ----- Q8: o morro ----- */
    const CURTO8 = ["Sem receita", "Nenhum público", "Menos de 25%", "25 a 50%", "50 a 75%", "75 a 99%", "100% público"];
    const FONTES = [
      { nome: "Fundo Especial (FEFC)", rot: "Fundo Especial", cor: "#1f2de6" },
      { nome: "Fundo Partidário", rot: "Fundo Partidário", cor: "#7f8af2", claro: true },
      { nome: "Pessoas físicas", rot: "Pessoas físicas", cor: "#e0701c" },
      { nome: "Recursos do próprio candidato", rot: "Recursos próprios", cor: "#1f8a6a" },
      { nome: "*", rot: "Outras fontes privadas", cor: "#8a919c", claro: true },
    ];
    const fonteDe = (cat) => FONTES.find((f) => f.nome === cat) ?? FONTES[FONTES.length - 1];
    const publicoPorUf = new Map();
    async function q8() {
      let r;
      try { r = (await resposta(`/api/q8?${qs({ ano: st.ano, cargo: st.cargo, uf: st.uf })}`)).dados; } catch { r = null; }
      const curva = document.getElementById("morro-curva");
      if (!r?.resumo) { curva.innerHTML = `<p class="muted">Sem candidatos para essa combinação.</p>`; return; }
      const { resumo: rs, faixas, origem } = r;
      const geral = (100 * rs.eleitos) / rs.candidatos;

      /* número principal: quem tem a maior parte do dinheiro privada contra quem tem a maior parte pública */
      const tPub = rs.maioria_publica ? (100 * rs.maioria_publica_eleitos) / rs.maioria_publica : null;
      const tPriv = rs.maioria_privada ? (100 * rs.maioria_privada_eleitos) / rs.maioria_privada : null;
      const num = document.getElementById("morro-num"), leg = document.getElementById("morro-leg");
      if (tPub == null || tPriv == null) { num.textContent = ""; leg.textContent = "Um dos dois grupos não tem candidatos nesta seleção."; }
      else if (tPub === 0 || tPriv === 0) { num.textContent = `${pct(Math.max(tPub, tPriv), 0)} × 0%`; leg.textContent = tPub === 0 ? "Ninguém que dependeu de dinheiro público na maior parte se elegeu nesta seleção." : "Ninguém que viveu de fonte privada na maior parte se elegeu nesta seleção."; }
      else {
        const privMelhor = tPriv >= tPub;
        num.textContent = vezes(privMelhor ? tPriv / tPub : tPub / tPriv);
        leg.textContent = `${privMelhor ? "Quem arrecadou mais da metade de fontes privadas se elegeu esse tanto de vezes mais que quem dependeu de dinheiro público" : "Aqui quem dependeu de dinheiro público na maior parte se elegeu esse tanto de vezes mais que quem viveu de fonte privada"}: ${pct(privMelhor ? tPriv : tPub)} contra ${pct(privMelhor ? tPub : tPriv)}. Do dinheiro arrecadado, ${pct(rs.pct_publico_do_dinheiro)} era público.`;
      }

      /* a curva */
      const fs = [...faixas].sort((a, b) => a.ordem - b.ordem);
      const W = Math.max(320, curva.clientWidth || 640), H = W < 520 ? 300 : 340, esq = 8, dir = 8, cima = 36, baixo = 58;
      const gap = W < 520 ? 14 : 34;
      const passo = (W - esq - dir - gap) / (fs.length - 0.5);
      const xs = fs.map((f, i) => (i === 0 ? esq + passo * 0.25 : esq + gap + passo * (i + 0.25)));
      const max = Math.max(geral, ...fs.map((f) => f.taxa_sucesso)) * 1.25 || 1;
      const y = (v) => cima + (1 - v / max) * (H - cima - baixo);
      const pequeno = W < 520;
      let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Taxa de sucesso por parte de dinheiro público">`;
      svg += `<line x1="${esq}" x2="${W - dir}" y1="${y(0)}" y2="${y(0)}" stroke="var(--surface-2)" stroke-width="2"/>`;
      svg += `<line x1="${esq}" x2="${W - dir}" y1="${y(geral)}" y2="${y(geral)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 5"/>`;
      document.getElementById("morro-cap").textContent = `Taxa de sucesso pela parte do dinheiro de cada candidato que era pública. A linha tracejada é a taxa geral: ${pct(geral)}.`;
      svg += `<path d="${fs.slice(1).map((f, i) => `${i ? "L" : "M"}${xs[i + 1]},${y(f.taxa_sucesso)}`).join("")}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
      fs.forEach((f, i) => {
        const poucos = f.candidatos < POUCOS;
        svg += `<g class="morro__ponto" data-i="${i}"><rect x="${xs[i] - passo / 2}" y="0" width="${passo}" height="${H}" fill="transparent"/>
          <circle cx="${xs[i]}" cy="${y(f.taxa_sucesso)}" r="${pequeno ? 6 : 8}" fill="${i === 0 || poucos ? "var(--surface)" : "var(--accent)"}" stroke="${i === 0 ? "var(--ink)" : "var(--accent)"}" stroke-width="2.5"/>
          <text x="${xs[i]}" y="${y(f.taxa_sucesso) - 16}" text-anchor="middle" font-size="${pequeno ? 13 : 21}" fill="var(--ink)">${pct(f.taxa_sucesso)}</text>
          <text x="${xs[i]}" y="${H - baixo + 22}" text-anchor="middle" font-size="${pequeno ? 11 : 15}" fill="var(--ink)">${pequeno ? CURTO8[i].replace("Menos de ", "< ").replace(" público", "").replace("Nenhum", "0%").replace("Sem receita", "Sem") : CURTO8[i]}</text>
          <text x="${xs[i]}" y="${H - baixo + 40}" text-anchor="middle" font-size="${pequeno ? 11 : 15}" fill="var(--muted)">${nf(0).format(f.candidatos)}${poucos ? "*" : ""}</text></g>`;
      });
      svg += `</svg><p class="morro__leitura muted" id="morro-leitura">Passe o mouse ou toque num ponto para ler a faixa. Abaixo de cada faixa, o número de candidatos${fs.some((f) => f.candidatos < POUCOS) ? "; * poucos candidatos" : ""}.</p>`;
      curva.innerHTML = svg;
      const leitura = document.getElementById("morro-leitura");
      const le = (e) => {
        const g = e.target.closest(".morro__ponto");
        if (!g) return;
        const f = fs[g.dataset.i];
        leitura.innerHTML = `<b>${CURTO8[g.dataset.i]}</b>: ${nf(0).format(f.eleitos)} eleitos de ${nf(0).format(f.candidatos)} candidatos (${pct(f.taxa_sucesso)}), receita mediana ${brl(f.receita_mediana)}.`;
      };
      curva.querySelector("svg").addEventListener("pointerover", le);
      curva.querySelector("svg").addEventListener("click", le);

      /* composição do dinheiro, eleitos × não eleitos */
      const linhas = ["Eleitos", "Não eleitos"].map((g) => {
        const ls = origem.filter((o) => o.grupo === g);
        const total = ls.reduce((s, o) => s + o.valor, 0);
        const por = FONTES.map((f) => ({ ...f, v: ls.filter((o) => fonteDe(o.categoria) === f).reduce((s, o) => s + o.valor, 0) }));
        return { g, total, por };
      }).filter((l) => l.total > 0);
      const usadas = FONTES.filter((f) => linhas.some((l) => l.por.find((p) => p.rot === f.rot).v > 0));
      document.getElementById("morro-comp").innerHTML = `<div class="comp">${linhas.map((l) => `
        <div class="comp__linha"><span>${l.g}<small>${curto(l.total)}</small></span><div class="comp__trilho">${l.por.filter((p) => p.v > 0).map((p) => {
          const w = (100 * p.v) / l.total;
          return `<i class="${p.claro ? "claro" : ""}" style="width:${w}%;background:${p.cor}" title="${p.rot}: ${curto(p.v)} (${pct(w)})">${w >= 7 ? pct(w, 0) : ""}</i>`;
        }).join("")}</div></div>`).join("")}</div>
        <p class="comp__chave">${usadas.map((f) => `<span><i style="background:${f.cor}"></i>${f.rot}${f.nome.startsWith("F") ? " (público)" : ""}</span>`).join("")}</p>`;

      /* parte pública por eleição, todos os cargos, a partir dos valores em reais */
      if (!publicoPorUf.has(st.uf)) {
        publicoPorUf.set(st.uf, Promise.all(opcoes.map((o) => resposta(`/api/q8?${qs({ ano: o.ano, cargo: o.cargo, uf: st.uf })}`).then((x) => ({ ano: o.ano, origem: x.dados.origem })).catch(() => ({ ano: o.ano, origem: [] }))))
          .then((todas) => {
            const m = {};
            for (const t of todas) for (const o of t.origem) { m[t.ano] ??= { tot: 0, pub: 0 }; m[t.ano].tot += o.valor; if (o.publico) m[t.ano].pub += o.valor; }
            return Object.entries(m).map(([ano, v]) => ({ ano: Number(ano), pct: (100 * v.pub) / v.tot, tot: v.tot })).sort((a, b) => a.ano - b.ano);
          }));
      }
      const serie = await publicoPorUf.get(st.uf);
      document.getElementById("morro-anos-sub").textContent = `Todos os cargos somados, ${ondeTxt()}.`;
      document.getElementById("morro-anos").innerHTML = serie.map((a) => `<li${a.ano === st.ano ? ' class="atual"' : ""}><span>${a.ano}</span><i style="--w:${a.pct.toFixed(1)}%"></i><span>${pct(a.pct)}</span></li>`).join("");
    }

    /* ----- Q9: o chão ----- */
    const CANAL = { "Impressos e adesivos": "#6f7cf5", "Rádio, TV, vídeo e som": "#cc6a20", "Internet": "#2fa784", "Militância, comícios e eventos": "#b08c1c" };
    const NAO_PROP = { "Estrutura da campanha": "#5b616c", "Outras despesas": "#3d424a" };
    const corGrupo = (g) => CANAL[g] ?? NAO_PROP[g] ?? "#5b616c";
    const ACENTO = { militancia: "militância", video: "vídeo", videos: "vídeos", conteudo: "conteúdo", grafica: "gráfica", graficos: "gráficos", couche: "couché", parachoque: "para-choque", juridico: "jurídico", juridica: "jurídica", contabil: "contábil", veiculo: "veículo", veiculos: "veículos", combustivel: "combustível", servico: "serviço", servicos: "serviços", eletrico: "elétrico", plastico: "plástico", agua: "água", publico: "público", publica: "pública", logistica: "logística", midia: "mídia", midias: "mídias", radio: "rádio", tecnico: "técnico", tecnica: "técnica", pagina: "página", paginas: "páginas", eletronico: "eletrônico", automovel: "automóvel", onibus: "ônibus", camera: "câmera", agencia: "agência", estrategia: "estratégia", politica: "política", politico: "político", lancamento: "lançamento", refeicoes: "refeições", espaco: "espaço", caminhao: "caminhão", bone: "boné", bones: "bonés", cafe: "café", periodo: "período", aniversario: "aniversário", basico: "básico", basica: "básica" };
    const acentua = (w) => {
      const p = w.toLowerCase();
      if (ACENTO[p]) return ACENTO[p];
      if (p.endsWith("coes")) return p.slice(0, -4) + "ções";
      if (p.endsWith("cao")) return p.slice(0, -3) + "ção";
      if (p.endsWith("oes")) return p.slice(0, -3) + "ões";
      if (p.endsWith("ao")) return p.slice(0, -2) + "ão";
      return p;
    };
    const hashOrdem = (w) => [...w].reduce((h, c) => ((h * 31) ^ c.charCodeAt(0)) >>> 0, 7);
    async function q9() {
      botoes(document.getElementById("chao-escopo"), [{ v: "PROPAGANDA", t: "Só propaganda" }, { v: "TODAS", t: "Todas as despesas" }], st.escopo, (v) => { st.escopo = v; nuvem(); });
      botoes(document.getElementById("chao-medida"), [{ v: "despesas", t: "Por frequência" }, { v: "valor", t: "Por valor" }], st.medida, (v) => { st.medida = v; nuvem(); });
      nuvem();
      let cats;
      try { cats = (await resposta(`/api/q9/categorias?${qs({ cargo: st.cargo, uf: st.uf })}`)).dados; } catch { cats = []; }
      const doAno = cats.filter((c) => c.ano === st.ano);
      const total = doAno.reduce((s, c) => s + c.valor, 0);
      const grupos = Object.values(doAno.reduce((m, c) => { (m[c.grupo] ??= { grupo: c.grupo, prop: c.propaganda, v: 0 }).v += c.valor; return m; }, {})).sort((a, b) => b.v - a.v);
      const prop = grupos.filter((g) => g.prop).reduce((s, g) => s + g.v, 0);
      const canalTop = grupos.find((g) => g.prop);
      document.getElementById("chao-ano-t").textContent = `Para onde foi o dinheiro em ${st.ano}`;
      const max = grupos[0]?.v || 1;
      document.getElementById("chao-grupos").innerHTML = total ? `<p class="muted" style="margin-top:.25rem;font-size:var(--step-small);color:#c4c9d2">${pct((100 * prop) / total)} foi propaganda; o canal que mais recebeu foi ${canalTop ? canalTop.grupo.toLowerCase() : "—"}, com ${canalTop ? pct((100 * canalTop.v) / prop) : "—"} da propaganda.</p>
        <div class="grupos">${grupos.map((g) => `<div class="grupo-l"><b>${g.grupo}${g.prop ? "" : ' <small style="color:#9aa1ad">· não é propaganda</small>'}</b><span>${pct((100 * g.v) / total)} · ${curto(g.v)}</span><i style="--w:${((g.v / max) * 100).toFixed(1)}%;background:${corGrupo(g.grupo)}"></i></div>`).join("")}</div>`
        : `<p class="muted">Sem despesas para essa combinação.</p>`;

      let todos;
      try { todos = (await resposta(`/api/q9/categorias?${qs({ cargo: "TODOS", uf: st.uf })}`)).dados; } catch { todos = []; }
      const anos = [...new Set(todos.map((c) => c.ano))].sort();
      const canais = Object.keys(CANAL);
      document.getElementById("chao-evol-sub").textContent = `Parte de cada canal no gasto com propaganda, todos os cargos, ${ondeTxt()}. Os anos alternam eleição geral e municipal.`;
      document.getElementById("chao-evol").innerHTML = `<div class="evol">${anos.map((a) => {
        const ls = todos.filter((c) => c.ano === a && c.propaganda);
        const t = ls.reduce((s, c) => s + c.valor, 0) || 1;
        return `<div class="evol__linha"><span>${a}</span><div class="evol__trilho">${canais.map((k) => {
          const w = (100 * ls.filter((c) => c.grupo === k).reduce((s, c) => s + c.valor, 0)) / t;
          return w > 0 ? `<i style="width:${w}%;background:${CANAL[k]}" title="${k}: ${pct(w)}">${w >= 8 ? pct(w, 0) : ""}</i>` : "";
        }).join("")}</div></div>`;
      }).join("")}</div><p class="comp__chave">${canais.map((k) => `<span><i style="background:${CANAL[k]}"></i>${k}</span>`).join("")}</p>`;
    }
    let pedidoNuvem = 0;
    async function nuvem() {
      const meu = ++pedidoNuvem;
      document.querySelectorAll("#chao-escopo button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === st.escopo)));
      document.querySelectorAll("#chao-medida button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === st.medida)));
      const el = document.getElementById("chao-nuvem");
      let ps;
      try { ps = (await resposta(`/api/q9/palavras?${qs({ ano: st.ano, cargo: st.cargo, escopo: st.escopo, uf: st.uf })}`)).dados; } catch { ps = []; }
      if (meu !== pedidoNuvem) return;
      const ord = [...ps].sort((a, b) => b[st.medida] - a[st.medida]).slice(0, 48);
      const rank = new Map(ord.map((p, i) => [p.palavra, i]));
      el.setAttribute("aria-label", `As ${ord.length} palavras mais ${st.medida === "despesas" ? "frequentes" : "caras"} nas despesas de ${CARGO[st.cargo]} em ${st.ano}`);
      el.innerHTML = ord.length ? [...ord].sort((a, b) => hashOrdem(a.palavra) - hashOrdem(b.palavra)).map((p) => {
        const i = rank.get(p.palavra);
        return `<span class="${i < 6 ? "w3" : i < 18 ? "w2" : "w1"}${i < 10 ? " forte" : ""}" title="${esc(acentua(p.palavra))}: ${nf(0).format(p.despesas)} despesas, ${curto(p.valor)}">${esc(acentua(p.palavra))}</span>`;
      }).join(" ") : `<span class="w1">Sem descrições para essa combinação.</span>`;
    }

    let pedido = 0;
    async function tudo() {
      const meu = ++pedido;
      filtros();
      await Promise.all([q2(), q8(), q9()].map((p) => p.catch((e) => console.error(e))));
      if (meu !== pedido) return;
    }
    let largura = document.getElementById("morro-curva").clientWidth;
    new ResizeObserver(() => { const w = document.getElementById("morro-curva").clientWidth; if (Math.abs(w - largura) > 40) { largura = w; q8(); } }).observe(document.getElementById("morro-curva"));
    tudo();
  })();
})();
