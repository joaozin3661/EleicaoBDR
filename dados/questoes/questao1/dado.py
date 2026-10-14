import pandas as pd, os

BASE = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao1"
UF = "PR"
ANOS = [2018, 2020, 2022, 2024]
N = 3   # linhas por arquivo

def ler_tse(p, n=N):
    return pd.read_csv(p, sep=";", encoding="latin1", dtype=str,
                       keep_default_na=False, nrows=n)

blocos = []

def mostra(titulo, df):
    blocos.append("=" * 70)
    blocos.append(f"{titulo} | {len(df.columns)} colunas")
    blocos.append("=" * 70)
    for i, row in df.iterrows():
        blocos.append(f"--- linha {i + 1} ---")
        for col, val in row.items():
            blocos.append(f"  {col}: {val}")
    blocos.append("")

for ano in ANOS:
    mostra(f"consulta_cand_{ano}_{UF}",
           ler_tse(f"{BASE}\\consulta_cand_{ano}\\consulta_cand_{ano}_{UF}.csv"))
    mostra(f"despesas_contratadas_{ano}_{UF}",
           ler_tse(f"{BASE}\\prestacao{ano}\\despesas_contratadas_candidatos_{ano}_{UF}.csv"))
    mostra(f"consulta_vagas_{ano}_BRASIL",
           ler_tse(f"{BASE}\\vagas\\{ano}\\consulta_vagas_{ano}_BRASIL.csv"))

mostra("municipio_tse_ibge",
       ler_tse(f"{BASE}\\municipio_tse_ibge\\municipio_tse_ibge.csv"))

# valores distintos dos campos que definem "quem ganhou" e o cargo
for ano in ANOS:
    d = pd.read_csv(f"{BASE}\\consulta_cand_{ano}\\consulta_cand_{ano}_{UF}.csv",
                    sep=";", encoding="latin1", dtype=str, keep_default_na=False,
                    usecols=["DS_CARGO", "DS_SIT_TOT_TURNO", "NR_TURNO"])
    blocos.append(f"=== DISTINCT {ano} {UF} ===")
    blocos.append("DS_CARGO:\n" + d.DS_CARGO.value_counts().to_string())
    blocos.append("DS_SIT_TOT_TURNO:\n" + d.DS_SIT_TOT_TURNO.value_counts().to_string())
    blocos.append("NR_TURNO:\n" + d.NR_TURNO.value_counts().to_string())
    blocos.append("")

# CPF e título preenchidos?
for ano in ANOS:
    d = ler_tse(f"{BASE}\\consulta_cand_{ano}\\consulta_cand_{ano}_{UF}.csv", n=2000)
    for c in ["NR_CPF_CANDIDATO", "NR_TITULO_ELEITORAL_CANDIDATO"]:
        if c in d.columns:
            ok = d[c].str.replace(r"\D", "", regex=True).str.len().ge(10).mean()
            blocos.append(f"CHECK {ano} {c}: {ok:.0%} preenchido (2000 primeiras linhas)")

saida = os.path.join(BASE, "amostra_para_claude.txt")
with open(saida, "w", encoding="utf-8") as f:
    f.write("\n".join(blocos))
print("Gerado:", saida)