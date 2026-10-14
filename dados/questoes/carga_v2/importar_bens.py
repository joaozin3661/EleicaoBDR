# -*- coding: utf-8 -*-
"""
Importa saida\\bem_declarado.csv no eleicoes_v2 (só esta tabela; as outras não são tocadas).
Pode rodar de novo quando quiser: ele esvazia bem_declarado antes de importar.
Depois rode views_q2.sql no pgAdmin.
"""
import csv
import os

import psycopg2

from importar_v2 import CONEXAO, SAIDA  # mesma conexão e pasta do importador principal

con = psycopg2.connect(**CONEXAO)
cur = con.cursor()
print("conectado em", CONEXAO["dbname"])

# a primeira versão do DDL tinha tipo_bem VARCHAR(100), e o TSE usa até 112 caracteres
cur.execute("ALTER TABLE bem_declarado ALTER COLUMN tipo_bem TYPE VARCHAR(150)")
cur.execute("TRUNCATE bem_declarado")
arq = os.path.join(SAIDA, "bem_declarado.csv")
with open(arq, encoding="utf-8") as f:
    colunas = next(csv.reader(f))
    f.seek(0)
    cur.copy_expert(f"COPY bem_declarado ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
con.commit()

with open(arq, encoding="utf-8") as f:
    no_csv = sum(1 for _ in csv.reader(f)) - 1
cur.execute("SELECT count(*), sum(valor) FROM bem_declarado")
no_banco, soma = cur.fetchone()
print(f"  bem_declarado  banco {no_banco:,} | csv {no_csv:,} | {'OK' if no_banco == no_csv else 'DIFERENTE!'}")
print(f"  total declarado: R$ {float(soma)/1e9:.2f} bi")
cur.execute("ANALYZE bem_declarado")
con.commit()
con.close()
print("PRONTO")
