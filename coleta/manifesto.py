"""Estado do que já foi baixado (dados/_controle/manifesto.json)."""
import json
from datetime import datetime
from pathlib import Path

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
