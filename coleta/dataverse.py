"""Classificação ideológica dos partidos brasileiros (Harvard Dataverse).

Bolognesi, Codato, Ribeiro & Silva, "Database on the ideological classification
of all Brazilian political parties (2018-2022)", doi:10.7910/DVN/MFIXKW. É a base
do survey com especialistas publicado em Bolognesi, Ribeiro & Codato (2023),
"Uma nova classificação ideológica dos partidos políticos brasileiros", Dados 66(2).
"""
from pathlib import Path

from .rede import baixar, obter_json

API = "https://dataverse.harvard.edu/api"
DOI = "doi:10.7910/DVN/MFIXKW"


def coletar(cli, chave: str, raiz: Path) -> list[Path]:
    meta = obter_json(cli, f"{API}/datasets/:persistentId/", {"persistentId": DOI})
    baixados = []
    for arquivo in meta["data"]["latestVersion"]["files"]:
        dados = arquivo["dataFile"]
        nome = dados.get("originalFileName") or dados["filename"]
        url = f"{API}/access/datafile/{dados['id']}"
        if dados.get("originalFileFormat"):
            url += "?format=original"  # arquivo tabular convertido pelo Dataverse: pega o original
        destino = raiz / "ideologia_partidos" / nome
        baixar(cli, url, destino, rotulo=nome)
        print(f"    {nome}", flush=True)
        baixados.append(destino)
    return baixados
