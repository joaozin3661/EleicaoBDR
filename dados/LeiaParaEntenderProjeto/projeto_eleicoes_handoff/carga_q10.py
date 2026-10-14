# -*- coding: utf-8 -*-
"""
Carga Q10 — Sobrevivência da carreira de um político (6 estados: AL, PA, PB, PR, SC, SE)

Lê consulta_cand de 2002 a 2016 (anos pares) e gera CSVs para as tabelas
ELEICAO, PARTIDO, PESSOA e CANDIDATURA (as despesas não são necessárias na Q10).
Linhas já gravadas nas cargas da Q1 (pessoa/partido/eleicao) são puladas.

Diferenças em relação à Q1:
  * SQ_CANDIDATO de 2002–2008 é um número pequeno e repetido entre UFs/anos;
    por isso id_candidatura = ANO + índice da UF + SQ (com zeros) -> único em todos os anos.
  * Guarda a SIGLA DO PARTIDO NA ÉPOCA em candidatura.sigla_partido (PFL virou DEM etc.).
  * Eleições suplementares são removidas pela DATA da eleição (janela de 28 dias após a
    1ª votação do ano, que cobre o 2º turno).
  * Também gera sigla_partido_2018_2024.csv para preencher a coluna nas candidaturas já carregadas.

Uso: python carga_q10.py
"""
import os, sys, glob
import pandas as pd

