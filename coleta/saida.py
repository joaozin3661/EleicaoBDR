"""Gravação dos CSVs gerados a partir das APIs (UTF-8, separador ';')."""
import csv
from pathlib import Path


def gravar_csv(destino: Path, cabecalho, linhas) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporario = destino.with_name(destino.name + ".tmp")
    with open(temporario, "w", encoding="utf-8", newline="") as f:
        escritor = csv.writer(f, delimiter=";")
        escritor.writerow(cabecalho)
        escritor.writerows(linhas)
    temporario.replace(destino)
