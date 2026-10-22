/* Views do site de apresentação (site_novo). Rodar depois de views_q5.sql; nao altera tabelas.

   vw_site_cadeira: uma linha por cadeira preenchida nas eleicoes proporcionais (deputado federal e estadual em 2018 e 2022,
   vereador em 2020 e 2024), com quem a ocupa. Alimenta o hemiciclo do site, em que cada ponto e um eleito: o partido da
   fatia, o nome, os votos, se a cadeira veio dos votos proprios ou da legenda (Q5) e o id_pessoa, que liga a cadeira a
   carreira do politico (Q10). A foto do candidato fica no site como fotos/<id_candidatura>.jpg.

   Casa legislativa: o estado, para deputados (cod_ibge = 0), e o municipio, para vereador. Os seis municipios de 2024 sem
   votos completos de vereador ficam fora, como na Q5. */

DROP VIEW IF EXISTS vw_site_cadeira;

CREATE VIEW vw_site_cadeira AS
SELECT e.ano,
       e.cargo,
       e.sg_uf,
       e.cod_ibge,
       m.nome AS municipio,
       e.id_candidatura,
       c.id_pessoa,
       e.nome_urna,
       e.partido,
       e.votos,
       e.posicao_votos,
       e.vagas,
       e.quociente,
       e.pct_do_quociente,
       e.por_legenda,
       e.fora_dos_mais_votados
FROM mv_q5_eleito e
JOIN candidatura c ON c.id_candidatura = e.id_candidatura
LEFT JOIN municipio m ON m.cod_ibge = NULLIF(e.cod_ibge, 0);


/* vw_site_municipio: uma linha por municipio com os indicadores do mapa do site (Q3, Q4 e Q6). Le apenas as views das
   questoes; os percentuais sao sobre os eleitores aptos, como na Q3.

   Q3 (vw_q3_municipio, vw_q3_eleicao): IDHM, PIB per capita e populacao de 2010; isentos, abstencao, brancos e nulos da
      eleicao para prefeito (1o turno) de 2008 e 2012, se a votacao foi marcada como anulada, e eleitores aptos por 100
      habitantes (populacao do Censo 2010).
   Q4 (mv_q4_municipio): anos de estudo equivalentes do eleitorado e dos eleitos em 2024 (vereador e prefeito) e, para
      deputado federal em 2022, a escolaridade dos eleitos ponderada pelos votos que o municipio deu a cada um.
   Q6 (vw_q6_municipio, vw_q6_eleito): idade mediana da populacao (Censo 2022) e o grupo do municipio; idade do prefeito
      e media dos vereadores eleitos em 2024; os partidos do prefeito de 2004 a 2024 e quantas vezes o partido mudou de uma
      eleicao para a seguinte, tratando renomeacoes e fusoes como o mesmo partido (partido_linhagem, como na Q6). */

DROP VIEW IF EXISTS vw_site_municipio;

