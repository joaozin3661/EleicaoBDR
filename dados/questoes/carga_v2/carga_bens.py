# -*- coding: utf-8 -*-
"""
Carga dos bens declarados (Q2) — gera saida\\bem_declarado.csv.

Lê os arquivos bem_candidato_AAAA_BRASIL.csv de 2018 a 2024 (pasta do crawler), fica com as 6 UFs e
com os bens das candidaturas que já estão no banco (saida\\candidatura.csv). Os bens que não se ligam
são de eleições suplementares, que a carga principal descarta.

Rodar depois do carga_v2.py e antes do importar_bens.py.
"""
import os

import pandas as pd

# ----------------------------------------------------------------------
# CONFIGURAÇÃO
# ----------------------------------------------------------------------
PASTA = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(PASTA, "saida")
BENS = os.path.join(os.path.dirname(os.path.dirname(PASTA)), "tse", "bens_candidatos")  # dados\tse\bens_candidatos
ANOS = [2018, 2020, 2022, 2024]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
NULOS = {"", "#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4"}
print("=== carga_bens | anos:", ANOS, "===")


def limpa(s):
    s = s.str.strip()
    return s.where(~s.isin(NULOS), "")


def para_valor(s):
    return pd.to_numeric(s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False), errors="coerce")


cand = pd.read_csv(os.path.join(SAIDA, "candidatura.csv"), dtype=str, keep_default_na=False,
                   usecols=["id_candidatura", "id_eleicao"])
validos = set(cand.loc[cand.id_eleicao.astype(int) >= 2018, "id_candidatura"])

partes = []
for ano in ANOS:
    b = pd.read_csv(os.path.join(BENS, str(ano), f"bem_candidato_{ano}_BRASIL.csv"), sep=";", encoding="latin1",
                    dtype=str, keep_default_na=False)
    b = b[b["SG_UF"].isin(UFS)]
    liga = b["SQ_CANDIDATO"].isin(validos)
    print(f"  {ano}: {len(b):,} bens nas 6 UFs | {liga.sum():,} ligados | {(~liga).sum():,} descartados "
          f"(eleições suplementares: {b.loc[~liga, 'DS_ELEICAO'].nunique()} pleitos)")
    b = b[liga].copy()
    # NR_ORDEM_BEM_CANDIDATO só é único dentro da candidatura: o id vira ano * 1e9 + sequência
    b = b.sort_values(["SQ_CANDIDATO", "NR_ORDEM_BEM_CANDIDATO"], key=lambda s: pd.to_numeric(s, errors="coerce"))
    partes.append(pd.DataFrame({
        "id_bem": ano * 1_000_000_000 + pd.RangeIndex(1, len(b) + 1),
        "id_candidatura": b["SQ_CANDIDATO"].astype("int64").values,
        "tipo_bem": limpa(b["DS_TIPO_BEM_CANDIDATO"]).values,
        "descricao": limpa(b["DS_BEM_CANDIDATO"]).values,
        "valor": para_valor(b["VR_BEM_CANDIDATO"]).values,
    }))

bem = pd.concat(partes, ignore_index=True)
assert bem["id_bem"].is_unique, "id_bem repetido"
assert bem["valor"].notna().all(), "valor de bem vazio"
assert (bem["valor"] >= 0).all(), "valor de bem negativo"
bem.to_csv(os.path.join(SAIDA, "bem_declarado.csv"), index=False, encoding="utf-8")
print(f"  -> bem_declarado.csv: {len(bem):,} linhas | R$ {bem['valor'].sum()/1e9:.2f} bi declarados")

# conferência: patrimônio por candidatura (soma dos bens) e os casos extremos
pat = bem.groupby("id_candidatura")["valor"].sum()
print(f"  candidaturas com algum bem: {len(pat):,} | maior tipo_bem: {bem['tipo_bem'].str.len().max()} caracteres")
print("  maiores patrimônios declarados (provável erro de digitação na origem acima de R$ 500 mi):")
for idc, v in pat.nlargest(6).items():
    print(f"    candidatura {idc}: R$ {v/1e6:,.1f} mi")
print("\nPRONTO. Agora rode importar_bens.py")
