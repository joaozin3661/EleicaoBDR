# -*- coding: utf-8 -*-
"""Onde a carga lê e grava, quais estados entram e em que banco. Todos os scripts de banco/carga/ importam daqui.

  dados/tse/, dados/ibge/          arquivos baixados pela coleta (python -m coleta), fora do git
  dados/saida_carga/               os CSVs que a carga gera e os importar_*.py levam ao banco
  banco/sql/                       esquema.sql e as views

Estados e banco vêm do .env da raiz (ou do ambiente, que tem prioridade):
  CARGA_UFS=AL,PA,PB,PR,SC,SE      siglas separadas por vírgula, ou TODAS para as 27 (padrão: os 6 estados do projeto)
  CARGA_BANCO=eleicoes_teste       banco em que os importar_*.py gravam (padrão: PGDATABASE, ou eleicoes)
"""
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SQL = os.path.join(RAIZ, "banco", "sql")

TODAS_UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI",
             "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]
UFS_DO_PROJETO = ["AL", "PA", "PB", "PR", "SC", "SE"]


def ler_env():
    """Variáveis do .env da raiz; as do ambiente (ex.: $env:CARGA_UFS no PowerShell) valem mais."""
    env = {}
    arq = os.path.join(RAIZ, ".env")
    if os.path.exists(arq):
        with open(arq, encoding="utf-8") as f:
            for linha in f:
                chave, sep, valor = linha.strip().partition("=")
                if sep and not chave.startswith("#"):
                    env[chave.strip()] = valor.strip()
    env.update({k: v for k, v in os.environ.items() if v})
    return env


ENV = ler_env()
DADOS = ENV.get("CARGA_DADOS") or os.path.join(RAIZ, "dados")   # CARGA_DADOS: outra pasta de dados (testes)
TSE = os.path.join(DADOS, "tse")
IBGE = os.path.join(DADOS, "ibge")
SAIDA = os.path.join(DADOS, "saida_carga")


def _ufs():
    valor = ENV.get("CARGA_UFS", "").strip().upper()
    if not valor:
        return list(UFS_DO_PROJETO)
    if valor == "TODAS":
        return list(TODAS_UFS)
    ufs = sorted({u.strip() for u in valor.split(",") if u.strip()})
    erradas = [u for u in ufs if u not in TODAS_UFS]
    if erradas:
        raise SystemExit(f"CARGA_UFS tem sigla desconhecida: {erradas}")
    return ufs


UFS = _ufs()
BANCO = ENV.get("CARGA_BANCO") or ENV.get("PGDATABASE") or "eleicoes"
# Presidente e vice vêm com SG_UF "BR" nos consolidados _BRASIL (e o voto do exterior com "ZZ"). As candidaturas,
# despesas, receitas e bens leem as UFs da carga mais "BR", para que a disputa nacional entre no banco.
UFS_CAND = UFS + ["BR"]
DESC_UFS = "as 27 UFs" if len(UFS) == 27 else f"{len(UFS)} UFs ({', '.join(UFS)})"
