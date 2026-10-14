# -*- coding: utf-8 -*-
"""
Carga v2 — banco eleicoes_v2 (6 estados: AL, PA, PB, PR, SC, SE), eleições de 2002 a 2024

Substitui carga_questao1_v2.py + carga_q10.py. Lê os arquivos originais do TSE uma vez só e gera
um CSV por tabela em saida\\: municipio, eleicao, partido, pessoa, candidatura, vaga, despesa.

O que muda em relação à carga anterior:
  * PESSOA tem chave sintética (id_pessoa). O título NÃO é mais a chave, porque na fonte:
      - a mesma pessoa aparece com títulos diferentes (formato antigo deslocado, reemissão);
      - pessoas diferentes aparecem com o mesmo título (erro de digitação).
    A identidade é resolvida assim:
      1) agrupa as candidaturas pelo título;
      2) dentro de um título, separa quem é claramente outra pessoa (nome, nascimento e CPF não batem);
      3) une grupos com o mesmo CPF válido e nome parecido, ou com mesmo nome + nascimento + UF de nascimento.
  * Título e CPF validados pelo dígito verificador. O que veio do TSE fica na candidatura
    (titulo_declarado, cpf_declarado), sem alteração.
  * Atributos da pessoa escolhidos por regra: nascimento e CPF mais frequentes, nome, sexo e
    cor/raça mais recentes (cor/raça não existe antes de 2014).
  * Candidatura ganha situacao_candidatura (APTO/INAPTO), detalhe_situacao, nome_urna e
    numero_candidato. Registros duplicados da mesma pessoa no mesmo ano são mantidos e marcados.

Uso: rodar direto (Code Runner). Configuração abaixo.
"""
import difflib
import glob
import os
import re
import sys
import unicodedata
from collections import Counter

import pandas as pd

# ----------------------------------------------------------------------
# CONFIGURAÇÃO
# ----------------------------------------------------------------------
QUESTOES = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # dados\questoes, a pasta acima de carga_v2
BASE1 = os.path.join(QUESTOES, "questao1")      # 2018–2024: consulta_cand, vagas, prestação de contas
BASE10 = os.path.join(QUESTOES, "questao10")    # 2002–2016: candidatoAAAA
ANOS = list(range(2002, 2025, 2))
ANOS_DESPESA = [2018, 2020, 2022, 2024]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
MUNICIPAIS = {2004, 2008, 2012, 2016, 2020, 2024}
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saida")
CHUNK = 200_000
os.makedirs(SAIDA, exist_ok=True)

NULOS = {"", "#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4"}
REGIAO = {"1": "Norte", "2": "Nordeste", "3": "Sudeste", "4": "Sul", "5": "Centro-Oeste"}
print("=== carga_v2 | anos:", ANOS[0], "a", ANOS[-1], "| saída:", SAIDA, "===")


# ----------------------------------------------------------------------
# Funções auxiliares
# ----------------------------------------------------------------------
def ler(path, **kw):
    """Padrão TSE: Latin-1, ';', tudo texto."""
    return pd.read_csv(path, sep=";", encoding="latin1", dtype=str, keep_default_na=False, **kw)


def limpa(s):
    s = s.str.strip()
    return s.where(~s.isin(NULOS), "")


def para_data(s):
    return pd.to_datetime(s, format="%d/%m/%Y", errors="coerce").dt.strftime("%Y-%m-%d")


def para_valor(s):
    return pd.to_numeric(s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False), errors="coerce")


def grava(df, nome):
    df.to_csv(os.path.join(SAIDA, nome + ".csv"), index=False, encoding="utf-8")
    print(f"  -> {nome}.csv: {len(df):,} linhas")


def titulo_valido(t):
    """Dígito verificador do título de eleitor (12 dígitos: 8 sequenciais, 2 da UF, 2 DVs)."""
    if not re.fullmatch(r"\d{12}", t):
        return False
    seq, uf, d1, d2 = t[:8], t[8:10], int(t[10]), int(t[11])
    if not 1 <= int(uf) <= 28:
        return False
    sp_mg = uf in ("01", "02")
    r1 = sum(int(seq[i]) * (i + 2) for i in range(8)) % 11
    r1 = 0 if r1 == 10 else (1 if r1 == 0 and sp_mg else r1)
    r2 = (int(uf[0]) * 7 + int(uf[1]) * 8 + r1 * 9) % 11
    r2 = 0 if r2 == 10 else (1 if r2 == 0 and sp_mg else r2)
    return r1 == d1 and r2 == d2


