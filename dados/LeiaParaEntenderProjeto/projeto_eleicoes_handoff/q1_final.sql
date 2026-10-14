WITH gasto AS (
  SELECT c.id_eleicao AS ano, UPPER(c.cargo) AS cargo, c.sg_uf AS uf,
         COUNT(DISTINCT c.id_candidatura) AS candidatos,
         SUM(COALESCE(d.valor, 0)) AS gasto_total
  FROM candidatura c
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao >= 2018
  GROUP BY c.id_eleicao, UPPER(c.cargo), c.sg_uf),
vagas AS (
  SELECT v.id_eleicao AS ano, UPPER(v.cargo) AS cargo, COALESCE(v.sg_uf, m.uf) AS uf,
         SUM(v.qt_vaga) AS cadeiras
  FROM vaga v
  LEFT JOIN municipio m ON m.cod_ibge = v.cod_ibge
  WHERE v.id_eleicao >= 2018
  GROUP BY v.id_eleicao, UPPER(v.cargo), COALESCE(v.sg_uf, m.uf))
SELECT g.ano, g.cargo, g.uf, g.candidatos, v.cadeiras,
       ROUND(g.gasto_total, 2) AS gasto_total,
       ROUND(g.gasto_total / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g
JOIN vagas v ON v.ano = g.ano AND v.cargo = g.cargo AND v.uf = g.uf
ORDER BY g.cargo, g.ano, g.uf;
