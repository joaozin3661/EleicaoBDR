"""Monta a cópia do site_novo que vai para a internet (GitHub Pages).

Copia só o que o navegador usa (páginas, CSS, JS, assets, dados, fotos) para a pasta de destino e, nos dados,
tira as respostas que trazem documentos pessoais: os shards em dados/ vieram da versão estática do site_eleicoes
e incluem /api/exemplo, com CPF e título de eleitor, que o site_novo não usa.

Uso: python3 scripts/prepara_publicacao.py ~/eleicoes-site
"""
import json, pathlib, shutil, sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
ARQUIVOS = ["index.html", "consultas.html", "styles.css", "consultas.css", "app.js", "capitulos.js", "consultas.js",
            "dados.js", "hemiciclo.js", "q3fundo.js", "territorio.js"]
PASTAS = ["assets", "fotos", "dados"]
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
