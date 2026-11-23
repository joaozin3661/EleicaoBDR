/* Confere se o banco está completo: as contagens têm que bater com as da carga das 27 UFs com 2026 (eleicoes, CARGA_UFS=TODAS,
   arquivos de 2026 do TSE baixados em 13/11/2026).
   Rode da raiz do projeto:  psql -U postgres -d eleicoes -f banco/testes/contagens.sql
   Cada linha mostra a contagem, a esperada e "ok" ou "DIFERENTE". */

SELECT item, contagem, esperado, CASE WHEN contagem = esperado THEN 'ok' ELSE 'DIFERENTE' END AS situacao
FROM (VALUES
  ('candidatura',   (SELECT count(*) FROM candidatura),  2949123),
  ('pessoa',        (SELECT count(*) FROM pessoa),       1856162),
  ('votacao',       (SELECT count(*) FROM votacao),      22156436),
  ('mv_q5_eleito',  (SELECT count(*) FROM mv_q5_eleito), 120815),
  ('municipio',     (SELECT count(*) FROM municipio),    5571)
) AS t(item, contagem, esperado);
