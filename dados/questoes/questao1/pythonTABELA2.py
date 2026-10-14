import pandas as pd, itertools

base = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1"
ufs = ["AL", "PA", "PB", "PR", "SC", "SE"]

def ler(ano):
    dfs = []
    for uf in ufs:
        f = f"{base}\\consulta_cand_{ano}\\consulta_cand_{ano}_{uf}.csv"
        dfs.append(pd.read_csv(f, sep=";", encoding="latin1", dtype=str,
                               usecols=["SQ_CANDIDATO", "NR_TURNO", "DS_CARGO"]))
    return pd.concat(dfs)

dados = {a: ler(a) for a in [2018, 2020, 2022, 2024]}
anos = {a: set(d.SQ_CANDIDATO) for a, d in dados.items()}

for a, d in dados.items():
    print(a, "candidatos:", len(anos[a]),
          "| repetidos no ano (por turno):", d.duplicated(["SQ_CANDIDATO", "NR_TURNO"]).sum())

print()
for x, y in itertools.combinations(anos, 2):
    print(x, y, "em comum:", len(anos[x] & anos[y]))