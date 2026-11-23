# -*- coding: utf-8 -*-
"""
Carga da Q7 (viés político): gera dados\\saida_carga\\vies_partido.csv, o viés de cada partido em cada eleição.

Fonte: survey com especialistas de Bolognesi, Codato, Ribeiro e Silva (Harvard Dataverse, doi:10.7910/DVN/MFIXKW,
df_experts.csv, baixado por python -m coleta). Cada especialista deu a cada partido uma nota de 0 (extrema esquerda)
a 10 (extrema direita), em duas ondas: 2018 e 2022.

  nota do partido = média das notas dos especialistas na onda
  viés do partido = (nota - 5) x 20, de -100 (extrema esquerda) a +100 (extrema direita)

As eleições de 2018 e 2020 usam a onda de 2018; as de 2022 em diante, a de 2022. Qual coluna do survey vale para cada
partido em cada eleição está em banco/referencia/sucessao_partidos.csv: renomeado mantém a nota; fusão feita depois da
onda recebe a média simples das notas dos partidos de origem (PRD = PTB e Patriota); partido sem nota na onda fica sem
viés (vies vazio) e sai da média da Q7. Rodar depois de importar.py; depois, importar_q7.py.
"""
import csv
import os

import pandas as pd

from caminhos import DADOS, RAIZ, SAIDA

experts = pd.read_csv(os.path.join(DADOS, "ideologia_partidos", "df_experts.csv"), sep=";", encoding="utf-8-sig",
                      dtype=str)
experts["onda"] = "20" + experts["id"].str[2:4]
print(f"=== carga_vies | {len(experts):,} especialistas: {experts['onda'].value_counts().sort_index().to_dict()} ===")


def notas(onda, coluna):
    """Notas válidas (0 a 10) que os especialistas da onda deram à coluna (ex.: ideol_22_pt)."""
    s = pd.to_numeric(experts.loc[experts["onda"] == str(onda), f"ideol_{str(onda)[2:]}_{coluna}"].str.replace(",", "."),
                      errors="coerce").dropna()
    assert s.between(0, 10).all(), f"nota fora de 0 a 10 em {coluna} ({onda})"
    return s


suc = pd.read_csv(os.path.join(RAIZ, "banco", "referencia", "sucessao_partidos.csv"), dtype=str, keep_default_na=False)
linhas = []
for r in suc.itertuples():
    colunas = [c for c in r.colunas.split(";") if c]
    if colunas:
        medias = [notas(r.onda, c) for c in colunas]
        nota = sum(m.mean() for m in medias) / len(medias)   # fusão: média simples das notas dos componentes
        especialistas = min(len(m) for m in medias)
        vies = round((nota - 5) * 20, 1)
        nota = round(nota, 2)
    else:
        nota = especialistas = vies = None
    linhas.append({"id_eleicao": int(r.ano), "numero_partido": int(r.numero_partido), "sigla": r.sigla,
                   "onda": int(r.onda), "nota_media": nota, "especialistas": especialistas, "vies": vies,
                   "origem": r.origem})

out = pd.DataFrame(linhas)
assert not out.duplicated(["id_eleicao", "numero_partido"]).any(), "ano + número repetido em sucessao_partidos.csv"
os.makedirs(SAIDA, exist_ok=True)
out.astype({"especialistas": "Int64"}).to_csv(os.path.join(SAIDA, "vies_partido.csv"), index=False,
                                             quoting=csv.QUOTE_MINIMAL)
for ano, g in out.groupby("id_eleicao"):
    sem = g[g["vies"].isna()]["sigla"].tolist()
    print(f"  {ano}: {len(g)} partidos, {g['vies'].notna().sum()} com viés" + (f" | sem viés: {sem}" if sem else ""))
print(out.sort_values(["id_eleicao", "vies"])[["id_eleicao", "sigla", "nota_media", "vies", "origem"]].to_string(index=False))
print("PRONTO")
