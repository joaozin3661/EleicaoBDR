/**
 * API do site. É a única parte que fala com o PostgreSQL, e só faz SELECT nas views de views_v2.sql.
 * Cada resposta devolve { sql, dados }: o SQL vai junto para o site poder mostrar o que foi executado.
 */
import express from "express";
import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(); // lê o .env (PGHOST, PGPASSWORD...)
} catch {
  console.warn("Sem arquivo .env: usando variáveis de ambiente.");
}

// numeric e bigint chegam como texto por padrão; aqui viram número. Datas ficam como 'AAAA-MM-DD'.
pg.types.setTypeParser(1700, parseFloat);
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
pg.types.setTypeParser(1082, (v) => v);

const pool = new pg.Pool({ max: 5 }); // lê PGHOST, PGPORT, PGDATABASE, PGUSER e PGPASSWORD
const app = express();

/** Versão do SQL com os parâmetros preenchidos, só para exibir (a execução usa parâmetros de verdade). */
function sqlExibivel(sql: string, params: unknown[]): string {
  const literal = (v: unknown): string => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (Array.isArray(v)) return `ARRAY[${v.map(literal).join(", ")}]`;
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  return sql.replace(/\$(\d+)/g, (_, i) => literal(params[Number(i) - 1])).replace(/\s+\n/g, "\n").trim();
}

async function consulta<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const r = await pool.query(sql, params);
  return { sql: sqlExibivel(sql, params), linhas: r.rows as T[] };
}

/** Embrulha a rota: erro vira JSON com a mensagem do banco. */
const rota =
  (fn: (req: express.Request) => Promise<{ sql: string; dados: unknown }>) =>
  async (req: express.Request, res: express.Response) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      if (e instanceof ErroDeEntrada) {
        res.status(400).json({ erro: e.message });
        return;
      }
      console.error(e);
      res.status(500).json({ erro: e instanceof Error ? e.message : String(e) });
    }
  };

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const inteiro = (v: unknown) => Number.parseInt(String(v), 10);