CREATE VIEW vw_site_municipio AS
WITH q3 AS (
  SELECT cod_ibge,
         MAX(ROUND(100.0 * isentos / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2008) AS isentos_2008,
         MAX(ROUND(100.0 * abstencoes / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2008) AS abstencao_2008,
         MAX(ROUND(100.0 * nulos / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2008) AS nulos_2008,
         MAX(ROUND(100.0 * brancos / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2008) AS brancos_2008,
         BOOL_OR(anulada) FILTER (WHERE ano = 2008) AS anulada_2008,
         MAX(ROUND(100.0 * isentos / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2012) AS isentos_2012,
         MAX(ROUND(100.0 * abstencoes / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2012) AS abstencao_2012,
         MAX(ROUND(100.0 * nulos / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2012) AS nulos_2012,
         MAX(ROUND(100.0 * brancos / NULLIF(aptos, 0), 1)) FILTER (WHERE ano = 2012) AS brancos_2012,
         BOOL_OR(anulada) FILTER (WHERE ano = 2012) AS anulada_2012,
         MAX(ROUND(100 * razao_eleitores_pop, 1)) FILTER (WHERE ano = 2008) AS eleitores_pop_2008,
         MAX(ROUND(100 * razao_eleitores_pop, 1)) FILTER (WHERE ano = 2012) AS eleitores_pop_2012
  FROM vw_q3_eleicao
  GROUP BY cod_ibge
),
q4 AS (
  SELECT cod_ibge,
         MAX(anos_eleitorado) FILTER (WHERE ano = 2024 AND cargo = 'VEREADOR') AS anos_eleitorado_2024,
         MAX(pct_superior_eleitorado) FILTER (WHERE ano = 2024 AND cargo = 'VEREADOR') AS pct_superior_eleitorado_2024,
         MAX(anos_eleitos) FILTER (WHERE ano = 2024 AND cargo = 'VEREADOR') AS anos_vereadores_2024,
         MAX(pct_superior_eleitos) FILTER (WHERE ano = 2024 AND cargo = 'VEREADOR') AS pct_superior_vereadores_2024,
         MAX(anos_eleitos) FILTER (WHERE ano = 2024 AND cargo = 'PREFEITO') AS anos_prefeito_2024,
         MAX(anos_votados) FILTER (WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL') AS anos_dep_federal_2022
  FROM mv_q4_municipio
  GROUP BY cod_ibge
),
prefeito AS (
  SELECT e.cod_ibge, e.ano, e.sigla_partido, e.partido_linhagem, e.id_pessoa, e.id_candidatura, e.idade, c.nome_urna,
         LAG(e.partido_linhagem) OVER w AS linhagem_anterior,
         LAG(e.ano) OVER w AS ano_anterior
  FROM vw_q6_eleito e
  JOIN candidatura c ON c.id_candidatura = e.id_candidatura
  WHERE e.cargo = 'PREFEITO'
  WINDOW w AS (PARTITION BY e.cod_ibge ORDER BY e.ano)
),
q6_prefeito AS (
  SELECT cod_ibge,
         STRING_AGG(ano || ':' || sigla_partido, ' ' ORDER BY ano) AS partidos_prefeito,
         COUNT(*) FILTER (WHERE ano_anterior = ano - 4) AS comparacoes,
         COUNT(*) FILTER (WHERE ano_anterior = ano - 4 AND partido_linhagem <> linhagem_anterior) AS trocas_partido,
         MAX(idade) FILTER (WHERE ano = 2024) AS idade_prefeito_2024,
         MAX(sigla_partido) FILTER (WHERE ano = 2024) AS partido_prefeito_2024,
         MAX(id_candidatura) FILTER (WHERE ano = 2024) AS id_prefeito_2024,
         MAX(nome_urna) FILTER (WHERE ano = 2024) AS nome_prefeito_2024
  FROM prefeito
  GROUP BY cod_ibge
),
reeleicao AS (
  SELECT a.cod_ibge, (a.id_pessoa = b.id_pessoa) AS prefeito_reeleito_2024
  FROM vw_q6_eleito a
  JOIN vw_q6_eleito b ON b.cod_ibge = a.cod_ibge AND b.cargo = 'PREFEITO' AND b.ano = 2020
  WHERE a.cargo = 'PREFEITO' AND a.ano = 2024
),
vereadores AS (
  SELECT cod_ibge, ROUND(AVG(idade), 1) AS idade_vereadores_2024
  FROM vw_q6_eleito
  WHERE cargo = 'VEREADOR' AND ano = 2024
  GROUP BY cod_ibge
)
SELECT m.cod_ibge, m.nome, m.uf,
       i.idhm, i.pib_per_capita, i.populacao, i.faixa_idhm, i.quartil_pib,
       q3.isentos_2008, q3.abstencao_2008, q3.nulos_2008, q3.brancos_2008, q3.anulada_2008,
       q3.isentos_2012, q3.abstencao_2012, q3.nulos_2012, q3.brancos_2012, q3.anulada_2012,
       q3.eleitores_pop_2008, q3.eleitores_pop_2012,
       q4.anos_eleitorado_2024, q4.pct_superior_eleitorado_2024, q4.anos_vereadores_2024, q4.pct_superior_vereadores_2024,
       q4.anos_prefeito_2024, q4.anos_dep_federal_2022,
       g.idade_mediana, g.indice_envelhecimento, g.grupo_ordem AS grupo_idade,
       p.idade_prefeito_2024, p.partido_prefeito_2024, p.id_prefeito_2024, p.nome_prefeito_2024, v.idade_vereadores_2024,
       p.partidos_prefeito, p.comparacoes, p.trocas_partido, r.prefeito_reeleito_2024
FROM municipio m
LEFT JOIN vw_q3_municipio i ON i.cod_ibge = m.cod_ibge
LEFT JOIN q3 ON q3.cod_ibge = m.cod_ibge
LEFT JOIN q4 ON q4.cod_ibge = m.cod_ibge
LEFT JOIN vw_q6_municipio g ON g.cod_ibge = m.cod_ibge
LEFT JOIN q6_prefeito p ON p.cod_ibge = m.cod_ibge
LEFT JOIN reeleicao r ON r.cod_ibge = m.cod_ibge
LEFT JOIN vereadores v ON v.cod_ibge = m.cod_ibge;


/* vw_site_candidatura_foto: candidaturas de 2018 em diante com o id_pessoa, para o site achar a foto de cada candidato.
   De 2018 a 2024 o id_candidatura e o SQ_CANDIDATO do TSE, o mesmo numero que da nome ao arquivo da foto
   (dados/tse/fotos_candidatos/indice.csv). As fotos nao entram no banco: o site guarda miniaturas proprias. */

DROP VIEW IF EXISTS vw_site_candidatura_foto;

CREATE VIEW vw_site_candidatura_foto AS
SELECT c.id_pessoa, c.id_eleicao AS ano, c.cargo, c.sg_uf, c.cod_ibge, c.nome_urna, c.sigla_partido, c.id_candidatura
FROM candidatura c
WHERE c.id_eleicao >= 2018;
