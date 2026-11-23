"""Arquivos do TSE (CDN do Portal de Dados Abertos).

Cada zip é baixado uma única vez, mesmo que atenda a vários itens (receitas e
despesas vêm do mesmo zip de prestação de contas). Do zip só saem os arquivos
necessários e, quando existe o consolidado *_BRASIL.csv, apenas ele: os
arquivos por UF (inclusive BR e ZZ) são pedaços do mesmo conteúdo. Depois da
extração o zip é apagado, a menos que se use --manter-zips.
"""
import io
import re
import shutil
import zipfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import httpx

from .catalogo import ITENS, Item
from .manifesto import Manifesto
from .rede import NaoEncontrado, baixar, descrever_erro, info_remota, obter_json

CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele/"
CKAN = "https://dadosabertos.tse.jus.br/api/3/action/"

_SUFIXO_UF = re.compile(r"^(?P<base>.+)_(?:[A-Z]{2}|BRASIL)\.(?:csv|txt)$", re.IGNORECASE)
_BRASIL = re.compile(r"_BRASIL\.(?:csv|txt)$", re.IGNORECASE)


@dataclass
class Tarefa:
    caminho_cdn: str
    ano: int | None
    itens: list[Item] = field(default_factory=list)
    perguntas: set[int] = field(default_factory=set)
    url: str = ""
    tamanho_zip: int | None = None
    modificado: str | None = None
    destinos: dict[str, tuple[str, Path]] = field(default_factory=dict)  # membro -> (item, arquivo final)
    tamanho_extraido: int | None = None
    pendente: bool = True
    erro: str | None = None

    @property
    def nome_zip(self) -> str:
        return self.caminho_cdn.rsplit("/", 1)[-1]

    @property
    def chave_manifesto(self) -> str:
        return "tse:" + self.caminho_cdn


def selecionar_membros(nomes: list[str], item: Item) -> list[str]:
    """Arquivos do zip que o item usa, preferindo o consolidado _BRASIL."""
    dados, docs = [], []
    for nome in nomes:
        base = nome.rsplit("/", 1)[-1]
        extensao = base.rsplit(".", 1)[-1].lower() if "." in base else ""
        if extensao in ("csv", "txt"):
            if item.membros is None or re.search(item.membros, base, re.IGNORECASE):
                dados.append(nome)
        elif extensao == "pdf" and (item.docs is None or re.search(item.docs, base, re.IGNORECASE)):
            docs.append(nome)
    grupos: dict[str, list[str]] = {}
    for nome in dados:
        base = nome.rsplit("/", 1)[-1]
        m = _SUFIXO_UF.match(base)
        grupos.setdefault((m.group("base") if m else base).lower(), []).append(nome)
    escolhidos = []
    for membros in grupos.values():
        escolhidos += [n for n in membros if _BRASIL.search(n)] or membros
    return sorted(escolhidos) + sorted(docs)


def planejar(cli: httpx.Client, plano, raiz: Path, manifesto: Manifesto,
             atualizar: bool = False) -> list[Tarefa]:
    """Agrupa os itens do TSE por zip e descobre tamanhos e o que extrair de cada um."""
    tarefas: dict[str, Tarefa] = {}
    for chave, anos in plano.items():
        item = ITENS[chave]
        if item.fonte != "tse":
            continue
        for ano, perguntas in anos.items():
            caminho = item.zip_cdn.format(ano=ano) if item.anual else item.zip_cdn
            tarefa = tarefas.setdefault(caminho, Tarefa(caminho, ano if item.anual else None))
            tarefa.itens.append(item)
            tarefa.perguntas |= perguntas
    with ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(lambda t: _planejar_zip(cli, t, raiz, manifesto, atualizar), tarefas.values()))
    return sorted(tarefas.values(), key=lambda t: (t.itens[0].chave, t.ano or 0))


def _planejar_zip(cli, t: Tarefa, raiz: Path, manifesto: Manifesto, atualizar: bool) -> None:
    registro = manifesto.get(t.chave_manifesto)
    completa = _completa(t, registro, raiz)
    if completa and not atualizar:
        t.pendente = False
        return
    try:
        t.url, info = _localizar(cli, t)
    except NaoEncontrado:
        t.erro = "arquivo não encontrado no CDN nem no portal de dados abertos do TSE"
        return
    except Exception as e:  # noqa: BLE001 - vira erro da tarefa sem derrubar o plano inteiro
        t.erro = f"falha ao consultar o servidor: {descrever_erro(e)}"
        return
    t.tamanho_zip, t.modificado = info.tamanho, info.modificado
    if completa and registro.get("modificado") == t.modificado:
        t.pendente = False
        return
    if not (info.aceita_range and info.tamanho):
        return  # sem leitura parcial: a seleção dos arquivos fica para depois do download
    try:
        infos = _listar_zip_remoto(cli, t.url, info.tamanho)
    except Exception:  # noqa: BLE001 - idem
        return
    t.destinos = _destinos(t, [i.filename for i in infos], raiz)
    tamanhos = {i.filename: i.file_size for i in infos}
    atualizando = _atualizando(registro, t)
    t.tamanho_extraido = sum(tamanhos[m] for m, (_, d) in t.destinos.items() if atualizando or not d.exists())


