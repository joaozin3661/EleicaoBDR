# -*- coding: utf-8 -*-
"""
Carga da Q3 (índices do município x eleitos e partidos mais vitoriosos) — gera dois CSVs em saida\\:
  indicador_2010.csv        IDHM (1991, 2000 e 2010) e, para 2010, PIB, população do Censo e PIB per capita
  totalizacao_municipio.csv aptos, comparecimento, abstenções, brancos e nulos por município, cargo e turno (2008 e 2012)

Recorte: eleições municipais de 2008 e 2012, as que cercam o único ano com IDHM municipal e Censo (2010).
Fontes: Atlas Brasil (IDHM), IBGE (PIB, tabela 5938; população, Censo 2010, tabela 202) e TSE (detalhe da votação por zona).
Rodar depois de baixa_ibge_2010.py e de ter o detalhe da votação de 2008 e 2012 em dados\\tse\\detalhe_votacao_munzona\\<ano>\\.
"""
import os

import pandas as pd

PASTA = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.dirname(os.path.dirname(PASTA))
SAIDA = os.path.join(PASTA, "saida")
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
ANOS = [2008, 2012]
NULOS = {"", "#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4"}

mun = pd.read_csv(os.path.join(SAIDA, "municipio.csv"), dtype=str)
validos = set(mun["cod_ibge"])
tse_para_ibge = dict(zip(mun["cod_tse"].str.zfill(5), mun["cod_ibge"]))
print(f"=== carga_q3 | {len(validos):,} municípios do projeto | eleições {ANOS} ===")

# ---------------------------------------------------------------- indicadores
idhm = pd.read_csv(os.path.join(DADOS, "ipea_atlas", "idhm_municipios.csv"), sep=";", dtype={"cod_ibge": str, "ano": int})
idhm = idhm[idhm["cod_ibge"].isin(validos)][["cod_ibge", "ano", "idhm"]]
print("IDHM:", idhm.groupby("ano").size().to_dict(), "(municípios por ano)")
assert idhm["idhm"].between(0, 1).all(), "IDHM fora de 0 a 1"


def le_sidra(caminho):
    d = pd.read_csv(caminho, sep=";", dtype=str)
    d = d[d["Município (Código)"].isin(validos)]
    return pd.to_numeric(d.set_index("Município (Código)")["Valor"], errors="coerce")


pib = le_sidra(os.path.join(DADOS, "ibge", "pib", "pib_municipios_2010_tabela5938.csv"))
pop = le_sidra(os.path.join(DADOS, "ibge", "populacao", "censo2010_populacao_tabela202.csv"))
print(f"PIB 2010: {pib.notna().sum():,} municípios | população Censo 2010: {pop.notna().sum():,}")
ind = idhm.copy()
e2010 = ind["ano"] == 2010
ind["pib"] = ind["cod_ibge"].map(pib).where(e2010)
ind["populacao"] = ind["cod_ibge"].map(pop).where(e2010)
ind["pib_per_capita"] = (ind["pib"] * 1000 / ind["populacao"]).round(2)
ind["populacao"] = ind["populacao"].astype("Int64")
sem2010 = sorted(validos - set(ind.loc[e2010, "cod_ibge"]))
print(f"municípios sem IDHM 2010 (criados depois do Censo): {len(sem2010)} -> {mun[mun.cod_ibge.isin(sem2010)].nome.tolist()}")
d10 = ind[e2010]
print(f"2010: PIB per capita mediano R$ {d10['pib_per_capita'].median():,.0f} | IDHM mediano {d10['idhm'].median():.3f} | "
      f"sem PIB: {int(d10['pib'].isna().sum())} | sem população: {int(d10['populacao'].isna().sum())}")
assert (d10["pib_per_capita"].dropna() > 0).all()
ind.to_csv(os.path.join(SAIDA, "indicador_2010.csv"), index=False, encoding="utf-8")
print(f"  -> indicador_2010.csv: {len(ind):,} linhas")

# ---------------------------------------------------------------- totalização por município
COLS = ["ANO_ELEICAO", "NR_TURNO", "DT_ELEICAO", "SG_UF", "CD_MUNICIPIO", "DS_CARGO", "QT_APTOS", "QT_COMPARECIMENTO", "QT_ABSTENCOES",
        "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"]
