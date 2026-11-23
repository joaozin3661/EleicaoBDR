/* Q1: presidente entra no custo da cadeira (1 vaga por eleicao). Refaz so mv_q1_custo_cadeira,
   igual ao 01_base.sql, sem rodar as outras views. Nenhuma outra view depende desta. */
BEGIN;
DROP MATERIALIZED VIEW IF EXISTS mv_q1_custo_cadeira;
CREATE MATERIALIZED VIEW mv_q1_custo_cadeira AS
WITH gasto AS (
  SELECT ano, cargo, uf, COUNT(*) AS candidatos, SUM(gasto) AS gasto_total
  FROM vw_gasto_candidatura
  GROUP BY ano, cargo, uf),
vagas AS (
  SELECT v.id_eleicao AS ano, v.cargo, v.sg_uf AS uf, SUM(v.qt_vaga) AS cadeiras
  FROM vaga v
  WHERE v.cargo NOT LIKE 'VICE%' AND v.cargo NOT LIKE '%SUPLENTE%'
  GROUP BY v.id_eleicao, v.cargo, v.sg_uf
  /* o arquivo de vagas do TSE nao traz presidente: a vaga e uma so por eleicao, na UF em que o TSE
     registra as candidaturas a presidente */
  UNION ALL
  SELECT DISTINCT ano, cargo, uf, 1
  FROM vw_gasto_candidatura WHERE cargo = 'PRESIDENTE')
SELECT g.ano, g.cargo, g.uf, g.candidatos, v.cadeiras,
       ROUND(g.gasto_total, 2) AS gasto_total,
       ROUND(g.gasto_total / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g
JOIN vagas v ON v.ano = g.ano AND v.cargo = g.cargo AND v.uf = g.uf;
CREATE INDEX ix_mv_q1_cc ON mv_q1_custo_cadeira (ano, cargo, uf);
COMMIT;

SELECT ano, cargo, uf, candidatos, cadeiras, gasto_total, custo_por_cadeira
FROM mv_q1_custo_cadeira WHERE cargo = 'PRESIDENTE' ORDER BY ano;
