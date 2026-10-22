"""Exporta vw_site_cadeira para site_novo/dados/site/cadeiras_<ano>_<cargo>_<uf>.json (um arquivo por casa e estado).

Roda no WSL chamando o psql.exe do Windows (o Postgres do Windows nao aceita conexao vinda do WSL), ou no Windows
com PSQL=psql. A senha vem de site_eleicoes/.env.  Uso: python3 scripts/exporta_cadeiras.py
"""
import json, os, pathlib, subprocess

RAIZ = pathlib.Path(__file__).resolve().parents[1]
SAIDA = RAIZ / "dados" / "site"
ENV = RAIZ.parent / "site_eleicoes" / ".env"
PSQL = os.environ.get("PSQL", "/mnt/c/Program Files/PostgreSQL/18/bin/psql.exe")

CASAS = [(2018, "DEPUTADO FEDERAL"), (2018, "DEPUTADO ESTADUAL"), (2022, "DEPUTADO FEDERAL"), (2022, "DEPUTADO ESTADUAL"),
         (2020, "VEREADOR"), (2024, "VEREADOR")]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]

SQL = """SELECT cod_ibge, municipio, id_candidatura, id_pessoa, nome_urna, partido, votos, posicao_votos, vagas,
       quociente, pct_do_quociente, por_legenda, fora_dos_mais_votados
FROM vw_site_cadeira
WHERE ano = {ano} AND cargo = '{cargo}' AND sg_uf = '{uf}'
ORDER BY municipio NULLS FIRST, partido, votos DESC;"""


def senha():
    for linha in ENV.read_text(encoding="utf-8").splitlines():
        if linha.startswith("PGPASSWORD="):
            return linha.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("PGPASSWORD nao encontrado em site_eleicoes/.env")


def consulta_json(sql):
    env = dict(os.environ, PGPASSWORD=senha(), PGCLIENTENCODING="UTF8", WSLENV="PGPASSWORD:PGCLIENTENCODING")
    envolto = f"SELECT COALESCE(json_agg(t), '[]') FROM ({sql.rstrip(';')}) t"
    cwd = str(pathlib.Path(PSQL).parent) if os.sep in PSQL else None
    r = subprocess.run([PSQL, "-w", "-h", "localhost", "-U", "postgres", "-d", "eleicoes_v2", "-At", "-c", envolto],
                       capture_output=True, env=env, cwd=cwd, stdin=subprocess.DEVNULL)
    if r.returncode:
        raise SystemExit(r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    total = 0
    for ano, cargo in CASAS:
        for uf in UFS:
            sql = SQL.format(ano=ano, cargo=cargo, uf=uf)
            linhas = consulta_json(sql)
            # chaves curtas: o arquivo de vereadores do Paraná tem ~4 mil cadeiras
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
