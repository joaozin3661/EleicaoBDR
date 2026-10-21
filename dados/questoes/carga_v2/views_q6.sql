/* Views da Q6 (banco eleicoes_v2): idade do municipio, idade dos eleitos e alternancia de poder.
   Rodar no pgAdmin depois de importar_idade.py. Depois de recarregar os dados, rode de novo.

   Municipio: classificado pela idade mediana (Censo 2022, IBGE) em quatro grupos de tamanho parecido,
   cortados nos quartis dos 1.238 municipios do projeto. A idade mediana so existe para 2022, entao o grupo e uma
   caracteristica estrutural do municipio, aplicada a todos os pleitos municipais (2004 a 2024).
   Eleitos: prefeito e vereador eleitos. Idade = anos completos em 1 de outubro do ano do pleito.
   Alternancia: compara o prefeito eleito de um pleito com o do pleito anterior (4 anos antes), municipio a municipio. */

DROP MATERIALIZED VIEW IF EXISTS mv_q6_alternancia CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q6_correlacao CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q6_idade CASCADE;
DROP VIEW IF EXISTS vw_q6_grupo CASCADE;
DROP VIEW IF EXISTS vw_q6_eleito CASCADE;
DROP VIEW IF EXISTS vw_q6_municipio CASCADE;
DROP VIEW IF EXISTS vw_q6_linhagem CASCADE;

/* Linhagem partidaria: renomeacoes e fusoes tratadas como o mesmo partido. O numero do partido nao serve
   para isso, porque e reaproveitado (o 44 era o PRP e hoje e o Uniao; o 25 era o DEM e hoje e o PRD).
   Quem nao aparece aqui e comparado pela propria sigla. */
CREATE VIEW vw_q6_linhagem AS
SELECT * FROM (VALUES
  ('PFL', 'UNIÃO'), ('DEM', 'UNIÃO'), ('PSL', 'UNIÃO'), ('UNIÃO', 'UNIÃO'),
  ('PMDB', 'MDB'), ('MDB', 'MDB'),
  ('PRB', 'REPUBLICANOS'), ('REPUBLICANOS', 'REPUBLICANOS'),
  ('PL', 'PL'), ('PR', 'PL'), ('PRONA', 'PL'),
  ('PT do B', 'AVANTE'), ('AVANTE', 'AVANTE'),
  ('SD', 'SOLIDARIEDADE'), ('SOLIDARIEDADE', 'SOLIDARIEDADE'), ('PROS', 'SOLIDARIEDADE'),
  ('PTN', 'PODE'), ('PODE', 'PODE'), ('PSC', 'PODE'), ('PHS', 'PODE'),
  ('PPS', 'CIDADANIA'), ('CIDADANIA', 'CIDADANIA'),
  ('PRP', 'PRD'), ('PATRIOTA', 'PRD'), ('PTB', 'PRD'), ('PRD', 'PRD'),
  ('PC do B', 'PC do B'), ('PPL', 'PC do B')
) AS t(sigla, linhagem);

/* Municipio com a idade mediana e o grupo etario (1 = mais jovens ... 4 = mais envelhecidos) */
CREATE VIEW vw_q6_municipio AS
WITH c AS (
  SELECT m.cod_ibge, m.nome, m.uf, i.idade_mediana, i.indice_envelhecimento
  FROM municipio m
  JOIN indicador_municipal i ON i.cod_ibge = m.cod_ibge AND i.ano = 2022
  WHERE i.idade_mediana IS NOT NULL),
q AS (
  SELECT percentile_disc(0.25) WITHIN GROUP (ORDER BY idade_mediana) AS q1,
         percentile_disc(0.50) WITHIN GROUP (ORDER BY idade_mediana) AS q2,
         percentile_disc(0.75) WITHIN GROUP (ORDER BY idade_mediana) AS q3
  FROM c)
SELECT c.*,
       CASE WHEN c.idade_mediana <= q.q1 THEN 1
            WHEN c.idade_mediana <= q.q2 THEN 2
            WHEN c.idade_mediana <= q.q3 THEN 3
            ELSE 4 END AS grupo_ordem,
       CASE WHEN c.idade_mediana <= q.q1 THEN 'Mais jovens · mediana até ' || q.q1::int || ' anos'
            WHEN c.idade_mediana <= q.q2 THEN 'Jovens · ' || (q.q1::int + 1) || ' a ' || q.q2::int || ' anos'
            WHEN c.idade_mediana <= q.q3 THEN 'Envelhecidos · ' || (q.q2::int + 1) || ' a ' || q.q3::int || ' anos'
            ELSE 'Mais envelhecidos · ' || (q.q3::int + 1) || ' anos ou mais' END AS grupo
FROM c, q;

CREATE VIEW vw_q6_grupo AS
SELECT DISTINCT grupo_ordem, grupo FROM vw_q6_municipio
UNION ALL
SELECT 0, 'Todos os municípios';

/* Prefeitos e vereadores eleitos, com a idade no pleito e a linhagem do partido */
CREATE VIEW vw_q6_eleito AS
SELECT c.id_eleicao AS ano, c.cargo, c.cod_ibge, c.id_pessoa, c.id_candidatura,
       c.sigla_partido, COALESCE(l.linhagem, c.sigla_partido) AS partido_linhagem,
       EXTRACT(YEAR FROM age(make_date(c.id_eleicao, 10, 1), p.data_nascimento))::int AS idade
