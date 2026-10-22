# -*- coding: utf-8 -*-
"""
Carga da Q5 (eleitos por votos de legenda) — gera dois CSVs em saida\\:
  votacao.csv          votos nominais VÁLIDOS de cada candidato por município (deputado federal, deputado estadual, vereador; 1º turno)
  votacao_legenda.csv  votos de legenda VÁLIDOS de cada partido por município e cargo (inclui os votos nominais convertidos em legenda)

Anos: 2018 e 2022 (deputados) e 2020 e 2024 (vereador). Só as eleições proporcionais dos 6 estados do projeto.
Fontes: TSE, votação por candidato e por partido em município e zona (dados\\tse\\votacao_candidato_munzona e votacao_partido_munzona).
Os arquivos de candidatos têm vários GB: a leitura é em blocos e leva alguns minutos.

Conferência embutida: para cada ano, cargo e UF, votos nominais + votos de legenda têm que ser IGUAIS ao total de votos válidos
publicado pelo TSE no detalhe da votação (QT_TOTAL_VOTOS_VALIDOS). É essa soma que forma o quociente eleitoral.
"""
import os

import pandas as pd

PASTA = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.dirname(os.path.dirname(PASTA))
SAIDA = os.path.join(PASTA, "saida")
TSE = os.path.join(DADOS, "tse")
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
CARGOS = {2018: ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"], 2022: ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"],
          2020: ["VEREADOR"], 2024: ["VEREADOR"]}
BLOCO = 400_000

mun = pd.read_csv(os.path.join(SAIDA, "municipio.csv"), dtype=str)
tse_para_ibge = dict(zip(mun["cod_tse"].str.zfill(5), mun["cod_ibge"]))
partidos = set(pd.read_csv(os.path.join(SAIDA, "partido.csv"), dtype=str)["numero_partido"])
cand = pd.read_csv(os.path.join(SAIDA, "candidatura.csv"), dtype=str, usecols=["id_candidatura", "id_eleicao", "cargo"])
cand_ids = set(cand["id_candidatura"])
print(f"=== carga_q5 | {len(mun):,} municípios | {len(cand_ids):,} candidaturas no banco | anos {sorted(CARGOS)} ===")


def arquivo(tipo, ano):
    return os.path.join(TSE, tipo, str(ano), f"{tipo}_{ano}_BRASIL.csv")


def janela_principal(d):
    """Descarta eleições suplementares: fica só o que ocorreu até 28 dias depois da data mais comum (como na Q3)."""
    dt = pd.to_datetime(d["DT_ELEICAO"], format="%d/%m/%Y", errors="coerce")
    modal = dt.value_counts().idxmax()
    return ((dt - modal).dt.days.between(0, 28)).values


def le(tipo, ano, colunas, valor):
    """Lê em blocos só UFs e cargos do projeto, 1º turno, e soma `valor` por (chave)."""
    partes = []
    cargos = [c for c in CARGOS[ano]]
    for b in pd.read_csv(arquivo(tipo, ano), sep=";", encoding="latin1", dtype=str, keep_default_na=False,
                         usecols=lambda c: c in colunas, chunksize=BLOCO):
        b = b[b["SG_UF"].isin(UFS) & b["NR_TURNO"].eq("1") & b["DS_CARGO"].str.upper().isin(cargos)]
        if len(b):
            partes.append(b)
    d = pd.concat(partes)
    faltam = [c for c in colunas if c not in d.columns]
    assert not faltam, f"{tipo} {ano}: colunas ausentes {faltam}"
    d = d[janela_principal(d)].copy()
    d[valor] = pd.to_numeric(d[valor], errors="coerce")
    assert d[valor].notna().all() and (d[valor] >= 0).all(), f"{tipo} {ano}: {valor} inválido"
    d["cargo"] = d["DS_CARGO"].str.upper().str.strip()
    d["cod_ibge"] = d["CD_MUNICIPIO"].str.zfill(5).map(tse_para_ibge)
    assert d["cod_ibge"].notna().all(), f"{tipo} {ano}: município fora da ponte"
    return d


