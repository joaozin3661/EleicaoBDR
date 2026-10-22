# -*- coding: utf-8 -*-
"""
Baixa as fotos dos candidatos publicadas pelo TSE, só dos estados do projeto.

Como rodar: abra este arquivo no VS Code e use o Code Runner (ou `python baixar_fotos.py` na raiz do repositório).
Não há argumentos de linha de comando: o que muda está nas constantes logo abaixo.

O que faz:
  1. Mostra o plano (ano x UF, com o tamanho de cada zip e o espaço necessário) e, se SOMENTE_SIMULAR for False, baixa.
  2. Baixa um zip por vez (foto_cand<ano>_<UF>_div.zip), extrai só as imagens e apaga o zip. Se for interrompido, é só rodar de novo:
     o que já foi extraído é pulado e o download parcial continua de onde parou.
  3. Gera dados/tse/fotos_candidatos/indice.csv, ligando cada arquivo ao candidato.

Onde ficam as fotos:  dados/tse/fotos_candidatos/<ano>/<UF>/F<UF><codigo>_div.jpg  (ou .png nos anos antigos)
Ligação com o banco:  de 2018 em diante o código do arquivo é o SQ_CANDIDATO, igual a candidatura.id_candidatura.
                      De 2004 a 2016 o código é o número original do TSE, que não é o id_candidatura gerado na carga.
Anos disponíveis no TSE: de 2004 a 2024 (2002 e anteriores não têm foto).

Se você já baixou os zips de algum ano pelo site (como a pasta de 2024), coloque-os em dados/_zips/fotos/<ano>/ (o nome
tem que ser o original, foto_cand2024_PB_div.zip, por exemplo). O script usa esses arquivos em vez de baixar e não os apaga.
"""
import csv
import re
import shutil
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # permite rodar de qualquer pasta
from crawler.rede import NaoEncontrado, baixar, descrever_erro, info_remota, novo_cliente  # noqa: E402

# ------------------------------------------------------------------ o que baixar
ANOS = [2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024]
UFS = ["AL", "PA", "PB", "PR", "SC", "SE"]
SO_LOCAIS = {2024}          # anos que nunca são baixados: usa só os zips que você colocou em dados/_zips/fotos/<ano>/
SOMENTE_SIMULAR = False     # True: só mostra o plano e o espaço, sem baixar nada
MANTER_ZIPS = False         # True: não apaga os zips baixados depois de extrair
BAIXAR_LOCAIS_INCOMPLETOS = True   # zip seu cortado/corrompido (SO_LOCAIS): baixa de novo do TSE e substitui o arquivo ruim
LIMITE_GB = 50              # não começa se o total a baixar passar disso

RAIZ = Path(__file__).resolve().parent
DADOS = RAIZ / "dados"
DESTINO = DADOS / "tse" / "fotos_candidatos"
ZIPS = DADOS / "_zips" / "fotos"
CDN = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes{ano}/fotos/foto_cand{ano}_{uf}_div.zip"
IMAGENS = (".jpg", ".jpeg", ".png")
# O TSE muda o padrão do nome conforme o ano: F<UF><codigo>_div.jpg (2006, 2008, 2016 em diante), <UF><codigo>_div.jpg
# (2010 a 2014, sem o F) e F<UF><municipio>_<sequencia>_div.png (2004).
NOME_FOTO = re.compile(r"^F?([A-Z]{2})(\d+)(?:_(\d+))?_div\.(jpg|jpeg|png)$", re.IGNORECASE)


def nome_zip(ano: int, uf: str) -> str:
    return f"foto_cand{ano}_{uf}_div.zip"


def zip_valido(caminho: Path) -> bool:
    """Um zip cortado (download interrompido) não tem o índice no final e não abre."""
    try:
        with zipfile.ZipFile(caminho) as z:
            return len(z.namelist()) > 0
    except (zipfile.BadZipFile, OSError):
        return False


