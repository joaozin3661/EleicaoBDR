/* ### 0 COMO USAR */
/* Cada consulta e independente. Selecione UMA (do WITH ate o ponto e virgula) e aperte F5 -> o pgAdmin roda so a selecao. */
/* Para mudar o filtro, edite os valores na primeira linha do bloco p (ex.: 2020 AS ano, 'VEREADOR' AS cargo). */
/* Cargos: VEREADOR, PREFEITO, VICE-PREFEITO, DEPUTADO ESTADUAL, DEPUTADO FEDERAL, SENADOR, GOVERNADOR, VICE-GOVERNADOR */

/* ### 1.1 Q1 - Custo por cadeira por estado (gasto total / cadeiras) */
WITH p AS (SELECT 2022 AS ano, 'DEPUTADO FEDERAL' AS cargo),
gasto AS (
  SELECT c.sg_uf AS uf, SUM(COALESCE(d.valor, 0)) AS gasto, COUNT(DISTINCT c.id_candidatura) AS candidatos
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo
  GROUP BY c.sg_uf),
vagas AS (
  SELECT COALESCE(v.sg_uf, m.uf) AS uf, SUM(v.qt_vaga) AS cadeiras
  FROM vaga v CROSS JOIN p
  LEFT JOIN municipio m ON m.cod_ibge = v.cod_ibge
  WHERE v.id_eleicao = p.ano AND UPPER(v.cargo) = p.cargo
  GROUP BY 1)
