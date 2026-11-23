"""Exporta vw_site_cadeira para frontend/dados/site/cadeiras_<ano>_<cargo>_<uf>.json (um arquivo por casa e estado).

Roda dentro do npm run grava (em api/); sozinho: python api/exportacao/exporta_cadeiras.py
"""
import json

from conexao import DADOS_SITE, SEM_CASA, consulta_json, ufs

SAIDA = DADOS_SITE / "site"

CASAS = [(2018, "DEPUTADO FEDERAL"), (2018, "DEPUTADO ESTADUAL"), (2022, "DEPUTADO FEDERAL"), (2022, "DEPUTADO ESTADUAL"),
         (2020, "VEREADOR"), (2024, "VEREADOR"), (2026, "DEPUTADO FEDERAL"), (2026, "DEPUTADO ESTADUAL")]

SQL = """SELECT cod_ibge, municipio, id_candidatura, id_pessoa, nome_urna, partido, votos, posicao_votos, vagas,
       quociente, pct_do_quociente, por_legenda, fora_dos_mais_votados
FROM vw_site_cadeira
WHERE ano = {ano} AND cargo = '{cargo}' AND sg_uf = '{uf}'
ORDER BY municipio NULLS FIRST, partido, votos DESC;"""


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    total = 0
    for ano, cargo in CASAS:
        for uf in ufs():
            if (uf, cargo) in SEM_CASA:
                continue
            sql = SQL.format(ano=ano, cargo=cargo, uf=uf)
            linhas = consulta_json(sql)
            # chaves curtas: o arquivo de vereadores de Minas Gerais tem ~8,5 mil cadeiras
            dados = [[l["cod_ibge"], l["municipio"], l["id_candidatura"], l["id_pessoa"], l["nome_urna"], l["partido"], l["votos"],
                      l["posicao_votos"], l["vagas"], l["quociente"], float(l["pct_do_quociente"]), l["por_legenda"],
                      l["fora_dos_mais_votados"]] for l in linhas]
            nome = f"cadeiras_{ano}_{cargo.replace(' ', '_')}_{uf}.json"
            (SAIDA / nome).write_text(json.dumps({
                "sql": sql,
                "colunas": ["cod_ibge", "municipio", "id_candidatura", "id_pessoa", "nome_urna", "partido", "votos", "posicao_votos",
                            "vagas", "quociente", "pct_do_quociente", "por_legenda", "fora_dos_mais_votados"],
                "linhas": dados}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            total += len(dados)
            print(f"{nome}: {len(dados)} cadeiras")
    print(f"total: {total} cadeiras")


if __name__ == "__main__":
    main()
