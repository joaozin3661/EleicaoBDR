/* Chave de cada consulta da API e o "shard" (dados/<xx>.json) em que a resposta gravada fica.
   Fonte única: o navegador carrega este arquivo antes do dados.js, e o gravador (api/exportacao/grava.ts) importa
   o mesmo arquivo, então os dois lados sempre calculam o mesmo nome. */
(() => {
  function normaliza(url) {
    const u = new URL(url, "http://x");
    const p = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("&");
    return u.pathname + (p ? `?${p}` : "");
  }
  /** 256 arquivos no máximo: o navegador baixa só o shard da consulta, e o site fica com poucos arquivos para hospedar. */
  function shard(chave) {
    let h = 5381;
    for (const c of chave) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    return (h % 256).toString(16).padStart(2, "0"); // taste-skill-ignore: nome do shard
  }
  globalThis.Chave = { normaliza, shard };
})();
