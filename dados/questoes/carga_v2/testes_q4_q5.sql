/* Testes das views da Q4 e da Q5 (banco eleicoes_v2). Rodar no pgAdmin (Query Tool) depois de views_q4.sql e views_q5.sql.
   Cada linha do resultado e um teste: coluna resultado = OK ou ERRO. Os valores esperados sao os conferidos em pandas
   (verifica_q4_2022 e verifica_q5, 0 divergencias). Se um teste der ERRO, a coluna obtido mostra o que o banco devolveu. */

WITH t AS (

  /* ---------- Q5: votos e quociente ---------- */
  SELECT 'Q5 01 · circunscricoes: 24 de deputados (6 UFs x 4 disputas) + 1.238 de vereador em 2020 + 1.232 em 2024' AS teste,
         '2494' AS esperado, COUNT(*)::text AS obtido FROM mv_q5_circunscricao
  UNION ALL
  SELECT 'Q5 02 · votos validos 2022 deputado federal (igual ao total oficial do TSE)',
         '19581741', SUM(votos_validos)::text FROM mv_q5_circunscricao WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL'
  UNION ALL
  SELECT 'Q5 03 · votos validos 2020 vereador (igual ao total oficial do TSE)',
         '18405616', SUM(votos_validos)::text FROM mv_q5_circunscricao WHERE ano = 2020 AND cargo = 'VEREADOR'
  UNION ALL
  SELECT 'Q5 04 · disputas em que eleitos <> vagas (deve ser 0)',
         '0', COUNT(*)::text
  FROM (SELECT q.ano, q.cargo, q.sg_uf, q.cod_ibge
        FROM mv_q5_circunscricao q
        LEFT JOIN mv_q5_eleito e USING (ano, cargo, sg_uf, cod_ibge)
        GROUP BY q.ano, q.cargo, q.sg_uf, q.cod_ibge, q.vagas
        HAVING COUNT(e.id_candidatura) <> q.vagas) x
  UNION ALL
  SELECT 'Q5 05 · quociente = votos validos / vagas, arredondado (diferentes: 0)',
         '0', COUNT(*)::text
  FROM mv_q5_circunscricao
  WHERE quociente <> CASE WHEN votos_validos::numeric / vagas - FLOOR(votos_validos::numeric / vagas) > 0.5
                          THEN CEIL(votos_validos::numeric / vagas) ELSE FLOOR(votos_validos::numeric / vagas) END
  UNION ALL
  SELECT 'Q5 06 · 2024 vereador: municipios excluidos por dados incompletos (1238 - 6)',
         '1232', COUNT(*)::text FROM mv_q5_circunscricao WHERE ano = 2024 AND cargo = 'VEREADOR'

  /* ---------- Q5: resultados ---------- */
  UNION ALL
  SELECT 'Q5 07 · 2022 deputado federal: eleitos / por legenda / fora dos mais votados',
         '92 / 87 / 11', eleitos || ' / ' || eleitos_por_legenda || ' / ' || fora_dos_mais_votados
  FROM mv_q5_resumo WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL' AND uf = 'TODAS'
  UNION ALL
  SELECT 'Q5 08 · 2018 deputado estadual: eleitos / por legenda / %',
         '222 / 220 / 99.1', eleitos || ' / ' || eleitos_por_legenda || ' / ' || pct_por_legenda
  FROM mv_q5_resumo WHERE ano = 2018 AND cargo = 'DEPUTADO ESTADUAL' AND uf = 'TODAS'
  UNION ALL
  SELECT 'Q5 09 · 2020 vereador: eleitos / por legenda / fora dos mais votados',
         '12621 / 12400 / 1878', eleitos || ' / ' || eleitos_por_legenda || ' / ' || fora_dos_mais_votados
  FROM mv_q5_resumo WHERE ano = 2020 AND cargo = 'VEREADOR' AND uf = 'TODAS'
  UNION ALL
  SELECT 'Q5 10 · 2024 vereador: eleitos / por legenda',
         '12646 / 12333', eleitos || ' / ' || eleitos_por_legenda
  FROM mv_q5_resumo WHERE ano = 2024 AND cargo = 'VEREADOR' AND uf = 'TODAS'
  UNION ALL
  SELECT 'Q5 11 · 2022 deputado federal: MDB eleitos / por legenda',
         '15 / 15', eleitos || ' / ' || eleitos_por_legenda
  FROM mv_q5_partido WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL' AND uf = 'TODAS' AND partido = 'MDB'
  UNION ALL
  SELECT 'Q5 12 · soma dos eleitos por partido = eleitos do resumo (diferencas: 0)',
         '0', COUNT(*)::text
  FROM (SELECT p.ano, p.cargo, p.uf
        FROM mv_q5_partido p JOIN mv_q5_resumo r USING (ano, cargo, uf)
        GROUP BY p.ano, p.cargo, p.uf, r.eleitos HAVING SUM(p.eleitos) <> r.eleitos) x
  UNION ALL
  SELECT 'Q5 13 · barrados: quem foi eleito nao aparece na lista (deve ser 0)',
         '0', COUNT(*)::text FROM mv_q5_barrado b JOIN mv_q5_eleito e USING (id_candidatura)
  UNION ALL
  SELECT 'Q5 14 · barrados: total',
         '3670', COUNT(*)::text FROM mv_q5_barrado

  /* ---------- Q4: parte 1 e quartis ---------- */
  UNION ALL
  SELECT 'Q4 01 · 2022 deputado federal: quartis de municipios (310 / 310 / 309 / 309)',
         '310 / 310 / 309 / 309',
         string_agg(municipios::text, ' / ' ORDER BY grupo_ordem)
  FROM mv_q4_grupos WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL' AND uf = 'TODAS' AND grupo_ordem > 0
  UNION ALL
  SELECT 'Q4 02 · 2022 deputado federal: correlacao / inclinacao / correlacao com todos os votados',
         '0.110 / 0.044 / 0.216', correlacao || ' / ' || inclinacao || ' / ' || correlacao_votados
  FROM mv_q4_correlacao WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL' AND uf = 'TODAS'
  UNION ALL
  SELECT 'Q4 03 · 2022 deputado estadual: correlacao / inclinacao',
         '0.052 / 0.045', correlacao || ' / ' || inclinacao
  FROM mv_q4_correlacao WHERE ano = 2022 AND cargo = 'DEPUTADO ESTADUAL' AND uf = 'TODAS'
  UNION ALL
  SELECT 'Q4 04 · 2024 vereador: correlacao / inclinacao (nao mudou com a ampliacao das views)',
         '0.468 / 0.586', correlacao || ' / ' || inclinacao
  FROM mv_q4_correlacao WHERE ano = 2024 AND cargo = 'VEREADOR' AND uf = 'TODAS'
  UNION ALL
  SELECT 'Q4 05 · 2024 vereador: % de eleitos com superior no 1o e no 4o quartos',
         '27.6 / 49.9', string_agg(pct_superior_eleitos::text, ' / ' ORDER BY grupo_ordem)
  FROM mv_q4_grupos WHERE ano = 2024 AND cargo = 'VEREADOR' AND uf = 'TODAS' AND grupo_ordem IN (1, 4)
  UNION ALL
  SELECT 'Q4 06 · 2022 deputado federal: escolaridade media do eleitorado no 1o e no 4o quartos',
         '6.43 / 9.50', string_agg(anos_eleitorado_medio::text, ' / ' ORDER BY grupo_ordem)
  FROM mv_q4_grupos WHERE ano = 2022 AND cargo = 'DEPUTADO FEDERAL' AND uf = 'TODAS' AND grupo_ordem IN (1, 4)
  UNION ALL
  SELECT 'Q4 07 · municipios por eleicao e cargo (2022 fed, 2022 est, 2024 pref, 2024 ver)',
         '1238 / 1238 / 1232 / 1232',
         string_agg(n::text, ' / ' ORDER BY ano, cargo DESC)
  FROM (SELECT ano, cargo, COUNT(*) AS n FROM mv_q4_municipio GROUP BY ano, cargo) x
  UNION ALL
  SELECT 'Q4 08 · taxa de sucesso 2024 vereador com superior completo (parte 1)',
         '20.1', taxa_sucesso::text
  FROM mv_q4_sucesso WHERE ano = 2024 AND cargo = 'VEREADOR' AND uf = 'TODAS' AND ordem = 7
)
SELECT teste, esperado, obtido, CASE WHEN esperado = obtido THEN 'OK' ELSE 'ERRO' END AS resultado
FROM t
ORDER BY teste;
