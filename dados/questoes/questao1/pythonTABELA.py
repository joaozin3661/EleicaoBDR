import pandas as pd, glob

base = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1"  # ajuste o caminho
ufs = ["AL","PA","PB","PR","SC","SE"]

def ler(ano):
    dfs = []
    for uf in ufs:
        f = f"{base}\\consulta_cand_{ano}\\consulta_cand_{ano}_{uf}.csv"
        dfs.append(pd.read_csv(f, sep=";", encoding="latin1", dtype=str,
                               usecols=["SQ_CANDIDATO","NR_TURNO","DS_CARGO"]))
    return pd.concat(dfs)

a18, a22 = ler(2018), ler(2022)
s18, s22 = set(a18.SQ_CANDIDATO), set(a22.SQ_CANDIDATO)

print("candidatos 2018:", len(s18), "| 2022:", len(s22))
print("SQ_CANDIDATO em comum:", len(s18 & s22))
print("repetidos dentro de 2018 (por turno):", a18.duplicated(["SQ_CANDIDATO","NR_TURNO"]).sum())
print("repetidos dentro de 2022 (por turno):", a22.duplicated(["SQ_CANDIDATO","NR_TURNO"]).sum())