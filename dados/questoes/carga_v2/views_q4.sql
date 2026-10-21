/* Views da Q4 (banco eleicoes_v2): escolaridade do candidato e escolaridade do eleitorado.
   Rodar no pgAdmin depois de importar_eleitorado.py. Depois de recarregar os dados, rode de novo.

   Parte 1 (2022 e 2024): a escolaridade do candidato se relaciona a ser eleito?
   Parte 2 (so 2024): municipios com eleitorado de menor escolaridade elegem candidatos de menor escolaridade?
   A parte 2 so vale em eleicao municipal, em que os eleitos pertencem a um municipio. Em 2022 (deputados, governador e
   senador) a comparacao e feita no nivel do estado. */

DROP MATERIALIZED VIEW IF EXISTS mv_q4_correlacao CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q4_grupos CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q4_municipio CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q4_representacao CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q4_sucesso CASCADE;
DROP VIEW IF EXISTS vw_q4_candidato CASCADE;
DROP VIEW IF EXISTS vw_q4_grau CASCADE;

/* Os oito graus de escolaridade, do menor ao maior. Os candidatos e o eleitorado usam os mesmos nomes.
   anos_estudo e uma escala de "anos de estudo equivalentes" (convencao nossa) para tirar medias:
   fundamental incompleto = 5, completo = 9, medio incompleto = 10, medio completo = 12, superior incompleto = 14,
   superior completo = 16. "NAO DIVULGAVEL" (candidato) e "NAO INFORMADO" (eleitor) ficam de fora. */
CREATE VIEW vw_q4_grau AS
SELECT * FROM (VALUES
  ('ANALFABETO', 0, 0),
  ('LÊ E ESCREVE', 1, 2),
  ('ENSINO FUNDAMENTAL INCOMPLETO', 2, 5),
  ('ENSINO FUNDAMENTAL COMPLETO', 3, 9),
  ('ENSINO MÉDIO INCOMPLETO', 4, 10),
  ('ENSINO MÉDIO COMPLETO', 5, 12),
  ('SUPERIOR INCOMPLETO', 6, 14),
  ('SUPERIOR COMPLETO', 7, 16)
) AS t(grau, ordem, anos_estudo);

/* Candidaturas elegiveis de 2022 e 2024: resultado conhecido, sem vices e suplentes de senador */
CREATE VIEW vw_q4_candidato AS
SELECT c.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sg_uf AS uf, c.cod_ibge,
       g.grau, g.ordem, g.anos_estudo,
       (c.situacao_resultado LIKE 'ELEITO%') AS eleito
FROM candidatura c
JOIN vw_q4_grau g ON g.grau = c.grau_instrucao
WHERE c.id_eleicao IN (2022, 2024)
  AND c.cargo NOT LIKE 'VICE%'
  AND c.cargo NOT LIKE '%SUPLENTE%'
  AND (c.situacao_resultado LIKE 'ELEITO%' OR c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE'));

/* Parte 1: taxa de sucesso por grau de escolaridade. uf 'TODAS' soma os 6 estados. */
CREATE MATERIALIZED VIEW mv_q4_sucesso AS
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf, ordem, grau,
       COUNT(*) AS candidatos,
       COUNT(*) FILTER (WHERE eleito) AS eleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE eleito) / COUNT(*), 1) AS taxa_sucesso
FROM vw_q4_candidato
GROUP BY GROUPING SETS ((ano, cargo, uf, ordem, grau), (ano, cargo, ordem, grau));
CREATE INDEX ix_mv_q4_sucesso ON mv_q4_sucesso (ano, cargo, uf);

/* Eleitorado x candidatos x eleitos: que parte de cada grupo tem cada escolaridade.
   O eleitorado e o apto do 1o turno no estado (ou nos 6 estados). */
CREATE MATERIALIZED VIEW mv_q4_representacao AS
WITH ele AS (
  SELECT e.id_eleicao AS ano, m.uf, g.ordem, SUM(e.qtd_eleitores) AS aptos
  FROM eleitorado e
  JOIN municipio m ON m.cod_ibge = e.cod_ibge
  JOIN vw_q4_grau g ON g.grau = e.grau_instrucao
  WHERE e.id_eleicao IN (2022, 2024) AND e.turno = 1
  GROUP BY GROUPING SETS ((e.id_eleicao, m.uf, g.ordem), (e.id_eleicao, g.ordem))),
cand AS (
  SELECT ano, cargo, uf, ordem, COUNT(*) AS candidatos, COUNT(*) FILTER (WHERE eleito) AS eleitos
  FROM vw_q4_candidato
  GROUP BY GROUPING SETS ((ano, cargo, uf, ordem), (ano, cargo, ordem))),
esqueleto AS (
  SELECT DISTINCT c.ano, c.cargo, c.uf, g.ordem, g.grau
  FROM cand c CROSS JOIN vw_q4_grau g),
junto AS (
  SELECT k.ano, k.cargo, COALESCE(k.uf, 'TODAS') AS uf, k.ordem, k.grau,
         COALESCE(c.candidatos, 0) AS candidatos, COALESCE(c.eleitos, 0) AS eleitos, COALESCE(e.aptos, 0) AS aptos
  FROM esqueleto k
  LEFT JOIN cand c ON c.ano = k.ano AND c.cargo = k.cargo AND c.ordem = k.ordem AND c.uf IS NOT DISTINCT FROM k.uf
  LEFT JOIN ele e ON e.ano = k.ano AND e.ordem = k.ordem AND e.uf IS NOT DISTINCT FROM k.uf)
