import { useEffect, useState } from "react";
import { ESTATICO } from "./estatico";
import { Banco } from "./secoes/Banco";
import { Qualidade } from "./secoes/Qualidade";
import { Q1 } from "./secoes/Q1";
import { Q2 } from "./secoes/Q2";
import { Q3 } from "./secoes/Q3";
import { Q4 } from "./secoes/Q4";
import { Q6 } from "./secoes/Q6";
import { Q8 } from "./secoes/Q8";
import { Q9 } from "./secoes/Q9";
import { Q10 } from "./secoes/Q10";

// Questões exibidas na apresentação. As demais continuam no código, só não aparecem.
// Para ver todas sem editar aqui, abra o site com ?todas na URL.
const QUESTOES_VISIVEIS = ["q1", "q2", "q10"];

const SECOES = [
  { id: "banco", rotulo: "A carga", Componente: Banco },
  { id: "qualidade", rotulo: "Tratamento", Componente: Qualidade },
  { id: "q1", rotulo: "Q1 · Custo da cadeira", Componente: Q1 },
  { id: "q2", rotulo: "Q2 · Patrimônio", Componente: Q2 },
  { id: "q3", rotulo: "Q3 · Índices do município", Componente: Q3 },
  { id: "q4", rotulo: "Q4 · Escolaridade", Componente: Q4 },
  { id: "q6", rotulo: "Q6 · Idade", Componente: Q6 },
  { id: "q8", rotulo: "Q8 · Financiamento", Componente: Q8 },
  { id: "q9", rotulo: "Q9 · Propaganda", Componente: Q9 },
  { id: "q10", rotulo: "Q10 · Carreira", Componente: Q10 },
];

const mostrarTodas = ESTATICO || new URLSearchParams(window.location.search).has("todas");
const LINKS = SECOES.filter((s) => mostrarTodas || !s.id.startsWith("q") || QUESTOES_VISIVEIS.includes(s.id));

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
            {ESTATICO && <a href="justificativa.html">Justificativas</a>}
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
            {ESTATICO
              ? "Esta é uma versão estática: cada tela mostra respostas já consultadas no banco, por meio de views, e gravadas em arquivos. O banco e a consulta ao vivo rodam no computador dos autores."
              : "Tudo o que aparece nesta página é consultado ao vivo no banco, por meio de views."}
          </p>
          {ESTATICO && (
            <p className="aviso">
              Nesta versão, a busca de políticos (Q10) cobre os 2.500 com mais candidaturas, e a busca de município da Q1 cobre todos os municípios dos seis estados.
              Os botões "Ver o SQL executado no banco" mostram a consulta usada para gerar cada resposta.
            </p>
          )}
          <div className="chips">
            <span className="chip">AL · PA · PB · PR · SC · SE</span>
            <span className="chip">1.238 municípios</span>
            <span className="chip">PostgreSQL 18</span>
            <span className="chip">14 tabelas</span>
            <span className="chip">Antônio Inácio da Silva Neto · João Marcelo Barros Cardoso Ventura</span>
          </div>
        </header>
        {LINKS.map(({ id, Componente }) => (
          <Componente key={id} />
        ))}
        <footer className="rodape">
          Fontes: Portal de Dados Abertos do TSE (candidatos, vagas, bens declarados, prestação de contas — receitas e despesas contratadas; perfil do eleitorado por escolaridade; IBGE: idade mediana dos municípios (Censo 2022), de-para de municípios TSE × IBGE).
          Cada bloco tem "Ver o SQL executado no banco" com a consulta exata.
          {ESTATICO && <> Os dados usados e as decisões de cada pergunta estão em <a href="justificativa.html">Justificativas</a>.</>}
        </footer>
      </main>
    </>
  );
}
