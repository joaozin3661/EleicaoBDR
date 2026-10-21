# -*- coding: utf-8 -*-
"""
Carga da idade mediana e do índice de envelhecimento dos municípios (Q6) — gera saida\\indicador_idade.csv.

Fonte: IBGE, Censo 2022, SIDRA tabela 9515 (idade mediana e índice de envelhecimento por município).
Só existe para 2022; classifica o município de forma estrutural, não acompanha a mudança entre os pleitos.
Fica só com os 1.238 municípios do projeto (saida\\municipio.csv).

Rodar depois do carga_v2.py e antes do importar_idade.py.
"""
import os

import pandas as pd

PASTA = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(PASTA, "saida")
ARQ = os.path.join(os.path.dirname(os.path.dirname(PASTA)), "ibge", "censo2022", "idade_mediana_envelhecimento_tabela9515.csv")
VARIAVEL_IDADE = "10613"          # Idade mediana (anos)
VARIAVEL_ENVELHECIMENTO = "10612"  # Índice de envelhecimento (idosos para cada 100 jovens)

mun = pd.read_csv(os.path.join(SAIDA, "municipio.csv"), dtype=str)
validos = set(mun["cod_ibge"])

d = pd.read_csv(ARQ, sep=";", dtype=str, encoding="utf-8", keep_default_na=False)
d.columns = [c.strip() for c in d.columns]
col_mun, col_var, col_val, col_ano = "Município (Código)", "Variável (Código)", "Valor", "Ano (Código)"
d = d[d[col_mun].isin(validos)]
print(f"linhas do IBGE nos {len(validos):,} municípios do projeto: {len(d):,} | anos: {sorted(d[col_ano].unique())}")


def pega(cod_var):
    x = d[d[col_var] == cod_var]
    return pd.to_numeric(x[col_val], errors="coerce").groupby(x[col_mun].values).first()


idade = pega(VARIAVEL_IDADE)
env = pega(VARIAVEL_ENVELHECIMENTO)
out = pd.DataFrame({"cod_ibge": sorted(validos)})
out["ano"] = 2022
out["idade_mediana"] = out["cod_ibge"].map(idade)
out["indice_envelhecimento"] = out["cod_ibge"].map(env)
faltam = out[out["idade_mediana"].isna() | out["indice_envelhecimento"].isna()]
print(f"municípios com idade mediana: {out['idade_mediana'].notna().sum():,} | com índice de envelhecimento: {out['indice_envelhecimento'].notna().sum():,} | faltando: {len(faltam)}")
assert len(faltam) == 0, f"municípios sem dado: {faltam['cod_ibge'].tolist()[:10]}"
assert out["idade_mediana"].between(15, 60).all(), "idade mediana fora do esperado"
out.to_csv(os.path.join(SAIDA, "indicador_idade.csv"), index=False, encoding="utf-8")
print(f"  -> indicador_idade.csv: {len(out):,} linhas")

print("\ndistribuição da idade mediana (anos):", out["idade_mediana"].describe().round(1).to_dict())
print("anos distintos:", out["idade_mediana"].nunique(), "| quartis:", out["idade_mediana"].quantile([.25, .5, .75]).to_dict())
print("índice de envelhecimento:", out["indice_envelhecimento"].describe().round(1).to_dict())
print("correlação entre os dois:", round(out["idade_mediana"].corr(out["indice_envelhecimento"]), 3))
print("\nmais jovens:\n", out.merge(mun[["cod_ibge", "nome", "uf"]], on="cod_ibge").nsmallest(3, "idade_mediana")[["nome", "uf", "idade_mediana", "indice_envelhecimento"]].to_string(index=False))
print("mais envelhecidos:\n", out.merge(mun[["cod_ibge", "nome", "uf"]], on="cod_ibge").nlargest(3, "idade_mediana")[["nome", "uf", "idade_mediana", "indice_envelhecimento"]].to_string(index=False))
print("\nPRONTO. Agora rode importar_idade.py")
