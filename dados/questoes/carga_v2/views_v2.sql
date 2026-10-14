/* Views do banco eleicoes_v2 - o front le SOMENTE daqui.
   Rodar no pgAdmin (Query Tool) depois da carga. Depois de recarregar dados:
   REFRESH MATERIALIZED VIEW mv_q1_custo_cadeira;  (e as outras mv_q1_*)  */

DROP VIEW IF EXISTS vw_candidatura_documentos CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_qualidade_identidade CASCADE;
DROP VIEW IF EXISTS vw_candidaturas_por_ano CASCADE;
DROP VIEW IF EXISTS vw_resumo_carga CASCADE;
DROP VIEW IF EXISTS vw_q10_busca CASCADE;
DROP VIEW IF EXISTS vw_q10_carreira CASCADE;
DROP VIEW IF EXISTS vw_q10_base CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q10_nomes CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q1_eleitos_vs_nao CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q1_custo_municipio CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q1_custo_cadeira CASCADE;
DROP VIEW IF EXISTS vw_gasto_candidatura CASCADE;


/* ====================================================================
   Q1 - Quanto custa uma cadeira
   ==================================================================== */

/* Base: gasto contratado por candidatura (candidato sem despesa = R$ 0). Vices e suplentes de senador
   ficam de fora, pois disputam a mesma vaga do titular. */
CREATE VIEW vw_gasto_candidatura AS
SELECT c.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sg_uf AS uf, c.cod_ibge,
       CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'ELEITO'
            WHEN c.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
            WHEN c.situacao_resultado = 'NÃO ELEITO' THEN 'NÃO ELEITO'
            ELSE 'SEM RESULTADO' END AS resultado,
       COALESCE(SUM(d.valor), 0) AS gasto
FROM candidatura c
LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
WHERE c.id_eleicao >= 2018
  AND c.cargo NOT LIKE 'VICE%'
  AND c.cargo NOT LIKE '%SUPLENTE%'
GROUP BY c.id_candidatura, c.id_eleicao, c.cargo, c.sg_uf, c.cod_ibge, c.situacao_resultado;

/* Principal: custo por cadeira = gasto total do cargo / vagas, por ano, cargo e UF */
CREATE MATERIALIZED VIEW mv_q1_custo_cadeira AS
WITH gasto AS (
  SELECT ano, cargo, uf, COUNT(*) AS candidatos, SUM(gasto) AS gasto_total
  FROM vw_gasto_candidatura
  GROUP BY ano, cargo, uf),
vagas AS (
  SELECT v.id_eleicao AS ano, v.cargo, v.sg_uf AS uf, SUM(v.qt_vaga) AS cadeiras
  FROM vaga v
  WHERE v.cargo NOT LIKE 'VICE%' AND v.cargo NOT LIKE '%SUPLENTE%'
  GROUP BY v.id_eleicao, v.cargo, v.sg_uf)
