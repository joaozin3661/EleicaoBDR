/* De onde vêm as respostas das perguntas. Servido pela API (npm start em api/), o site pergunta ao banco ao vivo;
   aberto sem ela (python -m http.server, GitHub Pages), lê as respostas gravadas em dados/<shard>.json pelo
   api/exportacao/grava.ts. Quem decide é dados/modo.json: o arquivo gravado diz { aoVivo: false } e a API responde true.
   Nos dois casos a resposta é { sql, dados }: o SQL executado nas views e as linhas. Precisa do chave.js antes. */
(() => {
  const { normaliza, shard } = window.Chave;
  const cache = new Map();
  function arquivo(nome) {
    if (!cache.has(nome)) {
      const p = fetch(`dados/${nome}`).then((r) => { if (!r.ok) throw new Error(nome); return r.json(); });
      p.catch(() => cache.delete(nome));
      cache.set(nome, p);
    }
    return cache.get(nome);
  }
  const aoVivo = arquivo("modo.json").then((m) => m.aoVivo === true, () => false);

  async function daApi(url) {
    const r = await fetch(url);
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(corpo.erro || `A API respondeu ${r.status}.`);
    return corpo;
  }
  async function gravada(url) {
    const k = normaliza(url);
    const bloco = await arquivo(`${shard(k)}.json`);
    if (!bloco[k]) throw new Error("Esta combinação de filtros não foi gravada.");
    return bloco[k];
  }
  /** Resposta completa: { sql, dados }. */
  async function resposta(url) {
    return (await aoVivo) ? daApi(url) : gravada(url);
  }
  const qs = (p) => new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)])).toString();
  window.Dados = { resposta, arquivo, qs, aoVivo };
})();