FROM candidatura c
JOIN pessoa p ON p.id_pessoa = c.id_pessoa
LEFT JOIN vw_q6_linhagem l ON l.sigla = c.sigla_partido
WHERE c.cargo IN ('PREFEITO', 'VEREADOR')
  AND c.situacao_resultado LIKE 'ELEITO%'
  AND c.cod_ibge IS NOT NULL
  AND p.data_nascimento IS NOT NULL;

/* Idade dos eleitos por grupo etario do municipio. grupo_ordem 0 = todos os municipios; uf 'TODAS' = 6 estados. */
CREATE MATERIALIZED VIEW mv_q6_idade AS
SELECT e.ano, e.cargo, COALESCE(m.uf, 'TODAS') AS uf, COALESCE(m.grupo_ordem, 0) AS grupo_ordem,
       COUNT(DISTINCT e.cod_ibge) AS municipios,
       COUNT(*) AS eleitos,
       ROUND(AVG(e.idade), 1) AS idade_media,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY e.idade) AS idade_mediana_eleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE e.idade < 35) / COUNT(*), 1) AS pct_ate_34,
       ROUND(100.0 * COUNT(*) FILTER (WHERE e.idade >= 60) / COUNT(*), 1) AS pct_60_mais
FROM vw_q6_eleito e
JOIN vw_q6_municipio m ON m.cod_ibge = e.cod_ibge
GROUP BY GROUPING SETS ((e.ano, e.cargo, m.uf, m.grupo_ordem), (e.ano, e.cargo, m.grupo_ordem), (e.ano, e.cargo, m.uf), (e.ano, e.cargo));
CREATE INDEX ix_mv_q6_idade ON mv_q6_idade (cargo, uf, ano);

/* Relacao municipio a municipio: idade mediana do municipio x idade media dos eleitos dele.
   inclinacao = anos a mais na idade media dos eleitos para cada ano a mais na idade mediana do municipio. */
CREATE MATERIALIZED VIEW mv_q6_correlacao AS
WITH por_mun AS (
  SELECT e.ano, e.cargo, m.uf, m.cod_ibge, m.idade_mediana, AVG(e.idade) AS idade_media_eleitos
  FROM vw_q6_eleito e JOIN vw_q6_municipio m ON m.cod_ibge = e.cod_ibge
  GROUP BY e.ano, e.cargo, m.uf, m.cod_ibge, m.idade_mediana)
SELECT ano, cargo, COALESCE(uf, 'TODAS') AS uf,
       COUNT(*) AS municipios,
       ROUND(corr(idade_mediana, idade_media_eleitos)::numeric, 3) AS correlacao,
       ROUND(regr_slope(idade_media_eleitos, idade_mediana)::numeric, 3) AS inclinacao
FROM por_mun
GROUP BY GROUPING SETS ((ano, cargo, uf), (ano, cargo));
CREATE INDEX ix_mv_q6_corr ON mv_q6_correlacao (cargo, uf, ano);

/* Alternancia de poder entre pleitos consecutivos (prefeito). Cada linha de "transicao" e um municipio que
   teve prefeito eleito nos dois pleitos. partido_mudou usa a linhagem partidaria; reeleito = o mesmo prefeito
   ganhou de novo (so entre os que concorreram: a lei limita a duas eleicoes seguidas). */
CREATE MATERIALIZED VIEW mv_q6_alternancia AS
WITH e AS (SELECT * FROM vw_q6_eleito WHERE cargo = 'PREFEITO'),
t AS (
  SELECT b.ano, b.cod_ibge,
         (a.partido_linhagem <> b.partido_linhagem) AS partido_mudou,
         (a.id_pessoa <> b.id_pessoa) AS pessoa_mudou,
         (a.id_pessoa = b.id_pessoa) AS reeleito,
         EXISTS (SELECT 1 FROM candidatura x
                 WHERE x.cargo = 'PREFEITO' AND x.cod_ibge = b.cod_ibge AND x.id_eleicao = b.ano
                   AND x.id_pessoa = a.id_pessoa
                   AND (x.situacao_resultado LIKE 'ELEITO%' OR x.situacao_resultado = 'NÃO ELEITO')) AS concorreu
  FROM e a
  JOIN e b ON b.cod_ibge = a.cod_ibge AND b.ano = a.ano + 4)
SELECT t.ano, COALESCE(m.uf, 'TODAS') AS uf, COALESCE(m.grupo_ordem, 0) AS grupo_ordem,
       COUNT(*) AS transicoes,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.partido_mudou) / COUNT(*), 1) AS pct_partido_mudou,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.pessoa_mudou) / COUNT(*), 1) AS pct_prefeito_mudou,
       COUNT(*) FILTER (WHERE t.concorreu) AS incumbentes_concorreram,
       COUNT(*) FILTER (WHERE t.reeleito) AS incumbentes_reeleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.reeleito) / NULLIF(COUNT(*) FILTER (WHERE t.concorreu), 0), 1) AS pct_reeleicao,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.concorreu) / COUNT(*), 1) AS pct_tentou_reeleicao
FROM t
JOIN vw_q6_municipio m ON m.cod_ibge = t.cod_ibge
GROUP BY GROUPING SETS ((t.ano, m.uf, m.grupo_ordem), (t.ano, m.grupo_ordem), (t.ano, m.uf), (t.ano));
CREATE INDEX ix_mv_q6_alt ON mv_q6_alternancia (uf, ano);
