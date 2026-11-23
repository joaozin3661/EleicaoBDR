# -*- coding: utf-8 -*-
"""
Carga da Q7 (viés político): gera dados\\saida_carga\\votacao_partido_municipio.csv, os votos válidos de cada partido
por eleição, cargo, município e turno, nas eleições ordinárias de 2018 em diante: o 1º turno de TODOS os cargos e o
2º turno de presidente, governador e prefeito (só onde houve; as views do 1º turno filtram turno = 1).

Fonte: TSE, votação por partido em município e zona (dados\\tse\\votacao_partido_munzona\\<ano>\\..._BRASIL.csv).
  votos_nominais = QT_VOTOS_NOMINAIS_VALIDOS    votos dados aos candidatos do partido
  votos_legenda  = QT_TOTAL_VOTOS_LEG_VALIDOS   votos de legenda (inclui os nominais convertidos em legenda)

Diferente da Q5 (carga_q5.py), aqui nenhum município é excluído quando a soma não bate com o total oficial do detalhe
da votação: a Q5 precisa da conta exata para o quociente eleitoral, a Q7 só do peso de cada partido. As diferenças são
impressas abaixo para registro; só sai um cargo inteiro de um estado quando o TSE não publicou o resultado dele
(menos da metade dos votos válidos oficiais, caso dos deputados do AP em 2026). O voto do exterior (presidente, UF ZZ) fica fora: não tem município.
Rodar com as mesmas UFs da carga principal (CARGA_UFS=TODAS no banco de 27 UFs), depois de importar.py; depois,
importar_q7.py.
"""
import os

import pandas as pd

from caminhos import DESC_UFS, SAIDA, TSE, UFS

ANOS = [2018, 2020, 2022, 2024, 2026]
BLOCO = 400_000
# cargos com partido; o arquivo traz também o Conselheiro Distrital de Fernando de Noronha (chapas, não partidos)
CARGOS = ["PRESIDENTE", "GOVERNADOR", "SENADOR", "DEPUTADO FEDERAL", "DEPUTADO ESTADUAL", "DEPUTADO DISTRITAL",
          "PREFEITO", "VEREADOR"]
CARGOS_2T = ["PRESIDENTE", "GOVERNADOR", "PREFEITO"]  # os únicos com 2º turno
COLUNAS = ["SG_UF", "NR_TURNO", "DT_ELEICAO", "CD_MUNICIPIO", "DS_CARGO", "NR_PARTIDO", "QT_VOTOS_NOMINAIS_VALIDOS",
           "QT_TOTAL_VOTOS_LEG_VALIDOS"]

mun = pd.read_csv(os.path.join(SAIDA, "municipio.csv"), dtype=str)
tse_para_ibge = dict(zip(mun["cod_tse"].str.zfill(5), mun["cod_ibge"]))
partidos = set(pd.read_csv(os.path.join(SAIDA, "partido.csv"), dtype=str)["numero_partido"])
print(f"=== carga_votos_q7 | {DESC_UFS} | {len(mun):,} municípios | anos {ANOS} ===")


def arquivo(tipo, ano):
    return os.path.join(TSE, tipo, str(ano), f"{tipo}_{ano}_BRASIL.csv")


def janela_principal(d):
    """Descarta eleições suplementares: fica só o que ocorreu até 28 dias depois da data mais comum (como na Q3 e Q5)."""
    dt = pd.to_datetime(d["DT_ELEICAO"], format="%d/%m/%Y", errors="coerce")
    modal = dt.value_counts().idxmax()
    return ((dt - modal).dt.days.between(0, 28)).values


def le(tipo, ano, colunas):
    partes = []
    for b in pd.read_csv(arquivo(tipo, ano), sep=";", encoding="latin1", dtype=str, keep_default_na=False,
                         usecols=lambda c: c in colunas, chunksize=BLOCO):
        c = b["DS_CARGO"].str.upper().str.strip()
        b = b[b["SG_UF"].isin(UFS) & c.isin(CARGOS) & (b["NR_TURNO"].eq("1") | (b["NR_TURNO"].eq("2") & c.isin(CARGOS_2T)))]
        if len(b):
            partes.append(b)
    d = pd.concat(partes)
    faltam = [c for c in colunas if c not in d.columns]
    assert not faltam, f"{tipo} {ano}: colunas ausentes {faltam}"
    d = d[janela_principal(d)].copy()  # o 2º turno cai dentro da janela (14 a 28 dias depois do 1º)
    d["turno"] = d["NR_TURNO"].astype(int)
    d["cargo"] = d["DS_CARGO"].str.upper().str.strip()
    d["cod_ibge"] = d["CD_MUNICIPIO"].str.zfill(5).map(tse_para_ibge)
    assert d["cod_ibge"].notna().all(), f"{tipo} {ano}: município fora da ponte"
    return d


