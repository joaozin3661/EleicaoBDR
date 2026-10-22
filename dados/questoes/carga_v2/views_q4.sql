/* Views da Q4 (banco eleicoes_v2): escolaridade do candidato e escolaridade do eleitorado.
   Rodar no pgAdmin depois de importar_eleitorado.py. Depois de recarregar os dados, rode de novo.

   Parte 1 (2022 e 2024): a escolaridade do candidato se relaciona a ser eleito?
   Parte 2 (2024 e 2022): municipios com eleitorado de menor escolaridade elegem candidatos de menor escolaridade?
   2024 (prefeito e vereador): os eleitos pertencem ao municipio.
   2022 (deputado federal e estadual): os eleitos representam o estado, entao a escolaridade "dos eleitos" de cada municipio e medida
   pelos votos: a media da escolaridade dos eleitos ponderada pelos votos que o municipio deu a eles (precisa de importar_q5.py).
   Governador e senador de 2022 ficam fora da parte 2: seus votos por municipio nao foram carregados. */

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

/* Parte 2: cada municipio, por eleicao, com a escolaridade media do eleitorado e a dos eleitos (anos de estudo equivalentes),
   e o grupo (1 = eleitorado de menor escolaridade ... 4 = maior), em quartis dos 1.238 municipios de cada eleicao.
   peso = o que pondera o municipio ao somar grupos: numero de eleitos (2024) ou votos que o municipio deu aos eleitos (2022).
   anos_votados (so 2022) e a mesma media sobre todos os candidatos votados, eleitos ou nao; votos_candidatos e o peso dela. */
CREATE MATERIALIZED VIEW mv_q4_municipio AS
WITH ele AS (
  SELECT e.id_eleicao AS ano, e.cod_ibge,
         SUM(e.qtd_eleitores * g.anos_estudo)::numeric / SUM(e.qtd_eleitores) AS anos_eleitorado,
         100.0 * SUM(e.qtd_eleitores) FILTER (WHERE g.ordem = 7) / SUM(e.qtd_eleitores) AS pct_superior_eleitorado,
         SUM(e.qtd_eleitores) AS aptos
  FROM eleitorado e
  JOIN vw_q4_grau g ON g.grau = e.grau_instrucao
  WHERE e.id_eleicao IN (2022, 2024) AND e.turno = 1
  GROUP BY e.id_eleicao, e.cod_ibge),
grupo AS (
  SELECT ano, cod_ibge, anos_eleitorado, pct_superior_eleitorado, aptos,
         NTILE(4) OVER (PARTITION BY ano ORDER BY anos_eleitorado, cod_ibge) AS grupo_ordem
  FROM ele),
e24 AS (
  SELECT 2024 AS ano, cod_ibge, cargo, COUNT(*)::numeric AS eleitos, NULL::numeric AS votos_para_eleitos,
         AVG(anos_estudo) AS anos_eleitos,
         100.0 * COUNT(*) FILTER (WHERE ordem = 7) / COUNT(*) AS pct_superior_eleitos,
         NULL::numeric AS anos_votados, NULL::numeric AS pct_superior_votados, NULL::numeric AS votos_candidatos,
         COUNT(*)::numeric AS peso
  FROM vw_q4_candidato
  WHERE ano = 2024 AND eleito AND cargo IN ('PREFEITO', 'VEREADOR')
  GROUP BY cod_ibge, cargo),
v22 AS (
  SELECT 2022 AS ano, v.cod_ibge, c.cargo, NULL::numeric AS eleitos,
         SUM(v.votos_nominais) FILTER (WHERE c.eleito)::numeric AS votos_para_eleitos,
         SUM(v.votos_nominais * c.anos_estudo) FILTER (WHERE c.eleito)::numeric / NULLIF(SUM(v.votos_nominais) FILTER (WHERE c.eleito), 0) AS anos_eleitos,
         100.0 * SUM(v.votos_nominais) FILTER (WHERE c.eleito AND c.ordem = 7) / NULLIF(SUM(v.votos_nominais) FILTER (WHERE c.eleito), 0) AS pct_superior_eleitos,
         SUM(v.votos_nominais * c.anos_estudo)::numeric / NULLIF(SUM(v.votos_nominais), 0) AS anos_votados,
         100.0 * SUM(v.votos_nominais) FILTER (WHERE c.ordem = 7) / NULLIF(SUM(v.votos_nominais), 0) AS pct_superior_votados,
         SUM(v.votos_nominais)::numeric AS votos_candidatos,
         SUM(v.votos_nominais) FILTER (WHERE c.eleito)::numeric AS peso
  FROM votacao v
  JOIN vw_q4_candidato c ON c.id_candidatura = v.id_candidatura
  WHERE v.turno = 1 AND c.ano = 2022 AND c.cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL')
  GROUP BY v.cod_ibge, c.cargo),
