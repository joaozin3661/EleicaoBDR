# -*- coding: utf-8 -*-
"""
Gera dois arquivos para revisar a resolução de identidade feita pela carga_v2.py:
  revisao_separados.csv  -> títulos que ficaram com mais de uma pessoa (TSE repetiu o título em pessoas diferentes)
  revisao_unidos.csv     -> pessoas que juntaram mais de um título (mesma pessoa com títulos diferentes)
Abra no Excel e confira por amostragem. Rodar depois da carga_v2.py.
"""
import os

import pandas as pd

SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saida")
c = pd.read_csv(os.path.join(SAIDA, "candidatura.csv"), dtype=str, keep_default_na=False)
p = pd.read_csv(os.path.join(SAIDA, "pessoa.csv"), dtype=str, keep_default_na=False)
m = pd.read_csv(os.path.join(SAIDA, "municipio.csv"), dtype=str, keep_default_na=False)
c = c.merge(p[["id_pessoa", "nome", "data_nascimento"]], on="id_pessoa") \
     .merge(m[["cod_ibge", "nome"]].rename(columns={"nome": "municipio"}), on="cod_ibge", how="left")
cols = ["id_pessoa", "nome", "data_nascimento", "id_eleicao", "sg_uf", "municipio", "cargo", "sigla_partido",
        "titulo_declarado", "cpf_declarado", "situacao_resultado"]

com_tit = c[c.titulo_declarado != ""]
n_pessoas = com_tit.groupby("titulo_declarado").id_pessoa.nunique()
sep = com_tit[com_tit.titulo_declarado.isin(n_pessoas[n_pessoas > 1].index)]
sep.sort_values(["titulo_declarado", "id_eleicao"])[["titulo_declarado"] + cols].to_csv(
    os.path.join(SAIDA, "revisao_separados.csv"), index=False, encoding="utf-8-sig", sep=";")

n_tit = com_tit.groupby("id_pessoa").titulo_declarado.nunique()
uni = c[c.id_pessoa.isin(n_tit[n_tit > 1].index)]
uni.sort_values(["id_pessoa", "id_eleicao"])[cols].to_csv(
    os.path.join(SAIDA, "revisao_unidos.csv"), index=False, encoding="utf-8-sig", sep=";")

print(f"títulos separados em mais de uma pessoa: {sep.titulo_declarado.nunique():,} ({len(sep):,} candidaturas)")
print(f"pessoas com mais de um título: {uni.id_pessoa.nunique():,} ({len(uni):,} candidaturas)")
print("arquivos: revisao_separados.csv e revisao_unidos.csv em", SAIDA)
