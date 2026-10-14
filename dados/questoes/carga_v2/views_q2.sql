/* Views da Q2 (banco eleicoes_v2): taxa de sucesso eleitoral por patrimonio declarado.
   Rodar no pgAdmin depois de importar_bens.py. Depois de recarregar os bens, rode de novo. */

DROP MATERIALIZED VIEW IF EXISTS mv_q2_resumo CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q2_quintis CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q2_faixas CASCADE;
DROP VIEW IF EXISTS vw_q2_patrimonio CASCADE;

/* Patrimonio de cada candidatura = soma dos bens declarados; quem nao declarou nenhum bem tem R$ 0.
   Entram so as candidaturas que chegaram ao resultado (eleito, nao eleito ou suplente), de 2018 a 2024.
   Vices e suplentes de senador ficam de fora: sao eleitos junto com o titular, nao por conta propria. */
CREATE VIEW vw_q2_patrimonio AS
SELECT c.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sg_uf AS uf,
       COALESCE(SUM(b.valor), 0) AS patrimonio,
       COUNT(b.id_bem) AS bens,
       (c.situacao_resultado LIKE 'ELEITO%') AS eleito
FROM candidatura c
LEFT JOIN bem_declarado b ON b.id_candidatura = c.id_candidatura
WHERE c.id_eleicao >= 2018
  AND c.cargo NOT LIKE 'VICE%'
  AND c.cargo NOT LIKE '%SUPLENTE%'
  AND (c.situacao_resultado LIKE 'ELEITO%' OR c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE'))
GROUP BY c.id_candidatura, c.id_eleicao, c.cargo, c.sg_uf, c.situacao_resultado;

/* Leitura 1: faixas fixas de patrimonio. uf = 'TODAS' soma os 6 estados. */
CREATE MATERIALIZED VIEW mv_q2_faixas AS
WITH f AS (
  SELECT p.*,
         CASE WHEN patrimonio = 0 THEN 0
              WHEN patrimonio <= 50000 THEN 1
              WHEN patrimonio <= 200000 THEN 2
              WHEN patrimonio <= 1000000 THEN 3
              WHEN patrimonio <= 5000000 THEN 4
              ELSE 5 END AS ordem
  FROM vw_q2_patrimonio p)
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf, ordem,
       (ARRAY['Sem bens declarados', 'Até R$ 50 mil', 'R$ 50 mil a 200 mil', 'R$ 200 mil a 1 mi',
              'R$ 1 mi a 5 mi', 'Acima de R$ 5 mi'])[ordem + 1] AS faixa,
       COUNT(*) AS candidatos,
       COUNT(*) FILTER (WHERE eleito) AS eleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE eleito) / COUNT(*), 1) AS taxa_sucesso,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY patrimonio))::numeric, 2) AS patrimonio_mediano
FROM f
GROUP BY GROUPING SETS ((ano, cargo, uf, ordem), (ano, cargo, ordem));
CREATE INDEX ix_mv_q2_faixas ON mv_q2_faixas (ano, cargo, uf);

/* Leitura 2: quintos de patrimonio DENTRO do cargo, entre quem declarou algum bem
   (quintil 1 = os 20% com menos patrimonio; 5 = os 20% com mais). Quintil 0 = sem bens.
   Compara ricos e pobres de cada disputa, sem misturar a escala de vereador com a de governador. */
CREATE MATERIALIZED VIEW mv_q2_quintis AS
WITH base AS (
  SELECT p.*, uf AS uf_grupo FROM vw_q2_patrimonio p
  UNION ALL
  SELECT p.*, 'TODAS' FROM vw_q2_patrimonio p),
q AS (
  SELECT b.*,
         CASE WHEN patrimonio = 0 THEN 0
              ELSE NTILE(5) OVER (PARTITION BY ano, cargo, uf_grupo, (patrimonio > 0) ORDER BY patrimonio, id_candidatura) END AS quintil
  FROM base b)
SELECT ano, cargo, uf_grupo AS uf, quintil,
       COUNT(*) AS candidatos,
       COUNT(*) FILTER (WHERE eleito) AS eleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE eleito) / COUNT(*), 1) AS taxa_sucesso,
       MIN(patrimonio) AS patrimonio_min,
       MAX(patrimonio) AS patrimonio_max
FROM q
GROUP BY ano, cargo, uf_grupo, quintil;
CREATE INDEX ix_mv_q2_quintis ON mv_q2_quintis (ano, cargo, uf);

/* Resumo de cada disputa: taxa geral, quantos nao declaram bens e patrimonio mediano de eleitos e nao eleitos.
   Mediana e nao media: ha declaracoes de R$ 1 bilhao para uma casa, erro de digitacao na origem. */
CREATE MATERIALIZED VIEW mv_q2_resumo AS
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf,
       COUNT(*) AS candidatos,
       COUNT(*) FILTER (WHERE eleito) AS eleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE eleito) / COUNT(*), 1) AS taxa_sucesso,
       ROUND(100.0 * COUNT(*) FILTER (WHERE patrimonio = 0) / COUNT(*), 1) AS pct_sem_bens,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY patrimonio) FILTER (WHERE eleito))::numeric, 2) AS mediana_eleitos,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY patrimonio) FILTER (WHERE NOT eleito))::numeric, 2) AS mediana_nao_eleitos,
       COUNT(*) FILTER (WHERE patrimonio >= 100000000) AS declaracoes_acima_100mi
FROM vw_q2_patrimonio
GROUP BY GROUPING SETS ((ano, cargo, uf), (ano, cargo));
CREATE INDEX ix_mv_q2_resumo ON mv_q2_resumo (ano, cargo, uf);
