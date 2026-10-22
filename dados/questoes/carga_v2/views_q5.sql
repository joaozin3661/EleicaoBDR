/* Views da Q5 (banco eleicoes_v2): quantos candidatos de cada partido foram eleitos por votos de legenda.
   Rodar no pgAdmin depois de importar_q5.py. Depois de recarregar os dados, rode de novo.

   Escopo: eleicoes proporcionais dos 6 estados: deputado federal e estadual (2018 e 2022) e vereador (2020 e 2024).
   Circunscricao: o estado, para deputados, e o municipio, para vereador.

   Definicao usada ("eleito por votos de legenda"): o candidato eleito cujos votos nominais ficaram ABAIXO do quociente eleitoral
   da circunscricao. Ele so entrou porque a soma dos votos do partido (de legenda e dos colegas) garantiu a vaga. Quociente
   eleitoral = votos validos (nominais + legenda) / vagas, com a fracao arredondada como manda o Codigo Eleitoral (art. 106:
   desprezada se igual ou inferior a meio, 1 se superior). Os votos validos conferem com o total oficial do TSE (carga_q5.py).

   Medida complementar: "fora dos mais votados" = o eleito nao esta entre os N candidatos mais votados da circunscricao (N = vagas),
   ou seja, ocupa a vaga de alguem que teve mais votos. Cobre o caso classico do candidato "puxado" por colegas de partido.

   Seis municipios de 2024 (Ananindeua, Breu Branco, Placas, Melgaco, Ruropolis e Nossa Senhora das Dores) ficam fora: o TSE
   nao publicou os votos de vereador, ou os publicou incompletos. */

DROP MATERIALIZED VIEW IF EXISTS mv_q5_barrado CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q5_partido CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q5_resumo CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q5_eleito CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q5_circunscricao CASCADE;

/* Uma linha por circunscricao e eleicao: vagas, votos validos e quociente eleitoral.
   cod_ibge = 0 identifica a circunscricao estadual (deputados). */
CREATE MATERIALIZED VIEW mv_q5_circunscricao AS
WITH nominais AS (
  SELECT c.id_eleicao AS ano, c.cargo, c.sg_uf,
         CASE WHEN c.cargo = 'VEREADOR' THEN v.cod_ibge ELSE 0 END AS cod_ibge,
         SUM(v.votos_nominais) AS votos_nominais
  FROM votacao v
  JOIN candidatura c ON c.id_candidatura = v.id_candidatura
  WHERE v.turno = 1 AND c.id_eleicao IN (2018, 2020, 2022, 2024)
    AND c.cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'VEREADOR')
  GROUP BY 1, 2, 3, 4),
legenda AS (
  SELECT l.id_eleicao AS ano, l.cargo, m.uf AS sg_uf,
         CASE WHEN l.cargo = 'VEREADOR' THEN l.cod_ibge ELSE 0 END AS cod_ibge,
         SUM(l.votos_legenda) AS votos_legenda
  FROM votacao_legenda l
  JOIN municipio m ON m.cod_ibge = l.cod_ibge
  WHERE l.turno = 1
  GROUP BY 1, 2, 3, 4),
vagas AS (
  SELECT id_eleicao AS ano, cargo, sg_uf, COALESCE(cod_ibge, 0) AS cod_ibge, SUM(qt_vaga) AS vagas
  FROM vaga
  WHERE id_eleicao IN (2018, 2020, 2022, 2024) AND cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'VEREADOR')
  GROUP BY 1, 2, 3, 4),
c AS (
  SELECT n.ano, n.cargo, n.sg_uf, n.cod_ibge, g.vagas, n.votos_nominais, COALESCE(l.votos_legenda, 0) AS votos_legenda,
         n.votos_nominais + COALESCE(l.votos_legenda, 0) AS votos_validos
  FROM nominais n
  JOIN vagas g USING (ano, cargo, sg_uf, cod_ibge)
  LEFT JOIN legenda l USING (ano, cargo, sg_uf, cod_ibge))
SELECT ano, cargo, sg_uf, cod_ibge, vagas, votos_nominais, votos_legenda, votos_validos,
       CASE WHEN votos_validos::numeric / vagas - FLOOR(votos_validos::numeric / vagas) > 0.5
            THEN CEIL(votos_validos::numeric / vagas) ELSE FLOOR(votos_validos::numeric / vagas) END AS quociente
FROM c;

CREATE UNIQUE INDEX ix_q5_circ ON mv_q5_circunscricao (ano, cargo, sg_uf, cod_ibge);

/* Cada candidato eleito, com seus votos, o quociente da circunscricao e as duas medidas.
   Entram so as candidaturas com votos carregados (as 6 cidades acima ficam de fora). */
