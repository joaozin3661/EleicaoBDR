# -*- coding: utf-8 -*-
"""
Importa os dados da Q7 no eleicoes (só estas tabelas; as outras não são tocadas):
  votacao_partido_municipio.csv (carga_votos_q7.py) -> votacao_partido_municipio (apaga e recarrega)
  vies_partido.csv (carga_vies.py)                   -> vies_partido (apaga e recarrega) e
partido.espectro_politico com a posição mais recente de cada número (esquerda, centro ou direita; centro é a faixa de
4,5 a 5,5 da nota, -10 a +10 de viés). Só mexe nessas duas coisas; pode rodar de novo quando quiser.
Depois rode banco/sql/views/07_q7.sql.
"""
import csv
import os

import psycopg2

from importar import CONEXAO, SAIDA  # mesma conexão e pasta do importador principal

con = psycopg2.connect(**CONEXAO)
cur = con.cursor()
print("conectado em", CONEXAO["dbname"])

cur.execute("""
CREATE TABLE IF NOT EXISTS vies_partido (
    id_eleicao     INT           NOT NULL,
    numero_partido SMALLINT      NOT NULL,
    sigla          VARCHAR(20)   NOT NULL,
    onda           SMALLINT      NOT NULL,
    nota_media     DECIMAL(4,2),
    especialistas  INT,
    vies           DECIMAL(4,1),
    origem         VARCHAR(80)   NOT NULL,
    PRIMARY KEY (id_eleicao, numero_partido),
    CONSTRAINT fk_vies_eleicao FOREIGN KEY (id_eleicao)     REFERENCES eleicao(id_eleicao),
    CONSTRAINT fk_vies_partido FOREIGN KEY (numero_partido) REFERENCES partido(numero_partido),
    CONSTRAINT ck_vies_faixa   CHECK (vies BETWEEN -100 AND 100),
    CONSTRAINT ck_vies_onda    CHECK (onda IN (2018, 2022))
)""")
cur.execute("""
CREATE TABLE IF NOT EXISTS votacao_partido_municipio (
    id_eleicao     INT          NOT NULL,
    cargo          VARCHAR(60)  NOT NULL,
    cod_ibge       INT          NOT NULL,
    numero_partido SMALLINT     NOT NULL,
    turno          SMALLINT     NOT NULL,
    votos_nominais INT          NOT NULL,
    votos_legenda  INT          NOT NULL,
    PRIMARY KEY (id_eleicao, cargo, cod_ibge, numero_partido, turno),
    CONSTRAINT fk_vpm_eleicao   FOREIGN KEY (id_eleicao)     REFERENCES eleicao(id_eleicao),
    CONSTRAINT fk_vpm_municipio FOREIGN KEY (cod_ibge)       REFERENCES municipio(cod_ibge),
    CONSTRAINT fk_vpm_partido   FOREIGN KEY (numero_partido) REFERENCES partido(numero_partido),
    CONSTRAINT ck_vpm_votos     CHECK (votos_nominais >= 0 AND votos_legenda >= 0)
)""")
cur.execute("TRUNCATE votacao_partido_municipio")
arq = os.path.join(SAIDA, "votacao_partido_municipio.csv")
with open(arq, encoding="utf-8") as f:
    colunas = next(csv.reader(f))
    f.seek(0)
    cur.copy_expert(f"COPY votacao_partido_municipio ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
cur.execute("SELECT id_eleicao, cargo, count(DISTINCT cod_ibge), sum(votos_nominais + votos_legenda) "
            "FROM votacao_partido_municipio GROUP BY 1, 2 ORDER BY 1, 2")
print("  votacao_partido_municipio (ano, cargo, municípios, votos válidos):")
for r in cur.fetchall():
    print(f"    {r[0]} {r[1]:20} {r[2]:>6,} {r[3]:>14,}")

cur.execute("DELETE FROM vies_partido")
arq = os.path.join(SAIDA, "vies_partido.csv")
with open(arq, encoding="utf-8") as f:
    colunas = next(csv.reader(f))
    f.seek(0)
    cur.copy_expert(f"COPY vies_partido ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)

cur.execute("UPDATE partido SET espectro_politico = NULL")
cur.execute("""
UPDATE partido p SET espectro_politico = CASE WHEN v.vies < -10 THEN 'ESQUERDA' WHEN v.vies > 10 THEN 'DIREITA'
                                              ELSE 'CENTRO' END
FROM (SELECT DISTINCT ON (numero_partido) numero_partido, vies
      FROM vies_partido ORDER BY numero_partido, id_eleicao DESC) v
WHERE v.numero_partido = p.numero_partido AND v.vies IS NOT NULL""")
con.commit()

# conferência: todo par (ano, número) com candidatura de 2018 em diante tem linha em vies_partido
cur.execute("""
SELECT c.id_eleicao, c.numero_partido, min(c.sigla_partido)
FROM candidatura c
WHERE c.id_eleicao >= 2018
  AND NOT EXISTS (SELECT 1 FROM vies_partido v WHERE v.id_eleicao = c.id_eleicao AND v.numero_partido = c.numero_partido)
GROUP BY 1, 2 ORDER BY 1, 2""")
faltam = cur.fetchall()
print("  partidos com candidatura e sem linha em vies_partido:", faltam or "nenhum")
cur.execute("""SELECT count(*) FROM vies_partido v JOIN (SELECT DISTINCT id_eleicao, numero_partido, sigla_partido
               FROM candidatura) c USING (id_eleicao, numero_partido) WHERE c.sigla_partido <> v.sigla""")
print("  sigla do CSV diferente da sigla da candidatura:", cur.fetchone()[0])
cur.execute("SELECT id_eleicao, count(*), count(vies) FROM vies_partido GROUP BY 1 ORDER BY 1")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} partidos, {r[2]} com viés")
cur.execute("SELECT espectro_politico, count(*) FROM partido GROUP BY 1 ORDER BY 1")
print("  partido.espectro_politico:", cur.fetchall())
cur.execute("ANALYZE vies_partido"); cur.execute("ANALYZE votacao_partido_municipio")
con.commit()
con.close()
print("PRONTO")