saida = []
for ano in ANOS:
    print(f"\n--- {ano} ---")
    p = le("votacao_partido_munzona", ano, COLUNAS)
    for c in ("QT_VOTOS_NOMINAIS_VALIDOS", "QT_TOTAL_VOTOS_LEG_VALIDOS"):
        p[c] = pd.to_numeric(p[c], errors="coerce")
        assert p[c].notna().all() and (p[c] >= 0).all(), f"{ano}: {c} inválido"
    assert set(p["NR_PARTIDO"]) <= partidos, set(p["NR_PARTIDO"]) - partidos
    g = (p.groupby(["turno", "cargo", "cod_ibge", "NR_PARTIDO"], as_index=False)[["QT_VOTOS_NOMINAIS_VALIDOS", "QT_TOTAL_VOTOS_LEG_VALIDOS"]]
          .sum().rename(columns={"NR_PARTIDO": "numero_partido", "QT_VOTOS_NOMINAIS_VALIDOS": "votos_nominais",
                                 "QT_TOTAL_VOTOS_LEG_VALIDOS": "votos_legenda"}))
    g = g[(g["votos_nominais"] + g["votos_legenda"]) > 0]
    g["id_eleicao"] = ano

    # registro: soma por cargo x total válido oficial do detalhe da votação (não exclui nada)
    d = le("detalhe_votacao_munzona", ano, ["SG_UF", "NR_TURNO", "DT_ELEICAO", "CD_MUNICIPIO", "DS_CARGO",
                                             "QT_TOTAL_VOTOS_VALIDOS"])
    d["QT_TOTAL_VOTOS_VALIDOS"] = pd.to_numeric(d["QT_TOTAL_VOTOS_VALIDOS"], errors="coerce")
    oficial = d.groupby(["turno", "cargo", "cod_ibge"])["QT_TOTAL_VOTOS_VALIDOS"].sum()
    nosso = g.assign(t=g["votos_nominais"] + g["votos_legenda"]).groupby(["turno", "cargo", "cod_ibge"])["t"].sum()
    cmp_ = pd.concat([oficial.rename("oficial"), nosso.rename("nosso")], axis=1).fillna(0)
    for (turno, cargo), s in cmp_.groupby(level=["turno", "cargo"]):
        dif = s["nosso"] - s["oficial"]
        print(f"  {turno}º {cargo:20} {s['nosso'].sum():>13,.0f} votos | {s.index.get_level_values('cod_ibge').nunique():,} municípios | "
              f"oficial {s['oficial'].sum():,.0f} | municípios diferentes: {int((dif != 0).sum())} ({dif.sum():+,.0f})")

    # Cargo sem resultado publicado num estado (deputados do AP em 2026: o TSE traz só parte dos votos de legenda e
    # nenhum voto nominal). Com menos da metade dos votos válidos oficiais o peso dos partidos sai errado, então esse
    # cargo fica fora da Q7 naquele estado; os outros cargos do estado continuam.
    uf_de = dict(zip(mun["cod_ibge"], mun["uf"]))
    por_uf = cmp_.groupby([cmp_.index.get_level_values("turno"), cmp_.index.get_level_values("cargo"),
                           cmp_.index.get_level_values("cod_ibge").map(uf_de).rename("uf")]).sum()
    incompletos = set(por_uf[por_uf["nosso"] < 0.5 * por_uf["oficial"]].index)
    if incompletos:
        print(f"  FORA (resultado incompleto no TSE): {sorted(incompletos)}")
        g = g[[k not in incompletos for k in zip(g["turno"], g["cargo"], g["cod_ibge"].map(uf_de))]]
    saida.append(g)

out = pd.concat(saida)
out["cod_ibge"] = out["cod_ibge"].astype(int)
out = out[["id_eleicao", "cargo", "cod_ibge", "numero_partido", "turno", "votos_nominais", "votos_legenda"]]
assert not out.duplicated(["id_eleicao", "cargo", "cod_ibge", "numero_partido", "turno"]).any(), "chave repetida"
out.to_csv(os.path.join(SAIDA, "votacao_partido_municipio.csv"), index=False, encoding="utf-8")
print(f"\n  -> votacao_partido_municipio.csv: {len(out):,} linhas")
print("PRONTO. Agora rode importar_q7.py")
