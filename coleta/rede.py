"""Acesso HTTP: cliente, novas tentativas e download com retomada."""
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

TENTATIVAS = 6
_BLOCO = 1 << 20
_REPETIVEIS = {408, 425, 429, 500, 502, 503, 504}


class NaoEncontrado(Exception):
    """O servidor respondeu 404."""


class _Repetir(Exception):
    """Falha passageira: vale tentar de novo."""


@dataclass
class InfoRemota:
    tamanho: int | None
    modificado: str | None
    aceita_range: bool


def descrever_erro(e: BaseException) -> str:
    """Mensagem curta de erro (a do httpx ocupa várias linhas)."""
    if isinstance(e, httpx.HTTPStatusError):
        codigo = e.response.status_code
        return f"HTTP {codigo}" + (" (acesso recusado pelo servidor)" if codigo == 403 else "")
    return str(e) or e.__class__.__name__


def novo_cliente() -> httpx.Client:
    # O CDN do TSE responde 403 a agentes com "crawler", "python" ou "httpx" no nome;
    # este formato é aceito por todas as fontes e ainda identifica o projeto.
    return httpx.Client(
        headers={"User-Agent": "Mozilla/5.0 (compatible; ProjetoBDR/1.0; pesquisa academica)"},
        timeout=httpx.Timeout(60.0, connect=30.0),
        follow_redirects=True,
    )


def _esperar(tentativa: int, motivo: object) -> None:
    pausa = min(60, 2 ** tentativa)
    print(f"    [aviso] {motivo} - nova tentativa em {pausa}s", flush=True)
    time.sleep(pausa)


def requisitar(cli: httpx.Client, url: str, *, params=None, headers=None) -> httpx.Response:
    """GET com novas tentativas para falhas de rede, 5xx e 429."""
    for tentativa in range(1, TENTATIVAS + 1):
        try:
            r = cli.get(url, params=params, headers=headers)
        except httpx.TransportError as e:
            if tentativa == TENTATIVAS:
                raise
            _esperar(tentativa, e)
            continue
        if r.status_code == 404:
            raise NaoEncontrado(url)
        if r.status_code in _REPETIVEIS and tentativa < TENTATIVAS:
            _esperar(tentativa, f"HTTP {r.status_code}")
            continue
        r.raise_for_status()
        return r
    raise AssertionError("inalcançável")


def obter_json(cli: httpx.Client, url: str, params=None):
    return requisitar(cli, url, params=params).json()


def _tamanho_total(r: httpx.Response) -> int | None:
    faixa = r.headers.get("content-range", "")
    if "/" in faixa:
        total = faixa.rsplit("/", 1)[1].strip()
        return int(total) if total.isdigit() else None
    if r.status_code == 200 and r.headers.get("content-encoding", "identity") == "identity":
        tamanho = r.headers.get("content-length", "")
        return int(tamanho) if tamanho.isdigit() else None
    return None


def info_remota(cli: httpx.Client, url: str) -> InfoRemota:
    """Tamanho e data de modificação sem baixar o arquivo (pede só o 1º byte)."""
    for tentativa in range(1, TENTATIVAS + 1):
        try:
            with cli.stream("GET", url, headers={"Range": "bytes=0-0"}) as r:
                if r.status_code == 404:
                    raise NaoEncontrado(url)
                if r.status_code in _REPETIVEIS and tentativa < TENTATIVAS:
                    raise _Repetir(f"HTTP {r.status_code}")
                r.raise_for_status()
                return InfoRemota(_tamanho_total(r), r.headers.get("last-modified"), r.status_code == 206)
        except (httpx.TransportError, _Repetir) as e:
            if tentativa == TENTATIVAS:
                raise
            _esperar(tentativa, e)
    raise AssertionError("inalcançável")


class _Progresso:
    def __init__(self, rotulo: str, total: int | None, inicial: int):
        self.rotulo, self.total, self.feito, self.base = rotulo, total, inicial, inicial
        self.inicio = self.ultimo = time.monotonic()
        self.tty = sys.stdout.isatty()
        self.marco = 0.25

    def _linha(self) -> str:
        velocidade = (self.feito - self.base) / 1e6 / max(time.monotonic() - self.inicio, 1e-6)
        if self.total:
            return (f"    {self.rotulo}: {self.feito / 1e6:,.0f}/{self.total / 1e6:,.0f} MB "
                    f"({self.feito / self.total:.0%}) {velocidade:.1f} MB/s")
        return f"    {self.rotulo}: {self.feito / 1e6:,.0f} MB {velocidade:.1f} MB/s"

    def avancar(self, n: int) -> None:
        self.feito += n
        if self.tty:
            if time.monotonic() - self.ultimo >= 0.5:
                self.ultimo = time.monotonic()
                print("\r" + self._linha(), end="", flush=True)
        elif self.total and self.feito / self.total >= self.marco:
            print(self._linha(), flush=True)
            while self.feito / self.total >= self.marco:
                self.marco += 0.25

    def concluir(self) -> None:
        if self.tty:
            print("\r" + self._linha() + "    ", flush=True)


def baixar(cli: httpx.Client, url: str, destino: Path, rotulo: str | None = None) -> InfoRemota:
    """Baixa url em destino. Se interrompido, a próxima chamada retoma do .part.

    O If-Range garante que um .part antigo não seja completado com bytes de uma
    versão mais nova do arquivo: se o servidor mudou, o download recomeça.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_name(destino.name + ".part")
    meta = destino.with_name(destino.name + ".part.json")
    validador = None
    if parcial.exists() and meta.exists():
        validador = json.loads(meta.read_text(encoding="utf-8")).get("modificado")
    falhas = 0
    while True:
        feito = parcial.stat().st_size if parcial.exists() else 0
        cabecalhos = {}
        if feito:
            cabecalhos["Range"] = f"bytes={feito}-"
            if validador:
                cabecalhos["If-Range"] = validador
        try:
            with cli.stream("GET", url, headers=cabecalhos) as r:
                if r.status_code == 416 and feito:
                    if _tamanho_total(r) in (None, feito):
                        break                          # o .part já estava completo
                    parcial.unlink()                   # arquivo remoto mudou de tamanho
                    validador = None
                    continue
                if r.status_code == 404:
                    raise NaoEncontrado(url)
                if r.status_code in _REPETIVEIS:
                    raise _Repetir(f"HTTP {r.status_code}")
                r.raise_for_status()
                if r.status_code != 206:
                    feito = 0                          # servidor mandou o arquivo inteiro
                total = _tamanho_total(r)
                validador = r.headers.get("last-modified") or validador
                meta.write_text(json.dumps({"url": url, "modificado": validador}), encoding="utf-8")
                progresso = _Progresso(rotulo or destino.name, total, feito)
                with open(parcial, "ab" if feito else "wb") as f:
                    for bloco in r.iter_bytes(_BLOCO):
                        f.write(bloco)
                        progresso.avancar(len(bloco))
                progresso.concluir()
            if total is None or parcial.stat().st_size == total:
                break
            raise _Repetir("conexão encerrada antes do fim")
        except (httpx.TransportError, _Repetir) as e:
            falhas += 1
            if falhas >= TENTATIVAS:
                raise RuntimeError(f"falha ao baixar {url}: {e}") from e
            _esperar(falhas, e)
    parcial.replace(destino)
    meta.unlink(missing_ok=True)
    return InfoRemota(destino.stat().st_size, validador, True)
