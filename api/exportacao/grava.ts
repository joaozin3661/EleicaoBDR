/**
 * npm run grava: grava em frontend/dados/ tudo que o site precisa para funcionar sem o banco
 * (python -m http.server, GitHub Pages). Precisa do banco ligado; a API sobe aqui mesmo, numa porta livre.
 *
 * 1. Percorre todas as combinações de filtros que o site oferece e chama a própria API, então o SQL mostrado
 *    na tela é exatamente o que rodou. As respostas vão para os shards dados/<xx>.json (ver frontend/js/chave.js).
 * 2. As buscas por texto (Q1 município e Q10) vão em arquivos próprios: q1_municipio_<cargo>.json e q10_indice.json.
 * 3. Roda os scripts em Python que gravam dados/site/ (hemiciclo, mapa e carreiras).
 *
 * Só troca os arquivos que ele mesmo grava; dados/modo.json e as fotos não são tocados. Não grava /api/exemplo,
 * que traz título e CPF: a tela de identidade mostra esses casos só com a API ligada.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { inicia } from "../rotas";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
await import(pathToFileURL(path.join(RAIZ, "frontend", "js", "chave.js")).href); // define globalThis.Chave, o mesmo hash do navegador
const { normaliza, shard } = (globalThis as unknown as { Chave: { normaliza(u: string): string; shard(k: string): string } }).Chave;

const SAIDA = path.join(RAIZ, "frontend", "dados");
const N_PESSOAS = 2500;
const PALAVRAS_MAX = 100;
/** Pessoas dos casos de identidade (tela Qualidade): entram na busca da Q10 mesmo fora das N_PESSOAS. */
const TITULOS_CASOS = ["037697100620", "000217462143", "058842961392"];
/** Políticos com poucas candidaturas que a busca da Q10 precisa achar, pelo nome (o id_pessoa muda a cada carga). */
const Q10_EXTRAS = ["SERGIO FERNANDO MORO", "FERNANDO AFFONSO COLLOR DE MELLO"];
/** Os arquivos que este script grava (e apaga antes de gravar de novo). */
const NOSSOS = /^([0-9a-f]{2}\.json|q1_municipio_.+\.json|q10_indice\.json)$/;
const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const SCRIPTS_PY = ["exporta_cadeiras.py", "exporta_mapa.py", "exporta_carreira.py", "exporta_extra.py"];

type Resp = { sql: string; dados: any };
const blocos = new Map<string, Record<string, Resp>>();
const arquivos = new Map<string, string>();
let falhas = 0;
let gravadas = 0;

const { servidor, porta, pool } = await inicia(0);
/** As UFs do banco (27 no banco completo) e TODAS, a soma delas. */
const UFS = ["TODAS", ...(await pool.query("SELECT DISTINCT sg_uf FROM candidatura WHERE sg_uf <> 'BR' ORDER BY 1")).rows.map((r: { sg_uf: string }) => r.sg_uf)];
console.log(`Banco ${process.env.PGDATABASE ?? ""}: ${UFS.length - 1} UFs`);
const API = `http://localhost:${porta}`;

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