saidas = []
for ano in ANOS:
    arq = os.path.join(DADOS, "tse", "detalhe_votacao_munzona", str(ano), f"detalhe_votacao_munzona_{ano}_BRASIL.csv")
    d = pd.read_csv(arq, sep=";", encoding="latin1", dtype=str, keep_default_na=False, usecols=lambda c: c in COLS)
    faltam = [c for c in COLS if c not in d.columns]
    assert not faltam, f"{ano}: colunas ausentes {faltam}"
    d = d[d["SG_UF"].isin(UFS)].copy()
    # eleições suplementares: fica só o que ocorreu até 28 dias depois da data mais comum (preserva o 2º turno)
    dt = pd.to_datetime(d["DT_ELEICAO"], format="%d/%m/%Y", errors="coerce")
    modal = dt.value_counts().idxmax()
    fora = ~((dt - modal).dt.days.between(0, 28))
    print(f"\n{ano}: {len(d):,} linhas nas 6 UFs | eleições suplementares descartadas: {int(fora.sum()):,} | data da 1ª votação: {modal:%d/%m/%Y}")
    d = d[~fora]
    for c in ["QT_APTOS", "QT_COMPARECIMENTO", "QT_ABSTENCOES", "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS"]:
        d[c] = pd.to_numeric(d[c], errors="coerce")
        assert d[c].notna().all() and (d[c] >= 0).all(), f"{ano}: {c} inválido"
    d["cargo"] = d["DS_CARGO"].str.upper().str.strip()
    assert set(d["cargo"]) <= {"PREFEITO", "VEREADOR"}, set(d["cargo"])
    d["cod_ibge"] = d["CD_MUNICIPIO"].str.zfill(5).map(tse_para_ibge)
    assert d["cod_ibge"].notna().all(), f"{ano}: município fora da ponte"
    g = d.groupby(["cod_ibge", "NR_TURNO", "cargo"], as_index=False).agg(
        eleitores_aptos=("QT_APTOS", "sum"), comparecimento=("QT_COMPARECIMENTO", "sum"), abstencoes=("QT_ABSTENCOES", "sum"),
        votos_brancos=("QT_VOTOS_BRANCOS", "sum"), votos_nulos=("QT_TOTAL_VOTOS_NULOS", "sum"))
    ruim = g[g["eleitores_aptos"] != g["comparecimento"] + g["abstencoes"]]
    print(f"   {len(g):,} linhas município x cargo x turno | aptos != comparecimento + abstenções em {len(ruim)} linhas")
    if len(ruim):
        print(ruim.head(5).to_string(index=False))
    g["id_eleicao"] = ano
    g["turno"] = g["NR_TURNO"].astype(int)
    saidas.append(g)
tot = pd.concat(saidas)
tot["cod_ibge"] = tot["cod_ibge"].astype(int)
dif = (tot["eleitores_aptos"] - tot["comparecimento"] - tot["abstencoes"]).abs()
if (dif > 0).any():
    # o TSE publica algumas linhas com 1 ou 2 eleitores de diferença; o dado fica como veio e o modelo tolera até 10
    print(f"\nAVISO: {int((dif > 0).sum())} linhas com aptos != comparecimento + abstenções (diferença máxima {int(dif.max())} eleitores); mantidas como no TSE")
    assert dif.max() <= 10, "diferença maior que a tolerância do modelo"
tot = tot[["cod_ibge", "id_eleicao", "turno", "cargo", "eleitores_aptos", "comparecimento", "abstencoes", "votos_brancos", "votos_nulos"]]
assert not tot.duplicated(["cod_ibge", "id_eleicao", "turno", "cargo"]).any(), "chave repetida"
tot.to_csv(os.path.join(SAIDA, "totalizacao_municipio.csv"), index=False, encoding="utf-8")
print(f"\n  -> totalizacao_municipio.csv: {len(tot):,} linhas")
p1 = tot[(tot.cargo == "PREFEITO") & (tot.turno == 1)]
for ano, x in p1.groupby("id_eleicao"):
    iso = x.abstencoes.sum() + x.votos_brancos.sum() + x.votos_nulos.sum()
    print(f"   {ano}: {x.cod_ibge.nunique():,} municípios (prefeito, 1º turno) | {x.eleitores_aptos.sum():,} aptos | isentos {100 * iso / x.eleitores_aptos.sum():.1f}% "
          f"(abstenção {100 * x.abstencoes.sum() / x.eleitores_aptos.sum():.1f}%, brancos {100 * x.votos_brancos.sum() / x.eleitores_aptos.sum():.1f}%, nulos {100 * x.votos_nulos.sum() / x.eleitores_aptos.sum():.1f}%)")
print("\nPRONTO. Agora rode importar_q3.py")
