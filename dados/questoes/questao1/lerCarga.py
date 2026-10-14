import pandas as pd, os

pasta = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1\saida_carga_2018_2022"
ler = lambda n: pd.read_csv(os.path.join(pasta, n + ".csv"), dtype=str, keep_default_na=False)
t = {n: ler(n) for n in ["municipio", "eleicao", "partido", "pessoa", "candidatura", "vaga", "despesa"]}

out = []
for n, df in t.items():
    out.append("=" * 60)
    out.append(f"{n}.csv | {len(df):,} linhas | colunas: {list(df.columns)}")
    out.append("=" * 60)
    for i, row in df.head(3).iterrows():
        out.append(f"--- linha {i + 1} ---")
        out += [f"  {c}: {v}" for c, v in row.items()]
    out.append("")

# ---- ligações entre tabelas (o que o PostgreSQL vai exigir) ----
c, d = t["candidatura"], t["despesa"]
out.append("=== CHECAGENS DE CHAVE ===")
out.append(f"candidatura -> pessoa: {(~c.titulo_eleitor.isin(t['pessoa'].titulo_eleitor)).sum()} sem pessoa")
out.append(f"candidatura -> partido: {(~c.numero_partido.isin(t['partido'].numero_partido)).sum()} sem partido")
out.append(f"candidatura -> eleicao: {(~c.id_eleicao.isin(t['eleicao'].id_eleicao)).sum()} sem eleição")
out.append(f"despesa -> candidatura: {(~d.id_candidatura.isin(c.id_candidatura)).sum()} sem candidatura")
out.append(f"candidatura.id duplicado: {c.id_candidatura.duplicated().sum()} | pessoa.titulo duplicado: {t['pessoa'].titulo_eleitor.duplicated().sum()}")
out.append(f"partido.numero duplicado: {t['partido'].numero_partido.duplicated().sum()} | vaga.id duplicado: {t['vaga'].id_vaga.duplicated().sum()}")

# ---- nulos por coluna ----
out.append("\n=== VAZIOS POR COLUNA ===")
for n in ["candidatura", "pessoa", "vaga", "despesa"]:
    v = (t[n] == "").sum()
    out.append(f"{n}: " + ", ".join(f"{k}={x}" for k, x in v.items() if x))

# ---- prévia da Q1 por estado (deputado estadual e federal) ----
d["valor"] = pd.to_numeric(d["valor"])
g = d.groupby("id_candidatura").valor.sum().rename("gasto")
x = c.merge(g, left_on="id_candidatura", right_index=True, how="left").fillna({"gasto": 0})
x = x[x.cargo.isin(["DEPUTADO ESTADUAL", "DEPUTADO FEDERAL"])]
gasto = x.groupby(["id_eleicao", "sg_uf", "cargo"]).gasto.sum()
vg = t["vaga"].assign(qt=pd.to_numeric(t["vaga"].qt_vaga)).groupby(["id_eleicao", "sg_uf", "cargo"]).qt.sum()
q1 = pd.concat([gasto, vg], axis=1, join="inner")
q1["custo_por_cadeira"] = (q1.gasto / q1.qt).round(0)
out.append("\n=== PRÉVIA Q1 (custo por cadeira, deputados) ===")
out.append(q1.to_string())

arq = os.path.join(pasta, "amostra_saida_para_claude.txt")
open(arq, "w", encoding="utf-8").write("\n".join(out))
print("Gerado:", arq)