def cpf_valido(c):
    if not re.fullmatch(r"\d{11}", c) or c == c[0] * 11:
        return False
    for n in (9, 10):
        if sum(int(c[i]) * (n + 1 - i) for i in range(n)) * 10 % 11 % 10 != int(c[n]):
            return False
    return True


def norm_nome(s):
    s = unicodedata.normalize("NFKD", s.upper())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z ]", " ", s)).strip()


def nome_parecido(a, b):
    return a == b or difflib.SequenceMatcher(None, a, b).ratio() >= 0.85


def mesmo_primeiro_nome(a, b):
    """Tolera grafia: MARTHA/MARTA, TEREZINHA/TERESINHA."""
    if not a or not b:
        return False
    pa, pb = a.split()[0], b.split()[0]
    return pa == pb or difflib.SequenceMatcher(None, pa, pb).ratio() >= 0.8


def nomes_compativeis(a, b):
    """Grafia quase igual, ou mesmo primeiro nome com metade das palavras em comum
    (cobre sobrenome trocado por casamento: ROSANGELA DA SILVA LIMA -> ROSANGELA LIMA E SILVA)."""
    if nome_parecido(a, b):
        return True
    pa, pb = set(a.split()), set(b.split())
    return mesmo_primeiro_nome(a, b) and len(pa & pb) / len(pa | pb) >= 0.5


def data_perto(a, b):
    """Mesma data, ou mesmo ano com só o dia OU só o mês diferente (erro de digitação)."""
    if not a or not b:
        return False
    if a == b:
        return True
    ya, ma, da = a.split("-")
    yb, mb, db = b.split("-")
    return ya == yb and (ma == mb or da == db)


# ----------------------------------------------------------------------
# 1) MUNICIPIO (ponte TSE <-> IBGE)
# ----------------------------------------------------------------------
print("1) municipio")
ponte = ler(os.path.join(BASE1, "municipio_tse_ibge", "municipio_tse_ibge.csv"))
ponte = ponte[ponte["SG_UF"].isin(UFS)]
municipio = pd.DataFrame({
    "cod_ibge": ponte["CD_MUNICIPIO_IBGE"].astype(int),
    "cod_tse": ponte["CD_MUNICIPIO_TSE"].str.zfill(5),
    "nome": ponte["NM_MUNICIPIO_IBGE"],
    "uf": ponte["SG_UF"],
    "regiao": ponte["CD_UF_IBGE"].str[0].map(REGIAO),
})
assert len(municipio) == 1238, f"esperava 1238 municípios, veio {len(municipio)}"
grava(municipio, "municipio")
tse_para_ibge = dict(zip(municipio["cod_tse"], municipio["cod_ibge"]))

# ----------------------------------------------------------------------
# 2) Leitura dos candidatos de todos os anos
# ----------------------------------------------------------------------
print("2) consulta_cand")
frames = []
for ano in ANOS:
    base = BASE10 if ano < 2018 else BASE1
    for uf in UFS:
        achados = sorted(f for f in glob.glob(os.path.join(base, f"*{ano}*", f"*{ano}_{uf}.*"))
                         if f.lower().endswith((".csv", ".txt")) and "saida" not in f.lower())
        if not achados:
            sys.exit(f"ERRO: não achei consulta_cand de {ano} {uf} em {base}")
        d = ler(achados[0])
        d["_ano"] = ano
        frames.append(d)
raw = pd.concat(frames, ignore_index=True)
for c in ["DS_DETALHE_SITUACAO_CAND", "SG_UF_NASCIMENTO", "NM_URNA_CANDIDATO", "DS_SITUACAO_CANDIDATURA"]:
    if c not in raw:
        raw[c] = ""
raw = raw.fillna("")
print(f"  linhas lidas: {len(raw):,}")