def zip_local(ano: int, uf: str) -> tuple[Path | None, bool]:
    """Zip que você mesmo baixou, em dados/_zips/fotos/ (em qualquer subpasta). Devolve (caminho, está_íntegro)."""
    achados = sorted(ZIPS.rglob(nome_zip(ano, uf))) if ZIPS.exists() else []
    achados = [a for a in achados if a.stat().st_size > 0 and not a.name.endswith(".part")]
    if not achados:
        return None, False
    return achados[0], zip_valido(achados[0])


def marcador(ano: int, uf: str) -> Path:
    return DESTINO / str(ano) / uf / ".completo"


def extrair(zip_path: Path, ano: int, uf: str) -> int:
    """Extrai as imagens do zip para dados/tse/fotos_candidatos/<ano>/<UF>/. Devolve quantas imagens há na pasta."""
    pasta = DESTINO / str(ano) / uf
    pasta.mkdir(parents=True, exist_ok=True)
    novas = 0
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            base = Path(info.filename).name              # nunca confia em subpastas do zip
            if not base or base != info.filename.replace("\\", "/").split("/")[-1]:
                continue
            if base.lower() == "leiame.pdf":
                alvo = DESTINO / str(ano) / "leiame.pdf"
            elif base.lower().endswith(IMAGENS):
                alvo = pasta / base
            else:
                continue
            if alvo.exists() and alvo.stat().st_size == info.file_size:
                continue
            with z.open(info) as origem, open(alvo, "wb") as saida:
                shutil.copyfileobj(origem, saida)
            novas += 1
    total = sum(1 for f in pasta.iterdir() if f.suffix.lower() in IMAGENS)
    marcador(ano, uf).write_text(f"zip={zip_path.name} imagens={total}\n", encoding="utf-8")
    return total


