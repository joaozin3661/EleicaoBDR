"""Estado do que já foi baixado (dados/_controle/manifesto.json) e o índice por pergunta."""
import json
from datetime import datetime
from pathlib import Path

from .catalogo import ITENS, PERGUNTAS, requisitos


class Manifesto:
    def __init__(self, raiz: Path):
        self.raiz = raiz
        self.caminho = raiz / "_controle" / "manifesto.json"
        self.dados = json.loads(self.caminho.read_text(encoding="utf-8")) if self.caminho.exists() else {}

    def get(self, chave: str) -> dict:
        return self.dados.get(chave, {})

    def registrar(self, chave: str, **info) -> None:
        self.dados[chave] = {**info, "atualizado_em": datetime.now().isoformat(timespec="seconds")}
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        temporario = self.caminho.with_name(self.caminho.name + ".tmp")
        temporario.write_text(json.dumps(self.dados, ensure_ascii=False, indent=2, sort_keys=True),
                              encoding="utf-8")
        temporario.replace(self.caminho)

    def relativo(self, caminho: Path) -> str:
        return caminho.relative_to(self.raiz).as_posix()


def _tem_arquivos(pasta: Path) -> bool:
    return pasta.is_dir() and any(p.is_file() and not p.name.endswith((".tmp", ".part")) for p in pasta.iterdir())


def gerar_indice(raiz: Path, manifesto: Manifesto, carreira_ate: int) -> Path:
    """Escreve dados/INDICE_PERGUNTAS.md: onde está, em disco, o material de cada pergunta."""
    linhas = [
        "# Arquivos por pergunta",
        "",
        f"Gerado pelo crawler (`python -m crawler`) em {datetime.now():%d/%m/%Y %H:%M}. "
        "Caminhos relativos a esta pasta.",
        "Os dados ficam organizados por fonte/tipo/ano; este índice diz o que cada pergunta usa.",
        "",
    ]
    for pergunta, texto in PERGUNTAS.items():
        linhas += [f"## P{pergunta}. {texto}", ""]
        for chave, anos in requisitos(pergunta, carreira_ate).items():
            item = ITENS[chave]
            if item.fonte == "tse" and item.anual:
                ok = [a for a in anos if _tem_arquivos(raiz / "tse" / chave / str(a))]
                falta = [a for a in anos if a not in ok]
                estado = f"baixados: {', '.join(map(str, ok)) or 'nenhum'}"
                if falta:
                    estado += f"; faltando: {', '.join(map(str, falta))}"
                linhas.append(f"- `tse/{chave}/<ano>/` - {item.descricao}. {estado}")
            elif item.fonte == "tse":
                estado = "ok" if _tem_arquivos(raiz / "tse" / chave) else "faltando"
                linhas.append(f"- `tse/{chave}/` - {item.descricao}. {estado}")
            else:
                arquivos = [a for a in manifesto.get(chave).get("arquivos", []) if (raiz / a).exists()]
                onde = ", ".join(f"`{a}`" for a in arquivos) or "faltando"
                linhas.append(f"- {onde} - {item.descricao}")
        linhas.append("")
    destino = raiz / "INDICE_PERGUNTAS.md"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(linhas), encoding="utf-8")
    return destino