# Eleições suplementares: fica só o que ocorreu até 28 dias após a data mais comum do ano
# (janela que preserva o 2º turno). Vale igual para anos antigos e recentes.
dt = pd.to_datetime(raw["DT_ELEICAO"], format="%d/%m/%Y", errors="coerce")
modal = dt.groupby(raw["_ano"]).agg(lambda x: x.value_counts().idxmax())
fora = ~(dt - raw["_ano"].map(modal)).dt.days.between(0, 28)
print(f"  candidaturas de eleições suplementares descartadas: {fora.sum():,}")
raw = raw[~fora].copy()

# Um registro por candidatura: fica a linha do ÚLTIMO turno.
# O SQ_CANDIDATO antigo só é único dentro do município, por isso a chave inclui SG_UE.
raw["_t"] = pd.to_numeric(raw["NR_TURNO"], errors="coerce").fillna(1)
chave = ["_ano", "SG_UF", "SG_UE", "SQ_CANDIDATO"]
raw = raw.sort_values(chave + ["_t"]).drop_duplicates(chave, keep="last").reset_index(drop=True)
print(f"  candidaturas: {len(raw):,}")
print("  " + raw.groupby("_ano").size().to_string().replace("\n", "\n  "))

# id_candidatura: SQ_CANDIDATO de 2018 em diante (único e usado nas despesas);
# antes disso, ano * 1e9 + sequência (o SQ antigo se repete entre municípios).
recente = raw["_ano"] >= 2018
seq = raw.groupby("_ano").cumcount() + 1
raw["id_candidatura"] = (raw["_ano"].astype("int64") * 1_000_000_000 + seq).where(
    ~recente, pd.to_numeric(raw["SQ_CANDIDATO"], errors="coerce")).astype("int64")
assert raw["id_candidatura"].is_unique, "id_candidatura repetido!"
assert raw.loc[recente, "id_candidatura"].max() < 2_002_000_000_000, "SQ recente colide com id gerado"

# Campos de identidade normalizados
tit = raw["NR_TITULO_ELEITORAL_CANDIDATO"].str.strip().str.replace(r"\D", "", regex=True)
tit_nulo = raw["NR_TITULO_ELEITORAL_CANDIDATO"].str.strip().isin(NULOS) | (tit.str.strip("0") == "")
raw["_tit"] = tit.str.zfill(12).where(~tit_nulo, "")
raw["_tit_ok"] = raw["_tit"].map(titulo_valido)
cpf_bruto = raw["NR_CPF_CANDIDATO"].str.strip()
raw["_cpf"] = cpf_bruto.str.replace(r"\D", "", regex=True).str.zfill(11).where(~cpf_bruto.isin(NULOS), "")
raw["_cpf_ok"] = raw["_cpf"].map(cpf_valido)
raw["_nome"] = raw["NM_CANDIDATO"].str.strip()
raw["_nome_n"] = raw["_nome"].map(norm_nome)
nasc = pd.to_datetime(raw["DT_NASCIMENTO"], format="%d/%m/%Y", errors="coerce")
raw["_nasc"] = nasc.where(nasc.dt.year.between(1900, 2008)).dt.strftime("%Y-%m-%d").fillna("")
ufn = limpa(raw["SG_UF_NASCIMENTO"]).str.upper()
raw["_ufn"] = ufn.where(ufn.str.fullmatch(r"[A-Z]{2}"), "")    # alguns anos trazem "Não divulgável"

print("  qualidade dos documentos por ano:")
print("  " + pd.DataFrame({
    "sem_titulo": (raw["_tit"] == "").groupby(raw["_ano"]).sum(),
    "titulo_dv_invalido": ((raw["_tit"] != "") & ~raw["_tit_ok"]).groupby(raw["_ano"]).sum(),
    "cpf_oculto": (cpf_bruto == "-4").groupby(raw["_ano"]).sum(),
    "cpf_valido": raw["_cpf_ok"].groupby(raw["_ano"]).sum(),
    "nasc_invalida": (raw["_nasc"] == "").groupby(raw["_ano"]).sum(),
}).to_string().replace("\n", "\n  "))

# ----------------------------------------------------------------------
# 3) Resolução de identidade -> id_pessoa
# ----------------------------------------------------------------------
print("3) identidade das pessoas")

