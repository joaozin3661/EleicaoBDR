# -*- coding: utf-8 -*-
"""
Baixa do IBGE (API SIDRA) os dois dados de 2010 que a Q3 precisa e que o crawler não trouxe:
  - PIB dos municípios a preços correntes, 2010 (tabela 5938, variável 37, mil reais)
  - População residente, Censo 2010 (tabela 202, variável 93, total)
e grava no mesmo formato dos outros arquivos do IBGE do projeto:
  dados\\ibge\\pib\\pib_municipios_2010_tabela5938.csv
  dados\\ibge\\populacao\\censo2010_populacao_tabela202.csv

Só precisa rodar uma vez (ou de novo, para atualizar). Requer internet.
"""
import csv
import json
import os
import urllib.request

PASTA = os.path.dirname(os.path.abspath(__file__))
IBGE = os.path.join(os.path.dirname(os.path.dirname(PASTA)), "ibge")
CAMPOS = ["Nível Territorial (Código)", "Nível Territorial", "Unidade de Medida (Código)", "Unidade de Medida", "Valor",
          "Município (Código)", "Município", "Variável (Código)", "Variável", "Ano (Código)", "Ano"]
CHAVES = ["NC", "NN", "MC", "MN", "V", "D1C", "D1N", "D2C", "D2N", "D3C", "D3N"]


def baixa(url, destino, esperado_min):
    print("buscando", url)
    with urllib.request.urlopen(url, timeout=120) as r:
        dados = json.load(r)
    linhas = dados[1:]  # a 1ª linha é o cabeçalho
    assert len(linhas) >= esperado_min, f"só {len(linhas)} linhas"
    validos = [x for x in linhas if str(x["V"]).strip() not in ("", "-", "...", "X")]
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(CAMPOS)
        for x in validos:
            w.writerow([x[c] for c in CHAVES])
    print(f"  -> {destino}: {len(validos):,} municípios com valor (de {len(linhas):,})")


baixa("https://apisidra.ibge.gov.br/values/t/5938/n6/all/v/37/p/2010",
      os.path.join(IBGE, "pib", "pib_municipios_2010_tabela5938.csv"), 5000)
baixa("https://apisidra.ibge.gov.br/values/t/202/n6/all/v/93/p/2010/c1/0/c2/0",
      os.path.join(IBGE, "populacao", "censo2010_populacao_tabela202.csv"), 5000)
print("PRONTO")
