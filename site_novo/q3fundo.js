/* Q3 a fundo: desenvolvimento do município (IDHM e PIB per capita de 2010) contra o comportamento do eleitor
   na eleição para prefeito de 2008 e 2012.
   Pontos: vw_site_municipio (dados/site/municipios.json). Correlações: mv_q3_correlacao, geral e por estado.
   Partidos por faixa: mv_q3_partidos. Faixas nos dois anos: mv_q3_grupos. As votações anuladas pelo TSE ficam
   fora das medidas de voto, como na pergunta 3; a razão eleitores/habitantes usa todos os municípios. */

(async () => {
  const elDisp = document.getElementById("fundo-disp");
  if (!elDisp) return;
  const { resposta, arquivo, qs } = window.Dados;
  const H = window.Hemiciclo;
  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const nomeMun = (s) => String(s ?? "").replace(/(?<=\s)(Do|Da|De|Dos|Das|E)(?=\s)/g, (p) => p.toLowerCase());
  const corr = (v) => (v == null ? "—" : nf(2).format(Math.abs(v) < 0.005 ? 0 : v));
  const NOME_UF = { AL: "Alagoas", PA: "Pará", PB: "Paraíba", PR: "Paraná", SC: "Santa Catarina", SE: "Sergipe" };
  const REGIAO = { PA: "Norte", PB: "Nordeste", AL: "Nordeste", SE: "Nordeste", PR: "Sul", SC: "Sul" };
  const COR = { Norte: "#1f8a6a", Nordeste: "#e0701c", Sul: "#1f2de6" }; // validada (dataviz, todos os pares)

  const MEDIDAS = {
    nulos: { rot: "Nulos", campo: "nulos", view: "pct_nulos", voto: true, eixo: "votos nulos, % dos aptos" },
    abstencao: { rot: "Abstenção", campo: "abstencao", view: "pct_abstencao", voto: true, eixo: "abstenção, % dos aptos" },
    brancos: { rot: "Brancos", campo: "brancos", view: "pct_brancos", voto: true, eixo: "votos brancos, % dos aptos" },
    isentos: { rot: "Isentos", campo: "isentos", view: "pct_isentos", voto: true, eixo: "isentos (abstenção, brancos e nulos), % dos aptos" },
    eleitores: { rot: "Eleitores por habitante", campo: "eleitores_pop", view: "pct_eleitores_pop", voto: false, eixo: "eleitores aptos por 100 habitantes" },
  };
  const INDICES = {
    IDHM: { rot: "IDHM", x: (m) => m.idhm, fmt: (v) => nf(3).format(v), eixo: "IDHM (2010)" },
    PIB: { rot: "PIB per capita", x: (m) => (m.pib_per_capita > 0 ? Math.log(m.pib_per_capita) : null), fmt: (v) => `R$ ${nf(0).format(Math.exp(v))}`, eixo: "PIB per capita em 2010, escala logarítmica" },
  };
  const FAIXAS = { IDHM: ["", "IDHM muito baixo", "IDHM baixo", "IDHM médio", "IDHM alto", "IDHM muito alto"], PIB: ["", "Quarto mais pobre", "Segundo quarto", "Terceiro quarto", "Quarto mais rico"] };

  const base = await arquivo("site/municipios.json");
  const MUN = base.linhas.map((l) => Object.fromEntries(base.colunas.map((c, i) => [c, l[i]])));
  const st = { indice: "IDHM", medida: "nulos", ano: 2008, retas: "geral" };

  function botoes(id, itens, ativo, fn) {
    const el = document.getElementById(id);
    el.innerHTML = itens.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(ativo)}">${t}</button>`).join("");
    el.onclick = (e) => { const b = e.target.closest("[data-v]"); if (b) fn(b.dataset.v); };
  }
  function controles() {
    botoes("fundo-indice", Object.entries(INDICES).map(([k, v]) => [k, v.rot]), st.indice, (v) => { st.indice = v; tudo(); });
    botoes("fundo-medida", Object.entries(MEDIDAS).map(([k, v]) => [k, v.rot]), st.medida, (v) => { st.medida = v; tudo(); });
    botoes("fundo-ano", [[2008, "2008"], [2012, "2012"]], st.ano, (v) => { st.ano = Number(v); tudo(); });
    botoes("fundo-retas", [["geral", "Uma para todos"], ["estado", "Uma por estado"]], st.retas, (v) => { st.retas = v; dispersao(); });
  }

  /* pontos da seleção atual */
  function pontos() {
    const md = MEDIDAS[st.medida], ix = INDICES[st.indice];
    return MUN.map((m) => {
      if (md.voto && m[`anulada_${st.ano}`]) return null;
      const x = ix.x(m), y = m[`${md.campo}_${st.ano}`];
      return x == null || y == null ? null : { m, x, y };
    }).filter(Boolean);
  }
  function ajuste(ps) {
    const n = ps.length;
    if (n < 3) return null;
    const mx = ps.reduce((s, p) => s + p.x, 0) / n, my = ps.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of ps) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
    const b = sxy / sxx;
    return { a: my - b * mx, b, x0: Math.min(...ps.map((p) => p.x)), x1: Math.max(...ps.map((p) => p.x)) };
  }
  const passoBonito = (bruto) => { const p = 10 ** Math.floor(Math.log10(bruto)); return [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= bruto); };

  /* ----- a dispersão ----- */
  const dica = document.getElementById("fundo-dica");
  let geo = null;
  function dispersao() {
    controles();
    const md = MEDIDAS[st.medida], ix = INDICES[st.indice];
    const ps = pontos();
    const W = Math.max(480, elDisp.clientWidth), Hh = Math.round(W * 0.6);
    const esq = 52, dir = st.retas === "estado" ? 44 : 16, cima = 14, baixo = 46;
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y).sort((a, b) => a - b);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ymax = ys[ys.length - 1];
    const passoY = passoBonito(ymax / 5);
    const ytopo = Math.ceil(ymax / passoY) * passoY;
    const X = (v) => esq + ((v - xmin) / (xmax - xmin)) * (W - esq - dir);
    const Y = (v) => cima + (1 - v / ytopo) * (Hh - cima - baixo);
    let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Dispersão: ${ix.rot} contra ${md.rot.toLowerCase()}, ${ps.length} municípios">`;
    for (let v = 0; v <= ytopo + 1e-9; v += passoY) s += `<line x1="${esq}" x2="${W - dir}" y1="${Y(v)}" y2="${Y(v)}" stroke="#cfd3da" stroke-width="1"/><text x="${esq - 8}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle" font-size="13" fill="var(--muted)">${nf(passoY < 1 ? 1 : 0).format(v)}</text>`;
    const tx = st.indice === "IDHM"
      ? [0.4, 0.5, 0.6, 0.7, 0.8, 0.9].filter((v) => v >= xmin - 0.02 && v <= xmax + 0.02).map((v) => [v, nf(1).format(v)])
      : [2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5].map((v) => [Math.log(v), v >= 1e3 ? `R$ ${nf(0).format(v / 1e3)} mil` : v]).filter(([v]) => v >= xmin && v <= xmax);
    for (const [v, t] of tx) s += `<text x="${X(v)}" y="${Hh - baixo + 20}" text-anchor="middle" font-size="13" fill="var(--muted)">${t}</text>`;
    s += `<text x="${(esq + W - dir) / 2}" y="${Hh - 4}" text-anchor="middle" font-size="13" fill="var(--ink)">${ix.eixo}</text>`;
    s += `<text x="${esq}" y="${cima - 2}" font-size="13" fill="var(--ink)" dy="-2">${md.eixo}</text>`;
    if (!md.voto) s += `<line x1="${esq}" x2="${W - dir}" y1="${Y(100)}" y2="${Y(100)}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="4 4"/><text x="${W - dir}" y="${Y(100) - 6}" text-anchor="end" font-size="13" fill="var(--ink)">mais eleitores que moradores</text>`;
    const ordem = [...ps].sort((a, b) => (a.m.uf === "PA") - (b.m.uf === "PA"));
    s += `<g>${ordem.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.4" fill="${COR[REGIAO[p.m.uf]]}" fill-opacity="0.55"/>`).join("")}</g>`;
    if (st.retas === "geral") {
      const a = ajuste(ps);
      if (a) s += `<line x1="${X(a.x0)}" y1="${Y(a.a + a.b * a.x0)}" x2="${X(a.x1)}" y2="${Y(a.a + a.b * a.x1)}" stroke="var(--ink)" stroke-width="2.5"/>`;
    } else {
      const rotulos = [];
      for (const uf of Object.keys(NOME_UF)) {
        const a = ajuste(ps.filter((p) => p.m.uf === uf));
        if (!a) continue;
        const c = COR[REGIAO[uf]];
        s += `<line x1="${X(a.x0)}" y1="${Y(a.a + a.b * a.x0)}" x2="${X(a.x1)}" y2="${Y(a.a + a.b * a.x1)}" stroke="#fff" stroke-width="5"/><line x1="${X(a.x0)}" y1="${Y(a.a + a.b * a.x0)}" x2="${X(a.x1)}" y2="${Y(a.a + a.b * a.x1)}" stroke="${c}" stroke-width="2.5"/>`;
        rotulos.push({ uf, c, x: X(a.x1) + 6, y: Y(a.a + a.b * a.x1) });
      }
      /* rótulos na ponta das retas sem se encostarem: empurra para baixo os que ficam a menos de 15px do anterior */
      rotulos.sort((p, q) => p.y - q.y);
      for (let i = 1; i < rotulos.length; i++) if (Math.abs(rotulos[i].x - rotulos[i - 1].x) < 40 && rotulos[i].y - rotulos[i - 1].y < 15) rotulos[i].y = rotulos[i - 1].y + 15;
      for (const r of rotulos) s += `<text x="${r.x}" y="${r.y}" dominant-baseline="middle" font-size="13" font-weight="600" fill="${r.c}" stroke="var(--surface)" stroke-width="3" paint-order="stroke">${r.uf}</text>`;
    }
    s += `<circle id="fundo-foco" r="6.5" fill="none" stroke="var(--ink)" stroke-width="2" opacity="0"/></svg>`;
    elDisp.innerHTML = s;
    geo = { ps, X, Y, W };
    document.getElementById("fundo-chave").innerHTML = Object.entries(COR).map(([r, c]) => `<span><i style="background:${c}"></i>${r} (${Object.keys(REGIAO).filter((u) => REGIAO[u] === r).join(", ")})</span>`).join("");
    const anuladas = md.voto ? MUN.filter((m) => m[`anulada_${st.ano}`]).length : 0;
    document.getElementById("fundo-cap").textContent = `${nf(0).format(ps.length)} municípios, eleição para prefeito de ${st.ano}.${anuladas ? ` ${anuladas} votações anuladas pelo TSE ficam fora, como na pergunta 3.` : ""} ${st.retas === "estado" ? "Cada reta é o ajuste dentro de um estado." : "A reta é o ajuste com todos os municípios."} Toque num ponto para abri-lo no mapa.`;
  }

  function maisPerto(e) {
    if (!geo) return null;
    const svg = elDisp.querySelector("svg");
    const r = svg.getBoundingClientRect();
    const k = geo.W / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    let melhor = null, d2 = 144;
    for (const p of geo.ps) {
      const dx = geo.X(p.x) - px, dy = geo.Y(p.y) - py, d = dx * dx + dy * dy;
      if (d < d2) { d2 = d; melhor = p; }
    }
    return melhor;
  }
  elDisp.addEventListener("pointermove", (e) => {
    const p = maisPerto(e);
    const foco = document.getElementById("fundo-foco");
    if (!p) { dica.hidden = true; foco?.setAttribute("opacity", 0); return; }
    const md = MEDIDAS[st.medida], ix = INDICES[st.indice];
    foco.setAttribute("cx", geo.X(p.x)); foco.setAttribute("cy", geo.Y(p.y)); foco.setAttribute("opacity", 1);
    dica.innerHTML = `<b>${esc(nomeMun(p.m.nome))} (${p.m.uf})</b>${ix.rot}: ${ix.fmt(p.x)} · ${md.rot}: ${nf(1).format(p.y)}${md.voto ? "%" : " por 100 habitantes"}`;
    dica.hidden = false;
    const caixa = elDisp.parentElement.getBoundingClientRect();
    dica.style.left = `${Math.min(e.clientX - caixa.left + 14, caixa.width - dica.offsetWidth - 8)}px`;
    dica.style.top = `${Math.max(8, e.clientY - caixa.top - dica.offsetHeight - 12)}px`;
  });
  elDisp.addEventListener("pointerleave", () => { dica.hidden = true; document.getElementById("fundo-foco")?.setAttribute("opacity", 0); });
  elDisp.addEventListener("click", (e) => {
    const p = maisPerto(e);
    if (!p) return;
    /* a camada do mapa mais próxima do que está no gráfico: o mapa tem nulos de 2008 e isentos de 2008 e 2012 */
    const medida = st.medida === "nulos" && st.ano === 2008 ? "nulos_2008" : MEDIDAS[st.medida].voto ? `isentos_${st.ano}` : st.indice === "PIB" ? "pib_per_capita" : "idhm";
    document.dispatchEvent(new CustomEvent("abre-municipio", { detail: { cod: p.m.cod_ibge, camada: "q3", medida } }));
  });

  /* ----- correlações (da view) ----- */
  async function correlacoes() {
    const md = MEDIDAS[st.medida];
    const ufs = ["TODAS", ...Object.keys(NOME_UF)];
    const rs = await Promise.all(ufs.map((uf) => resposta(`/api/q3?${qs({ ano: st.ano, dim: st.indice, cargo: "PREFEITO", uf })}`).then((r) => ({ uf, r: r.dados })).catch(() => ({ uf, r: null }))));
    const linha = (x) => x.r?.correlacao.find((c) => c.medida === md.view);
    const geral = linha(rs[0]);
    const est = rs.slice(1).map((x) => ({ uf: x.uf, c: linha(x) })).filter((x) => x.c);
    document.getElementById("fundo-num").textContent = corr(geral?.correlacao);
    const forca = (r) => { const a = Math.abs(r); return a < 0.1 ? "praticamente nenhuma" : a < 0.3 ? "fraca" : a < 0.5 ? "moderada" : "forte"; };
    const lo = Math.min(...est.map((x) => x.c.correlacao)), hi = Math.max(...est.map((x) => x.c.correlacao));
    const ixRot = INDICES[st.indice].rot, mdRot = md.rot.toLowerCase();
    let leitura = "";
    if (geral) {
      const g = geral.correlacao;
      const media = est.reduce((s, x) => s + x.c.correlacao, 0) / (est.length || 1);
      const extremo = [...est].sort((a, b) => Math.abs(b.c.correlacao) - Math.abs(a.c.correlacao))[0];
      if (Math.abs(g) < 0.1) {
        leitura = `Nos seis estados juntos (${nf(0).format(geral.municipios)} municípios), praticamente não há relação entre o ${ixRot} e ${{ nulos: "os votos nulos", abstencao: "a abstenção", brancos: "os votos brancos", isentos: "os isentos", eleitores: "o número de eleitores por habitante" }[st.medida]}.`;
        if (extremo && Math.abs(extremo.c.correlacao) >= 0.3) leitura += ` Mas dentro de alguns estados ela aparece: ${corr(extremo.c.correlacao)} ${{ AL: "em Alagoas", PA: "no Pará", PB: "na Paraíba", PR: "no Paraná", SC: "em Santa Catarina", SE: "em Sergipe" }[extremo.uf]}.`;
        else if (Math.abs(media) >= 0.1) leitura += ` Dentro dos estados, porém, a correlação média é ${corr(media)}: a diferença entre os estados esconde uma relação ${media < 0 ? "negativa" : "positiva"} dentro deles.`;
      } else {
        leitura = `Correlação ${forca(g)} nos seis estados juntos (${nf(0).format(geral.municipios)} municípios): quanto maior o ${ixRot}, ${g < 0 ? "menos" : "mais"} ${mdRot}. Dentro de cada estado, ela fica entre ${corr(lo)} e ${corr(hi)}, com média de ${corr(media)}.`;
        if (Math.sign(media) !== Math.sign(g) && Math.abs(media) >= 0.05) leitura += " Dentro dos estados o sinal se inverte: a relação geral vem da diferença entre os estados, um caso do paradoxo de Simpson.";
        else if (Math.abs(media) < 0.5 * Math.abs(g)) leitura += " Dentro dos estados ela fica bem mais fraca: a maior parte da relação vem da diferença entre os estados, não entre as cidades de um mesmo estado.";
        else leitura += " A relação se mantém dentro dos estados.";
      }
    }
    document.getElementById("fundo-leg").textContent = leitura;
    const barra = (r) => `<div class="fundo__barra"><i style="${r < 0 ? `right:50%;width:${Math.abs(r) * 50}%` : `left:50%;width:${r * 50}%`}"></i></div>`;
    document.getElementById("fundo-tab").innerHTML = `<tbody>${geral ? `<tr class="geral"><td>Seis estados</td><td>${barra(geral.correlacao)}</td><td>${corr(geral.correlacao)}</td></tr>` : ""}${[...est].sort((a, b) => a.c.correlacao - b.c.correlacao).map((x) => `<tr><td>${NOME_UF[x.uf]}</td><td>${barra(x.c.correlacao)}</td><td>${corr(x.c.correlacao)}</td></tr>`).join("")}</tbody>`;
    document.getElementById("fundo-nota").textContent = `Correlação de Pearson calculada na view mv_q3_correlacao${st.indice === "PIB" ? ", com o logaritmo do PIB per capita" : ""}. Barra à esquerda do centro: relação negativa.`;
    return rs[0].r;
  }

  /* ----- partidos por faixa, 2008 × 2012, mais eleitores que moradores ----- */
  async function paineis(todas) {
    const nomes = FAIXAS[st.indice];
    const grupos = (todas?.grupos ?? []).filter((g) => g.grupo_ordem > 0 && g.municipios > 0).sort((a, b) => a.grupo_ordem - b.grupo_ordem);
    document.getElementById("fundo-partidos-sub").textContent = `Partido dos prefeitos eleitos em ${st.ano}, por ${st.indice === "IDHM" ? "faixa de IDHM" : "quarto de PIB per capita"}. Os cinco maiores de cada grupo.`;
    document.getElementById("fundo-partidos").innerHTML = `<div class="pilha-p">${grupos.map((g) => {
      const ps = (todas.partidos ?? []).filter((p) => p.grupo_ordem === g.grupo_ordem).sort((a, b) => a.posicao - b.posicao);
      const top = ps.slice(0, 5);
      const resto = Math.max(0, 100 - top.reduce((s, p) => s + p.pct_do_grupo, 0));
      return `<div class="pilha-p__linha"><span>${nomes[g.grupo_ordem]} <small>${nf(0).format(g.municipios)} municípios</small></span><div class="pilha-p__trilho">${top.map((p) => `<i style="width:${p.pct_do_grupo}%;background:${H.cor(p.partido)}" title="${esc(p.partido)}: ${nf(0).format(p.pct_do_grupo)}% dos prefeitos">${p.pct_do_grupo >= 11 ? esc(p.partido) : ""}</i>`).join("")}${resto > 0.5 ? `<i class="outros" style="width:${resto}%" title="Outros: ${nf(0).format(resto)}%">${resto >= 14 ? "outros" : ""}</i>` : ""}</div></div>`;
    }).join("")}</div>${(() => {
      const usados = [...new Set(grupos.flatMap((g) => (todas.partidos ?? []).filter((p) => p.grupo_ordem === g.grupo_ordem).sort((a, b) => a.posicao - b.posicao).slice(0, 5).map((p) => p.partido)))];
      return `<p class="fundo__chave" style="margin-top:1rem;font-size:var(--step-small)">${usados.map((p) => `<span><i style="background:${H.cor(p)};border-radius:2px"></i>${esc(p)}</span>`).join("")}<span><i style="background:#b4bac4;border-radius:2px"></i>outros</span></p>`;
    })()}`;

    /* de 2008 para 2012, por grupo */
    const md = MEDIDAS[st.medida];
    try {
      const [g08, g12] = await Promise.all([2008, 2012].map((ano) => resposta(`/api/q3?${qs({ ano, dim: st.indice, cargo: "PREFEITO", uf: "TODAS" })}`).then((r) => r.dados.grupos)));
      const linhas = g08.filter((g) => g.grupo_ordem > 0).sort((a, b) => a.grupo_ordem - b.grupo_ordem).map((a) => ({ g: a.grupo_ordem, a: a[md.view], b: g12.find((x) => x.grupo_ordem === a.grupo_ordem)?.[md.view] })).filter((l) => l.a != null && l.b != null);
      const max = Math.max(...linhas.flatMap((l) => [l.a, l.b])) * 1.1;
      document.getElementById("fundo-mudou-sub").textContent = `${md.voto ? md.eixo[0].toUpperCase() + md.eixo.slice(1) : "Eleitores aptos por 100 habitantes"} em cada grupo, somados os municípios.`;
      document.getElementById("fundo-mudou").innerHTML = `<div class="halter">${linhas.map((l) => {
        const xa = (l.a / max) * 100, xb = (l.b / max) * 100;
        return `<div class="halter__linha"><span>${nomes[l.g]}</span><div class="halter__trilho"><b style="left:${Math.min(xa, xb)}%;width:${Math.abs(xb - xa)}%"></b><i class="a" style="left:${xa}%"></i><i class="b" style="left:${xb}%"></i><em style="left:${xb}%">${nf(1).format(l.b)}</em></div></div>`;
      }).join("")}</div><p class="halter__chave"><span><i style="display:inline-block;width:.75rem;height:.75rem;border-radius:50%;border:2px solid var(--ink)"></i>2008</span><span><i style="display:inline-block;width:.75rem;height:.75rem;border-radius:50%;background:var(--accent)"></i>2012 (valor escrito)</span></p>`;
    } catch {
      document.getElementById("fundo-mudou").innerHTML = "";
    }

    /* mais eleitores que moradores */
    const acima = MUN.filter((m) => m[`eleitores_pop_${st.ano}`] > 100).sort((a, b) => b[`eleitores_pop_${st.ano}`] - a[`eleitores_pop_${st.ano}`]);
    document.getElementById("fundo-mais-sub").textContent = `Em ${st.ano}, ${nf(0).format(acima.length)} municípios tinham mais eleitores aptos do que moradores no Censo de 2010. O cadastro eleitoral guarda quem mudou de cidade e manteve o título, e a população é de dois anos antes.`;
    document.getElementById("fundo-mais").innerHTML = acima.slice(0, 7).map((m) => `<li><span>${esc(nomeMun(m.nome))} <small>${m.uf} · IDHM ${m.idhm == null ? "—" : nf(3).format(m.idhm)}</small></span><span>${nf(1).format(m[`eleitores_pop_${st.ano}`])}</span></li>`).join("");
  }

  let pedido = 0;
  async function tudo() {
    const meu = ++pedido;
    dispersao();
    const todas = await correlacoes();
    if (meu !== pedido) return;
    await paineis(todas);
  }
  let largura = elDisp.clientWidth;
  new ResizeObserver(() => { if (Math.abs(elDisp.clientWidth - largura) > 40) { largura = elDisp.clientWidth; dispersao(); } }).observe(elDisp);
  tudo();
})();