# 3a) dentro de cada título, separa quem é outra pessoa.
#     Uma candidatura fica com um grupo se:
#       - os nomes são compatíveis; ou
#       - tem o mesmo primeiro nome e o nascimento (com tolerância a erro de digitação) ou o CPF batem; ou
#       - o nascimento é idêntico e a candidatura é de OUTRA eleição (troca de nome / nome social:
#         GERALDO -> SHIRLEY COSTA DA SILVA, mesmo título, CPF e nascimento).
#     Fora disso é outra pessoa, mesmo com documento igual: há registros em que o TSE copiou título e
#     CPF de um candidato para outro da mesma eleição (ex.: Tamboara/PR 2004, três vereadores eleitos
#     com o mesmo título).
raw["_no"] = ""
com_tit = raw["_tit"] != ""
varios = raw[com_tit].groupby("_tit")["_nome_n"].transform("nunique").gt(1) | \
    raw[com_tit].groupby("_tit")["_nasc"].transform("nunique").gt(1)
raw.loc[com_tit, "_no"] = raw.loc[com_tit, "_tit"]
separados = 0
for t, g in raw[com_tit][varios].sort_values("_ano").groupby("_tit"):
    grupos = []                                   # [(nome, nasc, cpfs, anos, rótulo)]
    for i, r in g.iterrows():
        for nome, dn, cpfs, anos, rot in grupos:
            if nomes_compativeis(nome, r["_nome_n"]) or (mesmo_primeiro_nome(nome, r["_nome_n"]) and (
                    data_perto(dn, r["_nasc"]) or (r["_cpf_ok"] and r["_cpf"] in cpfs))) or \
                    (dn and dn == r["_nasc"] and r["_ano"] not in anos):
                raw.at[i, "_no"] = rot
                anos.add(r["_ano"])
                if r["_cpf_ok"]:
                    cpfs.add(r["_cpf"])
                break
        else:
            rot = t if not grupos else f"{t}#{len(grupos)}"
            separados += bool(grupos)
            grupos.append((r["_nome_n"], r["_nasc"], {r["_cpf"]} if r["_cpf_ok"] else set(), {r["_ano"]}, rot))
            raw.at[i, "_no"] = rot
print(f"  títulos compartilhados por pessoas diferentes (separados): {separados}")
sem_tit = ~com_tit
raw.loc[sem_tit, "_no"] = "S" + raw.loc[sem_tit, "id_candidatura"].astype(str)

# 3b) une grupos que são a mesma pessoa com documentos diferentes
#     Trava: não une dois grupos que disputaram o mesmo ano em lugares diferentes (homônimos comuns,
#     como MARIA JOSE DOS SANTOS, aparecem com o mesmo CPF errado em municípios diferentes).
pai = {n: n for n in raw["_no"].unique()}
locais = {}
for n, a, ue in zip(raw["_no"], raw["_ano"], raw["SG_UE"]):
    locais.setdefault(n, {}).setdefault(a, set()).add(ue)
recusadas = 0


def acha(n):
    while pai[n] != n:
        pai[n] = pai[pai[n]]
        n = pai[n]
    return n


def une(a, b):
    global recusadas
    a, b = acha(a), acha(b)
    if a == b:
        return 0
    la, lb = locais[a], locais[b]
    if any(la[ano].isdisjoint(lb[ano]) for ano in la.keys() & lb.keys()):
        recusadas += 1
        return 0
    a, b = min(a, b), max(a, b)
    pai[b] = a
    for ano, ues in locais.pop(b).items():
        locais[a].setdefault(ano, set()).update(ues)
    return 1


no = raw.groupby("_no").agg(nome_n=("_nome_n", "last"),
                            nasc=("_nasc", lambda x: x[x != ""].mode().iat[0] if (x != "").any() else ""),
                            ufn=("_ufn", lambda x: x[x != ""].iat[-1] if (x != "").any() else ""))
u_cpf = 0
cp = raw[raw["_cpf_ok"]].drop_duplicates(["_cpf", "_no"])
for _, g in cp[cp.duplicated("_cpf", keep=False)].groupby("_cpf"):
    base = g.iloc[0]
    for _, r in g.iloc[1:].iterrows():
        nb, nr = no.loc[base["_no"]], no.loc[r["_no"]]
        if nomes_compativeis(nb.nome_n, nr.nome_n) or (nb.nasc and nb.nasc == nr.nasc):
            u_cpf += une(base["_no"], r["_no"])