SELECT g.ano, g.cargo, g.uf, g.candidatos, v.cadeiras,
       ROUND(g.gasto_total, 2) AS gasto_total,
       ROUND(g.gasto_total / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g
JOIN vagas v ON v.ano = g.ano AND v.cargo = g.cargo AND v.uf = g.uf;
CREATE INDEX ix_mv_q1_cc ON mv_q1_custo_cadeira (ano, cargo, uf);

/* Por municipio (vereador e prefeito) */
CREATE MATERIALIZED VIEW mv_q1_custo_municipio AS
WITH gasto AS (
  SELECT ano, cargo, cod_ibge, COUNT(*) AS candidatos, SUM(gasto) AS gasto_total
  FROM vw_gasto_candidatura
  WHERE cod_ibge IS NOT NULL
  GROUP BY ano, cargo, cod_ibge),
vagas AS (
  SELECT id_eleicao AS ano, cargo, cod_ibge, SUM(qt_vaga) AS cadeiras
  FROM vaga WHERE cod_ibge IS NOT NULL
  GROUP BY id_eleicao, cargo, cod_ibge)
SELECT g.ano, g.cargo, m.cod_ibge, m.nome AS municipio, UPPER(unaccent(m.nome)) AS municipio_busca,
       m.uf, g.candidatos, v.cadeiras,
       ROUND(g.gasto_total, 2) AS gasto_total,
       ROUND(g.gasto_total / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g
JOIN vagas v ON v.ano = g.ano AND v.cargo = g.cargo AND v.cod_ibge = g.cod_ibge
JOIN municipio m ON m.cod_ibge = g.cod_ibge;
CREATE INDEX ix_mv_q1_cm ON mv_q1_custo_municipio (cargo, uf, ano);
CREATE INDEX ix_mv_q1_cm_nome ON mv_q1_custo_municipio USING gin (municipio_busca gin_trgm_ops);

/* Complementar: eleitos x nao eleitos (por candidato: total, media e mediana).
   uf = 'TODAS' soma os 6 estados. com_gasto_zero = TRUE conta quem gastou R$ 0; FALSE tira esses candidatos.
   Grupos: ELEITO, NÃO ELEITO, SUPLENTE e NÃO ELEITO + SUPLENTE (calculado aqui porque a mediana
   de dois grupos juntos nao sai das medianas separadas). */
CREATE MATERIALIZED VIEW mv_q1_eleitos_vs_nao AS
WITH base1 AS (
  SELECT ano, cargo, uf, resultado, gasto, (gasto > 0) AS gastou
  FROM vw_gasto_candidatura
  WHERE resultado <> 'SEM RESULTADO'),
base AS (
  SELECT * FROM base1
  UNION ALL
  SELECT ano, cargo, uf, 'NÃO ELEITO + SUPLENTE', gasto, gastou
  FROM base1 WHERE resultado IN ('NÃO ELEITO', 'SUPLENTE')),
ampliada AS (
  SELECT ano, cargo, uf, resultado, gasto, TRUE AS com_gasto_zero FROM base
  UNION ALL
  SELECT ano, cargo, uf, resultado, gasto, FALSE FROM base WHERE gastou)
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf, resultado, com_gasto_zero,
       COUNT(*) AS candidatos,
       ROUND(SUM(gasto), 2) AS gasto_total,
       ROUND(AVG(gasto), 2) AS media,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY gasto))::numeric, 2) AS mediana
FROM ampliada
GROUP BY GROUPING SETS ((ano, cargo, uf, resultado, com_gasto_zero), (ano, cargo, resultado, com_gasto_zero));
CREATE INDEX ix_mv_q1_ev ON mv_q1_eleitos_vs_nao (ano, cargo, uf, com_gasto_zero);


/* ====================================================================
   Q10 - Sobrevivencia da carreira de um politico
   ==================================================================== */

/* Base da carreira. Registros da mesma pessoa, no mesmo ano, cargo e local (ex.: um INAPTO e o APTO
   que o substituiu) sao um so: fica o que tem resultado. Os demais continuam na tabela candidatura.
   E uma view separada (e nao uma CTE) para o PostgreSQL conseguir filtrar por id_pessoa ANTES das
   janelas; sem isso a consulta de uma pessoa varre as 569 mil candidaturas. */
CREATE VIEW vw_q10_base AS
WITH ranq AS (
  SELECT c.*,
         ROW_NUMBER() OVER (PARTITION BY c.id_pessoa, c.id_eleicao, c.cargo, c.sg_uf, c.cod_ibge
                            ORDER BY (c.situacao_resultado IS NOT NULL) DESC,
                                     (c.situacao_candidatura = 'APTO') DESC,
                                     c.id_candidatura DESC) AS rn
  FROM candidatura c)
SELECT r.id_pessoa, r.id_candidatura, r.id_eleicao AS ano, r.cargo, r.sigla_partido,
       COALESCE(m.nome, r.sg_uf) AS local, r.situacao_resultado,
       (r.situacao_resultado LIKE 'ELEITO%') AS eleito,
       CASE WHEN r.situacao_resultado LIKE 'ELEITO%' THEN 'VITÓRIA'
            WHEN r.situacao_resultado = 'NÃO ELEITO' THEN 'DERROTA'
            WHEN r.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
            WHEN r.situacao_resultado LIKE 'REGISTRO NEGADO%' THEN 'REGISTRO NEGADO'
            WHEN r.situacao_resultado LIKE 'RENÚNCIA%' THEN 'RENÚNCIA/FALECIMENTO'
            ELSE 'SEM RESULTADO' END AS resultado
FROM ranq r
LEFT JOIN municipio m ON m.cod_ibge = r.cod_ibge
WHERE r.rn = 1;

