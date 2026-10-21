/* Views da Q3 (banco eleicoes_v2): indices do municipio x eleitos e partidos mais vitoriosos.
   Rodar no pgAdmin depois de importar_q3.py. Depois de recarregar os dados, rode de novo.

   Recorte: eleicoes municipais de 2008 e 2012, as que cercam 2010, unico ano com IDHM municipal e Censo. Todos os indices
   (IDHM, PIB per capita, populacao) sao de 2010 e valem como retrato do municipio para as duas eleicoes: a de 2008 vem
   dois anos antes do retrato, a de 2012 dois anos depois. Tres municipios criados depois de 2010 ficam de fora.
   Eleicoes gerais (deputados, governador, senador) nao entram: os eleitos nao pertencem a um municipio. */

DROP MATERIALIZED VIEW IF EXISTS mv_q3_correlacao CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q3_partidos CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q3_grupos CASCADE;
DROP VIEW IF EXISTS vw_q3_eleicao CASCADE;
DROP VIEW IF EXISTS vw_q3_municipio CASCADE;

/* Municipio com os indices de 2010. Faixas do IDHM: as oficiais do Atlas (PNUD). PIB per capita em quartis dos
   municipios do projeto. */
CREATE VIEW vw_q3_municipio AS
WITH c AS (
  SELECT m.cod_ibge, m.nome, m.uf, i.idhm, i.pib_per_capita, i.populacao
  FROM municipio m
  JOIN indicador_municipal i ON i.cod_ibge = m.cod_ibge AND i.ano = 2010
  WHERE i.idhm IS NOT NULL AND i.pib_per_capita IS NOT NULL AND i.populacao > 0)
SELECT c.*,
       CASE WHEN idhm < 0.5 THEN 1 WHEN idhm < 0.6 THEN 2 WHEN idhm < 0.7 THEN 3 WHEN idhm < 0.8 THEN 4 ELSE 5 END AS faixa_idhm,
       NTILE(4) OVER (ORDER BY pib_per_capita, cod_ibge) AS quartil_pib
FROM c;

/* Cada municipio em cada eleicao (prefeito, 1o turno): eleitores, abstencao, brancos, nulos e a relacao eleitores/populacao.
   anulada = a eleicao teve percentual de nulos atipico. No TSE, os votos de candidatos cujo registro foi indeferido entram
   como nulos; em 2008 e 2012, 89% e 69% dos municipios com nulos atipicos tinham candidato a prefeito de registro indeferido
   (contra 6% e 4% dos demais). Nesses municipios os nulos nao medem o eleitor, e eles saem das medidas de isentos.
   O corte e estatistico: nulos acima de Q3 + 3 x (Q3 - Q1) da eleicao (12,8% em 2008 e 9,9% em 2012; a mediana e 3 a 4%). */
CREATE VIEW vw_q3_eleicao AS
WITH e AS (
  SELECT t.id_eleicao AS ano, m.*,
         t.eleitores_aptos AS aptos,
         t.abstencoes, t.votos_brancos AS brancos, t.votos_nulos AS nulos,
         t.abstencoes + t.votos_brancos + t.votos_nulos AS isentos,
         t.eleitores_aptos::numeric / m.populacao AS razao_eleitores_pop,
         100.0 * t.votos_nulos / t.eleitores_aptos AS pct_nulos_mun
  FROM totalizacao_municipio t
  JOIN vw_q3_municipio m ON m.cod_ibge = t.cod_ibge
  WHERE t.cargo = 'PREFEITO' AND t.turno = 1 AND t.id_eleicao IN (2008, 2012)),
q AS (
  SELECT ano, percentile_cont(0.25) WITHIN GROUP (ORDER BY pct_nulos_mun) AS q1,
         percentile_cont(0.75) WITHIN GROUP (ORDER BY pct_nulos_mun) AS q3
  FROM e GROUP BY ano)