u_nn = 0
nn = no[no["nasc"] != ""].reset_index().groupby(["nome_n", "nasc", "ufn"])["_no"].apply(list)
for nos in nn[nn.map(len) > 1]:
    for n in nos[1:]:
        u_nn += une(nos[0], n)
raw["_grupo"] = raw["_no"].map(acha)
print(f"  uniões pelo CPF: {u_cpf} | por nome + nascimento + UF de nascimento: {u_nn} "
      f"| recusadas (mesmo ano, lugares diferentes): {recusadas}")

# id_pessoa estável: ordem da primeira candidatura e nome
ordem = raw.groupby("_grupo").agg(a=("_ano", "min"), n=("_nome_n", "first")).sort_values(["a", "n"])
raw["id_pessoa"] = raw["_grupo"].map(pd.Series(range(1, len(ordem) + 1), index=ordem.index))
print(f"  pessoas: {raw['id_pessoa'].nunique():,} (antes, uma por título: {raw['_tit'].replace('', pd.NA).nunique() + sem_tit.sum():,})")


# 3c) atributos da pessoa
def mais_frequente(x):
    """Valor mais frequente; empate -> o mais recente (x vem ordenado por ano)."""
    x = [v for v in x if v]
    if not x:
        return ""
    cont = Counter(x)
    topo = max(cont.values())
    return [v for v in x if cont[v] == topo][-1]


def mais_recente(x):
    x = [v for v in x if v]
    return x[-1] if x else ""


raw = raw.sort_values(["id_pessoa", "_ano", "_t"])
raw["_tit_bom"] = raw["_tit"].where(raw["_tit_ok"], "")
raw["_cpf_bom"] = raw["_cpf"].where(raw["_cpf_ok"], "")
raw["_sexo"] = limpa(raw["DS_GENERO"])
raw["_raca"] = limpa(raw["DS_COR_RACA"])
pessoa = raw.groupby("id_pessoa").agg(
    titulo_eleitor=("_tit_bom", mais_frequente),
    cpf=("_cpf_bom", mais_frequente),
    nome=("_nome", "last"),
    data_nascimento=("_nasc", mais_frequente),
    sexo=("_sexo", mais_recente),
    raca_cor=("_raca", mais_recente),
    uf_nascimento=("_ufn", mais_recente),
).reset_index()
grava(pessoa, "pessoa")
print(f"  pessoas sem título válido: {(pessoa.titulo_eleitor == '').sum():,} | sem CPF: {(pessoa.cpf == '').sum():,}")
cand24 = raw[raw["_ano"] == 2024]
print(f"  candidatos de 2024 que ganharam CPF de outra eleição: "
      f"{cand24['id_pessoa'].isin(pessoa.loc[pessoa.cpf != '', 'id_pessoa']).sum():,} de {len(cand24):,}")

# ----------------------------------------------------------------------
# 4) CANDIDATURA, PARTIDO, ELEICAO
# ----------------------------------------------------------------------
print("4) candidatura, partido, eleicao")
raw = raw.sort_values("id_candidatura").reset_index(drop=True)
cod_ibge = raw["SG_UE"].str.strip().str.zfill(5).map(tse_para_ibge)
cod_ibge = cod_ibge.where(raw["_ano"].isin(MUNICIPAIS))
sem_mun = raw["_ano"].isin(MUNICIPAIS) & cod_ibge.isna()
assert not sem_mun.any(), f"{sem_mun.sum()} candidaturas municipais com SG_UE fora da ponte"
num_partido = pd.to_numeric(raw["NR_PARTIDO"], errors="coerce")
assert num_partido.notna().all(), "NR_PARTIDO vazio"

