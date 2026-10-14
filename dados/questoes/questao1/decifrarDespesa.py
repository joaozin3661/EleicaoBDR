import pandas as pd
p = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1\saida_carga_2018_2022\despesa.csv"
d = pd.read_csv(p, dtype=str, keep_default_na=False)
d["valor"] = pd.to_numeric(d["valor"])

dup = d[d.duplicated("id_despesa", keep=False)]
print("linhas com id repetido:", len(dup), "| ids distintos:", dup.id_despesa.nunique())
print("linhas idênticas em tudo (extras):", d.duplicated(keep="first").sum())
print("valor total das linhas idênticas extras:", d[d.duplicated(keep="first")].valor.sum())

g = dup.groupby("id_despesa").agg(n=("valor", "size"),
                                  candidatos=("id_candidatura", "nunique"),
                                  valores=("valor", "nunique"))
print("\nids repetidos com candidatos diferentes:", (g.candidatos > 1).sum())
print("ids repetidos com valores diferentes:", (g.valores > 1).sum())
print("\nexemplos:")
print(dup.sort_values("id_despesa").head(12).to_string())
print("\nvalor total geral:", d.valor.sum())