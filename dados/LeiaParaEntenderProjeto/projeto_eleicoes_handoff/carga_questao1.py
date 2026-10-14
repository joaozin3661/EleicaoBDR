# -*- coding: utf-8 -*-
"""
Carga Questão 1 — Banco de Dados das Eleições (6 estados: AL, PA, PB, PR, SC, SE)

Lê os CSVs do TSE, limpa, converte para o modelo e grava CSVs prontos para
COPY no PostgreSQL, na pasta "saida_carga".

Uso:
    python carga_questao1.py            -> roda ANOS (padrão: 2018 e 2022)
    Segunda carga:  python carga_questao1.py 2020 2024  (usa a ponte município TSE→IBGE)
    Linhas de municipio/partido/pessoa já gravadas em cargas anteriores são puladas.

Gera: municipio, eleicao, partido, pessoa, candidatura, vaga, despesa (.csv)
"""
import os, sys
import pandas as pd

# ----------------------------------------------------------------------
# CONFIGURAÇÃO — ajuste o caminho
# ----------------------------------------------------------------------
BASE = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1"
ANOS = [2018, 2022]                 # ou passe na linha de comando: python carga_questao1.py 2020 2024
if len(sys.argv) > 1:
    ANOS = [int(a) for a in sys.argv[1:]]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
MUNICIPAIS = {2020, 2024}           # nesses anos SG_UE = código TSE do município
SAIDA = os.path.join(BASE, "saida_carga_" + "_".join(map(str, ANOS)))  # uma pasta por carga
CHUNK = 200_000                     # linhas por pedaço nas despesas (arquivos grandes)
os.makedirs(SAIDA, exist_ok=True)

REGIAO = {"1": "Norte", "2": "Nordeste", "3": "Sudeste", "4": "Sul", "5": "Centro-Oeste"}


# ----------------------------------------------------------------------
# Funções auxiliares
# ----------------------------------------------------------------------
def ler(path, **kw):
    """Padrão TSE: Latin-1, ';', tudo texto."""
    return pd.read_csv(path, sep=";", encoding="latin1", dtype=str,
                       keep_default_na=False, **kw)


def pick(df, *nomes):
    """Devolve o primeiro nome de coluna que existir no DataFrame."""
    for n in nomes:
        if n in df.columns:
            return n
    sys.exit(f"ERRO: nenhuma destas colunas existe: {nomes}\nColunas: {list(df.columns)}")


def limpa(s):
    """Converte marcadores de nulo do TSE em vazio."""
    s = s.str.strip()
    return s.where(~s.isin(["#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4"]), "")


def para_data(s):
    return pd.to_datetime(s, format="%d/%m/%Y", errors="coerce").dt.strftime("%Y-%m-%d")


def para_valor(s):
    return pd.to_numeric(s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
                         errors="coerce")


def ja_carregado(nome, coluna):
    """Valores da coluna `coluna` já gravados em OUTRAS pastas saida_carga_* (cargas anteriores)."""
    achados = set()
    for pasta in os.listdir(BASE):
        cam = os.path.join(BASE, pasta, nome + ".csv")
        if pasta.startswith("saida_carga_") and os.path.join(BASE, pasta) != SAIDA and os.path.exists(cam):
            achados |= set(pd.read_csv(cam, dtype=str, keep_default_na=False, usecols=[coluna])[coluna])
    return achados


def grava_novos(df, nome, coluna):
    """Grava só as linhas cuja chave ainda não está em cargas anteriores (evita conflito de PK)."""
    antes = len(df)
    df = df[~df[coluna].astype(str).isin(ja_carregado(nome, coluna))]
    print(f"  ({nome}: {antes - len(df):,} linhas já carregadas antes foram puladas)")
    grava(df, nome)


def grava(df, nome, **kw):
    path = os.path.join(SAIDA, f"{nome}.csv")
    df.to_csv(path, index=False, encoding="utf-8", **kw)
    print(f"  -> {nome}.csv: {len(df):,} linhas")


# ----------------------------------------------------------------------
# 1) MUNICIPIO (ponte TSE <-> IBGE)
# ----------------------------------------------------------------------
print("1) MUNICIPIO")
ponte = ler(os.path.join(BASE, "municipio_tse_ibge", "municipio_tse_ibge.csv"))
ponte = ponte[ponte["SG_UF"].isin(UFS)].copy()
municipio = pd.DataFrame({
    "cod_ibge": ponte["CD_MUNICIPIO_IBGE"].astype(int),
    "cod_tse": ponte["CD_MUNICIPIO_TSE"].str.zfill(5),
    "nome": ponte["NM_MUNICIPIO_IBGE"],
    "uf": ponte["SG_UF"],
    "regiao": ponte["CD_UF_IBGE"].str[0].map(REGIAO),
})
assert len(municipio) == 1238, f"esperava 1238 municípios, veio {len(municipio)}"
grava_novos(municipio, "municipio", "cod_ibge")
tse_para_ibge = dict(zip(municipio["cod_tse"], municipio["cod_ibge"]))

