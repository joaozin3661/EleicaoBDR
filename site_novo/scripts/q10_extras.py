"""Acrescenta à busca da Q10 políticos que ficaram fora da lista exportada pelo site_eleicoes.

A versão estática do site_eleicoes grava em dados/q10_indice.json só as ~2.500 pessoas com mais candidaturas, e a
carreira de cada uma em dados/<shard>.json (resposta de /api/q10/pessoa/<id>). Quem disputou poucas eleições, como
Sergio Moro (uma candidatura), não aparece na busca. Este script lê as mesmas views (vw_q10_busca, mv_q10_nomes,
vw_q10_carreira) e grava essas pessoas no índice e nos shards, no mesmo formato.

Rode de novo depois de recopiar os dados do site_eleicoes, e depois rode exporta_carreira.py e exporta_fotos.py
(+ node scripts/miniaturas/gera.js) para a escolaridade, o dinheiro e as fotos delas.

Uso: python3 scripts/q10_extras.py
"""
import json, pathlib

from exporta_cadeiras import consulta_json

RAIZ = pathlib.Path(__file__).resolve().parents[1]
DADOS = RAIZ / "dados"
EXTRAS = {
    311426: "Sergio Moro",
    841: "Fernando Collor",
}
SQL_CARREIRA = """SELECT ano, cargo, local, partido, resultado, evento, troca_partido, mudanca_cargo, detalhe_resultado
FROM vw_q10_carreira
WHERE id_pessoa = {id}
ORDER BY ano;

SELECT nome FROM mv_q10_nomes WHERE id_pessoa = {id} ORDER BY nome;"""


def shard(chave):
    """O mesmo hash de site_eleicoes/src/chave.ts e de dados.js."""
    h = 5381
    for c in chave:
        h = ((h * 33) ^ ord(c)) & 0xFFFFFFFF
    return f"{h % 256:02x}"


def main():
    arq = DADOS / "q10_indice.json"
    indice = json.loads(arq.read_text(encoding="utf-8"))
    ja = {i["achado"]["id_pessoa"] for i in indice["indice"]}
    ids = ",".join(map(str, EXTRAS))
    achados = {r["id_pessoa"]: r for r in consulta_json(
        f"SELECT id_pessoa, nome, data_nascimento, candidaturas, primeira, ultima, vitorias, cargos FROM vw_q10_busca WHERE id_pessoa IN ({ids})")}
    nomes = consulta_json(f"SELECT id_pessoa, nome, nome_busca FROM mv_q10_nomes WHERE id_pessoa IN ({ids}) ORDER BY nome")
    for id_, rotulo in EXTRAS.items():
        if id_ not in achados:
            print(f"{rotulo} ({id_}): não está em vw_q10_busca")
            continue
        if id_ not in ja:
            indice["indice"].append({"achado": achados[id_], "nomes": [n["nome_busca"] for n in nomes if n["id_pessoa"] == id_]})

        chave = f"/api/q10/pessoa/{id_}"
        carreira = consulta_json(
            f"SELECT ano, cargo, local, partido, resultado, evento, troca_partido, mudanca_cargo, detalhe_resultado FROM vw_q10_carreira WHERE id_pessoa = {id_} ORDER BY ano")
        f = DADOS / f"{shard(chave)}.json"
        bloco = json.loads(f.read_text(encoding="utf-8"))
        bloco[chave] = {"sql": SQL_CARREIRA.format(id=id_),
                        "dados": {"nomes": [n["nome"] for n in nomes if n["id_pessoa"] == id_], "carreira": carreira}}
        f.write_text(json.dumps(bloco, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{rotulo} ({id_}): {len(carreira)} candidaturas{'' if id_ in ja else ', acrescentado ao índice'}")
    arq.write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