SELECT g.uf, g.candidatos, ROUND(g.gasto, 2) AS gasto_total, v.cadeiras,
       ROUND(g.gasto / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g JOIN vagas v USING (uf)
ORDER BY g.uf;

/* ### 1.2 Q1 - Panorama: todos os anos e cargos de uma vez (6 estados somados) */
WITH gasto AS (
  SELECT c.id_eleicao AS ano, UPPER(c.cargo) AS cargo, SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao >= 2018 GROUP BY 1, 2),
vagas AS (
  SELECT id_eleicao AS ano, UPPER(cargo) AS cargo, SUM(qt_vaga) AS cadeiras
  FROM vaga WHERE id_eleicao >= 2018 GROUP BY 1, 2)
SELECT g.ano, g.cargo, ROUND(g.gasto, 2) AS gasto_total, v.cadeiras,
       ROUND(g.gasto / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g JOIN vagas v USING (ano, cargo)
ORDER BY g.cargo, g.ano;

/* ### 1.3 Q1 - Ranking de municipios: mais caros (troque DESC por ASC para os mais baratos) */
WITH p AS (SELECT 2020 AS ano, 'VEREADOR' AS cargo, NULL::text AS uf),
gasto AS (
  SELECT c.cod_ibge, SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo AND c.cod_ibge IS NOT NULL
  GROUP BY c.cod_ibge),
vagas AS (
  SELECT v.cod_ibge, SUM(v.qt_vaga) AS cadeiras
  FROM vaga v CROSS JOIN p
  WHERE v.id_eleicao = p.ano AND UPPER(v.cargo) = p.cargo AND v.cod_ibge IS NOT NULL
  GROUP BY v.cod_ibge)
SELECT m.nome AS municipio, m.uf, ROUND(g.gasto, 2) AS gasto_total, v.cadeiras,
       ROUND(g.gasto / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g JOIN vagas v USING (cod_ibge) JOIN municipio m USING (cod_ibge)
CROSS JOIN p
WHERE p.uf IS NULL OR m.uf = p.uf
ORDER BY custo_por_cadeira DESC NULLS LAST
LIMIT 20;

/* ### 1.4 Q1 - Custo da cadeira de UM municipio, em todas as eleicoes (busca por nome) */
WITH p AS (SELECT '%Belém%' AS nome, 'VEREADOR' AS cargo),
gasto AS (
  SELECT c.id_eleicao AS ano, c.cod_ibge, SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE UPPER(c.cargo) = p.cargo AND c.id_eleicao >= 2018 AND c.cod_ibge IS NOT NULL
  GROUP BY 1, 2),
vagas AS (
  SELECT v.id_eleicao AS ano, v.cod_ibge, SUM(v.qt_vaga) AS cadeiras
  FROM vaga v CROSS JOIN p
  WHERE UPPER(v.cargo) = p.cargo AND v.cod_ibge IS NOT NULL
  GROUP BY 1, 2)
SELECT m.nome AS municipio, m.uf, g.ano, ROUND(g.gasto, 2) AS gasto_total, v.cadeiras,
       ROUND(g.gasto / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g JOIN vagas v USING (ano, cod_ibge) JOIN municipio m USING (cod_ibge)
CROSS JOIN p
WHERE m.nome ILIKE p.nome
ORDER BY m.nome, m.uf, g.ano;

/* ### 1.5 Q1 - Vencedores x perdedores: total, media e mediana de gasto por candidato (uf opcional: 'PA' ou NULL) */
WITH p AS (SELECT 2020 AS ano, 'VEREADOR' AS cargo, NULL::text AS uf),
por_cand AS (
  SELECT c.id_candidatura,
         CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'Eleitos'
              WHEN c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE') THEN 'Não eleitos' END AS grupo,
         SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo AND (p.uf IS NULL OR c.sg_uf = p.uf)
  GROUP BY c.id_candidatura, c.situacao_resultado)
SELECT grupo, COUNT(*) AS candidatos, ROUND(SUM(gasto), 2) AS gasto_total,
       ROUND(AVG(gasto), 2) AS media_por_candidato,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY gasto))::numeric, 2) AS mediana_por_candidato
FROM por_cand WHERE grupo IS NOT NULL
GROUP BY grupo ORDER BY grupo;

/* ### 1.6 Q1 - Razao eleitos / nao eleitos (media e mediana) por estado */
WITH p AS (SELECT 2022 AS ano, 'DEPUTADO FEDERAL' AS cargo),
por_cand AS (
  SELECT c.sg_uf AS uf, c.id_candidatura,
         CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'E'
              WHEN c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE') THEN 'N' END AS grupo,
         SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo
  GROUP BY c.sg_uf, c.id_candidatura, c.situacao_resultado)
SELECT uf,
       COUNT(*) FILTER (WHERE grupo = 'E') AS eleitos,
       COUNT(*) FILTER (WHERE grupo = 'N') AS nao_eleitos,
       ROUND(AVG(gasto) FILTER (WHERE grupo = 'E'), 2) AS media_eleitos,
       ROUND(AVG(gasto) FILTER (WHERE grupo = 'N'), 2) AS media_nao_eleitos,
       ROUND(AVG(gasto) FILTER (WHERE grupo = 'E') / NULLIF(AVG(gasto) FILTER (WHERE grupo = 'N'), 0), 1) AS razao_media,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY gasto) FILTER (WHERE grupo = 'E'))::numeric, 2) AS mediana_eleitos,
       ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY gasto) FILTER (WHERE grupo = 'N'))::numeric, 2) AS mediana_nao_eleitos
FROM por_cand WHERE grupo IS NOT NULL
GROUP BY uf ORDER BY uf;

/* ### 1.7 Q1 - Quem mais gastou (quem: 'todos', 'eleitos' ou 'nao_eleitos') */
WITH p AS (SELECT 2022 AS ano, 'DEPUTADO FEDERAL' AS cargo, NULL::text AS uf, 'todos' AS quem)
SELECT pe.nome, c.sigla_partido AS partido, c.sg_uf AS uf, COALESCE(m.nome, '') AS municipio,
       c.situacao_resultado AS resultado, ROUND(SUM(COALESCE(d.valor, 0)), 2) AS gasto_total
