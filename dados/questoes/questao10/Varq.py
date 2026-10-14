import os, glob

BASE = r"C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\questao10"
out = []
for ano in range(2002, 2018, 2):
    pasta = os.path.join(BASE, f"candidato{ano}")
    arqs = sorted(glob.glob(os.path.join(pasta, "*")))
    out.append("=" * 70)
    out.append(f"{ano} | {len(arqs)} arquivos")
    for a in arqs:
        out.append(f"   {os.path.basename(a)}  ({os.path.getsize(a) / 1024:,.0f} KB)")
    for f in sorted(glob.glob(os.path.join(pasta, "*_PR.*"))):
        with open(f, encoding="latin1") as fh:
            linhas = [fh.readline() for _ in range(3)]
        out.append(f"--- 3 primeiras linhas de {os.path.basename(f)} ---")
        out += [l.rstrip()[:1800] for l in linhas]
    out.append("")

arq = os.path.join(BASE, "amostra_q10_formato.txt")
open(arq, "w", encoding="utf-8").write("\n".join(out))
print("Gerado:", arq)