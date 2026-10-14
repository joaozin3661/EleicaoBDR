"""Linha de comando: python -m crawler [opções]  (rode da pasta do projeto)."""
import argparse
import shutil
import sys
from pathlib import Path

from . import dataverse, ibge, ipea, tse
from .catalogo import ITENS, PERGUNTAS, PRIMEIRO_ANO_CANDIDATOS, ULTIMO_ANO_COM_RESULTADO, montar_plano
from .manifesto import Manifesto, gerar_indice
from .rede import descrever_erro, novo_cliente

COLETORES = {"ibge": ibge.coletar, "ipea": ipea.coletar, "dataverse": dataverse.coletar}
RAIZ_PADRAO = Path(__file__).resolve().parent.parent / "dados"


def _argumentos(argv):
    p = argparse.ArgumentParser(
        prog="python -m crawler",
        description="Baixa só os dados necessários para as perguntas do ProjetoBDR.",
    )
    p.add_argument("--perguntas", type=int, nargs="+", choices=sorted(PERGUNTAS), metavar="N",
                   help="perguntas a atender (padrão: todas, 1 a 10)")
    p.add_argument("--fontes", nargs="+", choices=["tse", "ibge", "ipea", "dataverse"],
                   help="limita às fontes indicadas (padrão: todas)")
    p.add_argument("--anos", type=int, nargs="+", metavar="ANO",
                   help="limita aos anos indicados, dentro do escopo de cada pergunta")
    p.add_argument("--carreira-ate", type=int, default=ULTIMO_ANO_COM_RESULTADO, metavar="ANO",
                   help="último ano da pergunta 10 (padrão: 2024; 2026 inclui as candidaturas atuais)")
    p.add_argument("--dados", type=Path, default=RAIZ_PADRAO, help="pasta de destino (padrão: ./dados)")
    p.add_argument("--simular", action="store_true",
                   help="só mostra o plano e o espaço estimado, sem baixar nada")
    p.add_argument("--atualizar", action="store_true",
                   help="baixa de novo o que mudou no servidor desde o último download")
    p.add_argument("--manter-zips", action="store_true",
                   help="guarda os zips do TSE em dados/_zips (ocupa mais espaço)")
    p.add_argument("--limite-gb", type=float, default=200.0,
                   help="não baixa se o total em disco for passar deste valor (padrão: 200)")
    args = p.parse_args(argv)
    if args.carreira_ate < PRIMEIRO_ANO_CANDIDATOS:
        p.error(f"--carreira-ate deve ser {PRIMEIRO_ANO_CANDIDATOS} ou posterior")
    return args


def _mb(n: int | None) -> str:
    return "?" if n is None else f"{n / 1e6:,.0f}"


def _legivel(n: float) -> str:
    return f"{n / 1e9:,.1f} GB" if n >= 1e9 else f"{n / 1e6:,.0f} MB"


def _rotulo_perguntas(perguntas) -> str:
    return " ".join(f"P{p}" for p in sorted(perguntas))


def _externo_em_disco(manifesto: Manifesto, raiz: Path, chave: str) -> bool:
    arquivos = manifesto.get(chave).get("arquivos", [])
    return bool(arquivos) and all((raiz / a).exists() for a in arquivos)


def _mostrar_plano(tarefas, externos, externos_pendentes, plano, perguntas) -> None:
    print(f"\nPerguntas: {_rotulo_perguntas(perguntas)}")
    pendentes = [t for t in tarefas if t.pendente and not t.erro]
    erros = [t for t in tarefas if t.erro]
    if tarefas:
        print(f"\nTSE: {len(tarefas)} zips ({len(tarefas) - len(pendentes) - len(erros)} já em disco, "
              f"{len(pendentes)} a baixar, {len(erros)} com erro). De cada zip só se extrai o necessário.")
        if pendentes:
            print(f"  {'arquivo':<56}{'zip MB':>9}{'extrai MB':>11}  itens -> perguntas")
            for t in pendentes:
                itens = ", ".join(i.chave for i in t.itens)
                print(f"  {t.nome_zip:<56}{_mb(t.tamanho_zip):>9}{_mb(t.tamanho_extraido):>11}"
                      f"  {itens} -> {_rotulo_perguntas(t.perguntas)}")
        for t in erros:
            print(f"  [erro] {t.nome_zip}: {t.erro}")
    if externos:
        print("\nOutras fontes (arquivos pequenos):")
        for chave in externos:
            estado = "baixar" if chave in externos_pendentes else "já em disco"
            print(f"  {chave:<28}{ITENS[chave].fonte:<11}{estado:<13}-> {_rotulo_perguntas(plano[chave][None])}")