/* Linha do tempo: resultado, reeleicao, troca de partido e mudanca de cargo.
   Reeleicao = eleito para o mesmo cargo 4 anos depois de um mandato (8 no caso de senador).
   Use sempre com WHERE id_pessoa = ... */
CREATE VIEW vw_q10_carreira AS
WITH marcado AS (
  SELECT b.*,
         EXISTS (SELECT 1 FROM vw_q10_base x
                 WHERE x.id_pessoa = b.id_pessoa AND x.cargo = b.cargo AND x.eleito
                   AND x.ano = b.ano - CASE WHEN b.cargo = 'SENADOR' THEN 8 ELSE 4 END) AS tinha_mandato,
         LAG(b.sigla_partido) OVER w AS partido_anterior,
         LAG(b.cargo) OVER w AS cargo_anterior
  FROM vw_q10_base b
  WINDOW w AS (PARTITION BY b.id_pessoa ORDER BY b.ano, b.id_candidatura))
SELECT mk.id_pessoa, p.nome, p.data_nascimento, mk.ano, mk.cargo, mk.local,
       mk.sigla_partido AS partido, mk.resultado, mk.situacao_resultado AS detalhe_resultado,
       CASE WHEN mk.eleito AND mk.tinha_mandato THEN 'REELEIÇÃO'
            WHEN mk.resultado = 'DERROTA' AND mk.tinha_mandato THEN 'TENTOU REELEIÇÃO E PERDEU'
            WHEN mk.eleito THEN 'ELEITO (1º mandato neste cargo)'
            ELSE '' END AS evento,
       CASE WHEN mk.partido_anterior IS NOT NULL AND mk.partido_anterior <> mk.sigla_partido
            THEN 'Trocou de ' || mk.partido_anterior || ' para ' || mk.sigla_partido ELSE '' END AS troca_partido,
       CASE WHEN mk.cargo_anterior IS NOT NULL AND mk.cargo_anterior <> mk.cargo
            THEN 'Mudou de ' || mk.cargo_anterior || ' para ' || mk.cargo ELSE '' END AS mudanca_cargo
FROM marcado mk
JOIN pessoa p ON p.id_pessoa = mk.id_pessoa;

/* Todos os nomes com que cada pessoa concorreu (a pessoa guarda so o mais recente; quem mudou de nome
   continua achavel pelo antigo). Tem indice trigram: busca por pedaco de nome em milissegundos. */
CREATE MATERIALIZED VIEW mv_q10_nomes AS
SELECT DISTINCT id_pessoa, nome_declarado AS nome, UPPER(unaccent(nome_declarado)) AS nome_busca
FROM candidatura WHERE nome_declarado IS NOT NULL;
CREATE INDEX ix_mv_q10_nomes ON mv_q10_nomes USING gin (nome_busca gin_trgm_ops);
CREATE INDEX ix_mv_q10_nomes_pessoa ON mv_q10_nomes (id_pessoa);

/* Lista para escolher a pessoa antes de abrir a linha do tempo.
   Uso no front, em dois passos (assim o filtro entra antes do GROUP BY e a busca e instantanea):
     1) SELECT DISTINCT id_pessoa FROM mv_q10_nomes WHERE nome_busca LIKE '%' || UPPER(unaccent('jessica magno')) || '%'
     2) SELECT * FROM vw_q10_busca WHERE id_pessoa = ANY(ARRAY[ids do passo 1]) */
CREATE VIEW vw_q10_busca AS
SELECT p.id_pessoa, p.nome, p.data_nascimento,
       COUNT(*) AS candidaturas,
       MIN(c.id_eleicao) AS primeira, MAX(c.id_eleicao) AS ultima,
       COUNT(*) FILTER (WHERE c.situacao_resultado LIKE 'ELEITO%') AS vitorias,
       COUNT(DISTINCT c.cargo) AS cargos
FROM pessoa p
JOIN candidatura c ON c.id_pessoa = p.id_pessoa
GROUP BY p.id_pessoa, p.nome, p.data_nascimento;


/* ====================================================================
   Apresentacao - prova da carga e qualidade dos dados
   ==================================================================== */

