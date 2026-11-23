"""Monta a cópia do frontend que vai para a internet (GitHub Pages).

Copia só o que o navegador usa (páginas, CSS, JS, assets, dados, fotos) para a pasta de destino. Por garantia, confere
que nenhum dado traz documentos pessoais (CPF, título de eleitor): o npm run grava já não grava /api/exemplo, mas
dados antigos ainda podem ter, e aí as respostas são tiradas da cópia.

Uso (em api/): npm run publica -- <pasta de destino>, por exemplo npm run publica -- ../../eleicoes-site
"""
import json, pathlib, shutil, sys

RAIZ = pathlib.Path(__file__).resolve().parents[2] / "frontend"
ARQUIVOS = ["index.html", "consultas.html"]
PASTAS = ["css", "js", "assets", "fotos", "dados"]
PROIBIDO = ("cpf_declarado", "titulo_declarado", "cpf")


def main():
    destino = pathlib.Path(sys.argv[1]).expanduser().resolve()
    destino.mkdir(parents=True, exist_ok=True)
    for f in ARQUIVOS:
        shutil.copy2(RAIZ / f, destino / f)
    for p in PASTAS:
        shutil.copytree(RAIZ / p, destino / p, dirs_exist_ok=True)
    (destino / ".nojekyll").write_text("")

    tiradas = 0
    for f in (destino / "dados").glob("*.json"):
        bloco = json.loads(f.read_text(encoding="utf-8"))
        if not isinstance(bloco, dict):
            continue
        fora = [k for k, v in bloco.items() if k.startswith("/api/exemplo") or any(f'"{c}"' in json.dumps(v) for c in PROIBIDO)]
        for k in fora:
            del bloco[k]
        if fora:
            tiradas += len(fora)
            f.write_text(json.dumps(bloco, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    resto = [str(f) for f in (destino / "dados").rglob("*.json") if any(c in f.read_text(encoding="utf-8") for c in ("cpf_declarado", "titulo_declarado"))]
    if resto:
        raise SystemExit(f"ainda há documentos pessoais em: {resto}")
    print(f"copiado para {destino}; respostas retiradas: {tiradas}")


if __name__ == "__main__":
    main()
