"""Dados extras do frontend (frontend/dados/extra/*.json), que a API ainda não serve.

Lê só as views e tabelas que já existem no banco (PGDATABASE do .env); não cria nada no banco.
Roda dentro do npm run grava (em api/); sozinho: python api/exportacao/exporta_extra.py
"""
import json
from pathlib import Path

from conexao import SEM_CASA, consulta_json as consulta, ufs

SAIDA = Path(__file__).resolve().parents[2] / "frontend" / "dados" / "extra"
CASAS = [(2018, "DEPUTADO FEDERAL"), (2018, "DEPUTADO ESTADUAL"), (2022, "DEPUTADO FEDERAL"), (2022, "DEPUTADO ESTADUAL"),
         (2020, "VEREADOR"), (2024, "VEREADOR"), (2026, "DEPUTADO FEDERAL"), (2026, "DEPUTADO ESTADUAL")]


def grava(nome, sql, dados):
    (SAIDA / nome).write_text(json.dumps({"sql": " ".join(sql.split()), "dados": dados}, ensure_ascii=False,
                                         separators=(",", ":")), encoding="utf-8")
    print(nome, len(dados) if hasattr(dados, "__len__") else "")


# 1. Para cada cadeira: gasto da campanha, se é mulher e patrimônio declarado (custo da bancada, mulheres no hemiciclo)
SQL_CADEIRA = """
SELECT s.sg_uf AS uf, s.id_candidatura AS id, ROUND(g.gasto) AS gasto, (p.sexo = 'FEMININO') AS mulher, ROUND(q.patrimonio) AS patrimonio
FROM vw_site_cadeira s
JOIN candidatura c ON c.id_candidatura = s.id_candidatura
JOIN pessoa p ON p.id_pessoa = c.id_pessoa
LEFT JOIN vw_gasto_candidatura g ON g.id_candidatura = s.id_candidatura
LEFT JOIN vw_q2_patrimonio q ON q.id_candidatura = s.id_candidatura
WHERE s.ano = {ano} AND s.cargo = '{cargo}'"""

# 2. Votos e cadeiras de cada partido nas casas estaduais (votos nominais + de legenda, 1º turno)
SQL_PARTIDOS = """
WITH nominal AS (
  SELECT c.sg_uf AS uf, c.sigla_partido AS partido, c.numero_partido, SUM(v.votos_nominais) AS votos
  FROM candidatura c JOIN votacao v ON v.id_candidatura = c.id_candidatura AND v.turno = 1
  WHERE c.id_eleicao = {ano} AND c.cargo = '{cargo}'
  GROUP BY 1, 2, 3),
legenda AS (
  SELECT m.uf, l.numero_partido, SUM(l.votos_legenda) AS votos
  FROM votacao_legenda l JOIN municipio m ON m.cod_ibge = l.cod_ibge
  WHERE l.id_eleicao = {ano} AND l.cargo = '{cargo}' AND l.turno = 1
  GROUP BY 1, 2),
cadeiras AS (
  SELECT sg_uf AS uf, partido, COUNT(*) AS cadeiras FROM vw_site_cadeira
  WHERE ano = {ano} AND cargo = '{cargo}' GROUP BY 1, 2)
SELECT n.uf, n.partido, n.votos + COALESCE(l.votos, 0) AS votos, COALESCE(k.cadeiras, 0) AS cadeiras
FROM nominal n LEFT JOIN legenda l ON l.uf = n.uf AND l.numero_partido = n.numero_partido
LEFT JOIN cadeiras k ON k.uf = n.uf AND k.partido = n.partido
ORDER BY n.uf, votos DESC"""

# 3. Casos extremos para anotar nos gráficos: eleito que mais e que menos gastou por voto, e o mais rico
SQL_EXTREMOS = """
WITH base AS (
  SELECT c.id_eleicao AS ano, c.cargo, c.sg_uf AS uf, c.nome_urna, c.sigla_partido AS partido, c.id_candidatura,
         c.total_votos AS votos, g.gasto, q.patrimonio
  FROM candidatura c
  JOIN vw_gasto_candidatura g ON g.id_candidatura = c.id_candidatura
  JOIN vw_q2_patrimonio q ON q.id_candidatura = c.id_candidatura
  WHERE c.situacao_resultado LIKE 'ELEITO%' AND c.cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'SENADOR', 'GOVERNADOR'))
SELECT ano, cargo, uf, nome_urna, partido, id_candidatura, votos, ROUND(gasto) AS gasto, ROUND(patrimonio) AS patrimonio,
       ROUND(gasto / NULLIF(votos, 0), 2) AS por_voto
FROM base ORDER BY ano, cargo, uf, nome_urna"""

