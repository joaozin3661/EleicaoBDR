# -*- coding: utf-8 -*-
"""
Importa os dados da Q3 no eleicoes_v2 (só estas tabelas; as outras não são tocadas):
  indicador_2010.csv         -> indicador_municipal (upsert: atualiza só idhm, pib, populacao e pib_per_capita;
                                preserva o que já existe na linha, como a idade mediana de 2022)
  totalizacao_municipio.csv  -> totalizacao_municipio (apaga e recarrega só 2008 e 2012)
Pode rodar de novo quando quiser. Depois rode views_q3.sql no pgAdmin.
"""
import csv
import os

import psycopg2

from importar_v2 import CONEXAO, SAIDA  # mesma conexão e pasta do importador principal

con = psycopg2.connect(**CONEXAO)
cur = con.cursor()
print("conectado em", CONEXAO["dbname"])

# bancos criados antes desta carga têm a restrição exata (aptos = comparecimento + abstenções); o TSE publica 4 linhas de 2012
# com diferença de 1 ou 2 eleitores (ex.: Aracaju), então o modelo passa a tolerar até 10
cur.execute("ALTER TABLE totalizacao_municipio DROP CONSTRAINT IF EXISTS ck_totalizacao_soma")
cur.execute("ALTER TABLE totalizacao_municipio ADD CONSTRAINT ck_totalizacao_soma "
            "CHECK (ABS(eleitores_aptos - comparecimento - abstencoes) <= 10)")

arq = os.path.join(SAIDA, "indicador_2010.csv")
cur.execute("""CREATE TEMP TABLE tmp_ind (cod_ibge INT, ano SMALLINT, idhm DECIMAL(4,3), pib DECIMAL(18,2),
               populacao INT, pib_per_capita DECIMAL(15,2))""")
with open(arq, encoding="utf-8") as f:
    colunas = next(csv.reader(f))
    f.seek(0)
    cur.copy_expert(f"COPY tmp_ind ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
cur.execute("""
    INSERT INTO indicador_municipal (cod_ibge, ano, idhm, pib, populacao, pib_per_capita)
    SELECT cod_ibge, ano, idhm, pib, populacao, pib_per_capita FROM tmp_ind
    ON CONFLICT (cod_ibge, ano) DO UPDATE SET
       idhm = COALESCE(EXCLUDED.idhm, indicador_municipal.idhm),
       pib = COALESCE(EXCLUDED.pib, indicador_municipal.pib),
       populacao = COALESCE(EXCLUDED.populacao, indicador_municipal.populacao),
       pib_per_capita = COALESCE(EXCLUDED.pib_per_capita, indicador_municipal.pib_per_capita)""")

arq = os.path.join(SAIDA, "totalizacao_municipio.csv")
cur.execute("DELETE FROM totalizacao_municipio WHERE id_eleicao IN (2008, 2012)")
with open(arq, encoding="utf-8") as f:
    colunas = next(csv.reader(f))
    f.seek(0)
    cur.copy_expert(f"COPY totalizacao_municipio ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
con.commit()

with open(arq, encoding="utf-8") as f:
    no_csv = sum(1 for _ in csv.reader(f)) - 1
cur.execute("SELECT count(*) FROM totalizacao_municipio WHERE id_eleicao IN (2008, 2012)")
n = cur.fetchone()[0]
print(f"  totalizacao_municipio  banco {n:,} | csv {no_csv:,} | {'OK' if n == no_csv else 'DIFERENTE!'}")
cur.execute("SELECT ano, count(*), count(idhm), count(pib_per_capita), count(idade_mediana) FROM indicador_municipal GROUP BY 1 ORDER BY 1")
print("  indicador_municipal (ano, linhas, com idhm, com pib per capita, com idade mediana):")
for r in cur.fetchall():
    print("    ", r)
cur.execute("ANALYZE indicador_municipal"); cur.execute("ANALYZE totalizacao_municipio")
con.commit()
con.close()
print("PRONTO")
