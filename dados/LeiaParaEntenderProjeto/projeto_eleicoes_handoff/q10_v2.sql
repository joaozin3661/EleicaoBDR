WITH p AS (SELECT '%BARBALHO%'::text AS nome),
base AS (
  SELECT pe.titulo_eleitor, pe.nome, pe.data_nascimento,
         c.id_eleicao AS ano, c.cargo, c.sigla_partido, c.sg_uf, m.nome AS municipio,
         c.situacao_resultado, (c.situacao_resultado LIKE 'ELEITO%') AS eleito,
         CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'VITÓRIA'
              WHEN c.situacao_resultado = 'NÃO ELEITO' THEN 'DERROTA'
              WHEN c.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
              WHEN c.situacao_resultado LIKE 'REGISTRO NEGADO%' OR c.situacao_resultado LIKE 'INDEFERIDO%' THEN 'REGISTRO NEGADO'
              WHEN c.situacao_resultado LIKE 'RENÚNCIA%' THEN 'RENÚNCIA/FALECIMENTO'
              ELSE 'SEM RESULTADO' END AS resultado
  FROM pessoa pe
  CROSS JOIN p
  JOIN candidatura c ON c.titulo_eleitor = pe.titulo_eleitor
  LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
  WHERE pe.nome ILIKE p.nome),
marcado AS (
  SELECT b.*,
         EXISTS (SELECT 1 FROM base x
                 WHERE x.titulo_eleitor = b.titulo_eleitor AND x.cargo = b.cargo AND x.eleito
                   AND x.ano = b.ano - CASE WHEN b.cargo = 'SENADOR' THEN 8 ELSE 4 END) AS tinha_mandato,
         LAG(b.sigla_partido) OVER w AS partido_anterior,
         LAG(b.cargo) OVER w AS cargo_anterior
  FROM base b
  WINDOW w AS (PARTITION BY b.titulo_eleitor ORDER BY b.ano))
SELECT nome,
       ano,
       cargo AS cargo_disputado,
       COALESCE(municipio, sg_uf) AS local,
       sigla_partido AS partido,
       resultado,
       CASE WHEN eleito AND tinha_mandato THEN 'REELEIÇÃO'
            WHEN resultado = 'DERROTA' AND tinha_mandato THEN 'TENTOU REELEIÇÃO E PERDEU'
            WHEN eleito THEN 'ELEITO (1º mandato neste cargo)' ELSE '' END AS evento,
       TRIM(CASE WHEN partido_anterior IS NOT NULL AND partido_anterior <> sigla_partido
                 THEN 'Trocou de ' || partido_anterior || ' para ' || sigla_partido || '. ' ELSE '' END
         || CASE WHEN cargo_anterior IS NOT NULL AND cargo_anterior <> cargo
                 THEN 'Mudou de ' || cargo_anterior || ' para ' || cargo || '.' ELSE '' END) AS observacoes,
       data_nascimento
FROM marcado
ORDER BY nome, data_nascimento, titulo_eleitor, ano;
