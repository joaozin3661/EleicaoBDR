"""Exporta o que a carreira da Q10 mostra de cada candidatura (vw_site_carreira) para os políticos da busca.

Grava dados/site/carreira/<id_pessoa % 32>.json (em 32 pedaços de ~50 KB, para a página não baixar tudo):
  {"colunas": [...], "pessoas": {id_pessoa: [[ano, cargo, local, grau, ocupacao, votos, gasto, receita,
                                              receita_publica, patrimonio], ...]}}
O site liga cada linha à candidatura da carreira por (ano, cargo, local), que vw_q10_base deixa únicos por pessoa.
Gasto, receita e patrimônio são nulos antes de 2018 (o banco não tem prestação de contas desses anos).

Uso: python3 scripts/exporta_carreira.py
"""
import json, pathlib

from exporta_cadeiras import consulta_json

RAIZ = pathlib.Path(__file__).resolve().parents[1]
SITE = RAIZ / "dados" / "site" / "carreira"
PEDACOS = 32
COLUNAS = ["ano", "cargo", "local", "grau_instrucao", "ocupacao", "votos", "gasto", "receita", "receita_publica", "patrimonio"]


def main():
    indice = json.loads((RAIZ / "dados" / "q10_indice.json").read_text(encoding="utf-8"))["indice"]
    pessoas = sorted({i["achado"]["id_pessoa"] for i in indice})
    linhas = consulta_json(
        f"SELECT id_pessoa, {', '.join(COLUNAS)} FROM vw_site_carreira WHERE id_pessoa IN ({','.join(map(str, pessoas))}) ORDER BY id_pessoa, ano, id_candidatura")
    saida = [{} for _ in range(PEDACOS)]
    for l in linhas:
        valores = [round(float(l[c]), 2) if c in ("gasto", "receita", "receita_publica", "patrimonio") and l[c] is not None else l[c] for c in COLUNAS]
        saida[l["id_pessoa"] % PEDACOS].setdefault(str(l["id_pessoa"]), []).append(valores)
    SITE.mkdir(parents=True, exist_ok=True)
    for n, pedaco in enumerate(saida):
        (SITE / f"{n}.json").write_text(json.dumps({"colunas": COLUNAS, "pessoas": pedaco}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"pessoas: {sum(map(len, saida))} de {len(pessoas)}; candidaturas: {len(linhas)}")


if __name__ == "__main__":
    main()