/** Ano obrigatório e válido; senão a rota responde 400 em vez de mandar NaN ao banco. */
class ErroDeEntrada extends Error {}
function ano(v: unknown) {
  const n = inteiro(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new ErroDeEntrada("Parâmetro 'ano' ausente ou inválido.");
  return n;
}

// ---------------------------------------------------------------- o banco
app.get(
  "/api/resumo",
  rota(async () => {
    const t = await consulta("SELECT tabela, linhas FROM vw_resumo_carga");
    const a = await consulta("SELECT ano, tipo_eleicao, candidaturas, eleitos FROM vw_candidaturas_por_ano ORDER BY ano");
    return { sql: `${t.sql};\n\n${a.sql};`, dados: { tabelas: t.linhas, anos: a.linhas } };
  }),
);

// ---------------------------------------------------------------- qualidade dos dados
app.get(
  "/api/qualidade",
  rota(async () => {
    const q = await consulta("SELECT indicador, valor FROM mv_qualidade_identidade ORDER BY ordem");
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/exemplo",
  rota(async (req) => {
    const q = await consulta(
      `SELECT id_pessoa, nome_atual, nome_declarado, ano, cargo, local, titulo_declarado, cpf_declarado,
       data_nascimento, situacao_resultado
FROM vw_candidatura_documentos
WHERE id_pessoa IN (SELECT id_pessoa FROM candidatura WHERE titulo_declarado = $1)
ORDER BY id_pessoa, ano`,
      [texto(req.query.titulo)],
    );
    return { sql: q.sql, dados: q.linhas };
  }),
);

// ---------------------------------------------------------------- Q1
app.get(
  "/api/q1/custo-cadeira",
  rota(async () => {
    const q = await consulta(
      "SELECT ano, cargo, uf, candidatos, cadeiras, gasto_total, custo_por_cadeira FROM mv_q1_custo_cadeira ORDER BY cargo, ano, uf",
    );
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/q1/municipio",
  rota(async (req) => {
    const q = await consulta(
      `SELECT ano, municipio, uf, candidatos, cadeiras, gasto_total, custo_por_cadeira
FROM mv_q1_custo_municipio
WHERE cargo = $1 AND municipio_busca LIKE '%' || UPPER(unaccent($2)) || '%'
ORDER BY municipio, uf, ano`,
      [texto(req.query.cargo), texto(req.query.nome)],
    );
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/q1/opcoes",
  rota(async () => {
    const q = await consulta("SELECT DISTINCT ano, cargo FROM mv_q1_eleitos_vs_nao ORDER BY ano, cargo");
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/q1/eleitos",
  rota(async (req) => {
    const perdedor = req.query.suplentes === "false" ? "NÃO ELEITO" : "NÃO ELEITO + SUPLENTE";
    const q = await consulta(
      `SELECT resultado, candidatos, gasto_total, media, mediana
FROM mv_q1_eleitos_vs_nao
WHERE ano = $1 AND cargo = $2 AND uf = $3 AND com_gasto_zero = $4
  AND resultado IN ('ELEITO', $5)`,
      [ano(req.query.ano), texto(req.query.cargo), texto(req.query.uf) || "TODAS", req.query.zero !== "false", perdedor],
    );
    return { sql: q.sql, dados: q.linhas };
  }),
);

// ---------------------------------------------------------------- Q2
app.get(
  "/api/q2/opcoes",
  rota(async () => {
    const q = await consulta("SELECT ano, cargo FROM mv_q2_resumo WHERE uf = 'TODAS' ORDER BY cargo, ano");
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/q2",
  rota(async (req) => {
    const p = [ano(req.query.ano), texto(req.query.cargo), texto(req.query.uf) || "TODAS"];
    const r = await consulta(
      `SELECT candidatos, eleitos, taxa_sucesso, pct_sem_bens, mediana_eleitos, mediana_nao_eleitos, declaracoes_acima_100mi
FROM mv_q2_resumo
WHERE ano = $1 AND cargo = $2 AND uf = $3`,
      p,
    );
    const f = await consulta(
      `SELECT ordem, faixa, candidatos, eleitos, taxa_sucesso, patrimonio_mediano
FROM mv_q2_faixas
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY ordem`,
      p,
    );
    const q = await consulta(
      `SELECT quintil, candidatos, eleitos, taxa_sucesso, patrimonio_min, patrimonio_max
FROM mv_q2_quintis
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY quintil`,
      p,
    );
    return {
      sql: `${r.sql};\n\n${f.sql};\n\n${q.sql};`,
      dados: { resumo: r.linhas[0] ?? null, faixas: f.linhas, quintis: q.linhas },
    };
  }),
);

// ---------------------------------------------------------------- Q9
app.get(
  "/api/q9/opcoes",
  rota(async () => {
    const q = await consulta("SELECT DISTINCT cargo FROM mv_q9_categoria WHERE cargo <> 'TODOS' AND cargo NOT LIKE 'VICE%' AND cargo NOT LIKE '%SUPLENTE%' ORDER BY cargo");
    return { sql: q.sql, dados: q.linhas.map((r) => r.cargo) };
  }),
);

app.get(
  "/api/q9/categorias",
  rota(async (req) => {
    // todos os anos de uma vez: o site filtra o ano e também desenha a evolução entre pleitos
    const q = await consulta(
      `SELECT ano, grupo, propaganda, tipo_despesa, valor, despesas, candidatos
FROM mv_q9_categoria
WHERE cargo = $1 AND uf = $2
ORDER BY ano, valor DESC`,
      [texto(req.query.cargo) || "TODOS", texto(req.query.uf) || "TODAS"],
    );
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/q9/palavras",
  rota(async (req) => {
    const q = await consulta(
      `SELECT palavra, despesas, valor
FROM mv_q9_palavras
WHERE escopo = $1 AND ano = $2 AND cargo = $3 AND uf = $4
ORDER BY pos`,
      [
        req.query.escopo === "TODAS" ? "TODAS" : "PROPAGANDA",
        ano(req.query.ano),
        texto(req.query.cargo) || "TODOS",
        texto(req.query.uf) || "TODAS",
      ],
    );
    return { sql: q.sql, dados: q.linhas };
  }),
);

// ---------------------------------------------------------------- Q10
app.get(
  "/api/q10/busca",
  rota(async (req) => {
    // dois passos: o índice trigram acha os ids pelo nome (sem acento); a view agrega só essas pessoas.
    // Cada palavra é procurada separadamente: "helder barbalho" acha HELDER ZAHLUTH BARBALHO.
    const palavras = texto(req.query.nome).split(/\s+/).filter((p) => p.length >= 2).slice(0, 6);
    if (!palavras.length) return { sql: "", dados: [] };
    const ids = await consulta<{ id_pessoa: number }>(
      `SELECT DISTINCT id_pessoa FROM mv_q10_nomes
WHERE ${palavras.map((_, i) => `nome_busca LIKE '%' || UPPER(unaccent($${i + 1})) || '%'`).join("\n  AND ")}
LIMIT 500`,
      palavras,
    );
    const q = await consulta(
      `SELECT id_pessoa, nome, data_nascimento, candidaturas, primeira, ultima, vitorias, cargos
FROM vw_q10_busca
WHERE id_pessoa = ANY($1)
ORDER BY candidaturas DESC, nome
LIMIT 100`,
      [ids.linhas.map((r) => r.id_pessoa)],
    );
    return { sql: `${ids.sql};\n\n${q.sql.replace(/ARRAY\[[^\]]*\]/, "ARRAY[ids da consulta acima]")};`, dados: q.linhas };
  }),
);

app.get(
  "/api/q10/pessoa/:id",
  rota(async (req) => {
    const id = inteiro(req.params.id);
    const n = await consulta("SELECT nome FROM mv_q10_nomes WHERE id_pessoa = $1 ORDER BY nome", [id]);
    const c = await consulta(
      `SELECT ano, cargo, local, partido, resultado, evento, troca_partido, mudanca_cargo, detalhe_resultado
FROM vw_q10_carreira
WHERE id_pessoa = $1
ORDER BY ano`,
      [id],
    );
    return { sql: `${c.sql};\n\n${n.sql};`, dados: { nomes: n.linhas.map((r) => r.nome), carreira: c.linhas } };
  }),
);

// ---------------------------------------------------------------- site já compilado (npm run build)
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const porta = Number(process.env.PORT ?? 3001);
pool
  .query("SELECT current_database() AS banco")
  .then((r) => {
    app.listen(porta, () => console.log(`API conectada ao banco ${r.rows[0].banco} em http://localhost:${porta}`));
  })
  .catch((e) => {
    console.error("Não consegui conectar ao PostgreSQL. Confira o arquivo .env.\n", e.message);
    process.exit(1);
  });
