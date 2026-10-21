# -*- coding: utf-8 -*-
"""
Importa saida\\eleitorado.csv no eleicoes_v2 (só esta tabela; as outras não são tocadas).
Pode rodar de novo quando quiser: ele esvazia a tabela eleitorado antes de importar.
Depois rode views_q4.sql no pgAdmin.
"""
import csv
import os

import psycopg2

from importar_v2 import CONEXAO, SAIDA  # mesma conexão e pasta do importador principal

con = psycopg2.connect(**CONEXAO)
cur = con.cursor()
print("conectado em", CONEXAO["dbname"])

cur.execute("TRUNCATE eleitorado")
arq = os.path.join(SAIDA, "eleitorado.csv")
with open(arq, encoding="utf-8") as f:
    colunas = next(csv.reader(f))
    f.seek(0)
    cur.copy_expert(f"COPY eleitorado ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
con.commit()

with open(arq, encoding="utf-8") as f:
    no_csv = sum(1 for _ in csv.reader(f)) - 1
cur.execute("SELECT count(*), sum(qtd_eleitores) FROM eleitorado")
no_banco, soma = cur.fetchone()
print(f"  eleitorado  banco {no_banco:,} | csv {no_csv:,} | {'OK' if no_banco == no_csv else 'DIFERENTE!'}")
cur.execute("SELECT id_eleicao, count(DISTINCT cod_ibge), sum(qtd_eleitores) FROM eleitorado GROUP BY 1 ORDER BY 1")
for ano, n, aptos in cur.fetchall():
    print(f"    {ano}: {n:,} municípios | {aptos:,} aptos")
cur.execute("ANALYZE eleitorado")
con.commit()
con.close()
print("PRONTO")
