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

// ---------------------------------------------------------------- Q3
app.get(
  "/api/q3",
  rota(async (req) => {
    const a = ano(req.query.ano);
    const dim = texto(req.query.dim) === "PIB" ? "PIB" : "IDHM";
    const cargo = texto(req.query.cargo) === "VEREADOR" ? "VEREADOR" : "PREFEITO";
    const uf = texto(req.query.uf) || "TODAS";
    const g = await consulta(
      `SELECT dimensao, grupo_ordem, municipios, municipios_anulados, aptos, pct_isentos, pct_abstencao, pct_brancos, pct_nulos,
       pct_eleitores_pop, idhm_medio, pib_per_capita_mediano, idhm_min, idhm_max, pib_min, pib_max
FROM mv_q3_grupos
WHERE ano = $1 AND uf = $2 AND dimensao IN ($3, 'TODOS')
ORDER BY dimensao, grupo_ordem`,
      [a, uf, dim],
    );
    const p = await consulta(
      `SELECT dimensao, grupo_ordem, partido, eleitos, pct_do_grupo, posicao
FROM mv_q3_partidos
WHERE ano = $1 AND cargo = $2 AND uf = $3 AND dimensao IN ($4, 'TODOS')
ORDER BY dimensao, grupo_ordem, posicao, partido`,
      [a, cargo, uf, dim],
    );
    const c = await consulta(
      `SELECT medida, municipios, correlacao
FROM mv_q3_correlacao
WHERE ano = $1 AND uf = $2 AND indice = $3
ORDER BY medida`,
      [a, uf, dim],
    );
    return { sql: `${g.sql};\n\n${p.sql};\n\n${c.sql};`, dados: { grupos: g.linhas, partidos: p.linhas, correlacao: c.linhas } };
  }),
);