FROM candidatura c CROSS JOIN p
JOIN pessoa pe ON pe.titulo_eleitor = c.titulo_eleitor
LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo AND (p.uf IS NULL OR c.sg_uf = p.uf)
  AND (p.quem = 'todos'
       OR (p.quem = 'eleitos' AND c.situacao_resultado LIKE 'ELEITO%')
       OR (p.quem = 'nao_eleitos' AND c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE')))
GROUP BY pe.nome, c.sigla_partido, c.sg_uf, m.nome, c.situacao_resultado
ORDER BY gasto_total DESC LIMIT 20;

/* ### 1.8 Q1 - Gasto e custo por eleito por partido */
WITH p AS (SELECT 2020 AS ano, 'VEREADOR' AS cargo, NULL::text AS uf),
por_cand AS (
  SELECT c.id_candidatura, c.sigla_partido,
         (c.situacao_resultado LIKE 'ELEITO%') AS eleito,
         SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo AND (p.uf IS NULL OR c.sg_uf = p.uf)
  GROUP BY c.id_candidatura, c.sigla_partido, c.situacao_resultado)
SELECT sigla_partido AS partido, COUNT(*) AS candidatos, COUNT(*) FILTER (WHERE eleito) AS eleitos,
       ROUND(SUM(gasto), 2) AS gasto_total,
       ROUND(SUM(gasto) / NULLIF(COUNT(*) FILTER (WHERE eleito), 0), 2) AS custo_por_eleito
FROM por_cand
GROUP BY sigla_partido HAVING COUNT(*) >= 20
ORDER BY eleitos DESC;

/* ### 1.9 Q1 - Variacao do custo da cadeira de vereador por municipio, 2020 -> 2024 */
WITH p AS (SELECT 2020 AS ano1, 2024 AS ano2, 'VEREADOR' AS cargo),
gasto AS (
  SELECT c.id_eleicao AS ano, c.cod_ibge, SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE UPPER(c.cargo) = p.cargo AND c.id_eleicao IN (p.ano1, p.ano2) AND c.cod_ibge IS NOT NULL
  GROUP BY 1, 2),
vagas AS (
  SELECT v.id_eleicao AS ano, v.cod_ibge, SUM(v.qt_vaga) AS cadeiras
  FROM vaga v CROSS JOIN p
  WHERE UPPER(v.cargo) = p.cargo AND v.id_eleicao IN (p.ano1, p.ano2) AND v.cod_ibge IS NOT NULL
  GROUP BY 1, 2),
cc AS (SELECT g.ano, g.cod_ibge, g.gasto / NULLIF(v.cadeiras, 0) AS custo
       FROM gasto g JOIN vagas v USING (ano, cod_ibge))
SELECT m.nome AS municipio, m.uf, ROUND(a.custo, 0) AS custo_ano1, ROUND(b.custo, 0) AS custo_ano2,
       ROUND(100 * (b.custo - a.custo) / NULLIF(a.custo, 0), 1) AS variacao_pct
FROM p CROSS JOIN cc a JOIN cc b ON b.cod_ibge = a.cod_ibge
JOIN municipio m ON m.cod_ibge = a.cod_ibge
WHERE a.ano = p.ano1 AND b.ano = p.ano2
ORDER BY variacao_pct DESC NULLS LAST
LIMIT 20;

/* ### 1.10 Q1 - Variacao por estado entre duas eleicoes do mesmo tipo (deputados: 2018 -> 2022) */
WITH p AS (SELECT 2018 AS ano1, 2022 AS ano2, 'DEPUTADO FEDERAL' AS cargo),
gasto AS (
  SELECT c.id_eleicao AS ano, c.sg_uf AS uf, SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE UPPER(c.cargo) = p.cargo AND c.id_eleicao IN (p.ano1, p.ano2)
  GROUP BY 1, 2),
vagas AS (
  SELECT v.id_eleicao AS ano, COALESCE(v.sg_uf, m.uf) AS uf, SUM(v.qt_vaga) AS cadeiras
  FROM vaga v CROSS JOIN p LEFT JOIN municipio m ON m.cod_ibge = v.cod_ibge
  WHERE UPPER(v.cargo) = p.cargo AND v.id_eleicao IN (p.ano1, p.ano2)
  GROUP BY 1, 2),
cc AS (SELECT g.ano, g.uf, g.gasto / NULLIF(v.cadeiras, 0) AS custo
       FROM gasto g JOIN vagas v USING (ano, uf))
SELECT a.uf, ROUND(a.custo, 0) AS custo_ano1, ROUND(b.custo, 0) AS custo_ano2,
       ROUND(100 * (b.custo - a.custo) / NULLIF(a.custo, 0), 1) AS variacao_pct
FROM p CROSS JOIN cc a JOIN cc b ON b.uf = a.uf
WHERE a.ano = p.ano1 AND b.ano = p.ano2
ORDER BY a.uf;

/* ### 10.1 Q10 - Buscar pessoa por nome, CPF, titulo ou data de nascimento (use NULL nos criterios que nao quiser) */
WITH p AS (SELECT '%BARBALHO%'::text AS nome, NULL::text AS cpf, NULL::text AS titulo, NULL::date AS nascimento)
SELECT pe.titulo_eleitor, pe.nome, pe.data_nascimento, pe.cpf,
       COUNT(*) AS candidaturas, MIN(c.id_eleicao) AS primeira, MAX(c.id_eleicao) AS ultima,
       COUNT(*) FILTER (WHERE c.situacao_resultado LIKE 'ELEITO%') AS vitorias
FROM pessoa pe CROSS JOIN p
JOIN candidatura c ON c.titulo_eleitor = pe.titulo_eleitor
WHERE (p.nome IS NULL OR pe.nome ILIKE p.nome)
  AND (p.cpf IS NULL OR pe.cpf = p.cpf)
  AND (p.titulo IS NULL OR pe.titulo_eleitor = p.titulo)
  AND (p.nascimento IS NULL OR pe.data_nascimento = p.nascimento)
GROUP BY pe.titulo_eleitor, pe.nome, pe.data_nascimento, pe.cpf
ORDER BY candidaturas DESC, pe.nome LIMIT 50;

/* ### 10.2 Q10 - Para que cargos o candidato disputou e se ganhou (busca por NOME) */
WITH p AS (SELECT '%BARBALHO%'::text AS nome, NULL::text AS cargo)
SELECT pe.nome, pe.data_nascimento, c.id_eleicao AS ano, c.cargo,
       COALESCE(m.nome, c.sg_uf) AS local, c.sigla_partido AS partido,
       c.situacao_resultado AS resultado,
       CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'SIM'
            WHEN c.situacao_resultado = 'NÃO ELEITO' THEN 'NÃO'
            WHEN c.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
            ELSE 'OUTRO' END AS ganhou
FROM pessoa pe CROSS JOIN p
JOIN candidatura c ON c.titulo_eleitor = pe.titulo_eleitor
LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
WHERE pe.nome ILIKE p.nome AND (p.cargo IS NULL OR c.cargo = p.cargo)
ORDER BY pe.nome, pe.data_nascimento, c.id_eleicao;

/* ### 10.3 Q10 - Linha do tempo completa por TITULO: resultado, reeleicao, troca de partido e de cargo */
WITH p AS (SELECT '000000000001'::text AS titulo),
base AS (
  SELECT c.id_eleicao AS ano, c.cargo, c.sigla_partido, c.sg_uf, m.nome AS municipio,
         c.situacao_resultado, (c.situacao_resultado LIKE 'ELEITO%') AS eleito,
         CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'VITÓRIA'
              WHEN c.situacao_resultado = 'NÃO ELEITO' THEN 'DERROTA'
              WHEN c.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
              WHEN c.situacao_resultado LIKE 'REGISTRO NEGADO%' OR c.situacao_resultado LIKE 'INDEFERIDO%' THEN 'REGISTRO NEGADO'
              WHEN c.situacao_resultado LIKE 'RENÚNCIA%' THEN 'RENÚNCIA/FALECIMENTO'
              ELSE 'SEM RESULTADO' END AS resultado
  FROM candidatura c CROSS JOIN p
  LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
  WHERE c.titulo_eleitor = p.titulo),
marcado AS (
  SELECT b.*,
         EXISTS (SELECT 1 FROM base x WHERE x.cargo = b.cargo AND x.eleito
                 AND x.ano = b.ano - CASE WHEN b.cargo = 'SENADOR' THEN 8 ELSE 4 END) AS tinha_mandato,
         LAG(b.sigla_partido) OVER (ORDER BY b.ano) AS partido_anterior,
         LAG(b.cargo) OVER (ORDER BY b.ano) AS cargo_anterior
  FROM base b)
SELECT ano, cargo, sigla_partido AS partido, COALESCE(municipio, sg_uf) AS local, resultado,
       CASE WHEN eleito AND tinha_mandato THEN 'REELEIÇÃO'
            WHEN resultado = 'DERROTA' AND tinha_mandato THEN 'TENTOU REELEIÇÃO E PERDEU'
            WHEN eleito THEN 'ELEITO (1º mandato neste cargo)' ELSE '' END AS evento,
       CASE WHEN partido_anterior IS NOT NULL AND partido_anterior <> sigla_partido
            THEN 'veio de ' || partido_anterior ELSE '' END AS troca_partido,
       CASE WHEN cargo_anterior IS NOT NULL AND cargo_anterior <> cargo
            THEN 'veio de ' || cargo_anterior ELSE '' END AS mudanca_cargo
FROM marcado ORDER BY ano;

/* ### 10.4 Q10 - Ranking de carreiras: quem mais disputou e mais venceu (cargo opcional) */
WITH p AS (SELECT NULL::text AS cargo, 3 AS min_disputas),
r AS (
  SELECT c.titulo_eleitor, COUNT(*) AS disputas,
         COUNT(*) FILTER (WHERE c.situacao_resultado LIKE 'ELEITO%') AS vitorias,
         COUNT(*) FILTER (WHERE c.situacao_resultado = 'NÃO ELEITO') AS derrotas,
         MIN(c.id_eleicao) AS primeira, MAX(c.id_eleicao) AS ultima
  FROM candidatura c CROSS JOIN p
  WHERE c.titulo_eleitor NOT LIKE 'S%' AND (p.cargo IS NULL OR c.cargo = p.cargo)
  GROUP BY c.titulo_eleitor)
SELECT pe.nome, pe.data_nascimento, r.disputas, r.vitorias, r.derrotas,
       ROUND(100.0 * r.vitorias / r.disputas, 0) AS pct_vitorias, r.primeira, r.ultima
FROM r CROSS JOIN p JOIN pessoa pe ON pe.titulo_eleitor = r.titulo_eleitor
WHERE r.disputas >= p.min_disputas
ORDER BY r.vitorias DESC, r.disputas DESC LIMIT 30;

/* ### 10.5 Q10 - Quem passou por mais partidos (siglas que mudaram de nome tambem contam: PFL->DEM, PMDB->MDB) */
WITH p AS (SELECT 4 AS min_partidos)
SELECT pe.nome, pe.data_nascimento, COUNT(DISTINCT c.sigla_partido) AS partidos,
       string_agg(c.sigla_partido || ' (' || c.id_eleicao || ')', ' > ' ORDER BY c.id_eleicao) AS trajetoria
FROM candidatura c CROSS JOIN p
JOIN pessoa pe ON pe.titulo_eleitor = c.titulo_eleitor
WHERE c.titulo_eleitor NOT LIKE 'S%'
GROUP BY pe.nome, pe.data_nascimento, p.min_partidos
HAVING COUNT(DISTINCT c.sigla_partido) >= p.min_partidos
ORDER BY partidos DESC, pe.nome LIMIT 30;

/* ### 10.6 Q10 - Taxa de reeleicao por cargo: dos eleitos, quantos tentaram de novo e quantos se reelegeram */
WITH eleitos AS (
  SELECT DISTINCT titulo_eleitor, cargo, id_eleicao AS ano FROM candidatura
  WHERE situacao_resultado LIKE 'ELEITO%' AND titulo_eleitor NOT LIKE 'S%'
    AND cargo IN ('VEREADOR', 'PREFEITO', 'DEPUTADO ESTADUAL', 'DEPUTADO FEDERAL', 'GOVERNADOR', 'SENADOR')),
disputas AS (
  SELECT titulo_eleitor, cargo, id_eleicao AS ano,
         bool_or(situacao_resultado LIKE 'ELEITO%') AS ganhou
  FROM candidatura GROUP BY 1, 2, 3)
SELECT e.cargo, e.ano AS mandato_eleito_em, COUNT(*) AS eleitos,
       COUNT(d.titulo_eleitor) AS tentaram_de_novo,
       COUNT(*) FILTER (WHERE d.ganhou) AS se_reelegeram,
       ROUND(100.0 * COUNT(d.titulo_eleitor) / COUNT(*), 1) AS pct_tentaram,
       ROUND(100.0 * COUNT(*) FILTER (WHERE d.ganhou) / NULLIF(COUNT(d.titulo_eleitor), 0), 1) AS pct_sucesso
FROM eleitos e
LEFT JOIN disputas d ON d.titulo_eleitor = e.titulo_eleitor AND d.cargo = e.cargo
     AND d.ano = e.ano + CASE WHEN e.cargo = 'SENADOR' THEN 8 ELSE 4 END
GROUP BY e.cargo, e.ano ORDER BY e.cargo, e.ano;

/* ### 10.7 Q10 - Para onde vao as carreiras: transicoes de um cargo para o seguinte */
WITH s AS (
  SELECT titulo_eleitor, cargo, situacao_resultado,
         LAG(cargo) OVER w AS cargo_ant, LAG(situacao_resultado) OVER w AS res_ant
  FROM candidatura
  WHERE titulo_eleitor NOT LIKE 'S%'
    AND cargo IN ('VEREADOR', 'PREFEITO', 'DEPUTADO ESTADUAL', 'DEPUTADO FEDERAL', 'GOVERNADOR', 'SENADOR')
  WINDOW w AS (PARTITION BY titulo_eleitor ORDER BY id_eleicao))
SELECT cargo_ant AS de, cargo AS para, COUNT(*) AS pessoas,
       COUNT(*) FILTER (WHERE res_ant LIKE 'ELEITO%') AS vinham_de_vitoria,
       COUNT(*) FILTER (WHERE situacao_resultado LIKE 'ELEITO%') AS ganharam_o_novo_cargo
FROM s WHERE cargo_ant IS NOT NULL AND cargo_ant <> cargo
GROUP BY cargo_ant, cargo ORDER BY pessoas DESC LIMIT 20;

/* ### 10.8 Q10 - Sobrevivencia de uma coorte (quem = 'todos' ou 'eleitos') */
WITH p AS (SELECT 2004 AS ano_base, 'VEREADOR' AS cargo, 'todos' AS quem),
coorte AS (
  SELECT DISTINCT c.titulo_eleitor FROM candidatura c CROSS JOIN p
  WHERE c.id_eleicao = p.ano_base AND c.cargo = p.cargo AND c.titulo_eleitor NOT LIKE 'S%'
    AND (p.quem = 'todos' OR c.situacao_resultado LIKE 'ELEITO%')),
part AS (
  SELECT c.id_eleicao AS ano, c.titulo_eleitor, bool_or(c.situacao_resultado LIKE 'ELEITO%') AS eleito
  FROM candidatura c CROSS JOIN p JOIN coorte USING (titulo_eleitor)
  WHERE c.id_eleicao >= p.ano_base GROUP BY c.id_eleicao, c.titulo_eleitor)
SELECT ano, COUNT(*) AS ainda_candidatos,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM coorte), 1) AS pct_da_coorte,
       COUNT(*) FILTER (WHERE eleito) AS eleitos,
       ROUND(100.0 * COUNT(*) FILTER (WHERE eleito) / (SELECT COUNT(*) FROM coorte), 1) AS pct_eleitos