CREATE MATERIALIZED VIEW mv_q5_eleito AS
WITH r AS (
  SELECT c.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sg_uf,
         CASE WHEN c.cargo = 'VEREADOR' THEN c.cod_ibge ELSE 0 END AS cod_ibge,
         c.sigla_partido AS partido, c.nome_urna, c.situacao_resultado, c.total_votos AS votos,
         RANK() OVER (PARTITION BY c.id_eleicao, c.cargo, c.sg_uf, CASE WHEN c.cargo = 'VEREADOR' THEN c.cod_ibge ELSE 0 END
                      ORDER BY c.total_votos DESC) AS posicao_votos
  FROM candidatura c
  WHERE c.id_eleicao IN (2018, 2020, 2022, 2024) AND c.cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'VEREADOR')
    AND c.total_votos IS NOT NULL)
SELECT r.id_candidatura, r.ano, r.cargo, r.sg_uf, r.cod_ibge, r.partido, r.nome_urna, r.situacao_resultado, r.votos,
       r.posicao_votos, q.vagas, q.quociente,
       ROUND(100.0 * r.votos / q.quociente, 1) AS pct_do_quociente,
       r.votos < q.quociente AS por_legenda,
       r.posicao_votos > q.vagas AS fora_dos_mais_votados
FROM r
JOIN mv_q5_circunscricao q USING (ano, cargo, sg_uf, cod_ibge)
WHERE r.situacao_resultado LIKE 'ELEITO%';

CREATE UNIQUE INDEX ix_q5_eleito ON mv_q5_eleito (id_candidatura);
CREATE INDEX ix_q5_eleito_busca ON mv_q5_eleito (ano, cargo, sg_uf, votos);

/* Os "barrados": candidatos que ficaram entre os N mais votados da circunscricao (N = vagas) e nao foram eleitos,
   porque o partido nao fez quociente suficiente. E o outro lado do eleito "fora dos mais votados". */
CREATE MATERIALIZED VIEW mv_q5_barrado AS
WITH r AS (
  SELECT c.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sg_uf,
         CASE WHEN c.cargo = 'VEREADOR' THEN c.cod_ibge ELSE 0 END AS cod_ibge,
         c.sigla_partido AS partido, c.nome_urna, c.situacao_resultado, c.total_votos AS votos,
         RANK() OVER (PARTITION BY c.id_eleicao, c.cargo, c.sg_uf, CASE WHEN c.cargo = 'VEREADOR' THEN c.cod_ibge ELSE 0 END
                      ORDER BY c.total_votos DESC) AS posicao_votos
  FROM candidatura c
  WHERE c.id_eleicao IN (2018, 2020, 2022, 2024) AND c.cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'VEREADOR')
    AND c.total_votos IS NOT NULL)
SELECT r.id_candidatura, r.ano, r.cargo, r.sg_uf, r.cod_ibge, r.partido, r.nome_urna, r.situacao_resultado, r.votos,
       r.posicao_votos, q.vagas, q.quociente, ROUND(100.0 * r.votos / q.quociente, 1) AS pct_do_quociente
FROM r
JOIN mv_q5_circunscricao q USING (ano, cargo, sg_uf, cod_ibge)
WHERE r.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE') AND r.posicao_votos <= q.vagas;

CREATE UNIQUE INDEX ix_q5_barrado ON mv_q5_barrado (id_candidatura);
CREATE INDEX ix_q5_barrado_busca ON mv_q5_barrado (ano, cargo, sg_uf, votos);

/* Resumo por eleicao, cargo e UF (uf 'TODAS' = os 6 estados). Faixas pelo percentual do quociente que o eleito teve em votos proprios. */
CREATE MATERIALIZED VIEW mv_q5_resumo AS
WITH e AS (
  SELECT ano, cargo, COALESCE(sg_uf, 'TODAS') AS uf,
         COUNT(*) AS eleitos,
         COUNT(*) FILTER (WHERE por_legenda) AS eleitos_por_legenda,
         COUNT(*) FILTER (WHERE pct_do_quociente >= 100) AS faixa_100_mais,
         COUNT(*) FILTER (WHERE pct_do_quociente >= 50 AND pct_do_quociente < 100) AS faixa_50_99,
         COUNT(*) FILTER (WHERE pct_do_quociente >= 20 AND pct_do_quociente < 50) AS faixa_20_49,
         COUNT(*) FILTER (WHERE pct_do_quociente < 20) AS faixa_menos_20,
         COUNT(*) FILTER (WHERE fora_dos_mais_votados) AS fora_dos_mais_votados,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct_do_quociente) AS mediana_pct_quociente
  FROM mv_q5_eleito
  GROUP BY GROUPING SETS ((ano, cargo, sg_uf), (ano, cargo))),
c AS (
  SELECT ano, cargo, COALESCE(sg_uf, 'TODAS') AS uf, COUNT(*) AS circunscricoes, SUM(vagas) AS vagas,
         SUM(votos_validos) AS votos_validos, SUM(votos_legenda) AS votos_legenda
  FROM mv_q5_circunscricao
  GROUP BY GROUPING SETS ((ano, cargo, sg_uf), (ano, cargo)))
