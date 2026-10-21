/* Views da Q8 (banco eleicoes_v2): recursos publicos x privados e o desempenho eleitoral.
   Rodar no pgAdmin depois de importar_receitas.py. Depois de recarregar as receitas, rode de novo.

   Publico = FUNDO ESPECIAL (FEFC) + FUNDO PARTIDARIO, como o TSE classifica na fonte da receita.
   Isso vale tambem para o dinheiro que o partido repassa ao candidato: o TSE ja marca o repasse
   feito com verba do fundo como FUNDO ESPECIAL ou FUNDO PARTIDARIO. O que o partido repassa de
   outras fontes (suas doacoes privadas) fica como privado. */

DROP MATERIALIZED VIEW IF EXISTS mv_q8_origem CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q8_resumo CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q8_faixas CASCADE;
DROP VIEW IF EXISTS vw_q8_receita CASCADE;
DROP VIEW IF EXISTS vw_q8_candidato CASCADE;

/* Cada candidatura elegivel com o que arrecadou e quanto era dinheiro publico.
   Elegivel = 2018+, resultado ELEITO% / NAO ELEITO / SUPLENTE, sem vices e suplentes de senador
   (a arrecadacao do vice e do suplente vai na conta do titular). Quem nao declarou receita tem total 0. */
CREATE VIEW vw_q8_candidato AS
WITH r AS (
  SELECT id_candidatura,
         SUM(valor) AS total,
         COALESCE(SUM(valor) FILTER (WHERE origem_recurso IN ('FUNDO ESPECIAL', 'FUNDO PARTIDARIO')), 0) AS publico
  FROM receita
  GROUP BY id_candidatura),
c AS (
  SELECT c.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sg_uf AS uf,
         (c.situacao_resultado LIKE 'ELEITO%') AS eleito,
         COALESCE(r.total, 0) AS total, COALESCE(r.publico, 0) AS publico
  FROM candidatura c
  LEFT JOIN r ON r.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao >= 2018
    AND c.cargo NOT LIKE 'VICE%'
    AND c.cargo NOT LIKE '%SUPLENTE%'
    AND (c.situacao_resultado LIKE 'ELEITO%' OR c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE')))
SELECT c.*,
       c.total - c.publico AS privado,
       ROUND(100.0 * c.publico / NULLIF(c.total, 0), 2) AS pct_publico,
       CASE WHEN c.total = 0 THEN 0                  /* sem receita declarada */
            WHEN c.publico = 0 THEN 1                /* nenhum dinheiro publico */
            WHEN c.publico >= c.total THEN 6         /* 100% publico */
            WHEN c.publico * 4 >= c.total * 3 THEN 5 /* 75% a 99% */
            WHEN c.publico * 2 >= c.total THEN 4     /* 50% a 75% */
            WHEN c.publico * 4 >= c.total THEN 3     /* 25% a 50% */
            ELSE 2 END AS ordem                      /* menos de 25% */
FROM c;

/* Cada linha de receita com o canal em que o dinheiro entrou */
CREATE VIEW vw_q8_receita AS
SELECT r.id_candidatura, r.valor, r.origem_recurso,
       (r.origem_recurso IN ('FUNDO ESPECIAL', 'FUNDO PARTIDARIO')) AS publico,
       CASE WHEN r.origem_recurso = 'FUNDO ESPECIAL' THEN 'Fundo Especial (FEFC)'
            WHEN r.origem_recurso = 'FUNDO PARTIDARIO' THEN 'Fundo Partidário'
            WHEN r.tipo_doador LIKE 'Recursos de partido%' THEN 'Partido (outras fontes)'
            WHEN r.tipo_doador LIKE 'Recursos de pessoas%' THEN 'Pessoas físicas'
            WHEN r.tipo_doador LIKE 'Recursos próprios%' THEN 'Recursos do próprio candidato'
            WHEN r.tipo_doador LIKE 'Recursos de outros candidatos%' THEN 'Outros candidatos'
            ELSE 'Outras fontes' END AS categoria
FROM receita r;

/* Leitura principal: taxa de sucesso por faixa de participacao do dinheiro publico.
   uf = 'TODAS' soma os 6 estados. */
CREATE MATERIALIZED VIEW mv_q8_faixas AS
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf, ordem,
       (ARRAY['Sem receita declarada', 'Nenhum dinheiro público', 'Menos de 25% público', '25% a 50% público',
              '50% a 75% público', '75% a 99% público', '100% público'])[ordem + 1] AS faixa,
       COUNT(*) AS candidatos,
       COUNT(*) FILTER (WHERE eleito) AS eleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE eleito) / COUNT(*), 1) AS taxa_sucesso,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY total))::numeric, 2) AS receita_mediana
FROM vw_q8_candidato
GROUP BY GROUPING SETS ((ano, cargo, uf, ordem), (ano, cargo, ordem));
CREATE INDEX ix_mv_q8_faixas ON mv_q8_faixas (ano, cargo, uf);

/* Resumo de cada disputa: quanto dinheiro circulou, quanto era publico e as duas taxas "majoritariamente"
   (publico = mais da metade da arrecadacao do candidato; so entram candidatos com alguma receita). */
CREATE MATERIALIZED VIEW mv_q8_resumo AS
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf,
       COUNT(*) AS candidatos,
       COUNT(*) FILTER (WHERE eleito) AS eleitos,
       COUNT(*) FILTER (WHERE total = 0) AS sem_receita,
       ROUND(SUM(total), 2) AS receita_total,
       ROUND(100.0 * SUM(publico) / NULLIF(SUM(total), 0), 1) AS pct_publico_do_dinheiro,
       COUNT(*) FILTER (WHERE total > 0 AND publico * 2 > total) AS maioria_publica,
       COUNT(*) FILTER (WHERE total > 0 AND publico * 2 > total AND eleito) AS maioria_publica_eleitos,
       COUNT(*) FILTER (WHERE total > 0 AND publico * 2 <= total) AS maioria_privada,
       COUNT(*) FILTER (WHERE total > 0 AND publico * 2 <= total AND eleito) AS maioria_privada_eleitos,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY total) FILTER (WHERE eleito AND total > 0))::numeric, 2) AS mediana_receita_eleitos,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY total) FILTER (WHERE NOT eleito AND total > 0))::numeric, 2) AS mediana_receita_nao_eleitos
FROM vw_q8_candidato
GROUP BY GROUPING SETS ((ano, cargo, uf), (ano, cargo));
CREATE INDEX ix_mv_q8_resumo ON mv_q8_resumo (ano, cargo, uf);

/* De onde veio o dinheiro de eleitos e de nao eleitos (suplentes contam como nao eleitos) */
CREATE MATERIALIZED VIEW mv_q8_origem AS
SELECT c.ano, c.cargo, COALESCE(c.uf, 'TODAS') AS uf,
       CASE WHEN c.eleito THEN 'Eleitos' ELSE 'Não eleitos' END AS grupo,
       r.categoria, r.publico,
       ROUND(SUM(r.valor), 2) AS valor,
       COUNT(DISTINCT c.id_candidatura) AS candidatos
FROM vw_q8_candidato c
JOIN vw_q8_receita r ON r.id_candidatura = c.id_candidatura
GROUP BY GROUPING SETS ((c.ano, c.cargo, c.uf, c.eleito, r.categoria, r.publico), (c.ano, c.cargo, c.eleito, r.categoria, r.publico));
CREATE INDEX ix_mv_q8_origem ON mv_q8_origem (ano, cargo, uf);