SELECT ano, cargo, uf, ordem, grau, candidatos, eleitos, aptos AS eleitores,
       ROUND(100.0 * candidatos / NULLIF(SUM(candidatos) OVER w, 0), 1) AS pct_candidatos,
       ROUND(100.0 * eleitos / NULLIF(SUM(eleitos) OVER w, 0), 1) AS pct_eleitos,
       ROUND(100.0 * aptos / NULLIF(SUM(aptos) OVER w, 0), 1) AS pct_eleitorado
FROM junto
WINDOW w AS (PARTITION BY ano, cargo, uf);
CREATE INDEX ix_mv_q4_repr ON mv_q4_representacao (ano, cargo, uf);

/* Parte 2: cada municipio de 2024, com a escolaridade media do eleitorado e a dos eleitos (anos de estudo
   equivalentes), e o grupo (1 = eleitorado de menor escolaridade ... 4 = maior), em quartis dos 1.238 municipios. */
CREATE MATERIALIZED VIEW mv_q4_municipio AS
WITH ele AS (
  SELECT e.cod_ibge,
         SUM(e.qtd_eleitores * g.anos_estudo)::numeric / SUM(e.qtd_eleitores) AS anos_eleitorado,
         100.0 * SUM(e.qtd_eleitores) FILTER (WHERE g.ordem = 7) / SUM(e.qtd_eleitores) AS pct_superior_eleitorado,
         SUM(e.qtd_eleitores) AS aptos
  FROM eleitorado e
  JOIN vw_q4_grau g ON g.grau = e.grau_instrucao
  WHERE e.id_eleicao = 2024 AND e.turno = 1
  GROUP BY e.cod_ibge),
grupo AS (
  SELECT cod_ibge, anos_eleitorado, pct_superior_eleitorado, aptos,
         NTILE(4) OVER (ORDER BY anos_eleitorado, cod_ibge) AS grupo_ordem
  FROM ele),
eleitos AS (
  SELECT cod_ibge, cargo, COUNT(*) AS eleitos, AVG(anos_estudo) AS anos_eleitos,
         100.0 * COUNT(*) FILTER (WHERE ordem = 7) / COUNT(*) AS pct_superior_eleitos
  FROM vw_q4_candidato
  WHERE ano = 2024 AND eleito AND cargo IN ('PREFEITO', 'VEREADOR')
  GROUP BY cod_ibge, cargo)
SELECT m.cod_ibge, m.nome, m.uf, el.cargo, g.aptos, g.anos_eleitorado, g.pct_superior_eleitorado,
       el.eleitos, el.anos_eleitos, el.pct_superior_eleitos, g.grupo_ordem
FROM municipio m
JOIN grupo g ON g.cod_ibge = m.cod_ibge
JOIN eleitos el ON el.cod_ibge = m.cod_ibge;
CREATE INDEX ix_mv_q4_mun ON mv_q4_municipio (cargo, uf, grupo_ordem);

/* Resumo por grupo de municipio (eleitos pesados por pessoa: cada vereador conta uma vez) */
CREATE MATERIALIZED VIEW mv_q4_grupos AS
WITH base AS (
  SELECT mu.cargo, mu.uf, mu.grupo_ordem, mu.cod_ibge, mu.anos_eleitorado, mu.pct_superior_eleitorado, mu.eleitos, mu.anos_eleitos,
         mu.pct_superior_eleitos
  FROM mv_q4_municipio mu)
SELECT cargo, COALESCE(uf, 'TODAS') AS uf, COALESCE(grupo_ordem, 0) AS grupo_ordem,
       COUNT(*) AS municipios,
       SUM(eleitos) AS eleitos,
       ROUND(AVG(anos_eleitorado), 2) AS anos_eleitorado_medio,
       ROUND(MIN(anos_eleitorado), 2) AS anos_eleitorado_min,
       ROUND(MAX(anos_eleitorado), 2) AS anos_eleitorado_max,
       ROUND(AVG(pct_superior_eleitorado), 1) AS pct_superior_eleitorado,
       ROUND((SUM(anos_eleitos * eleitos) / SUM(eleitos))::numeric, 2) AS anos_eleitos_medio,
       ROUND((SUM(pct_superior_eleitos * eleitos) / SUM(eleitos))::numeric, 1) AS pct_superior_eleitos
FROM base
GROUP BY GROUPING SETS ((cargo, uf, grupo_ordem), (cargo, grupo_ordem), (cargo, uf), (cargo));
CREATE INDEX ix_mv_q4_grupos ON mv_q4_grupos (cargo, uf);

/* Correlacao municipio a municipio: escolaridade do eleitorado x escolaridade dos eleitos
   (inclinacao = anos de estudo a mais nos eleitos para cada ano a mais no eleitorado) */
CREATE MATERIALIZED VIEW mv_q4_correlacao AS
SELECT cargo, COALESCE(uf, 'TODAS') AS uf, COUNT(*) AS municipios,
       ROUND(corr(anos_eleitorado, anos_eleitos)::numeric, 3) AS correlacao,
       ROUND(regr_slope(anos_eleitos, anos_eleitorado)::numeric, 3) AS inclinacao
FROM mv_q4_municipio
GROUP BY GROUPING SETS ((cargo, uf), (cargo));
