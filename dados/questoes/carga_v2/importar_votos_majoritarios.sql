/* Grava em candidatura.total_votos os votos do 1o turno de governador, senador e prefeito (2018 a 2024),
   gerados por carga_votos_majoritarios.py em saida/votos_majoritarios.csv. So mexe nesses tres cargos:
   os votos dos cargos proporcionais continuam vindo da Q5 (importar_q5.py). Pode rodar de novo.

   Uso (troque o caminho pela pasta carga_v2):
     psql -U postgres -d eleicoes_v2 -v pasta="C:/.../dados/questoes/carga_v2" -f importar_votos_majoritarios.sql */

\set ON_ERROR_STOP on
\cd :pasta

BEGIN;

CREATE TEMP TABLE t_votos (id_candidatura BIGINT PRIMARY KEY, total_votos INT NOT NULL);
\copy t_votos FROM 'saida/votos_majoritarios.csv' WITH (FORMAT csv, HEADER true)

UPDATE candidatura SET total_votos = NULL
WHERE cargo IN ('GOVERNADOR', 'SENADOR', 'PREFEITO') AND total_votos IS NOT NULL;

UPDATE candidatura c SET total_votos = t.total_votos
FROM t_votos t
WHERE t.id_candidatura = c.id_candidatura AND c.cargo IN ('GOVERNADOR', 'SENADOR', 'PREFEITO');

/* conferencia: candidaturas com resultado e quantas ficaram com votos, por ano e cargo */
SELECT c.id_eleicao AS ano, c.cargo, count(*) AS candidaturas, count(c.total_votos) AS com_votos,
       (SELECT count(*) FROM t_votos t WHERE NOT EXISTS (SELECT 1 FROM candidatura x WHERE x.id_candidatura = t.id_candidatura)) AS no_csv_sem_candidatura
FROM candidatura c
WHERE c.cargo IN ('GOVERNADOR', 'SENADOR', 'PREFEITO') AND c.id_eleicao >= 2018 AND c.situacao_resultado IS NOT NULL
GROUP BY 1, 2 ORDER BY 1, 2;

COMMIT;
ANALYZE candidatura;
