import { useEffect, useState } from "react";
import { qs, useApi } from "../api";
import { Estado, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { dataBR, num } from "../formato";
import { useTokens, type Tokens } from "../tema";

type Achado = { id_pessoa: number; nome: string; data_nascimento: string | null; candidaturas: number; primeira: number; ultima: number; vitorias: number; cargos: number };
type Etapa = { ano: number; cargo: string; local: string; partido: string; resultado: string; evento: string; troca_partido: string; mudanca_cargo: string; detalhe_resultado: string | null };
type Pessoa = { nomes: string[]; carreira: Etapa[] };

const ANOS = Array.from({ length: 12 }, (_, i) => 2002 + 2 * i);
const ORDEM_CARGOS = ["VEREADOR", "VICE-PREFEITO", "PREFEITO", "DEPUTADO ESTADUAL", "DEPUTADO FEDERAL",
  "1º SUPLENTE", "2º SUPLENTE", "VICE-GOVERNADOR", "SENADOR", "GOVERNADOR"];

/** Resultado é estado (status): cor reservada + símbolo + texto, nunca só a cor. */
const STATUS: Record<string, { token: keyof Tokens; simbolo: string; rotulo: string; classe?: string }> = {
  "VITÓRIA": { token: "good", simbolo: "✓", rotulo: "Vitória" },
  "DERROTA": { token: "critical", simbolo: "✕", rotulo: "Derrota" },
  "SUPLENTE": { token: "warning", simbolo: "S", rotulo: "Suplente", classe: "suplente" },
};
const OUTRO = { token: "neutral" as const, simbolo: "–", rotulo: "Sem resultado / registro negado / renúncia" };
const status = (r: string) => STATUS[r] ?? OUTRO;

export function Q10() {
  const [texto, setTexto] = useState("helder barbalho");
  const [busca, setBusca] = useState("helder barbalho");
  const [escolhido, setEscolhido] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setBusca(texto.trim()), 350);
    return () => clearTimeout(id);
  }, [texto]);
  const achados = useApi<Achado[]>(busca.length >= 3 ? `/api/q10/busca?${qs({ nome: busca })}` : null);
  useEffect(() => {
    setEscolhido(achados.dados?.[0]?.id_pessoa ?? null);
  }, [achados.dados]);
  const p = useApi<Pessoa>(escolhido ? `/api/q10/pessoa/${escolhido}` : null);
  const sel = achados.dados?.find((a) => a.id_pessoa === escolhido);

  return (
    <Secao
      id="q10"
      num="10 · Pergunta 10"
      titulo="Sobrevivência da carreira de um político"
      descricao="Dado um político, todas as eleições que disputou de 2002 a 2024: cargo, partido da época, vitórias, derrotas e reeleições. Busque por qualquer parte do nome, com ou sem acento — quem mudou de nome é achado também pelo antigo."
    >
      <div className="grade g2" style={{ alignItems: "start" }}>
        <div className="card">
          <label className="campo">
            Nome do político
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ex.: jessica magno" />
          </label>
          <Estado carregando={achados.carregando} erro={achados.erro} vazio={!!achados.dados && achados.dados.length === 0} msgVazio="Ninguém encontrado com esse nome." />
          {achados.dados && achados.dados.length > 0 && (
            <>
              <p className="nota">{achados.dados.length === 100 ? "Mostrando as 100 primeiras — digite mais do nome para refinar." : `${achados.dados.length} pessoa(s), ordenadas por número de candidaturas.`}</p>
              <div className="pessoas">
                {achados.dados.map((a) => (
                  <button key={a.id_pessoa} className={"pessoa" + (a.id_pessoa === escolhido ? " ativo" : "")} onClick={() => setEscolhido(a.id_pessoa)}>
                    <span>
                      <div className="nm">{a.nome}</div>
                      <div className="mt">nasc. {dataBR(a.data_nascimento)} · {a.primeira === a.ultima ? a.primeira : `${a.primeira} a ${a.ultima}`}</div>
                    </span>
                    <span className="mt">{a.candidaturas} candidatura(s)</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <VerSQL sql={achados.sql} />
        </div>

        {sel && p.dados ? (
          <div className="grade g2">
            <Stat rotulo="Eleições disputadas" valor={num(new Set(p.dados.carreira.map((c) => c.ano)).size)} detalhe={`${sel.primeira} a ${sel.ultima}`} />
            <Stat rotulo="Vitórias" valor={num(p.dados.carreira.filter((c) => c.resultado === "VITÓRIA").length)} />
            <Stat rotulo="Reeleições" valor={num(p.dados.carreira.filter((c) => c.evento === "REELEIÇÃO").length)} detalhe="mesmo cargo, mandato seguido" />
            <Stat rotulo="Partidos" valor={num(new Set(p.dados.carreira.map((c) => c.partido)).size)} detalhe={[...new Set(p.dados.carreira.map((c) => c.partido))].join(" → ")} />
          </div>
        ) : (
          <Estado carregando={p.carregando} erro={p.erro} />
        )}
      </div>

      {sel && p.dados && <Carreira pessoa={sel} dados={p.dados} sql={p.sql} />}
    </Secao>
  );
}

function Carreira({ pessoa, dados, sql }: { pessoa: Achado; dados: Pessoa; sql?: string }) {
  const t = useTokens();
  const presentes = new Set(dados.carreira.map((c) => c.cargo));
  const cargos = [...ORDEM_CARGOS.filter((c) => presentes.has(c)), ...[...presentes].filter((c) => !ORDEM_CARGOS.includes(c)).sort()].reverse();
  const outrosNomes = dados.nomes.filter((n) => n !== pessoa.nome);
  const usados = [...new Set(dados.carreira.map((c) => (STATUS[c.resultado] ? c.resultado : "OUTRO")))];

  return (
    <div className="card">
      <h3>{pessoa.nome}</h3>
      <p className="sub">
        Nascido(a) em {dataBR(pessoa.data_nascimento)}
        {outrosNomes.length > 0 && <> · também concorreu como {outrosNomes.join("; ")}</>}
      </p>
      <div className="legenda">
        {usados.map((u) => {
          const s = u === "OUTRO" ? OUTRO : STATUS[u];
          return (
            <span key={u}>
              <i style={{ background: t[s.token], borderRadius: "50%" }} />
              {s.simbolo} {s.rotulo}
            </span>
          );
        })}
      </div>

      <div className="tempo">
        <div className="tempo-grade" style={{ gridTemplateColumns: `150px repeat(${ANOS.length}, minmax(48px, 1fr))` }}>
          {cargos.map((cargo) => (
            <Linha key={cargo} cargo={cargo} etapas={dados.carreira.filter((c) => c.cargo === cargo)} t={t} />
          ))}
          <div />
          {ANOS.map((a) => <div key={a} className="tempo-ano">{a}</div>)}
        </div>
      </div>

      <Tabela<Etapa>
        colunas={[
          { titulo: "Ano", valor: (l) => l.ano, numero: true },
          { titulo: "Cargo", valor: (l) => l.cargo },
          { titulo: "Local", valor: (l) => l.local },
          { titulo: "Partido", valor: (l) => l.partido },
          {
            titulo: "Resultado",
            valor: (l) => {
              const s = status(l.resultado);
              return <span className="tag"><i style={{ background: t[s.token] }} />{l.resultado}</span>;
            },
          },
          { titulo: "Evento", valor: (l) => l.evento || "—" },
          { titulo: "Troca de partido", valor: (l) => l.troca_partido || "—" },
          { titulo: "Mudança de cargo", valor: (l) => l.mudanca_cargo || "—" },
        ]}
        linhas={dados.carreira}
      />
      <p className="nota">Reeleição = eleito para o mesmo cargo no pleito seguinte a um mandato (4 anos; 8 para senador). Presidente fica fora do escopo de 6 estados.</p>
      <VerSQL sql={sql} />
    </div>
  );
}

function Linha({ cargo, etapas, t }: { cargo: string; etapas: Etapa[]; t: Tokens }) {
  return (
    <>
      <div className="tempo-cargo">{cargo}</div>
      {ANOS.map((ano) => {
        const e = etapas.find((x) => x.ano === ano);
        if (!e) return <div key={ano} className="tempo-cel" />;
        const s = status(e.resultado);
        return (
          <div key={ano} className="tempo-cel">
            <div className="marca-wrap">
              <div
                className={"marca " + ("classe" in s && s.classe ? s.classe : "")}
                style={{ background: t[s.token] }}
                tabIndex={0}
                aria-label={`${ano}, ${cargo}, ${e.local}, ${e.partido}: ${e.resultado}`}
              >
                {s.simbolo}
              </div>
              <div className="marca-partido">{e.partido}</div>
              <div className="dica">
                <div className="t">{ano} · {cargo}</div>
                <div className="l"><span>Local</span><b>{e.local}</b></div>
                <div className="l"><span>Partido</span><b>{e.partido}</b></div>
                <div className="l"><span>Resultado</span><b>{e.detalhe_resultado ?? e.resultado}</b></div>
                {e.evento && <div className="l"><span>Evento</span><b>{e.evento}</b></div>}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