votos, legenda, excluidos = [], [], []
for ano in sorted(CARGOS):
    print(f"\n--- {ano} ---")
    c = le("votacao_candidato_munzona", ano,
           ["SG_UF", "NR_TURNO", "DT_ELEICAO", "CD_MUNICIPIO", "DS_CARGO", "SQ_CANDIDATO", "QT_VOTOS_NOMINAIS_VALIDOS"], "QT_VOTOS_NOMINAIS_VALIDOS")
    vc = c.groupby(["SQ_CANDIDATO", "cod_ibge"], as_index=False)["QT_VOTOS_NOMINAIS_VALIDOS"].sum()
    fora = ~vc["SQ_CANDIDATO"].isin(cand_ids)
    print(f"  candidatos: {c['SQ_CANDIDATO'].nunique():,} | linhas município x candidato: {len(vc):,} | "
          f"candidatos sem registro em candidatura: {vc.loc[fora, 'SQ_CANDIDATO'].nunique()} ({int(vc.loc[fora, 'QT_VOTOS_NOMINAIS_VALIDOS'].sum()):,} votos)")
    vc = vc[~fora].rename(columns={"SQ_CANDIDATO": "id_candidatura", "QT_VOTOS_NOMINAIS_VALIDOS": "votos_nominais"})
    vc["turno"] = 1
    votos.append(vc)

    p = le("votacao_partido_munzona", ano,
           ["SG_UF", "NR_TURNO", "DT_ELEICAO", "CD_MUNICIPIO", "DS_CARGO", "NR_PARTIDO", "QT_TOTAL_VOTOS_LEG_VALIDOS"], "QT_TOTAL_VOTOS_LEG_VALIDOS")
    assert set(p["NR_PARTIDO"]) <= partidos, set(p["NR_PARTIDO"]) - partidos
    lp = p.groupby(["NR_PARTIDO", "cod_ibge", "cargo"], as_index=False)["QT_TOTAL_VOTOS_LEG_VALIDOS"].sum()
    lp = lp.rename(columns={"NR_PARTIDO": "numero_partido", "QT_TOTAL_VOTOS_LEG_VALIDOS": "votos_legenda"})
    lp["id_eleicao"], lp["turno"] = ano, 1
    legenda.append(lp)

    # conferência contra o total válido oficial (detalhe da votação)
    d = le("detalhe_votacao_munzona", ano, ["SG_UF", "NR_TURNO", "DT_ELEICAO", "CD_MUNICIPIO", "DS_CARGO", "QT_TOTAL_VOTOS_VALIDOS"], "QT_TOTAL_VOTOS_VALIDOS")
    oficial = d.groupby(["cargo", "cod_ibge"])["QT_TOTAL_VOTOS_VALIDOS"].sum()
    mun_uf = dict(zip(mun["cod_ibge"], mun["uf"]))
    nominais = c.groupby(["cargo", "cod_ibge"])["QT_VOTOS_NOMINAIS_VALIDOS"].sum()
    legen = p.groupby(["cargo", "cod_ibge"])["QT_TOTAL_VOTOS_LEG_VALIDOS"].sum()
    nosso = nominais.add(legen, fill_value=0)
    cmp_ = pd.concat([oficial.rename("oficial"), nosso.rename("nosso")], axis=1).fillna(0)
    dif = cmp_["oficial"] - cmp_["nosso"]
    print(f"  votos válidos (nominais + legenda) x total oficial do TSE, por município e cargo: {len(cmp_):,} linhas | diferentes: {int((dif != 0).sum())} "
          f"| soma oficial {int(cmp_['oficial'].sum()):,} | nossa {int(cmp_['nosso'].sum()):,}")
    if (dif != 0).any():
        # o TSE não publicou (ou publicou parcialmente) os votos de alguns municípios; sem o total, o quociente não é confiável
        # e o município sai da Q5 por inteiro. Não é esperado em mais que um punhado de municípios.
        ruins = sorted(set(cmp_[dif != 0].index.get_level_values("cod_ibge")))
        nomes = mun[mun["cod_ibge"].isin(ruins)][["cod_ibge", "nome", "uf"]].values.tolist()
        print(f"  EXCLUÍDOS (votos incompletos no TSE): {nomes}")
        assert len(ruins) <= 10, f"{ano}: municípios demais com votos incompletos"
        vc = vc[~vc["cod_ibge"].isin(ruins)]
        votos[-1] = vc
        legenda[-1] = legenda[-1][~legenda[-1]["cod_ibge"].isin(ruins)]
        excluidos.append((ano, nomes))
    for cg in CARGOS[ano]:
        sub = cmp_.loc[cg]
        print(f"   {cg}: {int(sub['oficial'].sum()):,} votos válidos")

vot = pd.concat(votos)
vot["cod_ibge"] = vot["cod_ibge"].astype(int)
vot["id_candidatura"] = vot["id_candidatura"].astype("int64")
vot = vot[["id_candidatura", "cod_ibge", "turno", "votos_nominais"]]
assert not vot.duplicated(["id_candidatura", "cod_ibge", "turno"]).any(), "chave repetida em votacao"
vot.to_csv(os.path.join(SAIDA, "votacao.csv"), index=False, encoding="utf-8")

leg = pd.concat(legenda)
leg["cod_ibge"] = leg["cod_ibge"].astype(int)
leg = leg[["numero_partido", "id_eleicao", "cod_ibge", "turno", "cargo", "votos_legenda"]]
assert not leg.duplicated(["numero_partido", "id_eleicao", "cod_ibge", "turno", "cargo"]).any(), "chave repetida em votacao_legenda"
leg.to_csv(os.path.join(SAIDA, "votacao_legenda.csv"), index=False, encoding="utf-8")
print(f"\n  -> votacao.csv: {len(vot):,} linhas | votacao_legenda.csv: {len(leg):,} linhas")
print("PRONTO. Agora rode importar_q5.py")