# ----------------------------------------------------------------------
# 2) CANDIDATURA / PESSOA / PARTIDO / ELEICAO
# ----------------------------------------------------------------------
print("2) consulta_cand")
cand_frames = []
for ano in ANOS:
    for uf in UFS:
        f = os.path.join(BASE, f"consulta_cand_{ano}", f"consulta_cand_{ano}_{uf}.csv")
        d = ler(f)
        d["_ano"] = ano
        cand_frames.append(d)
raw = pd.concat(cand_frames, ignore_index=True)
print("  colunas:", len(raw.columns), "| linhas:", f"{len(raw):,}")

# Anos municipais: o arquivo do ano também traz ELEIÇÕES SUPLEMENTARES (realizadas depois, com
# DS_ELEICAO próprio). Mantém só a eleição ordinária = DS_ELEICAO mais frequente do ano.
# Atenção: o 2º TURNO tem CD_ELEICAO diferente mas o MESMO DS_ELEICAO ("Eleições Municipais AAAA"),
# por isso o filtro é por DS_ELEICAO (e não por CD_ELEICAO), para não perder o resultado final.
if "DS_ELEICAO" in raw.columns:
    ordinaria = (raw[raw["_ano"].isin(MUNICIPAIS)].groupby("_ano")["DS_ELEICAO"]
                 .agg(lambda x: x.value_counts().idxmax()).to_dict())
    fora = raw["_ano"].isin(MUNICIPAIS) & (raw["DS_ELEICAO"] != raw["_ano"].map(ordinaria))
    if fora.any():
        print(f"  eleições suplementares descartadas: {fora.sum():,} candidaturas")
        print(raw.loc[fora].groupby(["_ano", "DS_ELEICAO"]).size().to_string())
    raw = raw[~fora].copy()
    print("  eleição ordinária por ano:", ordinaria)

c_sq = pick(raw, "SQ_CANDIDATO")
c_cpf = pick(raw, "NR_CPF_CANDIDATO")
c_tit = pick(raw, "NR_TITULO_ELEITORAL_CANDIDATO")
c_nome = pick(raw, "NM_CANDIDATO")
c_nasc = pick(raw, "DT_NASCIMENTO")
c_sexo = pick(raw, "DS_GENERO", "DS_SEXO")
c_raca = pick(raw, "DS_COR_RACA")
c_part_n = pick(raw, "NR_PARTIDO")
c_part_s = pick(raw, "SG_PARTIDO")
c_part_nm = pick(raw, "NM_PARTIDO")
c_cargo = pick(raw, "DS_CARGO")
c_grau = pick(raw, "DS_GRAU_INSTRUCAO")
c_ocup = pick(raw, "DS_OCUPACAO")
c_sit = pick(raw, "DS_SIT_TOT_TURNO")
c_turno = pick(raw, "NR_TURNO")
c_ue = pick(raw, "SG_UE")
c_uf = pick(raw, "SG_UF")

# um registro por candidato: fica a linha do ÚLTIMO turno
raw["_t"] = pd.to_numeric(raw[c_turno], errors="coerce").fillna(1)
raw = raw.sort_values(["_ano", c_sq, "_t"]).drop_duplicates(c_sq, keep="last")
assert raw[c_sq].is_unique, "SQ_CANDIDATO repetido entre anos — use chave composta!"

# Identificador da pessoa = título de eleitor (12 dígitos, com zeros à esquerda).
# O CPF é opcional: o TSE o oculta em 2024 (-4).
titulo = limpa(raw[c_tit]).str.replace(r"\D", "", regex=True)
ruim = (titulo.str.len() < 5) | (titulo.str.strip("0") == "")
print(f"  títulos ausentes/inválidos: {ruim.sum():,} de {len(titulo):,}")
if ruim.any():
    print("  exemplos (ano, UF, cargo, título bruto):")
    print(raw.loc[ruim, ["_ano", c_uf, c_cargo, c_tit]].head(8).to_string(index=False))
    print("  por ano/cargo:")
    print(raw.loc[ruim].groupby(["_ano", c_cargo]).size().to_string())