el AS (SELECT * FROM e24 UNION ALL SELECT * FROM v22)
SELECT g.ano, m.cod_ibge, m.nome, m.uf, el.cargo, g.aptos, g.anos_eleitorado, g.pct_superior_eleitorado,
       el.eleitos, el.votos_para_eleitos, el.anos_eleitos, el.pct_superior_eleitos, el.anos_votados, el.pct_superior_votados,
       el.votos_candidatos, el.peso, g.grupo_ordem
FROM municipio m
JOIN grupo g ON g.cod_ibge = m.cod_ibge
JOIN el ON el.cod_ibge = m.cod_ibge AND el.ano = g.ano
WHERE el.peso > 0;
CREATE INDEX ix_mv_q4_mun ON mv_q4_municipio (ano, cargo, uf, grupo_ordem);

/* Resumo por grupo de municipio (grupo_ordem 0 = todos). Medias dos eleitos ponderadas pelo peso do municipio:
   cada vereador conta uma vez (2024); cada voto dado a um eleito conta uma vez (2022). */
CREATE MATERIALIZED VIEW mv_q4_grupos AS
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf, COALESCE(grupo_ordem, 0) AS grupo_ordem,
       COUNT(*) AS municipios,
       SUM(eleitos) AS eleitos,
       SUM(votos_para_eleitos) AS votos_para_eleitos,
       ROUND(AVG(anos_eleitorado), 2) AS anos_eleitorado_medio,
       ROUND(MIN(anos_eleitorado), 2) AS anos_eleitorado_min,
       ROUND(MAX(anos_eleitorado), 2) AS anos_eleitorado_max,
       ROUND(AVG(pct_superior_eleitorado), 1) AS pct_superior_eleitorado,
       ROUND((SUM(anos_eleitos * peso) / SUM(peso))::numeric, 2) AS anos_eleitos_medio,
       ROUND((SUM(pct_superior_eleitos * peso) / SUM(peso))::numeric, 1) AS pct_superior_eleitos,
       ROUND((SUM(anos_votados * votos_candidatos) / NULLIF(SUM(votos_candidatos), 0))::numeric, 2) AS anos_votados_medio,
       ROUND((SUM(pct_superior_votados * votos_candidatos) / NULLIF(SUM(votos_candidatos), 0))::numeric, 1) AS pct_superior_votados
FROM mv_q4_municipio
GROUP BY GROUPING SETS ((ano, cargo, uf, grupo_ordem), (ano, cargo, grupo_ordem), (ano, cargo, uf), (ano, cargo));
CREATE INDEX ix_mv_q4_grupos ON mv_q4_grupos (ano, cargo, uf);

/* Correlacao municipio a municipio: escolaridade do eleitorado x escolaridade dos eleitos
   (inclinacao = anos de estudo a mais nos eleitos para cada ano a mais no eleitorado).
   correlacao_votados (so 2022) usa a media de todos os candidatos votados, nao so dos eleitos. */
CREATE MATERIALIZED VIEW mv_q4_correlacao AS
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf, COUNT(*) AS municipios,
       ROUND(corr(anos_eleitorado, anos_eleitos)::numeric, 3) AS correlacao,
       ROUND(regr_slope(anos_eleitos, anos_eleitorado)::numeric, 3) AS inclinacao,
       ROUND(corr(anos_eleitorado, anos_votados)::numeric, 3) AS correlacao_votados
FROM mv_q4_municipio
GROUP BY GROUPING SETS ((ano, cargo, uf), (ano, cargo));