// ---------------------------------------------------------------- Q4
app.get(
  "/api/q4/opcoes",
  rota(async () => {
    const q = await consulta("SELECT DISTINCT ano, cargo FROM mv_q4_sucesso WHERE uf = 'TODAS' ORDER BY ano, cargo");
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/q4",
  rota(async (req) => {
    const a = ano(req.query.ano);
    const cargo = texto(req.query.cargo);
    const uf = texto(req.query.uf) || "TODAS";
    const s = await consulta(
      `SELECT ordem, grau, candidatos, eleitos, taxa_sucesso
FROM mv_q4_sucesso
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY ordem`,
      [a, cargo, uf],
    );
    const r = await consulta(
      `SELECT ordem, grau, candidatos, eleitos, eleitores, pct_candidatos, pct_eleitos, pct_eleitorado
FROM mv_q4_representacao
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY ordem`,
      [a, cargo, uf],
    );
    // a parte 2 (município a município): prefeito e vereador de 2024 e deputados de 2022 (medidos pelos votos de cada município)
    const municipal = (a === 2024 && (cargo === "PREFEITO" || cargo === "VEREADOR")) || (a === 2022 && (cargo === "DEPUTADO FEDERAL" || cargo === "DEPUTADO ESTADUAL"));
    const g = municipal
      ? await consulta(
          `SELECT grupo_ordem, municipios, eleitos, anos_eleitorado_min, anos_eleitorado_max, anos_eleitorado_medio,
       anos_eleitos_medio, pct_superior_eleitorado, pct_superior_eleitos, anos_votados_medio, pct_superior_votados
FROM mv_q4_grupos
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY grupo_ordem`,
          [a, cargo, uf],
        )
      : { sql: "", linhas: [] };
    const c = municipal
      ? await consulta(
          "SELECT municipios, correlacao, inclinacao, correlacao_votados FROM mv_q4_correlacao WHERE ano = $1 AND cargo = $2 AND uf = $3",
          [a, cargo, uf],
        )
      : { sql: "", linhas: [] };
    return {
      sql: [s.sql, r.sql, g.sql, c.sql].filter(Boolean).join(";\n\n") + ";",
      dados: { sucesso: s.linhas, representacao: r.linhas, grupos: g.linhas, correlacao: c.linhas[0] ?? null, municipal },
    };
  }),
);

// ---------------------------------------------------------------- Q5
const CARGOS_Q5 = ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL", "VEREADOR"];
app.get(
  "/api/q5",
  rota(async (req) => {
    const a = ano(req.query.ano);
    const cargo = CARGOS_Q5.includes(texto(req.query.cargo)) ? texto(req.query.cargo) : "VEREADOR";
    const uf = texto(req.query.uf) || "TODAS";
    const r = await consulta(
      `SELECT circunscricoes, vagas, eleitos, eleitos_por_legenda, pct_por_legenda, faixa_100_mais, faixa_50_99, faixa_20_49, faixa_menos_20,
       fora_dos_mais_votados, pct_fora_dos_mais_votados, mediana_pct_quociente, votos_validos, votos_legenda, pct_votos_legenda
FROM mv_q5_resumo
WHERE ano = $1 AND cargo = $2 AND uf = $3`,
      [a, cargo, uf],
    );
    const p = await consulta(
      `SELECT partido, eleitos, eleitos_por_legenda, pct_por_legenda, eleitos_votos_proprios, fora_dos_mais_votados, votos_nominais, votos_legenda,
       pct_votos_legenda, posicao
FROM mv_q5_partido
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY posicao`,
      [a, cargo, uf],
    );
    const menos = await consulta(
      `SELECT e.nome_urna, e.partido, e.sg_uf, m.nome AS municipio, e.votos, e.quociente, e.pct_do_quociente, e.posicao_votos, e.vagas
FROM mv_q5_eleito e
LEFT JOIN municipio m ON m.cod_ibge = e.cod_ibge
WHERE e.ano = $1 AND e.cargo = $2 AND ($3 = 'TODAS' OR e.sg_uf = $3)
ORDER BY e.pct_do_quociente, e.votos, e.nome_urna
LIMIT 10`,
      [a, cargo, uf],
    );
    const barrados = await consulta(
      `SELECT b.nome_urna, b.partido, b.sg_uf, m.nome AS municipio, b.votos, b.quociente, b.pct_do_quociente, b.posicao_votos, b.vagas
FROM mv_q5_barrado b
LEFT JOIN municipio m ON m.cod_ibge = b.cod_ibge
WHERE b.ano = $1 AND b.cargo = $2 AND ($3 = 'TODAS' OR b.sg_uf = $3)
ORDER BY b.votos DESC, b.nome_urna
LIMIT 10`,
      [a, cargo, uf],
    );
    return {
      sql: [r.sql, p.sql, menos.sql, barrados.sql].join(";\n\n") + ";",
      dados: { resumo: r.linhas[0] ?? null, partidos: p.linhas, menos: menos.linhas, barrados: barrados.linhas },
    };
  }),
);

// ---------------------------------------------------------------- Q6
app.get(
  "/api/q6",
  rota(async (req) => {
    const cargo = texto(req.query.cargo) === "VEREADOR" ? "VEREADOR" : "PREFEITO";
    const uf = texto(req.query.uf) || "TODAS";
    const g = await consulta("SELECT grupo_ordem, grupo FROM vw_q6_grupo ORDER BY grupo_ordem");
    const i = await consulta(
      `SELECT ano, grupo_ordem, municipios, eleitos, idade_media, idade_mediana_eleitos, pct_ate_34, pct_60_mais
FROM mv_q6_idade
WHERE cargo = $1 AND uf = $2
ORDER BY ano, grupo_ordem`,
      [cargo, uf],
    );
    const c = await consulta(
      `SELECT ano, municipios, correlacao, inclinacao
FROM mv_q6_correlacao
WHERE cargo = $1 AND uf = $2
ORDER BY ano`,
      [cargo, uf],
    );
    const a = await consulta(
      `SELECT ano, grupo_ordem, transicoes, pct_partido_mudou, pct_prefeito_mudou,
       incumbentes_concorreram, incumbentes_reeleitos, pct_reeleicao, pct_tentou_reeleicao
FROM mv_q6_alternancia
WHERE uf = $1
ORDER BY ano, grupo_ordem`,
      [uf],
    );
    return {
      sql: `${i.sql};\n\n${c.sql};\n\n${a.sql};`,
      dados: { grupos: g.linhas, idade: i.linhas, correlacao: c.linhas, alternancia: a.linhas },
    };
  }),
);

// ---------------------------------------------------------------- Q8
app.get(
  "/api/q8/opcoes",
  rota(async () => {
    const q = await consulta("SELECT ano, cargo FROM mv_q8_resumo WHERE uf = 'TODAS' ORDER BY cargo, ano");
    return { sql: q.sql, dados: q.linhas };
  }),
);

app.get(
  "/api/q8",
  rota(async (req) => {
    const p = [ano(req.query.ano), texto(req.query.cargo), texto(req.query.uf) || "TODAS"];
    const r = await consulta(
      `SELECT candidatos, eleitos, sem_receita, receita_total, pct_publico_do_dinheiro,
       maioria_publica, maioria_publica_eleitos, maioria_privada, maioria_privada_eleitos,
       mediana_receita_eleitos, mediana_receita_nao_eleitos
FROM mv_q8_resumo
WHERE ano = $1 AND cargo = $2 AND uf = $3`,
      p,
    );
    const f = await consulta(
      `SELECT ordem, faixa, candidatos, eleitos, taxa_sucesso, receita_mediana
FROM mv_q8_faixas
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY ordem`,
      p,
    );
    const o = await consulta(
      `SELECT grupo, categoria, publico, valor, candidatos
FROM mv_q8_origem
WHERE ano = $1 AND cargo = $2 AND uf = $3
ORDER BY grupo, valor DESC`,
      p,
    );
    return {
      sql: `${r.sql};\n\n${f.sql};\n\n${o.sql};`,
      dados: { resumo: r.linhas[0] ?? null, faixas: f.linhas, origem: o.linhas },
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