candidatura = pd.DataFrame({
    "id_candidatura": raw["id_candidatura"],
    "id_pessoa": raw["id_pessoa"],
    "id_eleicao": raw["_ano"],
    "numero_partido": num_partido.astype(int),
    "cod_ibge": cod_ibge.astype("Int64"),
    "sg_uf": raw["SG_UF"].str.strip(),
    "cargo": raw["DS_CARGO"].str.upper().str.strip(),
    "abrangencia": raw["_ano"].map(lambda a: "MUNICIPAL" if a in MUNICIPAIS else "ESTADUAL"),
    "numero_candidato": pd.to_numeric(limpa(raw["NR_CANDIDATO"]), errors="coerce").astype("Int64"),
    "nome_urna": limpa(raw["NM_URNA_CANDIDATO"]),
    "nome_declarado": raw["_nome"],            # nome como veio naquela eleição (a pessoa guarda o mais recente)
    "titulo_declarado": raw["_tit"],
    "cpf_declarado": raw["_cpf"].where(raw["_cpf"].str.fullmatch(r"\d{11}"), ""),
    "sigla_partido": raw["SG_PARTIDO"].str.strip(),
    "grau_instrucao": limpa(raw["DS_GRAU_INSTRUCAO"]),
    "ocupacao": limpa(raw["DS_OCUPACAO"]),
    "situacao_candidatura": limpa(raw["DS_SITUACAO_CANDIDATURA"]).str.upper(),
    "detalhe_situacao": limpa(raw["DS_DETALHE_SITUACAO_CAND"]).str.upper(),
    # 2004–2010 gravam "MÉDIA" no lugar de "ELEITO POR MÉDIA": padroniza para LIKE 'ELEITO%'
    "situacao_resultado": limpa(raw["DS_SIT_TOT_TURNO"]).replace({"MÉDIA": "ELEITO POR MÉDIA"}),
    "total_votos": pd.NA,
})
grava(candidatura, "candidatura")

ult = raw.sort_values("_ano").drop_duplicates("NR_PARTIDO", keep="last")
partido = pd.DataFrame({
    "numero_partido": pd.to_numeric(ult["NR_PARTIDO"]).astype(int),
    "sigla": ult["SG_PARTIDO"].str.strip(),
    "nome": ult["NM_PARTIDO"].str.strip(),
    "espectro_politico": "",
}).sort_values("numero_partido")
grava(partido, "partido")

eleicao = pd.DataFrame({"id_eleicao": ANOS, "ano": ANOS,
                        "tipo_eleicao": ["MUNICIPAL" if a in MUNICIPAIS else "GERAL" for a in ANOS]})
grava(eleicao, "eleicao")

# ----------------------------------------------------------------------
# 5) VAGA (arquivo _BRASIL, 2018–2024)
# ----------------------------------------------------------------------
print("5) vaga")
vs = []
for ano in ANOS_DESPESA:
    d = ler(glob.glob(os.path.join(BASE1, "vagas", str(ano), f"consulta_vagas_{ano}_BRASIL.csv"))[0])
    d["_ano"] = ano
    vs.append(d)
v = pd.concat(vs, ignore_index=True)
v = v[v["SG_UF"].isin(UFS)].copy()
# suplementares: mesma regra de CD_ELEICAO mais frequente nos anos municipais
ord_v = v[v["_ano"].isin(MUNICIPAIS)].groupby("_ano")["CD_ELEICAO"].agg(lambda x: x.value_counts().idxmax())
fora_v = v["_ano"].isin(MUNICIPAIS) & (v["CD_ELEICAO"] != v["_ano"].map(ord_v))
print(f"  vagas de eleições suplementares descartadas: {fora_v.sum():,}")
v = v[~fora_v].copy()
v_ibge = v["SG_UE"].str.zfill(5).map(tse_para_ibge).where(v["_ano"].isin(MUNICIPAIS))
cargo_v = v["DS_CARGO"].str.upper().str.strip().replace({"1. SUPLENTE": "1º SUPLENTE", "2. SUPLENTE": "2º SUPLENTE"})
vaga = pd.DataFrame({
    "id_eleicao": v["_ano"],
    "cod_ibge": v_ibge.astype("Int64"),
    "sg_uf": v["SG_UF"],
    "cargo": cargo_v,
    "qt_vaga": pd.to_numeric(v[[c for c in ("QT_VAGA", "QT_VAGAS") if c in v][0]], errors="coerce").astype("Int64"),
    "dt_posse": para_data(v["DT_POSSE"]),
}).reset_index(drop=True)
vaga.insert(0, "id_vaga", vaga["id_eleicao"] * 100000 + vaga.groupby("id_eleicao").cumcount() + 1)
assert (vaga["qt_vaga"] > 0).all(), "vaga com quantidade zero ou vazia"
grava(vaga, "vaga")

