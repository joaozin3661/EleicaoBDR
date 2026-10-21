/**
 * Versão estática do site (npm run build:estatico): em vez de chamar a API, lê as respostas gravadas por
 * scripts/estatico.ts em dados/*.json. As buscas por texto (Q1 município e Q10) rodam no navegador sobre um índice gravado.
 */
import { normaliza, shard } from "./chave";
import type { Resposta } from "./api";

export const ESTATICO = import.meta.env.VITE_ESTATICO === "1";
const BASE = import.meta.env.BASE_URL;

const cache = new Map<string, Promise<any>>();
function arquivo<T>(nome: string): Promise<T> {
  let p = cache.get(nome);
  if (!p) {
    p = fetch(`${BASE}dados/${nome}`).then((r) => {
      if (!r.ok) throw new Error(`Arquivo ${nome} não encontrado na versão estática.`);
      return r.json();
    });
    p.catch(() => cache.delete(nome));
    cache.set(nome, p);
  }
  return p;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

type Mun = { municipio_busca: string; municipio: string; uf: string; ano: number };
type Indice = { achado: { id_pessoa: number; candidaturas: number; nome: string }; nomes: string[] };

export async function respostaEstatica(url: string): Promise<Resposta<any>> {
  const u = new URL(url, "http://x");

  if (u.pathname === "/api/q1/municipio") {
    const cargo = u.searchParams.get("cargo") === "PREFEITO" ? "PREFEITO" : "VEREADOR";
    const nome = (u.searchParams.get("nome") ?? "").trim();
    const f = await arquivo<{ sql: string; linhas: Mun[] }>(`q1_municipio_${cargo}.json`);
    const q = semAcento(nome);
    const linhas = f.linhas
      .filter((l) => l.municipio_busca.includes(q))
      .sort((a, b) => a.municipio.localeCompare(b.municipio) || a.uf.localeCompare(b.uf) || a.ano - b.ano)
      .map(({ municipio_busca: _, ...resto }) => resto);
    return { sql: f.sql.replaceAll("{{nome}}", nome.replace(/'/g, "''")), dados: linhas };
  }

  if (u.pathname === "/api/q10/busca") {
    const f = await arquivo<{ sql: string; indice: Indice[] }>("q10_indice.json");
    const palavras = (u.searchParams.get("nome") ?? "").trim().split(/\s+/).filter((p) => p.length >= 2).slice(0, 6).map(semAcento);
    const achados = palavras.length
      ? f.indice
          .filter((i) => i.nomes.some((n) => palavras.every((p) => n.includes(p))))
          .map((i) => i.achado)
          .sort((a, b) => b.candidaturas - a.candidaturas || a.nome.localeCompare(b.nome))
          .slice(0, 100)
      : [];
    return { sql: f.sql.replaceAll("{{nome}}", palavras.length ? (u.searchParams.get("nome") ?? "").trim().replace(/'/g, "''") : ""), dados: achados };
  }

  const chave = normaliza(url);
  const bloco = await arquivo<Record<string, Resposta<any>>>(`${shard(chave)}.json`);
  const r = bloco[chave];
  if (!r) throw new Error("Esta combinação de filtros não foi gravada na versão estática.");
  return r;
}
