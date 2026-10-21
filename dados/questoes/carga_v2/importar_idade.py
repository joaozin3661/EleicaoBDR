# -*- coding: utf-8 -*-
"""
Importa saida\\indicador_idade.csv na tabela indicador_municipal (só as colunas idade_mediana e
indice_envelhecimento, ano 2022). Faz "upsert": se a linha do município e do ano já existir (por exemplo,
com PIB e população carregados para a Q3), só atualiza essas duas colunas e preserva o resto.
Pode rodar de novo quando quiser. Depois rode views_q6.sql no pgAdmin.
"""
import csv
import os

import psycopg2

from importar_v2 import CONEXAO, SAIDA  # mesma conexão e pasta do importador principal

con = psycopg2.connect(**CONEXAO)
cur = con.cursor()
print("conectado em", CONEXAO["dbname"])

arq = os.path.join(SAIDA, "indicador_idade.csv")
cur.execute("CREATE TEMP TABLE tmp_idade (cod_ibge INT, ano SMALLINT, idade_mediana DECIMAL(4,1), indice_envelhecimento DECIMAL(6,2))")
with open(arq, encoding="utf-8") as f:
    cur.copy_expert("COPY tmp_idade (cod_ibge, ano, idade_mediana, indice_envelhecimento) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
cur.execute("""
    INSERT INTO indicador_municipal (cod_ibge, ano, idade_mediana, indice_envelhecimento)
    SELECT cod_ibge, ano, idade_mediana, indice_envelhecimento FROM tmp_idade
    ON CONFLICT (cod_ibge, ano) DO UPDATE
       SET idade_mediana = EXCLUDED.idade_mediana, indice_envelhecimento = EXCLUDED.indice_envelhecimento""")
con.commit()

with open(arq, encoding="utf-8") as f:
    no_csv = sum(1 for _ in csv.reader(f)) - 1
cur.execute("SELECT count(*), min(idade_mediana), max(idade_mediana) FROM indicador_municipal WHERE ano = 2022 AND idade_mediana IS NOT NULL")
no_banco, mn, mx = cur.fetchone()
print(f"  indicador_municipal (2022, idade mediana)  banco {no_banco:,} | csv {no_csv:,} | {'OK' if no_banco == no_csv else 'DIFERENTE!'} | de {mn} a {mx} anos")
cur.execute("ANALYZE indicador_municipal")
con.commit()
con.close()
print("PRONTO")
