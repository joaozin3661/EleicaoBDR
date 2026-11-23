/* Views da Q7 (banco eleicoes): vies politico de cada municipio, estado, regiao e do Brasil, eleicao a eleicao.
   Rodar no pgAdmin depois de importar_q7.py. Depois de recarregar os dados, rode de novo.

   Vies do partido (tabela vies_partido): (media dos especialistas de Bolognesi et al. - 5) x 20, de -100 (extrema
   esquerda) a +100 (extrema direita). 2018 e 2020 usam a onda de 2018 do survey; 2022 em diante, a de 2022.

   Em cada cargo:  vies do cargo = soma(votos do partido x vies do partido) / soma(votos dos partidos com vies)
   Votos = votos validos do 1o turno (nominais + legenda). Partido sem vies fica fora da conta (nem no numerador nem
   no denominador); a cobertura diz quanto do voto entrou.
   Cargos: presidente, governador, senador, deputado federal e estadual (e distrital) nos anos gerais; prefeito e
   vereador nos municipais.
   Vies do territorio no ano = media simples dos cargos, para que nenhum cargo pese mais (os dois votos para o Senado
   em 2018, por exemplo). Estado, regiao e Brasil fazem a mesma conta somando os votos dos seus municipios.

   Tudo e calculado por ano e cargo, entao uma eleicao nova (2026) entra sozinha depois de carregada, desde que
   vies_partido tenha os partidos dela. Anos gerais e municipais tem cargos diferentes: compare anos do mesmo tipo.
   O voto do exterior (presidente) nao tem municipio e fica fora. */

DROP MATERIALIZED VIEW IF EXISTS mv_q7_turno2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q7_territorio CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q7_municipio CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q7_cargo CASCADE;
DROP VIEW IF EXISTS vw_q7_votos_partido CASCADE;

/* Votos validos de cada partido, por eleicao, cargo e municipio (1o turno): nominais dos seus candidatos + legenda.
   Vem da tabela votacao_partido_municipio (carga_votos_q7.py), que tem todos os cargos e nao exclui os municipios que
   a Q5 tira por diferenca com o total oficial do TSE (AM em 2018, 2 municipios em 2020 e 21 em 2024). */
CREATE VIEW vw_q7_votos_partido AS
SELECT id_eleicao AS ano, cargo, cod_ibge, numero_partido, (votos_nominais + votos_legenda)::bigint AS votos
FROM votacao_partido_municipio
WHERE turno = 1;

/* Uma linha por eleicao, cargo e municipio, com as somas que permitem agregar em qualquer territorio. */
CREATE MATERIALIZED VIEW mv_q7_cargo AS
SELECT p.ano, p.cargo, p.cod_ibge, m.uf, m.regiao,
       SUM(p.votos)                                          AS votos,
       SUM(p.votos) FILTER (WHERE vp.vies IS NOT NULL)       AS votos_com_vies,
       SUM(p.votos * vp.vies)                                AS votos_x_vies,
       ROUND(SUM(p.votos * vp.vies) / NULLIF(SUM(p.votos) FILTER (WHERE vp.vies IS NOT NULL), 0), 1) AS vies
FROM vw_q7_votos_partido p
JOIN municipio m ON m.cod_ibge = p.cod_ibge
LEFT JOIN vies_partido vp ON vp.id_eleicao = p.ano AND vp.numero_partido = p.numero_partido
GROUP BY 1, 2, 3, 4, 5;

CREATE UNIQUE INDEX ix_q7_cargo ON mv_q7_cargo (ano, cargo, cod_ibge);

/* Vies de cada municipio em cada eleicao: media simples dos cargos. */
CREATE MATERIALIZED VIEW mv_q7_municipio AS
SELECT c.ano, e.tipo_eleicao, c.cod_ibge, m.nome AS municipio, c.uf, c.regiao,
       ROUND(AVG(c.vies), 1)                                          AS vies,
       ROUND(100.0 * SUM(c.votos_com_vies) / NULLIF(SUM(c.votos), 0), 1) AS cobertura_pct,
       COUNT(c.vies)                                                   AS cargos,
       STRING_AGG(c.cargo || ' ' || c.vies, '; ' ORDER BY c.cargo)     AS vies_por_cargo
