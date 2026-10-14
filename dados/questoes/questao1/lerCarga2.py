# -*- coding: utf-8 -*-
"""
Amostra e conferência da CARGA B (2020 e 2024).
Gera 'amostra_saida_para_claude.txt' dentro de saida_carga_2020_2024.
Considera também a Carga A (pasta saida_carga_2018_2022), porque municipio, partido
e pessoa da Carga B só trazem o que ainda NÃO estava no banco.
"""
import pandas as pd, os, glob

BASE = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1"
PASTA = os.path.join(BASE, "saida_carga_2020_2024")
ANTERIORES = [p for p in glob.glob(os.path.join(BASE, "saida_carga_*")) if p != PASTA]


def ler(pasta, nome, **kw):
    return pd.read_csv(os.path.join(pasta, nome + ".csv"), dtype=str, keep_default_na=False, **kw)


def todos(nome, colunas):
    """Tabela da Carga B + cargas anteriores (só as colunas pedidas)."""
    partes = [ler(PASTA, nome, usecols=colunas)]
    for p in ANTERIORES:
        if os.path.exists(os.path.join(p, nome + ".csv")):
            partes.append(ler(p, nome, usecols=colunas))
    return pd.concat(partes, ignore_index=True)


out = []
def lin(s=""): out.append(s)

# ---------------- amostra das 3 primeiras linhas de cada CSV ----------------
for n in ["municipio", "eleicao", "partido", "pessoa", "candidatura", "vaga", "despesa"]:
    df = ler(PASTA, n, nrows=3)
    total = sum(1 for _ in open(os.path.join(PASTA, n + ".csv"), encoding="utf-8")) - 1
    lin("=" * 60); lin(f"{n}.csv | {total:,} linhas | colunas: {list(df.columns)}"); lin("=" * 60)
    for i, row in df.iterrows():
        lin(f"--- linha {i + 1} ---")
        for c, v in row.items():
            lin(f"  {c}: {v}")
    lin()

cand = ler(PASTA, "candidatura")
vaga = ler(PASTA, "vaga")
desp = ler(PASTA, "despesa", usecols=["id_despesa", "id_candidatura", "valor"])
desp["valor"] = pd.to_numeric(desp["valor"])
mun = todos("municipio", ["cod_ibge", "nome", "uf"])
pes = todos("pessoa", ["titulo_eleitor"])
par = todos("partido", ["numero_partido"])
ele = todos("eleicao", ["id_eleicao"])

# ---------------- checagens de chave (contra Carga B + Carga A) ----------------
lin("=== CHECAGENS DE CHAVE (Carga B contra B + A) ===")
lin(f"candidatura -> pessoa:   {(~cand.titulo_eleitor.isin(pes.titulo_eleitor)).sum()} sem pessoa")
lin(f"candidatura -> partido:  {(~cand.numero_partido.isin(par.numero_partido)).sum()} sem partido")
lin(f"candidatura -> eleicao:  {(~cand.id_eleicao.isin(ele.id_eleicao)).sum()} sem eleição")
lin(f"candidatura -> municipio:{(~cand.cod_ibge.isin(mun.cod_ibge)).sum()} sem município")
lin(f"vaga -> municipio:       {(~vaga.cod_ibge.isin(mun.cod_ibge)).sum()} sem município")
lin(f"despesa -> candidatura:  {(~desp.id_candidatura.isin(cand.id_candidatura)).sum()} sem candidatura")
lin(f"duplicados: candidatura.id={cand.id_candidatura.duplicated().sum()} | vaga.id={vaga.id_vaga.duplicated().sum()} | despesa.id={desp.id_despesa.duplicated().sum()}")
for p in ANTERIORES:
    ant_c = ler(p, "candidatura", usecols=["id_candidatura"])
    ant_v = ler(p, "vaga", usecols=["id_vaga"])
    lin(f"colisão com {os.path.basename(p)}: candidatura={cand.id_candidatura.isin(ant_c.id_candidatura).sum()} | vaga={vaga.id_vaga.isin(ant_v.id_vaga).sum()}")
lin(f"valor nulo/negativo na despesa: {desp.valor.isna().sum()} / {(desp.valor < 0).sum()}")
lin(f"gasto contratado total (Carga B): R$ {desp.valor.sum():,.2f}")

# ---------------- vazios ----------------
lin("\n=== VAZIOS POR COLUNA ===")
for n, df in [("candidatura", cand), ("vaga", vaga)]:
    v = (df == "").sum()
    lin(f"{n}: " + ", ".join(f"{k}={x}" for k, x in v.items() if x))
pessoa = ler(PASTA, "pessoa")
v = (pessoa == "").sum()
lin("pessoa: " + ", ".join(f"{k}={x}" for k, x in v.items() if x))

# ---------------- cargos e resultados ----------------
lin("\n=== CARGOS por ano ===")
lin(cand.groupby(["id_eleicao", "cargo"]).size().to_string())
lin("\n=== RESULTADOS por ano (vereador) ===")
lin(cand[cand.cargo == "VEREADOR"].assign(r=lambda d: d.situacao_resultado.replace("", "(vazio)"))
    .groupby(["id_eleicao", "r"]).size().to_string())
lin("\n=== VAGAS por ano e cargo (soma dos 6 estados) ===")
vaga["qt"] = pd.to_numeric(vaga.qt_vaga)
lin(vaga.groupby(["id_eleicao", "cargo"]).qt.agg(["count", "sum"]).to_string())

# ---------------- prévia Q1: vereador ----------------
ver = cand[cand.cargo == "VEREADOR"][["id_candidatura", "id_eleicao", "cod_ibge"]]
d = desp.merge(ver, on="id_candidatura")
gasto = d.groupby(["id_eleicao", "cod_ibge"]).valor.sum().rename("gasto")
vg = (vaga[vaga.cargo == "VEREADOR"].groupby(["id_eleicao", "cod_ibge"]).qt.sum().rename("cadeiras"))
q = pd.concat([gasto, vg], axis=1).reset_index()
q["gasto"] = q.gasto.fillna(0)
q = q.merge(mun.drop_duplicates("cod_ibge"), on="cod_ibge", how="left")
q["custo_cadeira"] = (q.gasto / q.cadeiras)

lin("\n=== PRÉVIA Q1: vereador, custo por cadeira por estado ===")
e = q.groupby(["id_eleicao", "uf"]).agg(gasto=("gasto", "sum"), cadeiras=("cadeiras", "sum"), municipios=("cod_ibge", "count"))
e["custo_cadeira"] = (e.gasto / e.cadeiras).round(0)
lin(e.to_string())

lin("\n=== PRÉVIA Q1: capitais ===")
caps = [("Belém", "PA"), ("Curitiba", "PR"), ("Florianópolis", "SC"), ("Aracaju", "SE"),
        ("João Pessoa", "PB"), ("Maceió", "AL")]
for nome, uf in caps:
    s = q[(q.nome == nome) & (q.uf == uf)].sort_values("id_eleicao")
    for _, r in s.iterrows():
        lin(f"  {nome}/{uf} {r.id_eleicao}: gasto R$ {r.gasto:,.0f} | {int(r.cadeiras)} cadeiras | R$ {r.custo_cadeira:,.0f} por cadeira")

lin(f"\nmunicípios com vaga de vereador: {q.cadeiras.notna().sum()} | sem nenhum gasto: {(q.gasto == 0).sum()} | sem vaga: {q.cadeiras.isna().sum()}")

arq = os.path.join(PASTA, "amostra_saida_para_claude.txt")
open(arq, "w", encoding="utf-8").write("\n".join(out))
print("Gerado:", arq)