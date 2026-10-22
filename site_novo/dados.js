/* Leitura das respostas gravadas pela versão estática do site_eleicoes (dados/*.json).
   Cada consulta da API fica num "shard" escolhido pelo hash da URL normalizada (site_eleicoes/src/chave.ts);
   a resposta traz o SQL executado nas views e os dados. */
(() => {
  function normaliza(url) {
    const u = new URL(url, "http://x");
    const p = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("&");
    return u.pathname + (p ? `?${p}` : "");
  }
  function shard(chave) {
    let h = 5381;
    for (const c of chave) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    return (h % 256).toString(16).padStart(2, "0"); // taste-skill-ignore: nome do shard
  }
  const cache = new Map();
  function arquivo(nome) {
    if (!cache.has(nome)) {
      const p = fetch(`dados/${nome}`).then((r) => { if (!r.ok) throw new Error(nome); return r.json(); });
      p.catch(() => cache.delete(nome));
      cache.set(nome, p);
    }
    return cache.get(nome);
  }
  /** Resposta completa: { sql, dados }. */
  async function resposta(url) {
    const k = normaliza(url);
    const bloco = await arquivo(`${shard(k)}.json`);
    if (!bloco[k]) throw new Error("Esta combinação de filtros não foi gravada.");
    return bloco[k];
  }
  const qs = (p) => new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)])).toString();
  window.Dados = { resposta, arquivo, qs };
})();