# ----------------------------------------------------------------------
# CONFIGURAÇÃO — ajuste só o BASE1 / BASE10 se a pasta for outra
# ----------------------------------------------------------------------
BASE1 = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1"
BASE10 = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao10"
ANOS = [2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
MUNICIPAIS = {2004, 2008, 2012, 2016}
GERA_SIGLA_ATUAL = True            # gera sigla_partido_2018_2024.csv
SAIDA = os.path.join(BASE10, "saida_carga_q10")
os.makedirs(SAIDA, exist_ok=True)
print("=== carga_q10 | anos:", ANOS, "===")


def ler(path, **kw):
    return pd.read_csv(path, sep=";", encoding="latin1", dtype=str, keep_default_na=False, **kw)


def pick(df, *nomes, obrigatoria=True):
    for n in nomes:
        if n in df.columns:
            return n
    if obrigatoria:
        sys.exit(f"ERRO: nenhuma destas colunas existe: {nomes}\nColunas: {list(df.columns)}")
    return None


def get(df, *nomes):
    c = pick(df, *nomes, obrigatoria=False)
    return df[c] if c else pd.Series([""] * len(df), index=df.index)


def limpa(s):
    s = s.str.strip()
    return s.where(~s.isin(["#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4"]), "")


def para_data(s):
    d = pd.to_datetime(s, format="%d/%m/%Y", errors="coerce")
    ruim = d.notna() & ((d.dt.year < 1900) | (d.dt.year > 2010))   # ex.: ano 0046 digitado errado no TSE
    if ruim.any():
        print(f"  datas de nascimento com ano impossível (viraram vazio): {ruim.sum()}")
    return d.mask(ruim).dt.strftime("%Y-%m-%d")


def grava(df, nome):
    df.to_csv(os.path.join(SAIDA, nome + ".csv"), index=False, encoding="utf-8")
    print(f"  -> {nome}.csv: {len(df):,} linhas")


def ja_carregado(nome, coluna):
    """Chaves já gravadas nas cargas da Q1 (e em execuções anteriores de outras pastas)."""
    achados = set()
    for pasta in glob.glob(os.path.join(BASE1, "saida_carga_*")):
        cam = os.path.join(pasta, nome + ".csv")
        if os.path.exists(cam):
            achados |= set(pd.read_csv(cam, dtype=str, keep_default_na=False, usecols=[coluna])[coluna])
    return achados


# ----------------------------------------------------------------------
# 1) ponte município TSE -> IBGE
# ----------------------------------------------------------------------
print("1) ponte de municípios")
ponte = ler(os.path.join(BASE1, "municipio_tse_ibge", "municipio_tse_ibge.csv"))
tse_para_ibge = dict(zip(ponte["CD_MUNICIPIO_TSE"].str.zfill(5), ponte["CD_MUNICIPIO_IBGE"].astype(int)))
ibge_validos = set(ponte.loc[ponte["SG_UF"].isin(UFS), "CD_MUNICIPIO_IBGE"].astype(int))

# ----------------------------------------------------------------------
# 2) leitura dos arquivos
# ----------------------------------------------------------------------
print("2) consulta_cand")
frames = []
for ano in ANOS:
    for uf in UFS:
        # pasta de qualquer nome que contenha o ano (ex.: candidato2002, consulta_cand_2002)
        pastas = [p for p in glob.glob(os.path.join(BASE10, f"*{ano}*")) if os.path.isdir(p)
                  and "saida" not in os.path.basename(p).lower()]
        achados = []
        for p in pastas:
            achados += glob.glob(os.path.join(p, "**", f"*{ano}_{uf}.*"), recursive=True)
        achados = sorted(a for a in achados if a.lower().endswith((".csv", ".txt")))
        if not achados:
            sys.exit(f"ERRO: não achei arquivo *{ano}_{uf}.csv/.txt\n"
                     f"Pastas candidatas: {pastas}\nConteúdo de BASE10: {os.listdir(BASE10)}")
        f = achados[0]
        d = ler(f)
        d["_ano"] = ano
        d["_uf"] = uf
        frames.append(d)
raw = pd.concat(frames, ignore_index=True)
print(f"  linhas lidas: {len(raw):,}")

c_sq = pick(raw, "SQ_CANDIDATO")
c_dt = pick(raw, "DT_ELEICAO")

# ---- remove eleições suplementares pela data (janela de 28 dias após a 1ª votação) ----
dt = pd.to_datetime(raw[c_dt], format="%d/%m/%Y", errors="coerce")
raw["_dt"] = dt
modal = raw.groupby("_ano")["_dt"].agg(lambda x: x.value_counts().idxmax())
dias = (raw["_dt"] - raw["_ano"].map(modal)).dt.days
fora = ~dias.between(0, 28)
if fora.any():
    print(f"  candidaturas fora da janela da eleição ordinária (suplementares): {fora.sum():,}")
    print(raw.loc[fora].groupby(["_ano", "DS_ELEICAO", c_dt]).size().to_string())
raw = raw[~fora].copy()
print("  data da 1ª votação por ano:", {a: d.strftime("%d/%m/%Y") for a, d in modal.items()})

# ---- um registro por candidato: fica a linha do ÚLTIMO turno ----
c_turno = pick(raw, "NR_TURNO")
raw["_t"] = pd.to_numeric(raw[c_turno], errors="coerce").fillna(1)
raw["_ue"] = get(raw, "SG_UE").str.strip()
raw["_nome"] = get(raw, "NM_CANDIDATO").str.strip()
raw["_tit"] = get(raw, "NR_TITULO_ELEITORAL_CANDIDATO").str.strip()
print("  linhas por ano ANTES de juntar os turnos:")
print(raw.groupby("_ano").size().to_string())
# o SQ_CANDIDATO antigo só é único dentro do MUNICÍPIO (SG_UE) -> a chave inclui SG_UE
chave = ["_ano", "_uf", "_ue", c_sq]
raw = raw.sort_values(chave + ["_t"])
# diagnóstico: o mesmo SQ com NOMES diferentes seria colisão de verdade (não 2º turno)
nomes_dif = raw.groupby(chave)["_nome"].nunique()
print(f"  grupos (ano, UF, UE, SQ) com mais de um nome (colisão real): {(nomes_dif > 1).sum()}")
raw = raw.drop_duplicates(chave, keep="last").reset_index(drop=True)

# ---- id único em todos os anos: ANO*1e9 + sequência (2002..2016 -> 2.0e12..2.1e12; os de 2018+ são < 1e12) ----
uf_idx = raw["_uf"].map({u: str(i + 1) for i, u in enumerate(UFS)})
id_cand = (raw["_ano"].astype("int64") * 1_000_000_000 + raw.index.to_series() + 1).astype("int64")
assert id_cand.is_unique, "id_candidatura repetido!"
print(f"  candidaturas (após descartar suplementares e 2º turno): {len(raw):,}")
print(raw.groupby("_ano").size().to_string())

# ---- identificador da pessoa = título de eleitor ----
titulo = limpa(get(raw, "NR_TITULO_ELEITORAL_CANDIDATO")).str.replace(r"\D", "", regex=True)
ruim = (titulo.str.len() < 5) | (titulo.str.strip("0") == "")
print("  títulos ausentes/inválidos por ano:")
print(ruim.groupby(raw["_ano"]).agg(["sum", "size"]).rename(columns={"sum": "ausentes", "size": "total"}).to_string())
titulo = titulo.str.zfill(12)
fallback = "S" + (id_cand % 10**12).astype(str)   # 'S' + ano(2 díg.)+sequência: único, cabe em VARCHAR(13)
titulo = titulo.where(~ruim, fallback)

cpf = limpa(get(raw, "NR_CPF_CANDIDATO")).str.replace(r"\D", "", regex=True)
cpf = cpf.where(cpf.str.len() == 11, "")
print("  CPF disponível por ano (%):")
print((cpf != "").groupby(raw["_ano"]).mean().mul(100).round(1).to_string())

# ---- município ----
ue = get(raw, "SG_UE").str.strip().str.zfill(5)
cod_ibge = ue.map(tse_para_ibge)
cod_ibge = cod_ibge.where(raw["_ano"].isin(MUNICIPAIS), pd.NA)
nao_mapeado = raw["_ano"].isin(MUNICIPAIS) & cod_ibge.isna()
if nao_mapeado.any():
    print(f"  ATENÇÃO: {nao_mapeado.sum():,} candidaturas municipais com SG_UE fora da ponte (cod_ibge ficará vazio):")
    print(raw.loc[nao_mapeado].groupby(["_ano", "_uf", "SG_UE", "NM_UE"]).size().head(15).to_string())
fora_6 = cod_ibge.notna() & ~cod_ibge.isin(ibge_validos)
cod_ibge = cod_ibge.where(~fora_6, pd.NA)

num_partido = pd.to_numeric(get(raw, "NR_PARTIDO"), errors="coerce")
assert num_partido.notna().all(), "NR_PARTIDO vazio em alguma candidatura"

candidatura = pd.DataFrame({
    "id_candidatura": id_cand,
    "titulo_eleitor": titulo,
    "id_eleicao": raw["_ano"],
    "numero_partido": num_partido.astype(int),
    "cod_ibge": cod_ibge.astype("Int64"),
    "sg_uf": raw["_uf"],
    "cargo": get(raw, "DS_CARGO").str.upper().str.strip(),
    "abrangencia": raw["_ano"].map(lambda a: "MUNICIPAL" if a in MUNICIPAIS else "ESTADUAL"),
    "grau_instrucao": limpa(get(raw, "DS_GRAU_INSTRUCAO")),
    "ocupacao": limpa(get(raw, "DS_OCUPACAO")),
    # 2004–2010 gravam "MÉDIA" no lugar de "ELEITO POR MÉDIA": padroniza para 'LIKE ELEITO%' funcionar
    "situacao_resultado": limpa(get(raw, "DS_SIT_TOT_TURNO")).str.strip().replace({"MÉDIA": "ELEITO POR MÉDIA"}),
    "total_votos": pd.NA,
    "sigla_partido": get(raw, "SG_PARTIDO").str.strip(),   # SEMPRE a última coluna
})
grava(candidatura, "candidatura")

# ---- PESSOA (só quem ainda não está no banco) ----
pessoa = pd.DataFrame({
    "titulo_eleitor": titulo.values,
    "cpf": cpf.values,
    "nome": get(raw, "NM_CANDIDATO").str.strip().values,
    "data_nascimento": para_data(get(raw, "DT_NASCIMENTO")).values,
    "sexo": limpa(get(raw, "DS_GENERO", "DS_SEXO")).values,
    "raca_cor": limpa(get(raw, "DS_COR_RACA")).values,
    "_ano": raw["_ano"].values,
}).sort_values(["_ano", "cpf"]).drop_duplicates("titulo_eleitor", keep="last").drop(columns="_ano")
antes = len(pessoa)
pessoa = pessoa[~pessoa["titulo_eleitor"].isin(ja_carregado("pessoa", "titulo_eleitor"))]
print(f"  (pessoa: {antes - len(pessoa):,} já estavam no banco e foram puladas)")
grava(pessoa, "pessoa")

# ---- PARTIDO (só números ainda inexistentes) ----
partido = pd.DataFrame({
    "numero_partido": num_partido.astype(int).values,
    "sigla": get(raw, "SG_PARTIDO").str.strip().values,
    "nome": get(raw, "NM_PARTIDO").str.strip().values,
    "espectro_politico": "",
    "_ano": raw["_ano"].values,
}).sort_values("_ano").drop_duplicates("numero_partido", keep="last").drop(columns="_ano")
existentes = ja_carregado("partido", "numero_partido")
partido = partido[~partido["numero_partido"].astype(str).isin(existentes)]
print(f"  partidos novos (números ainda não existentes): {len(partido)}")
grava(partido, "partido")

# ---- ELEICAO ----
eleicao = pd.DataFrame({"id_eleicao": ANOS, "ano": ANOS,
                        "tipo_eleicao": ["MUNICIPAL" if a in MUNICIPAIS else "GERAL" for a in ANOS]})
eleicao = eleicao[~eleicao["id_eleicao"].astype(str).isin(ja_carregado("eleicao", "id_eleicao"))]
grava(eleicao, "eleicao")

# ----------------------------------------------------------------------
# 3) sigla do partido na época para as candidaturas JÁ carregadas (2018–2024)
# ----------------------------------------------------------------------
if GERA_SIGLA_ATUAL:
    print("3) sigla_partido das candidaturas de 2018–2024 (para UPDATE)")
    partes = []
    for ano in (2018, 2020, 2022, 2024):
        for uf in UFS:
            f = os.path.join(BASE1, f"consulta_cand_{ano}", f"consulta_cand_{ano}_{uf}.csv")
            if os.path.exists(f):
                partes.append(ler(f, usecols=["SQ_CANDIDATO", "SG_PARTIDO", "NR_TURNO"]))
    if partes:
        s = pd.concat(partes, ignore_index=True)
        s["_t"] = pd.to_numeric(s["NR_TURNO"], errors="coerce").fillna(1)
        s = s.sort_values(["SQ_CANDIDATO", "_t"]).drop_duplicates("SQ_CANDIDATO", keep="last")
        grava(pd.DataFrame({"id_candidatura": s["SQ_CANDIDATO"].astype("int64"),
                            "sigla_partido": s["SG_PARTIDO"].str.strip()}),
              "sigla_partido_2018_2024")
    else:
        print("  (arquivos de 2018–2024 não encontrados — pulei)")

# ----------------------------------------------------------------------
# 4) validações
# ----------------------------------------------------------------------
print("4) validações")
print("  candidaturas por ano e cargo:")
print(candidatura.groupby(["id_eleicao", "cargo"]).size().to_string())
print("  situacao_resultado por ano:")
print(candidatura.assign(r=candidatura.situacao_resultado.replace("", "(vazio)"))
      .groupby(["id_eleicao", "r"]).size().to_string())
print("  siglas de partido por ano (top 12 em cada ano):")
for a, g in candidatura.groupby("id_eleicao"):
    print(f"   {a}: " + ", ".join(f"{k}={v}" for k, v in g.sigla_partido.value_counts().head(12).items()))

print("\nPRONTO. CSVs em:", SAIDA)
