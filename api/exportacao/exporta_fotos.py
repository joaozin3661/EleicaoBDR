"""Decide quais fotos de candidatos o site usa e prepara os índices delas.

As fotos originais ficam em dados/tse/fotos_candidatos (fora do git, 584 mil arquivos); o índice
dados/tse/fotos_candidatos/indice.csv liga cada foto ao id_candidatura de 2018 em diante. O site usa miniaturas
WebP próprias em frontend/fotos/<id_candidatura>.webp, geradas por miniaturas/gera.js a partir da lista
que este script grava.

Fotos usadas:
  - os eleitos do hemiciclo (dados/site/cadeiras_*.json, vw_site_cadeira);
  - (vale como foto o original no índice ou a miniatura que já existe em frontend/fotos)
  - o prefeito eleito em 2024 de cada município (dados/site/municipios.json, vw_site_municipio);
  - as candidaturas de 2018 em diante dos políticos da busca da Q10 (vw_site_candidatura_foto);
  - os eleitos com menos votos e os mais votados de fora das listas da Q5 (mv_q5_eleito, mv_q5_barrado).

Grava:
  frontend/dados/site/fotos_pessoa.json   id_pessoa -> [[ano, id_candidatura, cargo], ...]   (Q10)
  frontend/dados/site/fotos_q5.json       "ano|cargo|uf|nome_urna|partido|votos" -> id      (listas da Q5 nas consultas)
  api/exportacao/miniaturas/lista.json    [[id_candidatura, caminho da foto original], ...]

Uso: npm run fotos (em api/), que roda este script e depois o miniaturas/gera.js. Precisa das fotos originais
(python coleta/baixar_fotos.py) e de rodar depois do npm run grava.
"""
import csv, json, pathlib

from conexao import DADOS_SITE, RAIZ, consulta_json, ufs

SITE = DADOS_SITE / "site"
FOTOS = RAIZ / "dados" / "tse" / "fotos_candidatos"
MINIATURAS = RAIZ / "frontend" / "fotos"
PARES_Q5 = [(2018, "DEPUTADO FEDERAL"), (2018, "DEPUTADO ESTADUAL"), (2020, "VEREADOR"), (2022, "DEPUTADO FEDERAL"),
            (2022, "DEPUTADO ESTADUAL"), (2024, "VEREADOR"), (2026, "DEPUTADO FEDERAL"), (2026, "DEPUTADO ESTADUAL")]


def main():
    arquivo = {}
    with open(FOTOS / "indice.csv", encoding="utf-8", newline="") as f:
        for linha in csv.DictReader(f):
            if linha["id_candidatura"]:
                arquivo[int(linha["id_candidatura"])] = linha["arquivo"]
    # a miniatura já gerada também conta como foto: o original pode não estar mais nesta máquina (o nome é o
    # id_candidatura, que não muda entre cargas, ao contrário do id_pessoa)
    ja_tem = {int(p.stem) for p in MINIATURAS.glob("*.webp") if p.stem.isdigit()}

    def tem_foto(i):
        return i in arquivo or i in ja_tem

    ids = set()
    for f in SITE.glob("cadeiras_*.json"):
        ids.update(l[2] for l in json.loads(f.read_text(encoding="utf-8"))["linhas"])
    eleitos = len(ids)

    mun = json.loads((SITE / "municipios.json").read_text(encoding="utf-8"))
    col = mun["colunas"].index("id_prefeito_2024")
    ids.update(l[col] for l in mun["linhas"] if l[col])

    indice = json.loads((SITE.parent / "q10_indice.json").read_text(encoding="utf-8"))["indice"]
    pessoas = sorted({i["achado"]["id_pessoa"] for i in indice})
    linhas = consulta_json(
        f"SELECT id_pessoa, ano, id_candidatura, cargo FROM vw_site_candidatura_foto WHERE id_pessoa IN ({','.join(map(str, pessoas))}) ORDER BY id_pessoa, ano")
    por_pessoa = {}
    for l in linhas:
        if tem_foto(l["id_candidatura"]):
            por_pessoa.setdefault(str(l["id_pessoa"]), []).append([l["ano"], l["id_candidatura"], l["cargo"]])
            ids.add(l["id_candidatura"])
    (SITE / "fotos_pessoa.json").write_text(json.dumps(por_pessoa, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    q5 = {}
    for ano, cargo in PARES_Q5:
        for uf in ["TODAS", *ufs()]:
            filtro = "" if uf == "TODAS" else f"AND sg_uf = '{uf}'"
            for sql in (
                f"SELECT id_candidatura, nome_urna, partido, sg_uf, votos FROM mv_q5_eleito WHERE ano = {ano} AND cargo = '{cargo}' {filtro} ORDER BY pct_do_quociente, votos, nome_urna LIMIT 10",
                f"SELECT id_candidatura, nome_urna, partido, sg_uf, votos FROM mv_q5_barrado WHERE ano = {ano} AND cargo = '{cargo}' {filtro} ORDER BY votos DESC, nome_urna LIMIT 10",
            ):
                for l in consulta_json(sql):
                    q5[f"{ano}|{cargo}|{l['sg_uf']}|{l['nome_urna']}|{l['partido']}|{l['votos']}"] = l["id_candidatura"]
                    ids.add(l["id_candidatura"])
    (SITE / "fotos_q5.json").write_text(json.dumps(q5, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    lista = sorted([i, str(FOTOS / arquivo[i])] for i in ids if i in arquivo)
    sem = sorted(i for i in ids if not tem_foto(i))
    (pathlib.Path(__file__).parent / "miniaturas" / "lista.json").write_text(json.dumps(lista), encoding="utf-8")
    print(f"eleitos do hemiciclo: {eleitos}; pessoas da Q10 com foto: {len(por_pessoa)} de {len(pessoas)}; chaves da Q5: {len(q5)}")
    print(f"fotos a gerar: {len(lista)}; ids sem foto no índice: {len(sem)}")


if __name__ == "__main__":
    main()