titulo = titulo.str.zfill(12)
# plano B: sem título válido, usa 'S' + SQ_CANDIDATO (não liga a pessoa entre anos)
titulo = titulo.where(~ruim, "S" + raw[c_sq])
cpf = limpa(raw[c_cpf]).str.replace(r"\D", "", regex=True)
cpf = cpf.where(cpf.str.len() == 11, "")
print(f"  CPF disponível em {(cpf != '').mean():.1%} das candidaturas")

cod_ibge = (raw[c_ue].str.zfill(5).map(tse_para_ibge)
            if set(ANOS) & MUNICIPAIS else pd.Series([pd.NA] * len(raw), index=raw.index))
# em anos gerais SG_UE = UF -> cod_ibge fica nulo
cod_ibge = cod_ibge.where(raw["_ano"].isin(MUNICIPAIS), pd.NA)

candidatura = pd.DataFrame({
    "id_candidatura": raw[c_sq].astype("int64"),
    "titulo_eleitor": titulo,
    "id_eleicao": raw["_ano"],
    "numero_partido": raw[c_part_n].astype(int),
    "cod_ibge": cod_ibge.astype("Int64"),
    "sg_uf": raw[c_uf],
    "cargo": raw[c_cargo],
    "abrangencia": raw["_ano"].map(lambda a: "MUNICIPAL" if a in MUNICIPAIS else "ESTADUAL"),
    "grau_instrucao": limpa(raw[c_grau]),
    "ocupacao": limpa(raw[c_ocup]),
    "situacao_resultado": limpa(raw[c_sit]),
    "total_votos": pd.NA,           # virá do arquivo de votação, se for usado
})
sem_mun = candidatura["cod_ibge"].isna() & candidatura["id_eleicao"].isin(MUNICIPAIS)
assert not sem_mun.any(), f"{sem_mun.sum()} candidaturas municipais sem cod_ibge (SG_UE fora da ponte)"
grava(candidatura, "candidatura")

pessoa = pd.DataFrame({
    "titulo_eleitor": titulo,
    "cpf": cpf,
    "nome": raw[c_nome],
    "data_nascimento": para_data(raw[c_nasc]),
    "sexo": limpa(raw[c_sexo]),
    "raca_cor": limpa(raw[c_raca]),
}).sort_values("cpf").drop_duplicates("titulo_eleitor", keep="last")
grava_novos(pessoa, "pessoa", "titulo_eleitor")

partido = pd.DataFrame({
    "numero_partido": raw[c_part_n].astype(int),
    "sigla": raw[c_part_s],
    "nome": raw[c_part_nm],
    "espectro_politico": "",        # vem do Estudo Harvard, carregar depois
}).drop_duplicates("numero_partido", keep="last")
grava_novos(partido, "partido", "numero_partido")

eleicao = pd.DataFrame({"id_eleicao": ANOS,
                        "ano": ANOS,
                        "tipo_eleicao": ["MUNICIPAL" if a in MUNICIPAIS else "GERAL" for a in ANOS]})
grava(eleicao, "eleicao")

# ----------------------------------------------------------------------
# 3) VAGA  (arquivo _BRASIL, filtra os 6 estados)
# ----------------------------------------------------------------------
print("3) vagas")
vagas = []
for ano in ANOS:
    f = os.path.join(BASE, "vagas", str(ano), f"consulta_vagas_{ano}_BRASIL.csv")
    d = ler(f)
    d["_ano"] = ano
    vagas.append(d)
v = pd.concat(vagas, ignore_index=True)
v = v[v[pick(v, "SG_UF")].isin(UFS)].copy()
if "CD_ELEICAO" in v.columns:
    ord_v = (v[v["_ano"].isin(MUNICIPAIS)].groupby("_ano")["CD_ELEICAO"]
             .agg(lambda x: x.value_counts().idxmax()).to_dict())
    fora_v = v["_ano"].isin(MUNICIPAIS) & (v["CD_ELEICAO"] != v["_ano"].map(ord_v))
    if fora_v.any():
        print(f"  vagas de eleições suplementares descartadas: {fora_v.sum():,}")
    v = v[~fora_v].copy()
v_qt = pick(v, "QT_VAGAS", "QT_VAGA")
v_cargo = pick(v, "DS_CARGO")
v_ue = pick(v, "SG_UE")
v_uf = pick(v, "SG_UF")
v["_cod_ibge"] = (v[v_ue].str.zfill(5).map(tse_para_ibge)
                  if set(ANOS) & MUNICIPAIS else pd.NA)