FROM part GROUP BY ano ORDER BY ano;

/* ### 10.9 Q10 - Politicos invictos: ganharam todas as vezes que disputaram */
WITH p AS (SELECT 3 AS min_disputas)
SELECT pe.nome, pe.data_nascimento, COUNT(*) AS disputas, MIN(c.id_eleicao) AS primeira, MAX(c.id_eleicao) AS ultima,
       string_agg(DISTINCT c.cargo, ', ') AS cargos
FROM candidatura c CROSS JOIN p
JOIN pessoa pe ON pe.titulo_eleitor = c.titulo_eleitor
WHERE c.titulo_eleitor NOT LIKE 'S%'
GROUP BY pe.nome, pe.data_nascimento, p.min_disputas
HAVING COUNT(*) >= p.min_disputas AND COUNT(*) = COUNT(*) FILTER (WHERE c.situacao_resultado LIKE 'ELEITO%')
ORDER BY disputas DESC, pe.nome LIMIT 30;

/* ### 10.10 Q10 - Quem foi eleito em um municipio e como e a carreira de cada um */
WITH p AS (SELECT '%Belém%'::text AS municipio, 2020 AS ano, 'VEREADOR' AS cargo)
SELECT pe.nome, c.sigla_partido AS partido, c.situacao_resultado AS resultado,
       (SELECT COUNT(*) FROM candidatura x WHERE x.titulo_eleitor = c.titulo_eleitor) AS disputas_na_carreira,
       (SELECT COUNT(*) FROM candidatura x WHERE x.titulo_eleitor = c.titulo_eleitor
          AND x.situacao_resultado LIKE 'ELEITO%') AS vitorias_na_carreira,
       (SELECT MIN(x.id_eleicao) FROM candidatura x WHERE x.titulo_eleitor = c.titulo_eleitor) AS primeira_eleicao
