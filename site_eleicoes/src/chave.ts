/**
 * Chave de uma consulta da API, usada na versão estática: o gerador (scripts/estatico.ts) grava cada resposta
 * dentro de um "shard" e o navegador procura a mesma chave. Os dois lados importam este arquivo.
 */
export function normaliza(url: string): string {
  const u = new URL(url, "http://x");
  const p = [...u.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return u.pathname + (p ? `?${p}` : "");
}

/** 256 arquivos no máximo: o navegador baixa só o shard da consulta, e o site fica com poucos arquivos para hospedar. */
export function shard(chave: string): string {
  let h = 5381;
  for (const c of chave) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return (h % 256).toString(16).padStart(2, "0");
}
