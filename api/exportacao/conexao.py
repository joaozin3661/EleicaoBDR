"""Caminhos do projeto e consulta ao banco para os scripts de exportação.

As consultas rodam pelo psql (o do PostgreSQL 18 no Windows, ou o do PATH no Linux/macOS; a variável PSQL troca),
com a conexão do .env da raiz do projeto, e voltam como JSON: SELECT json_agg(...).
"""
import json, os, pathlib, subprocess

RAIZ = pathlib.Path(__file__).resolve().parents[2]
DADOS_SITE = RAIZ / "frontend" / "dados"
PSQL_WINDOWS = r"C:\Program Files\PostgreSQL\18\bin\psql.exe"
PSQL = os.environ.get("PSQL", PSQL_WINDOWS if os.name == "nt" else "psql")


def env():
    """As variáveis PG* do .env da raiz (sem sobrescrever as que já estão no ambiente)."""
    arq = RAIZ / ".env"
    if not arq.exists():
        raise SystemExit(f"Falta o arquivo {arq} (copie o .env.example e coloque a senha do postgres).")
    vals = {}
    for linha in arq.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return {**vals, **os.environ, "PGCLIENTENCODING": "UTF8"}


def consulta_json(sql):
    """Roda um SELECT e devolve as linhas como lista de dicionários."""
    e = env()
    envolto = f"SELECT COALESCE(json_agg(t), '[]') FROM ({sql.rstrip().rstrip(';')}) t"
    args = [PSQL, "-w", "-h", e.get("PGHOST", "localhost"), "-p", e.get("PGPORT", "5432"), "-U", e.get("PGUSER", "postgres"),
            "-d", e.get("PGDATABASE", "eleicoes"), "-At", "-c", envolto]
    r = subprocess.run(args, capture_output=True, env=e, stdin=subprocess.DEVNULL)
    if r.returncode:
        raise SystemExit(r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def ufs():
    """As UFs que o banco tem (as 27, ou só as da carga de teste), em ordem alfabética."""
    return [l["uf"] for l in consulta_json("SELECT DISTINCT sg_uf AS uf FROM candidatura WHERE sg_uf <> 'BR' ORDER BY 1")]


# o DF não tem prefeito nem vereador, e a casa dele é a Câmara Legislativa (deputado distrital, fora da Q5)
SEM_CASA = {("DF", "VEREADOR"), ("DF", "DEPUTADO ESTADUAL")}
