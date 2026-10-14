import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { num, numCurto } from "../formato";
import { useTokens } from "../tema";

type Resumo = {
  tabelas: { tabela: string; linhas: number }[];
  anos: { ano: number; tipo_eleicao: string; candidaturas: number; eleitos: number }[];
};

const TABELAS: { tabela: string; desc: string; questoes: string }[] = [
  { tabela: "municipio", desc: "Municípios das 6 UFs, com código IBGE e TSE", questoes: "todas" },
  { tabela: "eleicao", desc: "Pleitos de 2002 a 2024", questoes: "todas" },
  { tabela: "partido", desc: "Legendas pelo número", questoes: "todas" },
  { tabela: "pessoa", desc: "Políticos com identidade resolvida", questoes: "todas" },
  { tabela: "candidatura", desc: "Uma linha por candidato por pleito", questoes: "todas" },
  { tabela: "vaga", desc: "Cadeiras em disputa (2018–2024)", questoes: "Q1, Q5" },
  { tabela: "despesa", desc: "Despesas contratadas (2018–2024)", questoes: "Q1, Q9" },
  { tabela: "bem_declarado", desc: "Patrimônio declarado", questoes: "Q2" },
  { tabela: "receita", desc: "Receitas de campanha", questoes: "Q8" },
  { tabela: "votacao", desc: "Votos nominais por município", questoes: "Q3–Q7" },
  { tabela: "votacao_legenda", desc: "Votos de legenda", questoes: "Q5" },
  { tabela: "eleitorado", desc: "Perfil do eleitorado", questoes: "Q3, Q4, Q6" },
  { tabela: "totalizacao_municipio", desc: "Abstenção, brancos e nulos", questoes: "Q3" },
  { tabela: "indicador_municipal", desc: "PIB, população, IDHM", questoes: "Q3, Q6" },
];

export function Banco() {
  const r = useApi<Resumo>("/api/resumo");
  const t = useTokens();
  const linhas = Object.fromEntries((r.dados?.tabelas ?? []).map((x) => [x.tabela, x.linhas]));
  const cor = (tipo: string) => (tipo === "GERAL" ? t["series-1"] : t["series-2"]);

  return (
    <Secao
      id="banco"
      num="01 · A carga"
      titulo="O que está no banco"
      descricao="Contagens lidas agora do PostgreSQL (banco eleicoes_v2). O modelo tem 14 tabelas; as carregadas até aqui sustentam as perguntas 1 e 10."
    >
      <Estado carregando={r.carregando} erro={r.erro} />
      {r.dados && (
        <>
          <div className="grade g4">
            <Stat rotulo="Candidaturas" valor={num(linhas.candidatura)} detalhe="12 pleitos, 2002 a 2024" />
            <Stat rotulo="Pessoas" valor={num(linhas.pessoa)} detalhe="identidade resolvida, não só pelo título" />
            <Stat rotulo="Despesas de campanha" valor={num(linhas.despesa)} detalhe="itens contratados, 2018 a 2024" />
            <Stat rotulo="Municípios" valor={num(linhas.municipio)} detalhe="AL, PA, PB, PR, SC e SE" />
          </div>

          <div className="card">
            <h3>Candidaturas por pleito</h3>
            <p className="sub">Eleições municipais têm cerca de 20 vezes mais candidatos que as gerais (vereadores).</p>
            <Legenda itens={[{ rotulo: "Geral", cor: cor("GERAL") }, { rotulo: "Municipal", cor: cor("MUNICIPAL") }]} />
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart
                  data={r.dados.anos.map((a) => ({
                    ...a,
                    geral: a.tipo_eleicao === "GERAL" ? a.candidaturas : null,
                    municipal: a.tipo_eleicao === "MUNICIPAL" ? a.candidaturas : null,
                  }))}
                  margin={{ top: 16, right: 8, left: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke={t.grid} />
                  <XAxis dataKey="ano" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} />
                  <YAxis tickFormatter={numCurto} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={56} />
                  <Tooltip
                    cursor={{ fill: t.grid, opacity: 0.5 }}
                    content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as Resumo["anos"][number] | undefined;
                      if (!active || !d) return null;
                      return (
                        <Dica
                          titulo={`${d.ano} · ${d.tipo_eleicao === "GERAL" ? "eleição geral" : "eleição municipal"}`}
                          linhas={[{ rotulo: "Candidaturas", valor: num(d.candidaturas) }, { rotulo: "Eleitos", valor: num(d.eleitos) }]}
                        />
                      );
                    }}
                  />
                  <Bar isAnimationActive={false} dataKey="geral" stackId="t" fill={cor("GERAL")} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar isAnimationActive={false} dataKey="municipal" stackId="t" fill={cor("MUNICIPAL")} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>As 14 tabelas do modelo</h3>
            <p className="sub">As vazias pertencem às próximas questões e já existem com chaves e restrições.</p>
            <Tabela
              colunas={[
                { titulo: "Tabela", valor: (l) => <code>{l.tabela}</code> },
                { titulo: "Conteúdo", valor: (l) => l.desc },
                { titulo: "Perguntas", valor: (l) => l.questoes },
                {
                  titulo: "Linhas",
                  numero: true,
                  valor: (l) => (linhas[l.tabela] ? num(linhas[l.tabela]) : <span className="vazio">a carregar</span>),
                },
              ]}
              linhas={TABELAS}
            />
          </div>
          <VerSQL sql={r.sql} />
        </>
      )}
    </Secao>
  );
}
