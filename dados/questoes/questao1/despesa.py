import pandas as pd
base = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1"
dfs = [pd.read_csv(f"{base}\\prestacao{a}\\despesas_contratadas_candidatos_{a}_SE.csv",
                   sep=";", encoding="latin1", dtype=str, keep_default_na=False)
       for a in (2018, 2022)]
d = pd.concat(dfs)
d = d[d.SQ_DESPESA != "-1"]

rep = d[d.duplicated("SQ_DESPESA", keep=False)]
print("linhas:", len(d), "| linhas com SQ_DESPESA repetido:", len(rep),
      "| ids repetidos:", rep.SQ_DESPESA.nunique())

print("\nquantos ids repetidos têm valores DIFERENTES em cada coluna:")
dif = rep.groupby("SQ_DESPESA").nunique()
print((dif > 1).sum().loc[lambda s: s > 0].sort_values(ascending=False).to_string())

print("\nTP_PRESTACAO_CONTAS:\n", d.TP_PRESTACAO_CONTAS.value_counts().to_string())
cols = ["SQ_DESPESA","SQ_CANDIDATO","TP_PRESTACAO_CONTAS","ST_TURNO","DT_PRESTACAO_CONTAS",
        "NR_DOCUMENTO","DS_ORIGEM_DESPESA","NM_FORNECEDOR","DT_DESPESA","VR_DESPESA_CONTRATADA"]
print("\nexemplos:")
print(rep.sort_values("SQ_DESPESA")[cols].head(12).to_string(index=False))