/* Linhas em cada uma das 14 tabelas, contadas na hora */
CREATE VIEW vw_resumo_carga AS
SELECT 'municipio' AS tabela, COUNT(*) AS linhas FROM municipio
UNION ALL SELECT 'eleicao', COUNT(*) FROM eleicao
UNION ALL SELECT 'partido', COUNT(*) FROM partido
UNION ALL SELECT 'pessoa', COUNT(*) FROM pessoa
UNION ALL SELECT 'candidatura', COUNT(*) FROM candidatura
UNION ALL SELECT 'vaga', COUNT(*) FROM vaga
UNION ALL SELECT 'despesa', COUNT(*) FROM despesa
UNION ALL SELECT 'receita', COUNT(*) FROM receita
UNION ALL SELECT 'bem_declarado', COUNT(*) FROM bem_declarado
UNION ALL SELECT 'votacao', COUNT(*) FROM votacao
UNION ALL SELECT 'votacao_legenda', COUNT(*) FROM votacao_legenda
UNION ALL SELECT 'eleitorado', COUNT(*) FROM eleitorado
UNION ALL SELECT 'totalizacao_municipio', COUNT(*) FROM totalizacao_municipio
UNION ALL SELECT 'indicador_municipal', COUNT(*) FROM indicador_municipal;

/* Candidaturas por ano (mostra a cobertura 2002-2024) */
CREATE VIEW vw_candidaturas_por_ano AS
SELECT c.id_eleicao AS ano, e.tipo_eleicao, COUNT(*) AS candidaturas,
       COUNT(*) FILTER (WHERE c.situacao_resultado LIKE 'ELEITO%') AS eleitos
FROM candidatura c
JOIN eleicao e ON e.id_eleicao = c.id_eleicao
GROUP BY c.id_eleicao, e.tipo_eleicao;

/* Indicadores da resolucao de identidade (titulo e CPF nao sao confiaveis sozinhos) */
CREATE MATERIALIZED VIEW mv_qualidade_identidade AS
SELECT 1 AS ordem, 'candidaturas' AS indicador, COUNT(*)::bigint AS valor FROM candidatura
UNION ALL
SELECT 2, 'pessoas', COUNT(*) FROM pessoa
UNION ALL
SELECT 3, 'pessoas_com_mais_de_um_titulo', COUNT(*) FROM (
  SELECT id_pessoa FROM candidatura WHERE titulo_declarado IS NOT NULL
  GROUP BY id_pessoa HAVING COUNT(DISTINCT titulo_declarado) > 1) x
UNION ALL
SELECT 4, 'titulos_de_mais_de_uma_pessoa', COUNT(*) FROM (
  SELECT titulo_declarado FROM candidatura WHERE titulo_declarado IS NOT NULL
  GROUP BY titulo_declarado HAVING COUNT(DISTINCT id_pessoa) > 1) x
UNION ALL
SELECT 5, 'candidaturas_sem_titulo', COUNT(*) FROM candidatura WHERE titulo_declarado IS NULL
UNION ALL
SELECT 6, 'candidaturas_2024', COUNT(*) FROM candidatura WHERE id_eleicao = 2024
UNION ALL
SELECT 7, 'candidaturas_2024_cpf_recuperado', COUNT(*) FROM candidatura c
  JOIN pessoa p ON p.id_pessoa = c.id_pessoa
  WHERE c.id_eleicao = 2024 AND c.cpf_declarado IS NULL AND p.cpf IS NOT NULL
UNION ALL
SELECT 8, 'pessoas_com_mais_de_uma_grafia_de_nome', COUNT(*) FROM (
  SELECT id_pessoa FROM candidatura GROUP BY id_pessoa HAVING COUNT(DISTINCT nome_declarado) > 1) x
UNION ALL
SELECT 9, 'mesma_pessoa_duas_vezes_no_ano', COUNT(*) FROM (
  SELECT id_pessoa, id_eleicao FROM candidatura GROUP BY id_pessoa, id_eleicao HAVING COUNT(*) > 1) x;

/* Documentos declarados em cada candidatura, com a pessoa resolvida (para mostrar exemplos) */
CREATE VIEW vw_candidatura_documentos AS
SELECT c.id_pessoa, p.nome AS nome_atual, c.nome_declarado, c.id_eleicao AS ano, c.cargo,
       COALESCE(m.nome, c.sg_uf) AS local, c.titulo_declarado, c.cpf_declarado,
       p.data_nascimento, c.situacao_resultado
FROM candidatura c
JOIN pessoa p ON p.id_pessoa = c.id_pessoa
LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge;
CREATE INDEX IF NOT EXISTS ix_candidatura_titulo ON candidatura (titulo_declarado);

