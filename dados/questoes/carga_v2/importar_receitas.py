# -*- coding: utf-8 -*-
"""
Importa saida\\receita.csv no eleicoes_v2 (só esta tabela; as outras não são tocadas).
Pode rodar de novo quando quiser: ele esvazia a tabela receita antes de importar.
Depois rode views_q8.sql no pgAdmin.
"""
import csv
import os

import psycopg2

from importar_v2 import CONEXAO, SAIDA  # mesma conexão e pasta do importador principal

con = psycopg2.connect(**CONEXAO)
cur = con.cursor()
print("conectado em", CONEXAO["dbname"])

# bancos criados antes desta carga não têm as colunas sq_receita e natureza
cur.execute("ALTER TABLE receita ADD COLUMN IF NOT EXISTS sq_receita BIGINT")
cur.execute("ALTER TABLE receita ADD COLUMN IF NOT EXISTS natureza VARCHAR(20)")
cur.execute("TRUNCATE receita")
arq = os.path.join(SAIDA, "receita.csv")
with open(arq, encoding="utf-8") as f:
    colunas = next(csv.reader(f))
    f.seek(0)
    cur.copy_expert(f"COPY receita ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
con.commit()

with open(arq, encoding="utf-8") as f:
    no_csv = sum(1 for _ in csv.reader(f)) - 1
cur.execute("SELECT count(*), sum(valor) FROM receita")
no_banco, soma = cur.fetchone()
print(f"  receita  banco {no_banco:,} | csv {no_csv:,} | {'OK' if no_banco == no_csv else 'DIFERENTE!'}")
print(f"  total arrecadado: R$ {float(soma)/1e9:.2f} bi")
cur.execute("CREATE INDEX IF NOT EXISTS ix_receita_candidatura ON receita (id_candidatura)")
cur.execute("ANALYZE receita")
con.commit()
con.close()
print("PRONTO")