def gerar_indice() -> int:
    linhas = []
    for pasta_ano in sorted(p for p in DESTINO.iterdir() if p.is_dir()) if DESTINO.exists() else []:
        for pasta_uf in sorted(p for p in pasta_ano.iterdir() if p.is_dir()):
            for f in sorted(pasta_uf.iterdir()):
                m = NOME_FOTO.match(f.name)
                if m:
                    ano = int(pasta_ano.name)
                    codigo = m.group(2) + (f"_{m.group(3)}" if m.group(3) else "")
                    linhas.append({"ano": ano, "uf": m.group(1).upper(), "codigo": codigo,
                                   "id_candidatura": m.group(2) if ano >= 2018 else "",
                                   "arquivo": f.relative_to(DESTINO).as_posix()})
    DESTINO.mkdir(parents=True, exist_ok=True)
    with open(DESTINO / "indice.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["ano", "uf", "codigo", "id_candidatura", "arquivo"])
        w.writeheader()
        w.writerows(linhas)
    return len(linhas)


def executar(anos=ANOS, ufs=UFS, simular=SOMENTE_SIMULAR) -> None:
    cli = novo_cliente()
    plano = []   # (ano, uf, situacao, tamanho, caminho_zip_local)
    print(f"Fotos de candidatos do TSE | anos {anos[0]} a {anos[-1]} | UFs {', '.join(ufs)}\n")
    for ano in anos:
        for uf in ufs:
            if marcador(ano, uf).exists():
                plano.append((ano, uf, "feito", 0, None))
                continue
            local, integro = zip_local(ano, uf)
            if local and integro:
                plano.append((ano, uf, "local", local.stat().st_size, local))
                continue
            if local and not integro:
                print(f"  [aviso] {local.name} está incompleto ({local.stat().st_size / 1e6:,.0f} MB, o zip não abre)")
                if ano in SO_LOCAIS and not BAIXAR_LOCAIS_INCOMPLETOS:
                    plano.append((ano, uf, "falta_local", 0, None))
                    continue
            elif ano in SO_LOCAIS:
                plano.append((ano, uf, "falta_local", 0, None))
                continue
            try:
                info = info_remota(cli, CDN.format(ano=ano, uf=uf))
                plano.append((ano, uf, "baixar", info.tamanho or 0, None))
            except NaoEncontrado:
                plano.append((ano, uf, "indisponivel", 0, None))
            except Exception as e:  # noqa: BLE001
                plano.append((ano, uf, "erro", 0, None))
                print(f"  [aviso] {ano} {uf}: {descrever_erro(e)}")

    rotulo = {"feito": "ok", "local": "local", "baixar": "baixar", "falta_local": "FALTA", "indisponivel": "-", "erro": "erro"}
    print("Plano (MB por UF; ok = já extraído, local = zip seu, baixar = vem do TSE, FALTA = ano só local sem os zips, - = TSE não tem):")
    for ano in anos:
        celulas = []
        for uf in ufs:
            p = next(x for x in plano if x[0] == ano and x[1] == uf)
            celulas.append(f"{uf} {rotulo[p[2]]}" + (f" {p[3] / 1e6:,.0f}" if p[2] in ("baixar", "local") else ""))
        print(f"  {ano}: " + " | ".join(celulas))

    a_baixar = [p for p in plano if p[2] == "baixar"]
    a_extrair_local = [p for p in plano if p[2] == "local"]
    total = sum(p[3] for p in a_baixar)
    maior = max([p[3] for p in a_baixar + a_extrair_local] or [0])
    livre = shutil.disk_usage(RAIZ).free
    precisa = 2 * total + maior            # o zip é apagado após extrair, mas as imagens ficam: ~ tamanho do zip em disco
    print(f"\nA baixar: {len(a_baixar)} zips, {total / 1e9:.2f} GB | zips seus a extrair: {len(a_extrair_local)} | "
          f"espaço livre: {livre / 1e9:.1f} GB | necessário (com folga): {precisa / 1e9:.1f} GB")
    faltam_local = sorted({p[0] for p in plano if p[2] == "falta_local"})
    if faltam_local:
        print(f"Aviso: {', '.join(map(str, faltam_local))} só usam zips locais, e não achei zips em {ZIPS}\\<ano>\\. Coloque-os lá e rode de novo.")
    if total / 1e9 > LIMITE_GB:
        print(f"Parado: o total passa do limite de {LIMITE_GB} GB (mude LIMITE_GB).")
        return
    if precisa > livre:
        print("Parado: não há espaço livre suficiente.")
        return
    if simular:
        print("\nSimulação: nada foi baixado (SOMENTE_SIMULAR = True).")
        return

    print()
    falhas = []
    for k, (ano, uf, situacao, tamanho, local) in enumerate(a_extrair_local + a_baixar, 1):
        print(f"[{k}/{len(a_extrair_local) + len(a_baixar)}] {ano} {uf}", flush=True)
        try:
            if local:
                zip_path, apagar = local, False
            else:
                zip_path, apagar = ZIPS / str(ano) / nome_zip(ano, uf), not MANTER_ZIPS
                baixar(cli, CDN.format(ano=ano, uf=uf), zip_path, f"{ano} {uf}")
            n = extrair(zip_path, ano, uf)
            print(f"    {n:,} imagens em dados/tse/fotos_candidatos/{ano}/{uf}/")
            if apagar:
                zip_path.unlink(missing_ok=True)
                try:
                    zip_path.parent.rmdir()          # remove a pasta do ano se ficou vazia
                except OSError:
                    pass
        except KeyboardInterrupt:
            print("\nInterrompido. Rode de novo para continuar de onde parou.")
            raise
        except Exception as e:  # noqa: BLE001
            falhas.append((ano, uf, descrever_erro(e)))
            print(f"    ERRO: {descrever_erro(e)}")
    n_indice = gerar_indice()
    print(f"\nIndice: {n_indice:,} fotos em {DESTINO / 'indice.csv'}")
    if falhas:
        print("Falharam (rode de novo para tentar outra vez):", ", ".join(f"{a} {u}" for a, u, _ in falhas))
    else:
        print("PRONTO.")


if __name__ == "__main__":
    executar()