# 4. Mulheres entre candidatos e eleitos, 2002 a 2024 (cota de 30% de candidaturas por sexo desde 2009)
SQL_MULHERES = """
SELECT c.id_eleicao AS ano, c.cargo,
       ROUND(100.0 * AVG((p.sexo = 'FEMININO')::int), 1) AS candidatas,
       ROUND(100.0 * AVG((p.sexo = 'FEMININO')::int) FILTER (WHERE c.situacao_resultado LIKE 'ELEITO%'), 1) AS eleitas,
       COUNT(*) FILTER (WHERE c.situacao_resultado LIKE 'ELEITO%') AS eleitos
FROM candidatura c JOIN pessoa p ON p.id_pessoa = c.id_pessoa
WHERE c.cargo IN ('VEREADOR', 'DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'PREFEITO')
GROUP BY 1, 2 ORDER BY 2, 1"""

# 5. Todos os candidatos a deputado federal de 2022: gasto e se elegeu (a história do preço da cadeira)
SQL_DF2022 = """
SELECT ROUND(g.gasto) AS gasto, (g.resultado = 'ELEITO') AS eleito
FROM vw_gasto_candidatura g
WHERE g.ano = 2022 AND g.cargo = 'DEPUTADO FEDERAL' AND g.resultado <> 'SEM RESULTADO'
ORDER BY g.gasto"""

# 6. Os vereadores eleitos mais ricos de 2024 (anotação da história do patrimônio)
SQL_RICOS = """
SELECT c.nome_urna, c.sigla_partido AS partido, m.nome AS municipio, m.uf, ROUND(q.patrimonio) AS patrimonio
FROM vw_q2_patrimonio q
JOIN candidatura c ON c.id_candidatura = q.id_candidatura
JOIN municipio m ON m.cod_ibge = c.cod_ibge
WHERE q.ano = 2024 AND q.cargo = 'VEREADOR' AND q.eleito
ORDER BY q.patrimonio DESC LIMIT 5"""


def main():
    # Uma consulta por casa com todas as UFs juntas (as views de gasto e patrimônio não são materializadas,
    # então filtrar UF por UF recalculava tudo ~160 vezes); a separação por UF é feita aqui.
    cadeiras, partidos = {}, {}
    lista = list(ufs())
    for ano, cargo in CASAS:
        def chave(uf):
            return f"{ano}_{cargo.replace(' ', '_')}_{uf}"
        validas = [uf for uf in lista if (uf, cargo) not in SEM_CASA]
        for uf in validas:
            cadeiras[chave(uf)] = {}
        for l in consulta(SQL_CADEIRA.format(ano=ano, cargo=cargo)):
            if l["uf"] in validas:
                cadeiras[chave(l["uf"])][str(l["id"])] = [l["gasto"] or 0, l["mulher"], l["patrimonio"] or 0]
        if cargo != "VEREADOR":
            for uf in validas:
                partidos[chave(uf)] = []
            for l in consulta(SQL_PARTIDOS.format(ano=ano, cargo=cargo)):
                if l["uf"] in validas:
                    partidos[chave(l["uf"])].append({k: l[k] for k in ("partido", "votos", "cadeiras")})
    grava("cadeiras_extra.json", SQL_CADEIRA, cadeiras)
    grava("partidos_votos.json", SQL_PARTIDOS, partidos)
    grava("extremos.json", SQL_EXTREMOS, consulta(SQL_EXTREMOS))
    grava("mulheres.json", SQL_MULHERES, consulta(SQL_MULHERES))
    grava("df2022.json", SQL_DF2022, [[l["gasto"], 1 if l["eleito"] else 0] for l in consulta(SQL_DF2022)])
    grava("ricos_vereador_2024.json", SQL_RICOS, consulta(SQL_RICOS))


if __name__ == "__main__":
    main()