def _completa(t: Tarefa, registro: dict, raiz: Path) -> bool:
    """True se todos os itens da tarefa já foram extraídos antes e continuam em disco."""
    arquivos = registro.get("arquivos", {})
    for item in t.itens:
        caminhos = [a["caminho"] for a in arquivos.values() if a["item"] == item.chave]
        if not caminhos or not all((raiz / c).exists() for c in caminhos):
            return False
    return True


def _atualizando(registro: dict, t: Tarefa) -> bool:
    antigo = registro.get("modificado")
    return bool(antigo and t.modificado and antigo != t.modificado)


def _localizar(cli, t: Tarefa):
    url = CDN + t.caminho_cdn
    try:
        return url, info_remota(cli, url)
    except NaoEncontrado:
        url = _procurar_no_portal(cli, t)
        if url is None:
            raise
        return url, info_remota(cli, url)


@lru_cache(maxsize=1)
def _conjuntos(cli) -> tuple[str, ...]:
    return tuple(obter_json(cli, CKAN + "package_list")["result"])


def _procurar_no_portal(cli, t: Tarefa) -> str | None:
    """Se o TSE mudar o caminho no CDN, acha o zip pelo catálogo do portal (CKAN)."""
    conjunto = t.itens[0].conjunto_ckan
    for nome in _conjuntos(cli):
        if conjunto not in nome or (t.ano and str(t.ano) not in nome):
            continue
        for recurso in obter_json(cli, CKAN + "package_show", {"id": nome})["result"]["resources"]:
            # alguns recursos do portal vêm com a URL prefixada por "URL: "
            url = re.sub(r"^\s*URL:\s*", "", recurso.get("url") or "").strip()
            if url.rsplit("/", 1)[-1].lower() == t.nome_zip.lower():
                return url
    return None


class _ArquivoRemoto(io.RawIOBase):
    """Arquivo remoto lido por HTTP Range: permite ler o índice do zip sem baixá-lo."""

    def __init__(self, cli, url: str, tamanho: int):
        self.cli, self.url, self.tamanho, self.pos = cli, url, tamanho, 0

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, deslocamento: int, origem: int = io.SEEK_SET) -> int:
        base = {io.SEEK_SET: 0, io.SEEK_CUR: self.pos, io.SEEK_END: self.tamanho}[origem]
        self.pos = base + deslocamento
        return self.pos

    def readinto(self, buffer) -> int:
        if self.pos >= self.tamanho:
            return 0
        fim = min(self.pos + len(buffer), self.tamanho) - 1
        with self.cli.stream("GET", self.url, headers={"Range": f"bytes={self.pos}-{fim}"}) as r:
            if r.status_code != 206:
                raise OSError(f"leitura parcial recusada (HTTP {r.status_code})")
            dados = r.read()
        buffer[: len(dados)] = dados
        self.pos += len(dados)
        return len(dados)


def _listar_zip_remoto(cli, url: str, tamanho: int) -> list[zipfile.ZipInfo]:
    with zipfile.ZipFile(io.BufferedReader(_ArquivoRemoto(cli, url, tamanho), buffer_size=1 << 16)) as z:
        return z.infolist()


def _destinos(t: Tarefa, nomes: list[str], raiz: Path) -> dict[str, tuple[str, Path]]:
    destinos = {}
    for item in t.itens:
        pasta = raiz / "tse" / item.chave / (str(t.ano) if t.ano else "")
        for membro in selecionar_membros(nomes, item):
            destinos[membro] = (item.chave, pasta / membro.rsplit("/", 1)[-1])
    return destinos


def executar(cli, t: Tarefa, raiz: Path, manifesto: Manifesto, manter_zip: bool = False) -> None:
    """Baixa o zip (retomando se preciso), extrai só o selecionado e registra no manifesto."""
    registro = manifesto.get(t.chave_manifesto)
    atualizando = _atualizando(registro, t)
    zip_local = raiz / "_zips" / t.nome_zip
    if zip_local.exists() and atualizando:
        zip_local.unlink()  # versão antiga guardada com --manter-zips
    if not zip_local.exists():
        info = baixar(cli, t.url, zip_local, rotulo=t.nome_zip)
        t.modificado = t.modificado or info.modificado
    with zipfile.ZipFile(zip_local) as z:
        if not t.destinos:
            t.destinos = _destinos(t, z.namelist(), raiz)
        for membro, (_, destino) in t.destinos.items():
            if atualizando or not destino.exists():
                _extrair(z, membro, destino)
    arquivos = dict(registro.get("arquivos", {}))
    arquivos.update({m: {"item": chave, "caminho": manifesto.relativo(d)}
                     for m, (chave, d) in t.destinos.items()})
    manifesto.registrar(t.chave_manifesto, url=t.url, modificado=t.modificado, arquivos=arquivos)
    if not manter_zip:
        zip_local.unlink()


def _extrair(z: zipfile.ZipFile, membro: str, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporario = destino.with_name(destino.name + ".tmp")
    with z.open(membro) as origem, open(temporario, "wb") as saida:
        shutil.copyfileobj(origem, saida, 1 << 20)
    temporario.replace(destino)
    print(f"    extraído {destino.name} ({destino.stat().st_size / 1e6:,.0f} MB)", flush=True)