SELECT e.*, (e.pct_nulos_mun > q.q3 + 3 * (q.q3 - q.q1)) AS anulada
FROM e JOIN q ON q.ano = e.ano;

/* Grupos de municipios. dimensao: 'IDHM' (grupo_ordem 1 a 5), 'PIB' (quartis 1 a 4) ou 'TODOS' (0). uf 'TODAS' soma os 6 estados.
   Isentos = abstencoes + brancos + nulos, sobre os eleitores aptos (percentuais "pooled": soma dos votos / soma dos aptos). */
CREATE MATERIALIZED VIEW mv_q3_grupos AS
WITH base AS (
  SELECT ano, uf, cod_ibge, populacao, aptos, abstencoes, brancos, nulos, isentos, anulada, idhm, pib_per_capita,
         faixa_idhm AS g_idhm, quartil_pib AS g_pib
  FROM vw_q3_eleicao),
dims AS (
  SELECT *, 'IDHM' AS dimensao, g_idhm AS grupo_ordem FROM base
  UNION ALL SELECT *, 'PIB', g_pib FROM base
  UNION ALL SELECT *, 'TODOS', 0 FROM base)
SELECT ano, dimensao, grupo_ordem, COALESCE(uf, 'TODAS') AS uf,
       COUNT(*) AS municipios,
       COUNT(*) FILTER (WHERE anulada) AS municipios_anulados,
       SUM(populacao) AS populacao,
       SUM(aptos) AS aptos,
       ROUND(100.0 * SUM(isentos) FILTER (WHERE NOT anulada) / NULLIF(SUM(aptos) FILTER (WHERE NOT anulada), 0), 2) AS pct_isentos,
       ROUND(100.0 * SUM(abstencoes) FILTER (WHERE NOT anulada) / NULLIF(SUM(aptos) FILTER (WHERE NOT anulada), 0), 2) AS pct_abstencao,
       ROUND(100.0 * SUM(brancos) FILTER (WHERE NOT anulada) / NULLIF(SUM(aptos) FILTER (WHERE NOT anulada), 0), 2) AS pct_brancos,
       ROUND(100.0 * SUM(nulos) FILTER (WHERE NOT anulada) / NULLIF(SUM(aptos) FILTER (WHERE NOT anulada), 0), 2) AS pct_nulos,
       ROUND(100.0 * SUM(isentos) / SUM(aptos), 2) AS pct_isentos_todos,
       ROUND(100.0 * SUM(aptos) / SUM(populacao), 2) AS pct_eleitores_pop,
       ROUND(AVG(idhm), 3) AS idhm_medio,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY pib_per_capita))::numeric, 2) AS pib_per_capita_mediano,
       MIN(idhm) AS idhm_min, MAX(idhm) AS idhm_max,
       MIN(pib_per_capita) AS pib_min, MAX(pib_per_capita) AS pib_max
FROM dims
GROUP BY GROUPING SETS ((ano, dimensao, grupo_ordem, uf), (ano, dimensao, grupo_ordem));
CREATE INDEX ix_mv_q3_grupos ON mv_q3_grupos (ano, dimensao, uf);

/* Partidos eleitos por grupo de municipio. Prefeito: um eleito por municipio. Vereador: cada vereador eleito conta uma vez.
   O partido e a sigla da epoca (de 2008 a 2012 as siglas nao mudaram). */
CREATE MATERIALIZED VIEW mv_q3_partidos AS
WITH eleitos AS (
  SELECT c.id_eleicao AS ano, c.cargo, c.cod_ibge, c.sigla_partido AS partido, m.uf, m.faixa_idhm, m.quartil_pib
  FROM candidatura c
  JOIN vw_q3_municipio m ON m.cod_ibge = c.cod_ibge
  WHERE c.id_eleicao IN (2008, 2012) AND c.cargo IN ('PREFEITO', 'VEREADOR') AND c.situacao_resultado LIKE 'ELEITO%'),