SELECT e.ano, e.cargo, e.uf, c.circunscricoes, c.vagas, e.eleitos, e.eleitos_por_legenda,
       ROUND(100.0 * e.eleitos_por_legenda / e.eleitos, 1) AS pct_por_legenda,
       e.faixa_100_mais, e.faixa_50_99, e.faixa_20_49, e.faixa_menos_20,
       e.fora_dos_mais_votados, ROUND(100.0 * e.fora_dos_mais_votados / e.eleitos, 1) AS pct_fora_dos_mais_votados,
       ROUND(e.mediana_pct_quociente::numeric, 1) AS mediana_pct_quociente,
       c.votos_validos, c.votos_legenda, ROUND(100.0 * c.votos_legenda / c.votos_validos, 2) AS pct_votos_legenda
FROM e JOIN c USING (ano, cargo, uf);

CREATE UNIQUE INDEX ix_q5_resumo ON mv_q5_resumo (ano, cargo, uf);

/* Por partido (sigla da epoca), eleicao, cargo e UF: quantos eleitos, quantos por legenda, e de onde vieram os votos do partido.
   votos_legenda e o total de legenda valido (inclui nominais convertidos em legenda, como no TSE). */
CREATE MATERIALIZED VIEW mv_q5_partido AS
WITH sigla AS (
  SELECT id_eleicao AS ano, numero_partido, MIN(sigla_partido) AS partido
  FROM candidatura
  WHERE id_eleicao IN (2018, 2020, 2022, 2024)
  GROUP BY 1, 2),
nom AS (
  SELECT c.id_eleicao AS ano, c.cargo, c.sg_uf, c.sigla_partido AS partido, SUM(v.votos_nominais) AS votos_nominais
  FROM votacao v
  JOIN candidatura c ON c.id_candidatura = v.id_candidatura
  WHERE v.turno = 1 AND c.id_eleicao IN (2018, 2020, 2022, 2024) AND c.cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'VEREADOR')
  GROUP BY 1, 2, 3, 4),
leg AS (
  SELECT l.id_eleicao AS ano, l.cargo, m.uf AS sg_uf, s.partido, SUM(l.votos_legenda) AS votos_legenda
  FROM votacao_legenda l
  JOIN municipio m ON m.cod_ibge = l.cod_ibge
  JOIN sigla s ON s.ano = l.id_eleicao AND s.numero_partido = l.numero_partido
  WHERE l.turno = 1
  GROUP BY 1, 2, 3, 4),
vp AS (
  SELECT n.ano, n.cargo, n.sg_uf, n.partido, n.votos_nominais, COALESCE(l.votos_legenda, 0) AS votos_legenda
  FROM nom n LEFT JOIN leg l USING (ano, cargo, sg_uf, partido)),
el AS (
  SELECT ano, cargo, sg_uf, partido, COUNT(*) AS eleitos, COUNT(*) FILTER (WHERE por_legenda) AS eleitos_por_legenda,
         COUNT(*) FILTER (WHERE fora_dos_mais_votados) AS fora_dos_mais_votados
  FROM mv_q5_eleito
  GROUP BY ano, cargo, sg_uf, partido),
j AS (
  SELECT el.ano, el.cargo, el.sg_uf, el.partido, el.eleitos, el.eleitos_por_legenda, el.fora_dos_mais_votados,
         vp.votos_nominais, vp.votos_legenda
  FROM el JOIN vp USING (ano, cargo, sg_uf, partido)),
t AS (
  SELECT ano, cargo, COALESCE(sg_uf, 'TODAS') AS uf, partido,
         SUM(eleitos) AS eleitos, SUM(eleitos_por_legenda) AS eleitos_por_legenda, SUM(fora_dos_mais_votados) AS fora_dos_mais_votados,
         SUM(votos_nominais) AS votos_nominais, SUM(votos_legenda) AS votos_legenda
  FROM j
  GROUP BY GROUPING SETS ((ano, cargo, sg_uf, partido), (ano, cargo, partido)))
SELECT ano, cargo, uf, partido, eleitos, eleitos_por_legenda,
       ROUND(100.0 * eleitos_por_legenda / eleitos, 1) AS pct_por_legenda,
       eleitos - eleitos_por_legenda AS eleitos_votos_proprios,
       fora_dos_mais_votados, votos_nominais, votos_legenda,
       ROUND(100.0 * votos_legenda / NULLIF(votos_nominais + votos_legenda, 0), 2) AS pct_votos_legenda,
       RANK() OVER (PARTITION BY ano, cargo, uf ORDER BY eleitos DESC, partido) AS posicao
FROM t;

CREATE UNIQUE INDEX ix_q5_partido ON mv_q5_partido (ano, cargo, uf, partido);