# ----------------------------------------------------------------------
# 6) DESPESA (despesas contratadas, 2018–2024) — lê em pedaços
# ----------------------------------------------------------------------
print("6) despesa")
validos = set(candidatura.loc[candidatura["id_eleicao"] >= 2018, "id_candidatura"].astype(str))
out_desp = os.path.join(SAIDA, "despesa.csv")
if os.path.exists(out_desp):
    os.remove(out_desp)
total, vazias, fora_modelo, negativas, primeiro = 0, 0, 0, 0, True
for ano in ANOS_DESPESA:
    seqd = 0
    for uf in UFS:
        f = os.path.join(BASE1, f"prestacao{ano}", f"despesas_contratadas_candidatos_{ano}_{uf}.csv")
        for ch in ler(f, chunksize=CHUNK):
            vazio = ch["SQ_DESPESA"].str.strip() == "-1"      # candidato sem gasto: linha vazia do TSE
            vazias += vazio.sum()
            ch = ch[~vazio]
            ok = ch["SQ_CANDIDATO"].isin(validos)
            fora_modelo += (~ok).sum()
            ch = ch[ok]
            valor = para_valor(ch["VR_DESPESA_CONTRATADA"])
            negativas += (valor < 0).sum()
            out = pd.DataFrame({
                "id_despesa": ano * 1_000_000_000 + seqd + 1 + pd.RangeIndex(len(ch)),
                "sq_despesa": ch["SQ_DESPESA"].astype("int64").values,
                "id_candidatura": ch["SQ_CANDIDATO"].astype("int64").values,
                "tipo_despesa": limpa(ch["DS_ORIGEM_DESPESA"]).values,
                "descricao": limpa(ch["DS_DESPESA"]).values,
                "nome_fornecedor": limpa(ch["NM_FORNECEDOR"]).values,
                "valor": valor.values,
                "data_despesa": para_data(ch["DT_DESPESA"]).values,
            })
            seqd += len(ch)
            out.to_csv(out_desp, mode="a", header=primeiro, index=False, encoding="utf-8")
            primeiro = False
            total += len(out)
    print(f"  {ano} ok (acumulado {total:,})")
print(f"  -> despesa.csv: {total:,} linhas | vazias (-1): {vazias:,} | candidato fora do modelo: {fora_modelo:,} "
      f"| valor negativo: {negativas:,}")

# ----------------------------------------------------------------------
# 7) Validações e relatório
# ----------------------------------------------------------------------
print("7) validações")
c = candidatura
print("  candidaturas sem pessoa:", (~c.id_pessoa.isin(pessoa.id_pessoa)).sum())
print("  candidaturas sem sigla:", (c.sigla_partido == "").sum())
dup = c[c.duplicated(["id_pessoa", "id_eleicao"], keep=False)]
print(f"  pessoa com mais de uma candidatura no mesmo ano: {dup.groupby(['id_pessoa', 'id_eleicao']).ngroups:,} "
      f"pares | {(dup.situacao_candidatura == 'INAPTO').sum():,} dessas linhas são INAPTO")
locais_dup = dup.assign(_ue=dup.cod_ibge.astype(str) + dup.sg_uf).groupby(["id_pessoa", "id_eleicao"])._ue.nunique()
print(f"  pessoa em dois lugares no mesmo ano (deveria ser 0): {(locais_dup > 1).sum()}")
car = c.groupby("id_pessoa").id_eleicao.nunique()
print(f"  pessoas por número de eleições disputadas: " + ", ".join(f"{k}={v:,}" for k, v in car.value_counts().sort_index().items()))
eleitos_2018 = c[(c.id_eleicao == 2018) & (c.cargo == "DEPUTADO FEDERAL") & c.situacao_resultado.str.startswith("ELEITO")]
print(f"  deputados federais eleitos em 2018 (esperado 92): {len(eleitos_2018)}")
print("  situacao_candidatura por ano:")
print("  " + c.groupby(["id_eleicao", "situacao_candidatura"]).size().unstack(fill_value=0).to_string().replace("\n", "\n  "))
print("\nPRONTO. CSVs em:", SAIDA)
