"""Gera os dados do mapa do território (Q3, Q4 e Q6) em site_novo/dados/site/:

  municipios.json      vw_site_municipio (uma linha por município), com o SQL que a gerou
  mapa_brasil.json     contorno dos 27 estados, para o primeiro nível do mapa
  mapa_<UF>.json       contorno dos municípios de cada um dos seis estados

Os contornos vêm da API de malhas do IBGE (qualidade intermediária), projetados num plano (longitude × cos da
latitude central) e simplificados na escala em que o site os desenha (mil unidades de largura). A primeira execução
baixa as malhas para scripts/cache_ibge/; as seguintes reaproveitam o cache.

Roda no WSL chamando o psql.exe do Windows (ver exporta_cadeiras.py). Uso: python3 scripts/exporta_mapa.py
"""
import json, math, pathlib, urllib.request

from exporta_cadeiras import consulta_json

RAIZ = pathlib.Path(__file__).resolve().parents[1]
SAIDA = RAIZ / "dados" / "site"
CACHE = pathlib.Path(__file__).resolve().parent / "cache_ibge"
API = "https://servicodados.ibge.gov.br/api/v3/malhas"
UFS = {"PA": 15, "PB": 25, "AL": 27, "SE": 28, "PR": 41, "SC": 42}
SIGLA = {11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN",
         25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC",
         43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF"}
LARGURA = 1000
TOLERANCIA = 0.9  # pontos a menos de 0,9 unidade do anterior somem: invisível na escala do site

SQL = """SELECT cod_ibge, nome, uf, idhm, pib_per_capita, populacao, faixa_idhm, quartil_pib,
       isentos_2008, abstencao_2008, nulos_2008, brancos_2008, anulada_2008,
       isentos_2012, abstencao_2012, nulos_2012, brancos_2012, anulada_2012, eleitores_pop_2008, eleitores_pop_2012,
       anos_eleitorado_2024, pct_superior_eleitorado_2024, anos_vereadores_2024, pct_superior_vereadores_2024,
       anos_prefeito_2024, anos_dep_federal_2022,
       idade_mediana, indice_envelhecimento, grupo_idade, idade_prefeito_2024, partido_prefeito_2024, id_prefeito_2024, nome_prefeito_2024, idade_vereadores_2024,
       partidos_prefeito, comparacoes, trocas_partido, prefeito_reeleito_2024
FROM vw_site_municipio
ORDER BY uf, nome;"""


def baixa(url, arquivo):
    CACHE.mkdir(exist_ok=True)
    destino = CACHE / arquivo
    if not destino.exists():
        with urllib.request.urlopen(url, timeout=120) as r:
            destino.write_bytes(r.read())
    return json.loads(destino.read_text(encoding="utf-8"))


def aneis(geometria):
    poligonos = [geometria["coordinates"]] if geometria["type"] == "Polygon" else geometria["coordinates"]
    return [anel for poligono in poligonos for anel in poligono]


def projeta(features):
    """Projeção plana com a escala ajustada à largura do desenho; devolve uma função e a altura resultante."""
    pontos = [c for f in features for anel in aneis(f["geometry"]) for c in anel]
    lat0 = math.radians(sum(p[1] for p in pontos) / len(pontos))
    k = math.cos(lat0)
    xs = [p[0] * k for p in pontos]
    ys = [-p[1] for p in pontos]
    escala = LARGURA / (max(xs) - min(xs))
    x0, y0 = min(xs), min(ys)
    altura = (max(ys) - y0) * escala
    return (lambda lon, lat: ((lon * k - x0) * escala, (-lat - y0) * escala)), altura


def caminho(geometria, p):
    partes = []
    for anel in aneis(geometria):
        xy = [p(*c) for c in anel]
        simples = [xy[0]]
        for pt in xy[1:]:
            if abs(pt[0] - simples[-1][0]) + abs(pt[1] - simples[-1][1]) > TOLERANCIA:
                simples.append(pt)
        if len(simples) >= 3:
            partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in simples) + "Z")
    return "".join(partes)


def centro(geometria, p):
    """Centro do maior anel (para o rótulo e para o zoom)."""
    melhor = None
    for anel in aneis(geometria):
        xy = [p(*c) for c in anel]
        area = sum(xy[i][0] * xy[i - 1][1] - xy[i - 1][0] * xy[i][1] for i in range(len(xy))) / 2
        if melhor is None or abs(area) > abs(melhor[0]):
            melhor = (area, sum(x for x, _ in xy) / len(xy), sum(y for _, y in xy) / len(xy))
    return [round(melhor[1], 1), round(melhor[2], 1)]


def grava(nome, dados):
    (SAIDA / nome).write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{nome}: {(SAIDA / nome).stat().st_size / 1024:.0f} KB")


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)

    linhas = consulta_json(SQL)
    colunas = list(linhas[0].keys())
    numero = lambda v: round(v, 3) if isinstance(v, float) else v
    grava("municipios.json", {"sql": SQL, "colunas": colunas, "linhas": [[numero(l[c]) for c in colunas] for l in linhas]})

    brasil = baixa(f"{API}/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF", "brasil_uf.json")
    p, altura = projeta(brasil["features"])
    grava("mapa_brasil.json", {"largura": LARGURA, "altura": round(altura, 1), "areas": [
        {"id": SIGLA[int(f["properties"]["codarea"])], "d": caminho(f["geometry"], p), "c": centro(f["geometry"], p)}
        for f in brasil["features"]]})

    for uf, codigo in UFS.items():
        malha = baixa(f"{API}/estados/{codigo}?formato=application/vnd.geo%2Bjson&qualidade=intermediaria&intrarregiao=municipio",
                      f"municipios_{uf}.json")
        p, altura = projeta(malha["features"])
        grava(f"mapa_{uf}.json", {"largura": LARGURA, "altura": round(altura, 1), "areas": [
            {"id": int(f["properties"]["codarea"]), "d": caminho(f["geometry"], p), "c": centro(f["geometry"], p)}
            for f in malha["features"]]})


if __name__ == "__main__":
    main()