async function respostas() {
  const urls: string[] = [];

  // ---- telas sem filtro
  for (const u of ["/api/resumo", "/api/qualidade", "/api/q1/custo-cadeira"]) await grava(u);

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
  for (const [ano, cargos] of [[2018, ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"]], [2020, ["VEREADOR"]], [2022, ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"]], [2024, ["VEREADOR"]], [2026, ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"]]] as const)
    for (const cargo of cargos) for (const uf of UFS) urls.push(`/api/q5?${qs({ ano, cargo, uf })}`);

  // ---- Q6: cargo x uf
  for (const cargo of ["PREFEITO", "VEREADOR"]) for (const uf of UFS) urls.push(`/api/q6?${qs({ cargo, uf })}`);

  // ---- Q7: Brasil, regiões e UFs de uma vez; os municípios de cada UF em cada ano, para o mapa
  const q7 = await grava("/api/q7");
  const anosQ7 = [...new Set<number>((q7?.dados.territorios ?? []).map((t: { ano: number }) => t.ano))];
  for (const ano of anosQ7) for (const uf of UFS) if (uf !== "TODAS") urls.push(`/api/q7/municipios?${qs({ ano, uf })}`);
  // 2º turno: os territórios de uma vez; os municípios de cada UF em cada ano e cargo que teve 2º turno
  const q7t2 = await grava("/api/q7/turno2");
  for (const t of (q7t2?.dados ?? []) as { ano: number; cargo: string; escopo: string; territorio: string }[])
    if (t.escopo === "UF") urls.push(`/api/q7/turno2/municipios?${qs({ ano: t.ano, cargo: t.cargo, uf: t.territorio })}`);

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
}

async function buscas() {
  // ---- Q1 por município: a busca roda no navegador sobre a lista inteira
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
    arquivos.set(`q1_municipio_${cargo}.json`, JSON.stringify({ sql, linhas: q.rows }));
    console.log(`Q1 município (${cargo}): ${q.rowCount} linhas`);
  }

  // ---- Q10: os N políticos com mais candidaturas, as pessoas dos casos de identidade, os extras e quem já se
  //      candidatou a presidente ou se elegeu governador, senador ou deputado federal (os nomes que o leitor mais procura)
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
   OR id_pessoa IN (SELECT id_pessoa FROM candidatura WHERE titulo_declarado = ANY($1))
   OR id_pessoa IN (SELECT id_pessoa FROM pessoa WHERE nome = ANY($2))
   OR id_pessoa IN (SELECT id_pessoa FROM candidatura WHERE cargo = 'PRESIDENTE'
                    OR cargo IN ('GOVERNADOR', 'SENADOR', 'DEPUTADO FEDERAL') AND situacao_resultado LIKE 'ELEITO%')`,
    [TITULOS_CASOS, Q10_EXTRAS],
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
  arquivos.set(
    "q10_indice.json",
    JSON.stringify({
      sql: modelo?.sql ?? "",
      indice: top.rows.map((achado) => ({ achado, nomes: porId.get(achado.id_pessoa) ?? [] })),
    }),
  );
  console.log(`Q10: ${top.rows.length} políticos no índice`);
  await emParalelo([...ids], 8, (id) => grava(`/api/q10/pessoa/${id}`));
}

function escreve() {
  for (const f of fs.readdirSync(SAIDA)) if (NOSSOS.test(f)) fs.rmSync(path.join(SAIDA, f));
  for (const [s, conteudo] of blocos) arquivos.set(`${s}.json`, JSON.stringify(conteudo));
  let bytes = 0;
  for (const [nome, conteudo] of arquivos) {
    fs.writeFileSync(path.join(SAIDA, nome), conteudo);
    bytes += Buffer.byteLength(conteudo);
  }
  return bytes;
}

const t0 = Date.now();
try {
  await respostas();
  await buscas();
} finally {
  servidor.close();
  await pool.end();
}
if (falhas) {
  console.error(`\n${falhas} consultas falharam; nada foi gravado.`);
  process.exit(1);
}
const bytes = escreve();
console.log(
  `\nGravadas ${gravadas} respostas em ${blocos.size} shards (${(bytes / 1e6).toFixed(1)} MB no total), ${((Date.now() - t0) / 1000).toFixed(0)} s.`,
);

// ---- dados/site/: hemiciclo, mapa e carreiras (a carreira usa o q10_indice.json recém-gravado)
for (const script of SCRIPTS_PY) {
  console.log(`\n${script}`);
  const r = spawnSync(PYTHON, [path.join(import.meta.dirname, script)], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`${script} falhou${r.error ? `: ${r.error.message}` : ""}. Os shards já foram gravados; rode o script de novo à mão.`);
    process.exit(1);
  }
}
