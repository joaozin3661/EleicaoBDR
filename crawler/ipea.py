"""IDHM do Atlas do Desenvolvimento Humano no Brasil (PNUD/Ipea/FJP), via API do Ipeadata.

O arquivo de "dados brutos" do site do Atlas saiu do ar; o Ipeadata publica as
mesmas séries do Atlas por município, identificadas pelo código IBGE de 7
dígitos. O IDHM municipal é censitário (1991, 2000, 2010); se o Atlas publicar
uma edição nova, ela entra aqui sem mudança de código.
"""
from pathlib import Path

from .rede import obter_json
from .saida import gravar_csv

API = "http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{codigo}')"
SERIES = {
    "ADH_IDHM": "idhm",
    "ADH_IDHM_E": "idhm_educacao",
    "ADH_IDHM_L": "idhm_longevidade",
    "ADH_IDHM_R": "idhm_renda",
}


def coletar(cli, chave: str, raiz: Path) -> list[Path]:
    valores: dict[tuple[str, str], dict[str, float]] = {}
    for codigo, coluna in SERIES.items():
        url, n = API.format(codigo=codigo), 0
        while url:
            resposta = obter_json(cli, url)
            for v in resposta["value"]:
                if (v.get("NIVNOME") or "").startswith("Munic"):
                    valores.setdefault((v["TERCODIGO"], v["VALDATA"][:4]), {})[coluna] = v["VALVALOR"]
                    n += 1
            url = resposta.get("@odata.nextLink")
        print(f"    {codigo}: {n} valores municipais", flush=True)
    colunas = list(SERIES.values())
    destino = raiz / "ipea_atlas" / "idhm_municipios.csv"
    gravar_csv(destino, ["cod_ibge", "ano", *colunas],
               [[cod, ano, *(v.get(c, "") for c in colunas)] for (cod, ano), v in sorted(valores.items())])
    return [destino]
