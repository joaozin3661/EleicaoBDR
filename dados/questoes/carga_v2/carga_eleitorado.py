# -*- coding: utf-8 -*-
"""
Carga do perfil do eleitorado (Q4; serve também às Q3 e Q6) — gera saida\\eleitorado.csv.

Lê perfil_comparecimento_abstencao_AAAA_BRASIL.csv (até 2,4 GB por ano), em pedaços, e soma os eleitores aptos
(QT_APTOS) por município, faixa etária e grau de escolaridade. O arquivo vem aberto por zona, gênero, estado civil, cor e
outras dimensões que o modelo não usa; somar tudo isso dá a mesma população apta.

Só o 1º turno: o perfil dos aptos é o mesmo nos dois turnos, e o arquivo de 2022 repete o 1º turno como "2º turno"
(carregar os dois contaria cada eleitor em dobro).
O código do município no TSE (CD_MUNICIPIO) é convertido para o do IBGE pela tabela municipio.

Rodar depois do carga_v2.py e antes do importar_eleitorado.py. Leva alguns minutos.
"""
import os

import pandas as pd

PASTA = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(PASTA, "saida")
ARQ = os.path.join(os.path.dirname(os.path.dirname(PASTA)), "tse", "comparecimento_abstencao", "{ano}",
                   "perfil_comparecimento_abstencao_{ano}_BRASIL.csv")
ANOS = [2018, 2020, 2022, 2024]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
CHUNK = 500_000
COLUNAS = ["NR_TURNO", "SG_UF", "CD_MUNICIPIO", "DS_FAIXA_ETARIA", "DS_GRAU_ESCOLARIDADE", "QT_APTOS"]
print("=== carga_eleitorado | anos:", ANOS, "===")

mun = pd.read_csv(os.path.join(SAIDA, "municipio.csv"), dtype=str)
tse_para_ibge = dict(zip(mun["cod_tse"].str.zfill(5), mun["cod_ibge"]))

saida = os.path.join(SAIDA, "eleitorado.csv")
if os.path.exists(saida):
    os.remove(saida)
primeiro = True
for ano in ANOS:
    arq = ARQ.format(ano=ano)
    partes, lidas = [], 0
    for ch in pd.read_csv(arq, sep=";", encoding="latin1", dtype=str, keep_default_na=False,
                          usecols=lambda c: c in COLUNAS, chunksize=CHUNK):
        faltam = [c for c in COLUNAS if c not in ch.columns]
        assert not faltam, f"{ano}: colunas ausentes {faltam}"
        lidas += len(ch)
        ch = ch[ch["SG_UF"].isin(UFS) & (ch["NR_TURNO"] == "1")].copy()
        ch["qtd"] = pd.to_numeric(ch["QT_APTOS"], errors="coerce")
        partes.append(ch.groupby(["CD_MUNICIPIO", "DS_FAIXA_ETARIA", "DS_GRAU_ESCOLARIDADE"], as_index=False)["qtd"].sum())
    g = pd.concat(partes).groupby(["CD_MUNICIPIO", "DS_FAIXA_ETARIA", "DS_GRAU_ESCOLARIDADE"], as_index=False)["qtd"].sum()
    g["cod_ibge"] = g["CD_MUNICIPIO"].str.zfill(5).map(tse_para_ibge)
    sem = g["cod_ibge"].isna()
    assert not sem.any(), f"{ano}: {sem.sum()} linhas com município fora da ponte (ex.: {g.loc[sem, 'CD_MUNICIPIO'].unique()[:5]})"
    assert g["qtd"].notna().all() and (g["qtd"] >= 0).all(), f"{ano}: quantidade inválida"
    out = pd.DataFrame({
        "cod_ibge": g["cod_ibge"].astype(int), "id_eleicao": ano, "turno": 1,
        "faixa_etaria": g["DS_FAIXA_ETARIA"].str.strip(), "grau_instrucao": g["DS_GRAU_ESCOLARIDADE"].str.strip(),
        "qtd_eleitores": g["qtd"].astype("int64"),
    })
    assert not out.duplicated(["cod_ibge", "id_eleicao", "turno", "faixa_etaria", "grau_instrucao"]).any(), f"{ano}: chave repetida"
    out.to_csv(saida, mode="a", header=primeiro, index=False, encoding="utf-8")
    primeiro = False
    nao_inf = out.loc[out["grau_instrucao"] == "NÃO INFORMADO", "qtd_eleitores"].sum()
    sup = out.loc[out["grau_instrucao"] == "SUPERIOR COMPLETO", "qtd_eleitores"].sum()
    print(f"  {ano}: {lidas:,} linhas lidas -> {len(out):,} agregadas | {out['cod_ibge'].nunique():,} municípios | "
          f"{out['qtd_eleitores'].sum():,} aptos | superior completo {100 * sup / out['qtd_eleitores'].sum():.1f}% | não informado {100 * nao_inf / out['qtd_eleitores'].sum():.2f}%")
print("\nPRONTO. Agora rode importar_eleitorado.py")