FROM mv_q7_cargo c
JOIN municipio m ON m.cod_ibge = c.cod_ibge
JOIN eleicao e ON e.id_eleicao = c.ano
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE UNIQUE INDEX ix_q7_municipio ON mv_q7_municipio (ano, cod_ibge);
CREATE INDEX ix_q7_municipio_uf ON mv_q7_municipio (uf, ano);

/* Estados, regioes e Brasil: em cada cargo soma os votos de todos os municipios do territorio; depois media dos cargos.
   escopo = 'BRASIL', 'REGIAO' ou 'UF'; territorio = 'BR', o nome da regiao ou a sigla da UF. */
CREATE MATERIALIZED VIEW mv_q7_territorio AS
WITH por_cargo AS (
  SELECT ano, cargo,
         CASE WHEN GROUPING(uf) = 0 THEN 'UF' WHEN GROUPING(regiao) = 0 THEN 'REGIAO' ELSE 'BRASIL' END AS escopo,
         CASE WHEN GROUPING(uf) = 0 THEN uf WHEN GROUPING(regiao) = 0 THEN regiao ELSE 'BR' END       AS territorio,
         SUM(votos) AS votos, SUM(votos_com_vies) AS votos_com_vies,
         SUM(votos_x_vies) / NULLIF(SUM(votos_com_vies), 0) AS vies
  FROM mv_q7_cargo
  GROUP BY GROUPING SETS ((ano, cargo), (ano, cargo, regiao), (ano, cargo, uf)))
SELECT p.ano, e.tipo_eleicao, p.escopo, p.territorio,
       ROUND(AVG(p.vies), 1)                                              AS vies,
       ROUND(100.0 * SUM(p.votos_com_vies) / NULLIF(SUM(p.votos), 0), 1)  AS cobertura_pct,
       COUNT(p.vies)                                                      AS cargos,
       STRING_AGG(p.cargo || ' ' || ROUND(p.vies, 1), '; ' ORDER BY p.cargo) AS vies_por_cargo
FROM por_cargo p
JOIN eleicao e ON e.id_eleicao = p.ano
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX ix_q7_territorio ON mv_q7_territorio (escopo, territorio, ano);

/* 2o turno (presidente, governador e prefeito, so onde houve): uma linha por eleicao, cargo e municipio, com as mesmas
   somas de mv_q7_cargo. Sao votos nominais (no 2o turno nao ha legenda). Estado, regiao e Brasil saem na API somando os
   municipios que tiveram 2o turno; onde nao houve, nao ha linha. As views do 1o turno acima nao mudam. */
CREATE MATERIALIZED VIEW mv_q7_turno2 AS
SELECT p.id_eleicao AS ano, p.cargo, p.cod_ibge, m.nome AS municipio, m.uf, m.regiao,
       SUM(p.votos_nominais + p.votos_legenda)::bigint                                   AS votos,
       SUM(p.votos_nominais + p.votos_legenda) FILTER (WHERE vp.vies IS NOT NULL)        AS votos_com_vies,
       SUM((p.votos_nominais + p.votos_legenda) * vp.vies)                               AS votos_x_vies,
       ROUND(SUM((p.votos_nominais + p.votos_legenda) * vp.vies)
             / NULLIF(SUM(p.votos_nominais + p.votos_legenda) FILTER (WHERE vp.vies IS NOT NULL), 0), 1) AS vies
FROM votacao_partido_municipio p
JOIN municipio m ON m.cod_ibge = p.cod_ibge
LEFT JOIN vies_partido vp ON vp.id_eleicao = p.id_eleicao AND vp.numero_partido = p.numero_partido
WHERE p.turno = 2
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE UNIQUE INDEX ix_q7_turno2 ON mv_q7_turno2 (ano, cargo, cod_ibge);
