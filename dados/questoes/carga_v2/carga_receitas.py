# -*- coding: utf-8 -*-
"""
Carga das receitas de campanha (Q8) — gera saida\\receita.csv.

Lê receitas_candidatos_AAAA_BRASIL.csv de 2018 a 2024 (pasta do crawler), em pedaços (os arquivos têm até 1,5 GB),
fica com as 6 UFs e com as receitas das candidaturas que já estão no banco (saida\\candidatura.csv).
Receitas de eleições suplementares não se ligam e ficam de fora, como nos bens e nas despesas.

Mapeamento (os nomes dos campos do TSE são confusos, o que importa é o significado):
  origem_recurso <- DS_FONTE_RECEITA   FUNDO ESPECIAL (FEFC) | FUNDO PARTIDARIO | OUTROS RECURSOS   -> público x privado
  tipo_doador    <- DS_ORIGEM_RECEITA  pessoa física, partido, outros candidatos, recursos próprios, financiamento coletivo...
  natureza       <- DS_NATUREZA_RECEITA  FINANCEIRO | ESTIMÁVEL (doação em bens ou serviços)

Rodar depois do carga_v2.py e antes do importar_receitas.py. Leva alguns minutos.
"""
import os

import pandas as pd

# ----------------------------------------------------------------------
# CONFIGURAÇÃO
# ----------------------------------------------------------------------
PASTA = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(PASTA, "saida")
RECEITAS = os.path.join(os.path.dirname(os.path.dirname(PASTA)), "tse", "receitas_candidatos")  # dados\tse\receitas_candidatos
ANOS = [2018, 2020, 2022, 2024]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
NULOS = {"", "#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4"}
CHUNK = 400_000
COLUNAS = ["SG_UF", "SQ_CANDIDATO", "DS_FONTE_RECEITA", "DS_ORIGEM_RECEITA", "DS_NATUREZA_RECEITA", "NM_DOADOR",
           "SQ_RECEITA", "DT_RECEITA", "VR_RECEITA"]
print("=== carga_receitas | anos:", ANOS, "===")


def limpa(s):
    s = s.str.strip()
    return s.where(~s.isin(NULOS), "")


def para_valor(s):
    return pd.to_numeric(s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False), errors="coerce")


def para_data(s):
    return pd.to_datetime(s, format="%d/%m/%Y", errors="coerce").dt.strftime("%Y-%m-%d")


cand = pd.read_csv(os.path.join(SAIDA, "candidatura.csv"), dtype=str, keep_default_na=False, usecols=["id_candidatura", "id_eleicao"])
validos = set(cand.loc[cand.id_eleicao.astype(int) >= 2018, "id_candidatura"])

saida = os.path.join(SAIDA, "receita.csv")
if os.path.exists(saida):
    os.remove(saida)
primeiro = True
total = 0
resumo = []
for ano in ANOS:
    arq = os.path.join(RECEITAS, str(ano), f"receitas_candidatos_{ano}_BRASIL.csv")
    seq = 0
    lidas = sem_receita = fora = 0
    por_fonte = {}
    for ch in pd.read_csv(arq, sep=";", encoding="latin1", dtype=str, keep_default_na=False, usecols=lambda c: c in COLUNAS, chunksize=CHUNK):
        faltam = [c for c in COLUNAS if c not in ch.columns]
        assert not faltam, f"{ano}: colunas ausentes {faltam}"
        ch = ch[ch["SG_UF"].isin(UFS)]
        lidas += len(ch)
        vazio = ch["SQ_RECEITA"].str.strip() == "-1"          # candidato que não declarou receita: linha vazia do TSE
        sem_receita += int(vazio.sum())
        ch = ch[~vazio]
        ok = ch["SQ_CANDIDATO"].isin(validos)
        fora += int((~ok).sum())
        ch = ch[ok]
        valor = para_valor(ch["VR_RECEITA"])
        assert valor.notna().all(), f"{ano}: valor de receita vazio"
        assert (valor >= 0).all(), f"{ano}: valor de receita negativo"
        out = pd.DataFrame({
            "id_receita": ano * 1_000_000_000 + seq + 1 + pd.RangeIndex(len(ch)),
            "sq_receita": ch["SQ_RECEITA"].astype("int64").values,
            "id_candidatura": ch["SQ_CANDIDATO"].astype("int64").values,
            "origem_recurso": limpa(ch["DS_FONTE_RECEITA"]).values,
            "tipo_doador": limpa(ch["DS_ORIGEM_RECEITA"]).values,
            "natureza": limpa(ch["DS_NATUREZA_RECEITA"]).values,
            "nome_doador": limpa(ch["NM_DOADOR"]).values,
            "valor": valor.values,
            "data_receita": para_data(ch["DT_RECEITA"]).values,
        })
        seq += len(out)
        out.to_csv(saida, mode="a", header=primeiro, index=False, encoding="utf-8")
        primeiro = False
        total += len(out)
        for f, v in out.groupby(out["origem_recurso"].replace("", "(sem fonte)"))["valor"].sum().items():
            por_fonte[f] = por_fonte.get(f, 0) + float(v)
    print(f"  {ano}: {lidas:,} linhas nas 6 UFs | sem receita (-1): {sem_receita:,} | fora do modelo (suplementares): {fora:,} | gravadas: {seq:,}")
    print("       R$ por fonte (mi):", {k: round(v / 1e6, 1) for k, v in sorted(por_fonte.items())})
    resumo.append((ano, seq, sum(por_fonte.values())))

print(f"\n  -> receita.csv: {total:,} linhas | R$ {sum(r[2] for r in resumo)/1e9:.2f} bi")
rec = pd.read_csv(saida, dtype={"nome_doador": str}, keep_default_na=False)
assert rec["id_receita"].is_unique, "id_receita repetido"
print("  tipo_doador (R$ mi):", (rec.groupby(rec.tipo_doador.replace("", "(sem)")).valor.sum() / 1e6).round(1).sort_values(ascending=False).to_dict())
print("  natureza (R$ mi):", (rec.groupby(rec.natureza.replace("", "(sem)")).valor.sum() / 1e6).round(1).to_dict())
print("  maiores campos: origem", rec.origem_recurso.str.len().max(), "| tipo", rec.tipo_doador.str.len().max(), "| doador", rec.nome_doador.astype(str).str.len().max())
print("  candidaturas com alguma receita:", rec.id_candidatura.nunique(), "| linhas sem fonte:", int((rec.origem_recurso == "").sum()))
print("\nPRONTO. Agora rode importar_receitas.py")
