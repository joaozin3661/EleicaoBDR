import { useEffect, useState } from "react";
import { Banco } from "./secoes/Banco";
import { Qualidade } from "./secoes/Qualidade";
import { Q1 } from "./secoes/Q1";
import { Q2 } from "./secoes/Q2";
import { Q9 } from "./secoes/Q9";
import { Q10 } from "./secoes/Q10";

const LINKS = [
  { id: "banco", rotulo: "A carga" },
  { id: "qualidade", rotulo: "Tratamento" },
  { id: "q1", rotulo: "Q1 · Custo da cadeira" },
  { id: "q2", rotulo: "Q2 · Patrimônio" },
  { id: "q9", rotulo: "Q9 · Propaganda" },
  { id: "q10", rotulo: "Q10 · Carreira" },
];

function useSecaoAtiva() {
  const [ativa, setAtiva] = useState("");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setAtiva(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    LINKS.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return ativa;
}

function BotaoTema() {
  const [tema, setTema] = useState<string | null>(() => {
    try {
      return localStorage.getItem("tema");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (tema) document.documentElement.dataset.theme = tema;
    else delete document.documentElement.dataset.theme;
    try {
      if (tema) localStorage.setItem("tema", tema);
      else localStorage.removeItem("tema");
    } catch {
      /* navegador sem armazenamento: só não lembra a escolha */
    }
  }, [tema]);
  const escuro = tema ? tema === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  return (
    <button className="tema" onClick={() => setTema(escuro ? "light" : "dark")} title="Alternar tema">
      {escuro ? "☀ Claro" : "☾ Escuro"}
    </button>
  );
}

export function App() {
  const ativa = useSecaoAtiva();
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <span className="nav-marca">Eleições em Dados</span>
          <div className="nav-links">
            {LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} className={ativa === l.id ? "ativo" : ""}>{l.rotulo}</a>
            ))}
          </div>
          <BotaoTema />
        </div>
      </nav>
      <main>
        <header className="hero">
          <div className="rotulo">Banco de Dados Relacional · UFPI · 2026</div>
          <h1>Doze eleições em um banco relacional</h1>
          <p className="lead">
            Dados abertos do TSE de 2002 a 2024, modelados em PostgreSQL e tratados para responder às perguntas do projeto.
            Tudo o que aparece nesta página é consultado ao vivo no banco, por meio de views.
          </p>
          <div className="chips">
            <span className="chip">AL · PA · PB · PR · SC · SE</span>
            <span className="chip">1.238 municípios</span>
            <span className="chip">PostgreSQL 18</span>
            <span className="chip">14 tabelas</span>
            <span className="chip">Antônio Inácio da Silva Neto · João Marcelo Barros Cardoso Ventura</span>
          </div>
        </header>
        <Banco />
        <Qualidade />
        <Q1 />
        <Q2 />
        <Q9 />
        <Q10 />
        <footer className="rodape">
          Fontes: Portal de Dados Abertos do TSE (candidatos, vagas, bens declarados, prestação de contas — despesas contratadas, de-para de municípios TSE × IBGE).
          Cada bloco tem "Ver o SQL executado no banco" com a consulta exata.
        </footer>
      </main>
    </>
  );
}