FROM candidatura c CROSS JOIN p
JOIN pessoa pe ON pe.titulo_eleitor = c.titulo_eleitor
JOIN municipio m ON m.cod_ibge = c.cod_ibge
WHERE m.nome ILIKE p.municipio AND c.id_eleicao = p.ano AND c.cargo = p.cargo
  AND c.situacao_resultado LIKE 'ELEITO%'
ORDER BY disputas_na_carreira DESC, pe.nome;

/* ### 10.11 Q10 - Candidatos de um partido: ano, cargo e estado opcional, com resultado */
WITH p AS (SELECT 'PT'::text AS partido, 2022 AS ano, 'DEPUTADO ESTADUAL' AS cargo, NULL::text AS uf)
SELECT pe.nome, c.sg_uf AS uf, COALESCE(m.nome, '') AS municipio, c.situacao_resultado AS resultado
FROM candidatura c CROSS JOIN p
JOIN pessoa pe ON pe.titulo_eleitor = c.titulo_eleitor
LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
WHERE c.sigla_partido = p.partido AND c.id_eleicao = p.ano AND c.cargo = p.cargo
  AND (p.uf IS NULL OR c.sg_uf = p.uf)
ORDER BY c.situacao_resultado, pe.nome LIMIT 100;

/* ### 10.12 Q10 - Renovacao: que parte dos eleitos era estreante na base (a base comeca em 2002) */
WITH primeira AS (
  SELECT titulo_eleitor, MIN(id_eleicao) AS ano_estreia FROM candidatura
  WHERE titulo_eleitor NOT LIKE 'S%' GROUP BY titulo_eleitor)
SELECT c.cargo, c.id_eleicao AS ano, COUNT(*) AS eleitos,
       COUNT(*) FILTER (WHERE pr.ano_estreia = c.id_eleicao) AS estreantes,
       ROUND(100.0 * COUNT(*) FILTER (WHERE pr.ano_estreia = c.id_eleicao) / COUNT(*), 1) AS pct_estreantes
FROM candidatura c JOIN primeira pr ON pr.titulo_eleitor = c.titulo_eleitor
WHERE c.situacao_resultado LIKE 'ELEITO%'
  AND c.cargo IN ('VEREADOR', 'PREFEITO', 'DEPUTADO ESTADUAL', 'DEPUTADO FEDERAL', 'GOVERNADOR', 'SENADOR')
GROUP BY c.cargo, c.id_eleicao ORDER BY c.cargo, c.id_eleicao;
