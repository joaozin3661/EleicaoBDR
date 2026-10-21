# -*- coding: utf-8 -*-
"""
Importa os CSVs de saida\\ no banco eleicoes_v2.

Antes, no pgAdmin: botão direito em Databases > Create > Database..., nome eleicoes_v2.
Depois rode este script (Code Runner). Ele:
  1) cria as tabelas com der_eleicoes_v2.sql (se ainda não existirem);
  2) importa os CSVs na ordem das dependências, via COPY;
  3) confere as contagens do banco contra os CSVs.
Se precisar recomeçar, mude RECRIAR para True: ele apaga as tabelas do eleicoes_v2 e cria de novo.
"""
import csv
import os

import psycopg2

# ----------------------------------------------------------------------
# CONFIGURAÇÃO (importar_bens.py usa a mesma conexão)
# ----------------------------------------------------------------------
PASTA = os.path.dirname(os.path.abspath(__file__))


def senha_do_banco():
    """PGPASSWORD do ambiente ou do primeiro .env encontrado daqui para cima (o .env não vai para o GitHub)."""
    if os.getenv("PGPASSWORD"):
        return os.environ["PGPASSWORD"]
    pasta = PASTA
    for _ in range(5):
        caminho = os.path.join(pasta, ".env")
        if os.path.exists(caminho):
            with open(caminho, encoding="utf-8") as f:
                for linha in f:
                    chave, _, valor = linha.strip().partition("=")
                    if chave == "PGPASSWORD" and valor:
                        return valor
        pasta = os.path.dirname(pasta)
    raise SystemExit("Senha do postgres não encontrada. Copie .env.example para .env (na raiz do projeto) "
                     "e preencha PGPASSWORD.")


CONEXAO = dict(host="localhost", port=5432, dbname="eleicoes_v2", user="postgres", password=senha_do_banco())
RECRIAR = False
SAIDA = os.path.join(PASTA, "saida")
ORDEM = ["municipio", "eleicao", "partido", "pessoa", "candidatura", "vaga", "despesa", "bem_declarado", "receita"]
TABELAS = ["indicador_municipal", "vaga", "totalizacao_municipio", "eleitorado", "votacao_legenda", "votacao",
           "despesa", "receita", "bem_declarado", "candidatura", "municipio", "partido", "eleicao", "pessoa"]


def main():
    ordem = [t for t in ORDEM if os.path.exists(os.path.join(SAIDA, t + ".csv"))]  # bem_declarado só se já foi gerado
    con = psycopg2.connect(**CONEXAO)
    con.autocommit = False
    cur = con.cursor()
    print("conectado em", CONEXAO["dbname"])

    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidatura'")
    existe = cur.fetchone()[0] > 0
    if RECRIAR and existe:
        cur.execute("DROP TABLE IF EXISTS " + ", ".join(TABELAS) + " CASCADE")
        existe = False
        print("tabelas antigas apagadas")
    if not existe:
        with open(os.path.join(PASTA, "der_eleicoes_v2.sql"), encoding="utf-8") as f:
            cur.execute(f.read())
        print("tabelas criadas")
    else:
        cur.execute("SELECT count(*) FROM candidatura")
        if cur.fetchone()[0] > 0:
            raise SystemExit("O eleicoes_v2 já tem dados. Para recarregar, mude RECRIAR = True.")

    for tabela in ordem:
        arq = os.path.join(SAIDA, tabela + ".csv")
        with open(arq, encoding="utf-8") as f:
            colunas = next(csv.reader(f))
            f.seek(0)
            cur.copy_expert(f"COPY {tabela} ({', '.join(colunas)}) FROM STDIN WITH (FORMAT csv, HEADER true)", f)
        print(f"  {tabela}: {cur.rowcount:,} linhas importadas")
    con.commit()

    print("conferência (banco x CSV):")
    for tabela in ordem:
        with open(os.path.join(SAIDA, tabela + ".csv"), encoding="utf-8") as f:
            no_csv = sum(1 for _ in csv.reader(f)) - 1
        cur.execute(f"SELECT count(*) FROM {tabela}")
        no_banco = cur.fetchone()[0]
        print(f"  {tabela:13s} banco {no_banco:>10,} | csv {no_csv:>10,} | {'OK' if no_banco == no_csv else 'DIFERENTE!'}")
    cur.execute("ANALYZE")
    con.commit()
    con.close()
    print("PRONTO")


if __name__ == "__main__":
    main()
