/**
 * Grava as respostas do site em arquivos, para publicar uma versão que não precisa do banco nem da API.
 *
 * Uso (com o banco ligado):
 *   1. npm start                     (API na porta 3001; ou PORT=3002 npm start e API=http://localhost:3002)
 *   2. npm run grava:estatico
 *   3. npm run build:estatico        (gera dist-estatico/, pronto para hospedar)
 *
 * Percorre todas as combinações de filtros que o site oferece e chama a própria API, então o SQL mostrado
 * na tela é exatamente o que rodou. Só as buscas por texto (Q1 município e Q10) usam arquivos próprios.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { normaliza, shard } from "../src/chave";

try {
  process.loadEnvFile();
} catch {
  /* usa variáveis de ambiente */
}
pg.types.setTypeParser(1700, parseFloat);
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
pg.types.setTypeParser(1082, (v) => v);

const API = process.env.API ?? "http://localhost:3001";
const SAIDA = path.resolve(import.meta.dirname, "..", "estatico", "dados");
const UFS = ["TODAS", "AL", "PA", "PB", "PR", "SC", "SE"];
const N_PESSOAS = 2500;
const PALAVRAS_MAX = 100;

type Resp = { sql: string; dados: any };
const blocos = new Map<string, Record<string, Resp>>();
let falhas = 0;
let gravadas = 0;

async function pega(url: string): Promise<Resp | null> {
  const r = await fetch(API + url);
  if (!r.ok) {
    falhas++;
    console.warn(`  falhou (${r.status}): ${url}`);
    return null;
  }
  return (await r.json()) as Resp;
}

function guarda(url: string, resp: Resp) {
  const chave = normaliza(url);
  const s = shard(chave);
  if (!blocos.has(s)) blocos.set(s, {});
  blocos.get(s)![chave] = resp;
  gravadas++;
}

async function grava(url: string): Promise<Resp | null> {
  const r = await pega(url);
  if (r) guarda(url, r);
  return r;
}

/** Executa as tarefas com no máximo n ao mesmo tempo. */
async function emParalelo<T>(itens: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < itens.length) await fn(itens[i++]);
    }),
  );
}

const qs = (p: Record<string, string | number | boolean>) =>
  new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)])).toString();

