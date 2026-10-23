# -*- coding: utf-8 -*-
"""
Votos do 1º turno dos cargos majoritários (governador, senador e prefeito), 2018 a 2024, nos 6 estados do projeto.
Gera saida\\votos_majoritarios.csv (id_candidatura, total_votos) para preencher candidatura.total_votos, que até aqui
só tinha os votos dos cargos proporcionais (carga_q5.py). Com isso o site calcula o custo por voto também de quem
disputou governo, Senado ou prefeitura.

Regras:
  - só o 1º turno (é a disputa em que todos os candidatos aparecem; quem foi ao 2º turno fica com os votos do 1º);
  - votos nominais VÁLIDOS (QT_VOTOS_NOMINAIS_VALIDOS), como na Q5: votos de candidato com registro indeferido não contam;
  - eleições suplementares ficam de fora: só o que ocorreu até 28 dias depois da data mais comum do ano (como na Q3 e na Q5).
A tabela votacao NÃO é tocada (ela é da Q5 e só tem cargos proporcionais).

Fonte: dados\\tse\\votacao_candidato_munzona\\<ano>\\votacao_candidato_munzona_<ano>_BRASIL.csv (vários GB; leva alguns minutos).
Usa só a biblioteca padrão. Depois rode importar_votos_majoritarios.sql (psql) para gravar no banco.
"""
import csv
import os
from collections import Counter, defaultdict
from datetime import datetime

PASTA = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.dirname(os.path.dirname(PASTA))
SAIDA = os.path.join(PASTA, "saida")
TSE = os.path.join(DADOS, "tse", "votacao_candidato_munzona")
UFS = {"AL", "PA", "PB", "PR", "SC", "SE"}
ANOS = [2018, 2020, 2022, 2024]
CARGOS = {"GOVERNADOR", "SENADOR", "PREFEITO"}
FILTRO = ('"Governador"', '"Senador"', '"Prefeito"', '"GOVERNADOR"', '"SENADOR"', '"PREFEITO"')


def main():
    linhas_saida = []
    for ano in ANOS:
        caminho = os.path.join(TSE, str(ano), f"votacao_candidato_munzona_{ano}_BRASIL.csv")
        votos = defaultdict(int)          # (sq_candidato, data) -> votos
        datas = Counter()
        lidas = 0
        with open(caminho, encoding="latin1", newline="") as f:
            cab = next(csv.reader([f.readline()], delimiter=";"))
            i = {c: cab.index(c) for c in ("NR_TURNO", "DT_ELEICAO", "SG_UF", "DS_CARGO", "SQ_CANDIDATO", "QT_VOTOS_NOMINAIS_VALIDOS")}
            for bruta in f:
                lidas += 1
                if not any(c in bruta for c in FILTRO):
                    continue
                l = next(csv.reader([bruta], delimiter=";"))
                if l[i["NR_TURNO"]] != "1" or l[i["SG_UF"]] not in UFS or l[i["DS_CARGO"]].upper().strip() not in CARGOS:
                    continue
                dt = l[i["DT_ELEICAO"]]
                datas[dt] += 1
                votos[(l[i["SQ_CANDIDATO"]], dt)] += int(l[i["QT_VOTOS_NOMINAIS_VALIDOS"]] or 0)
        modal = datetime.strptime(datas.most_common(1)[0][0], "%d/%m/%Y")
        dentro = {d for d in datas if 0 <= (datetime.strptime(d, "%d/%m/%Y") - modal).days <= 28}
        total = defaultdict(int)
        for (sq, dt), v in votos.items():
            if dt in dentro:
                total[sq] += v
        fora = sum(1 for (sq, dt) in votos if dt not in dentro)
        print(f"{ano}: {lidas:,} linhas lidas | {len(total):,} candidaturas | eleição principal {modal:%d/%m/%Y} | "
              f"{fora:,} registros de eleições suplementares descartados")
        linhas_saida += [(sq, v) for sq, v in total.items()]

    os.makedirs(SAIDA, exist_ok=True)
    with open(os.path.join(SAIDA, "votos_majoritarios.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id_candidatura", "total_votos"])
        w.writerows(sorted(linhas_saida))
    print(f"gravado saida/votos_majoritarios.csv: {len(linhas_saida):,} candidaturas")


if __name__ == "__main__":
    main()