v.loc[~v["_ano"].isin(MUNICIPAIS), "_cod_ibge"] = pd.NA
vaga = pd.DataFrame({
    "id_eleicao": v["_ano"],
    "cod_ibge": v["_cod_ibge"].astype("Int64"),
    "sg_uf": v[v_uf],
    "cargo": v[v_cargo].str.upper().str.strip(),
    "qt_vaga": pd.to_numeric(v[v_qt], errors="coerce").astype("Int64"),
    "dt_posse": para_data(v[pick(v, "DT_POSSE")]),
}).reset_index(drop=True)
# id único entre cargas: ano*100000 + sequência (evita colisão entre Carga A e B)
vaga.insert(0, "id_vaga", vaga["id_eleicao"].astype(int) * 100000 + vaga.groupby("id_eleicao").cumcount() + 1)
grava(vaga, "vaga")

# ----------------------------------------------------------------------
# 4) DESPESA (despesas contratadas) — lê em pedaços
# ----------------------------------------------------------------------
print("4) despesas contratadas")
validos = set(candidatura["id_candidatura"].astype(str))
out_desp = os.path.join(SAIDA, "despesa.csv")
if os.path.exists(out_desp):
    os.remove(out_desp)
total, descartadas, vazias, primeiro = 0, 0, 0, True
for ano in ANOS:
    seq = 0   # contador por ano -> id_despesa único: ano*1e9 + seq
    for uf in UFS:
        f = os.path.join(BASE, f"prestacao{ano}", f"despesas_contratadas_candidatos_{ano}_{uf}.csv")
        for ch in pd.read_csv(f, sep=";", encoding="latin1", dtype=str,
                              keep_default_na=False, chunksize=CHUNK):
            # SQ_DESPESA = -1: candidato sem gasto declarado (linha vazia do TSE) -> descarta
            vazio = ch["SQ_DESPESA"].str.strip() == "-1"
            vazias += vazio.sum()
            ch = ch[~vazio]
            ok = ch["SQ_CANDIDATO"].isin(validos)
            descartadas += (~ok).sum()
            ch = ch[ok]
            # Um SQ_DESPESA = um documento; pode ter VÁRIAS linhas (itens) com valores
            # diferentes. Todas valem e são somadas -> id_despesa é um id novo por linha.
            ids = ano * 1_000_000_000 + seq + 1 + pd.RangeIndex(len(ch))
            seq += len(ch)
            out = pd.DataFrame({
                "id_despesa": ids,
                "sq_despesa": ch["SQ_DESPESA"].astype("int64").values,
                "id_candidatura": ch["SQ_CANDIDATO"].astype("int64").values,
                "tipo_despesa": limpa(ch["DS_ORIGEM_DESPESA"]).values,
                "descricao": limpa(ch["DS_DESPESA"]).values,
                "nome_fornecedor": limpa(ch["NM_FORNECEDOR"]).values,
                "valor": para_valor(ch["VR_DESPESA_CONTRATADA"]).values,
                "data_despesa": para_data(ch["DT_DESPESA"]).values,
            })
            out.to_csv(out_desp, mode="a", header=primeiro, index=False, encoding="utf-8")
            primeiro = False
            total += len(out)
        print(f"  {ano} {uf} ok (acumulado {total:,})")

desp = pd.read_csv(out_desp, usecols=["id_despesa", "valor"])
print(f"  gasto contratado total (6 UFs, {ANOS}): R$ {desp['valor'].sum():,.2f}")
print(f"  -> despesa.csv: {total:,} linhas | linhas vazias (-1) ignoradas: {vazias:,} | candidato fora do modelo: {descartadas:,}")

# ----------------------------------------------------------------------
# 5) VALIDAÇÕES
# ----------------------------------------------------------------------
print("5) validações")
print("  id_despesa duplicado:", desp["id_despesa"].duplicated().sum())
print("  valor nulo/negativo:", desp["valor"].isna().sum(), "/", (desp["valor"] < 0).sum())
print("  valores de situacao_resultado:")
print(candidatura["situacao_resultado"].value_counts(dropna=False).to_string())
print("  cargos:")
print(candidatura["cargo"].value_counts().to_string())
print("  vagas por estado/cargo:")
print(vaga.groupby(["id_eleicao", "sg_uf", "cargo"])["qt_vaga"].sum().to_string())

print("\nPRONTO. CSVs em:", SAIDA)
print("""
No PostgreSQL (psql), carregue nesta ordem:
  \\copy municipio   FROM 'municipio.csv'   CSV HEADER
  \\copy eleicao     FROM 'eleicao.csv'     CSV HEADER
  \\copy partido     FROM 'partido.csv'     CSV HEADER
  \\copy pessoa      FROM 'pessoa.csv'      CSV HEADER
  \\copy candidatura FROM 'candidatura.csv' CSV HEADER
  \\copy vaga        FROM 'vaga.csv'        CSV HEADER
  \\copy despesa     FROM 'despesa.csv'     CSV HEADER
""")