async function main() {
  fs.rmSync(SAIDA, { recursive: true, force: true });
  fs.mkdirSync(SAIDA, { recursive: true });
  const t0 = Date.now();
  const urls: string[] = [];

  // ---- telas sem filtro
  for (const u of ["/api/resumo", "/api/qualidade", "/api/q1/custo-cadeira"]) await grava(u);

  // ---- exemplos de identidade (Qualidade)
  const fonteQualidade = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "secoes", "Qualidade.tsx"), "utf8");
  for (const m of fonteQualidade.matchAll(/titulo:\s*"(\d{6,})"/g)) urls.push(`/api/exemplo?${qs({ titulo: m[1] })}`);

  // ---- opções (pares ano x cargo) de cada pergunta
  const opcoes: Record<string, { ano: number; cargo: string }[]> = {};
  for (const q of ["q1", "q2", "q4", "q8"]) {
    const r = await grava(`/api/${q}/opcoes`);
    opcoes[q] = r?.dados ?? [];
  }
  const cargosQ9: string[] = (await grava("/api/q9/opcoes"))?.dados ?? [];

  // ---- Q1: eleitos x não eleitos
  for (const { ano, cargo } of opcoes.q1)
    for (const uf of UFS)
      for (const suplentes of [true, false])
        for (const zero of [true, false]) urls.push(`/api/q1/eleitos?${qs({ ano, cargo, uf, suplentes, zero })}`);

  // ---- Q2, Q4, Q8: ano x cargo x uf
  for (const [q, rota] of [["q2", "/api/q2"], ["q4", "/api/q4"], ["q8", "/api/q8"]] as const)
    for (const { ano, cargo } of opcoes[q]) for (const uf of UFS) urls.push(`${rota}?${qs({ ano, cargo, uf })}`);

  // ---- Q3: ano x índice x cargo x uf
  for (const ano of [2008, 2012])
    for (const dim of ["IDHM", "PIB"])
      for (const cargo of ["PREFEITO", "VEREADOR"]) for (const uf of UFS) urls.push(`/api/q3?${qs({ ano, dim, cargo, uf })}`);

  // ---- Q5: eleição x cargo x uf
  for (const [ano, cargos] of [[2018, ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"]], [2020, ["VEREADOR"]], [2022, ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"]], [2024, ["VEREADOR"]]] as const)
    for (const cargo of cargos) for (const uf of UFS) urls.push(`/api/q5?${qs({ ano, cargo, uf })}`);

  // ---- Q6: cargo x uf
  for (const cargo of ["PREFEITO", "VEREADOR"]) for (const uf of UFS) urls.push(`/api/q6?${qs({ cargo, uf })}`);

  console.log(`Consultas fixas: ${urls.length}`);
  await emParalelo(urls, 8, grava);

  // ---- Q9: categorias (todos os anos de uma vez) e nuvem de palavras (por ano)
  const q9: string[] = [];
  for (const cargo of ["TODOS", ...cargosQ9])
    for (const uf of UFS) {
      const r = await grava(`/api/q9/categorias?${qs({ cargo, uf })}`);
      const anos = [...new Set<number>((r?.dados ?? []).map((c: { ano: number }) => c.ano))];
      for (const escopo of ["PROPAGANDA", "TODAS"]) for (const ano of anos) q9.push(`/api/q9/palavras?${qs({ escopo, ano, cargo, uf })}`);
    }
  console.log(`Nuvens de palavras da Q9: ${q9.length}`);
  await emParalelo(q9, 8, async (u) => {
    const r = await pega(u);
    if (r) guarda(u, { ...r, dados: r.dados.slice(0, PALAVRAS_MAX) });
  });

  // ---- buscas por texto: direto no banco, arquivos próprios
  const pool = new pg.Pool({ max: 3 });
  for (const cargo of ["VEREADOR", "PREFEITO"]) {
    const q = await pool.query(
      `SELECT ano, municipio, uf, candidatos, cadeiras, gasto_total, custo_por_cadeira, municipio_busca
FROM mv_q1_custo_municipio WHERE cargo = $1`,
      [cargo],
    );
    const sql = `SELECT ano, municipio, uf, candidatos, cadeiras, gasto_total, custo_por_cadeira
FROM mv_q1_custo_municipio
WHERE cargo = '${cargo}' AND municipio_busca LIKE '%' || UPPER(unaccent('{{nome}}')) || '%'
ORDER BY municipio, uf, ano`;
    fs.writeFileSync(path.join(SAIDA, `q1_municipio_${cargo}.json`), JSON.stringify({ sql, linhas: q.rows }));
    console.log(`Q1 município (${cargo}): ${q.rowCount} linhas`);
  }

  // Q10: os N políticos com mais candidaturas + quem a tela abre por padrão e os exemplos da Qualidade
  const top = await pool.query(
    `SELECT id_pessoa, nome, data_nascimento, candidaturas, primeira, ultima, vitorias, cargos
FROM vw_q10_busca ORDER BY candidaturas DESC, vitorias DESC, nome LIMIT $1`,
    [N_PESSOAS],
  );
  const ids = new Set<number>(top.rows.map((r) => r.id_pessoa));
  const extras = await pool.query(
    `SELECT DISTINCT id_pessoa FROM mv_q10_nomes
WHERE nome_busca LIKE '%HELDER%' AND nome_busca LIKE '%BARBALHO%'
   OR nome_busca LIKE '%JESSICA%' AND nome_busca LIKE '%MAGNO%'
   OR id_pessoa IN (SELECT id_pessoa FROM candidatura WHERE titulo_declarado = ANY($1))`,
    [[...fonteQualidade.matchAll(/titulo:\s*"(\d{6,})"/g)].map((m) => m[1])],
  );
  const novos = extras.rows.map((r) => r.id_pessoa).filter((id: number) => !ids.has(id));
  if (novos.length) {
    const a = await pool.query(
      `SELECT id_pessoa, nome, data_nascimento, candidaturas, primeira, ultima, vitorias, cargos FROM vw_q10_busca WHERE id_pessoa = ANY($1)`,
      [novos],
    );
    top.rows.push(...a.rows);
    novos.forEach((id: number) => ids.add(id));
  }
  const nomes = await pool.query(`SELECT id_pessoa, nome_busca FROM mv_q10_nomes WHERE id_pessoa = ANY($1)`, [[...ids]]);
  const porId = new Map<number, string[]>();
  for (const r of nomes.rows) (porId.get(r.id_pessoa) ?? porId.set(r.id_pessoa, []).get(r.id_pessoa)!).push(r.nome_busca);
  const modelo = await pega(`/api/q10/busca?${qs({ nome: "{{nome}}" })}`);
  fs.writeFileSync(
    path.join(SAIDA, "q10_indice.json"),
    JSON.stringify({
      sql: modelo?.sql ?? "",
      indice: top.rows.map((achado) => ({ achado, nomes: porId.get(achado.id_pessoa) ?? [] })),
    }),
  );
  console.log(`Q10: ${top.rows.length} políticos no índice`);
  await pool.end();
  await emParalelo([...ids], 8, (id) => grava(`/api/q10/pessoa/${id}`));

  // ---- escreve os shards
  for (const [s, conteudo] of blocos) fs.writeFileSync(path.join(SAIDA, `${s}.json`), JSON.stringify(conteudo));
  const tamanho = fs.readdirSync(SAIDA).reduce((t, f) => t + fs.statSync(path.join(SAIDA, f)).size, 0);
  console.log(
    `\nGravadas ${gravadas} respostas em ${blocos.size} shards (${(tamanho / 1e6).toFixed(1)} MB no total), ${falhas} falhas, ${((Date.now() - t0) / 1000).toFixed(0)} s.`,
  );
  if (falhas) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