dims AS (
  SELECT ano, cargo, uf, partido, 'IDHM' AS dimensao, faixa_idhm AS grupo_ordem FROM eleitos
  UNION ALL SELECT ano, cargo, uf, partido, 'PIB', quartil_pib FROM eleitos
  UNION ALL SELECT ano, cargo, uf, partido, 'TODOS', 0 FROM eleitos),
cont AS (
  SELECT ano, cargo, dimensao, grupo_ordem, COALESCE(uf, 'TODAS') AS uf, partido, COUNT(*) AS eleitos
  FROM dims
  GROUP BY GROUPING SETS ((ano, cargo, dimensao, grupo_ordem, uf, partido), (ano, cargo, dimensao, grupo_ordem, partido)))
SELECT ano, cargo, dimensao, grupo_ordem, uf, partido, eleitos,
       ROUND(100.0 * eleitos / SUM(eleitos) OVER (PARTITION BY ano, cargo, dimensao, grupo_ordem, uf), 1) AS pct_do_grupo,
       RANK() OVER (PARTITION BY ano, cargo, dimensao, grupo_ordem, uf ORDER BY eleitos DESC) AS posicao
FROM cont;
CREATE INDEX ix_mv_q3_partidos ON mv_q3_partidos (ano, cargo, dimensao, uf);

/* Correlacao municipio a municipio entre cada indice e cada medida eleitoral. Usa o logaritmo do PIB per capita
   (a distribuicao e muito assimetrica: poucos municipios com PIB per capita altissimo). */
CREATE MATERIALIZED VIEW mv_q3_correlacao AS
WITH b AS (
  SELECT ano, uf, idhm, ln(pib_per_capita) AS ln_pib,
         CASE WHEN NOT anulada THEN 100.0 * isentos / aptos END AS pct_isentos,
         CASE WHEN NOT anulada THEN 100.0 * abstencoes / aptos END AS pct_abstencao,
         CASE WHEN NOT anulada THEN 100.0 * brancos / aptos END AS pct_brancos,
         CASE WHEN NOT anulada THEN 100.0 * nulos / aptos END AS pct_nulos,
         100.0 * razao_eleitores_pop AS pct_eleitores_pop
  FROM vw_q3_eleicao),
t AS (
  SELECT ano, uf, 'IDHM' AS indice, 'pct_isentos' AS medida, idhm AS x, pct_isentos AS y FROM b
  UNION ALL SELECT ano, uf, 'IDHM', 'pct_abstencao', idhm, pct_abstencao FROM b
  UNION ALL SELECT ano, uf, 'IDHM', 'pct_brancos', idhm, pct_brancos FROM b
  UNION ALL SELECT ano, uf, 'IDHM', 'pct_nulos', idhm, pct_nulos FROM b
  UNION ALL SELECT ano, uf, 'IDHM', 'pct_eleitores_pop', idhm, pct_eleitores_pop FROM b
  UNION ALL SELECT ano, uf, 'PIB', 'pct_isentos', ln_pib, pct_isentos FROM b
  UNION ALL SELECT ano, uf, 'PIB', 'pct_abstencao', ln_pib, pct_abstencao FROM b
  UNION ALL SELECT ano, uf, 'PIB', 'pct_brancos', ln_pib, pct_brancos FROM b
  UNION ALL SELECT ano, uf, 'PIB', 'pct_nulos', ln_pib, pct_nulos FROM b
  UNION ALL SELECT ano, uf, 'PIB', 'pct_eleitores_pop', ln_pib, pct_eleitores_pop FROM b)
SELECT ano, COALESCE(uf, 'TODAS') AS uf, indice, medida, COUNT(y) AS municipios,
       ROUND(corr(x, y)::numeric, 3) AS correlacao
FROM t
GROUP BY GROUPING SETS ((ano, uf, indice, medida), (ano, indice, medida));
CREATE INDEX ix_mv_q3_corr ON mv_q3_correlacao (ano, uf);