def _tamanho_pasta(pasta: Path) -> int:
    return sum(p.stat().st_size for p in pasta.rglob("*") if p.is_file()) if pasta.exists() else 0


def _espaco_ok(tarefas, raiz: Path, limite_gb: float, manter_zips: bool) -> bool:
    pendentes = [t for t in tarefas if t.pendente and not t.erro]
    download = sum(t.tamanho_zip or 0 for t in pendentes)
    # sem o índice do zip, estima o CSV como 10x o zip (taxa típica dos arquivos do TSE)
    extrair = sum(t.tamanho_extraido if t.tamanho_extraido is not None else 10 * (t.tamanho_zip or 0)
                  for t in pendentes)
    existente = _tamanho_pasta(raiz)
    final = existente + extrair + (download if manter_zips else 0)
    maior_zip = max((t.tamanho_zip or 0 for t in pendentes), default=0)
    necessario = extrair + (download if manter_zips else maior_zip)  # sem --manter-zips, 1 zip por vez
    livre = shutil.disk_usage(next(p for p in (raiz, *raiz.parents) if p.exists())).free
    print(f"\nDownload: {_legivel(download)} | a extrair: {_legivel(extrair)} | já em disco: {_legivel(existente)} | "
          f"total final estimado: {_legivel(final)} | livre no disco: {_legivel(livre)}")
    if final > limite_gb * 1e9:
        print(f"[erro] O total estimado passa do limite de {limite_gb:g} GB. "
              "Reduza com --perguntas/--anos ou aumente com --limite-gb.")
        return False
    if necessario > livre:
        print(f"[erro] Espaço livre insuficiente: são necessários ~{_legivel(necessario)}.")
        return False
    return True


def main(argv=None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    args = _argumentos(argv)
    perguntas = sorted(set(args.perguntas or PERGUNTAS))
    raiz = args.dados.resolve()
    plano = montar_plano(perguntas, args.fontes, args.anos, args.carreira_ate)
    if not plano:
        print("Nada a baixar com esses filtros.")
        return 0
    manifesto = Manifesto(raiz)
    falhas = []
    with novo_cliente() as cli:
        print("Consultando os servidores para montar o plano...", flush=True)
        tarefas = tse.planejar(cli, plano, raiz, manifesto, args.atualizar)
        externos = [k for k in plano if ITENS[k].fonte != "tse"]
        externos_pendentes = [k for k in externos if args.atualizar or not _externo_em_disco(manifesto, raiz, k)]
        _mostrar_plano(tarefas, externos, externos_pendentes, plano, perguntas)
        if not _espaco_ok(tarefas, raiz, args.limite_gb, args.manter_zips):
            return 2
        if args.simular:
            return 0
        for t in tarefas:
            if t.erro:
                falhas.append(f"{t.nome_zip}: {t.erro}")
            elif t.pendente:
                print(f"\n[TSE] {t.nome_zip}", flush=True)
                try:
                    tse.executar(cli, t, raiz, manifesto, args.manter_zips)
                except Exception as e:  # noqa: BLE001 - registra e segue para o próximo arquivo
                    falhas.append(f"{t.nome_zip}: {descrever_erro(e)}")
                    print(f"    [erro] {descrever_erro(e)}")
        for chave in externos_pendentes:
            fonte = ITENS[chave].fonte
            print(f"\n[{fonte.upper()}] {chave}", flush=True)
            try:
                arquivos = COLETORES[fonte](cli, chave, raiz)
                manifesto.registrar(chave, fonte=fonte, arquivos=[manifesto.relativo(p) for p in arquivos])
            except Exception as e:  # noqa: BLE001 - idem
                falhas.append(f"{chave}: {descrever_erro(e)}")
                print(f"    [erro] {descrever_erro(e)}")
    indice = gerar_indice(raiz, manifesto, args.carreira_ate)
    print(f"\nÍndice por pergunta: {indice}")
    if falhas:
        print("\nFalhas (rode de novo para tentar outra vez; o que já baixou não é refeito):")
        for falha in falhas:
            print(f"  - {falha}")
        return 1
    print("Concluído.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrompido. Rode de novo para retomar de onde parou.")
        sys.exit(130)
