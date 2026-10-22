# -*- coding: utf-8 -*-
"""
Importa os dados da Q5 no eleicoes_v2 (só estas tabelas; as outras não são tocadas):
  votacao.csv          -> votacao (apaga e recarrega)
  votacao_legenda.csv  -> votacao_legenda (apaga e recarrega)
e preenche candidatura.total_votos (soma dos votos nominais válidos) dos candidatos que têm votação carregada.
Pode rodar de novo quando quiser. Depois rode views_q5.sql no pgAdmin.
"""
import csv
import os

import psycopg2

from importar_v2 import CONEXAO, SAIDA  # mesma conexão e pasta do importador principal

con = psycopg2.connect(**CONEXAO)
cur = con.cursor()
print("conectado em", CONEXAO["dbname"])

for tabela, arq in (("votacao", "votacao.csv"), ("votacao_legenda", "votacao_legenda.csv")):
    caminho = os.path.join(SAIDA, arq)
    cur.execute(f"DELETE FROM {tabela}")
    with open(caminho, encoding="utf-8") as f:
        colunas = next(csv.reader(f))
        f.seek(0)
        cur.copy_expert(f"COPY {tabela} ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
    with open(caminho, encoding="utf-8") as f:
        no_csv = sum(1 for _ in csv.reader(f)) - 1
    cur.execute(f"SELECT count(*) FROM {tabela}")
    n = cur.fetchone()[0]
    print(f"  {tabela:16s} banco {n:>10,} | csv {no_csv:>10,} | {'OK' if n == no_csv else 'DIFERENTE!'}")

cur.execute("UPDATE candidatura SET total_votos = NULL WHERE total_votos IS NOT NULL")
cur.execute("""UPDATE candidatura c SET total_votos = v.total
               FROM (SELECT id_candidatura, SUM(votos_nominais) AS total FROM votacao GROUP BY id_candidatura) v
               WHERE v.id_candidatura = c.id_candidatura""")
print(f"  candidatura.total_votos preenchido em {cur.rowcount:,} candidaturas")
cur.execute("""SELECT id_eleicao, cargo, count(*), count(total_votos) FROM candidatura
               WHERE cargo IN ('DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'VEREADOR') AND id_eleicao IN (2018, 2020, 2022, 2024)
               GROUP BY 1, 2 ORDER BY 1, 2""")
print("  (ano, cargo, candidaturas, com votos):")
for r in cur.fetchall():
    print("    ", r)
con.commit()
cur.execute("ANALYZE votacao"); cur.execute("ANALYZE votacao_legenda"); cur.execute("ANALYZE candidatura")
con.commit()
con.close()
print("PRONTO")
