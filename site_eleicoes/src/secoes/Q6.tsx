import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList, Cell } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { num, pct } from "../formato";
import { useTokens, type Tokens } from "../tema";

type Grupo = { grupo_ordem: number; grupo: string };
type Idade = { ano: number; grupo_ordem: number; municipios: number; eleitos: number; idade_media: number; idade_mediana_eleitos: number; pct_ate_34: number; pct_60_mais: number };
type Corr = { ano: number; municipios: number; correlacao: number; inclinacao: number };
type Alt = {
  ano: number; grupo_ordem: number; transicoes: number; pct_partido_mudou: number; pct_prefeito_mudou: number;
  incumbentes_concorreram: number; incumbentes_reeleitos: number; pct_reeleicao: number | null; pct_tentou_reeleicao: number;
};
type Dados = { grupos: Grupo[]; idade: Idade[]; correlacao: Corr[]; alternancia: Alt[] };

const UFS = ["AL", "PA", "PB", "PR", "SC", "SE"];
const COR_GRUPO: (keyof Tokens)[] = ["text-muted", "series-1", "series-2", "series-3", "series-4"]; // 0 = todos, 1..4 = jovens a envelhecidos
const sinal = (v: number, casas = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(casas).replace(".", ",");
const forca = (r: number) => (Math.abs(r) < 0.1 ? "praticamente nenhuma" : Math.abs(r) < 0.3 ? "fraca" : Math.abs(r) < 0.5 ? "moderada" : "forte");

export function Q6() {
  const t = useTokens();
  const [cargo, setCargo] = useState<"PREFEITO" | "VEREADOR">("VEREADOR");
  const [uf, setUf] = useState("TODAS");
  const [ano, setAno] = useState(2024);
  const r = useApi<Dados>(`/api/q6?${qs({ cargo, uf })}`);
  const d = r.dados;
  const anos = useMemo(() => [...new Set((d?.idade ?? []).map((x) => x.ano))].sort(), [d]);
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[anos.length - 1]);
  }, [anos.join(), ano]);

  const rotulo = (g: number) => d?.grupos.find((x) => x.grupo_ordem === g)?.grupo ?? "";
  const curto = (g: number) => rotulo(g).split(" · ")[0];
  const idAno = (d?.idade ?? []).filter((x) => x.ano === ano);
  const todos = idAno.find((x) => x.grupo_ordem === 0);
  const g1 = idAno.find((x) => x.grupo_ordem === 1);
  const g4 = idAno.find((x) => x.grupo_ordem === 4);
  const corr = d?.correlacao.find((x) => x.ano === ano);
  const altAno = (d?.alternancia ?? []).filter((x) => x.ano === ano);
  const altTodos = altAno.find((x) => x.grupo_ordem === 0);
  const temAlt = !!altTodos; // 2004 não tem pleito anterior

  const serie = <T extends { ano: number; grupo_ordem: number }>(linhas: T[], campo: (x: T) => number | null) =>
    [...new Set(linhas.map((x) => x.ano))].sort().map((a) => {
      const o: Record<string, number | null> = { ano: a };
      for (const g of [1, 2, 3, 4]) {
        const x = linhas.find((y) => y.ano === a && y.grupo_ordem === g);
        o[`g${g}`] = x ? campo(x) : null;
      }
      return o;
    });
  const serieIdade = serie(d?.idade ?? [], (x) => x.idade_media);
  const serieAlt = serie(d?.alternancia ?? [], (x) => x.pct_partido_mudou);
  const diffs = [1, 2, 3, 4].map((g) => {
    const x = idAno.find((y) => y.grupo_ordem === g);
    return { g, rotulo: curto(g), diff: x && todos ? Number((x.idade_media - todos.idade_media).toFixed(2)) : 0, media: x?.idade_media ?? 0, eleitos: x?.eleitos ?? 0 };
  });

  // eixo simétrico em torno de zero, com folga para o rótulo das barras
  const limite = Math.max(1, Math.ceil((Math.max(0, ...diffs.map((x) => Math.abs(x.diff))) + 0.4) * 2) / 2);

  return (
    <Secao
      id="q6"
      num="07 · Pergunta 6"
      titulo="A idade do município se reflete em quem ele elege?"
      descricao={
        <>
          Os 1.238 municípios foram divididos em <span className="destaque">quatro grupos pela idade mediana da população</span> (Censo
          2022, IBGE), cortados nos quartis. Para cada grupo, olhamos a idade dos prefeitos e vereadores eleitos nos seis pleitos municipais
          de 2004 a 2024 e se o poder mudou de partido de uma eleição para a seguinte. Idade = anos completos em 1º de outubro do ano da
          eleição. A idade mediana só existe para 2022, então o grupo é uma característica estrutural do município, aplicada a todos os
          pleitos. Eleições gerais (2018 e 2022) não entram: os eleitos não pertencem a um município.
        </>
      }
    >
      <div className="filtros">
        <label className="campo">
          Cargo
          <select value={cargo} onChange={(e) => setCargo(e.target.value as "PREFEITO" | "VEREADOR")}>
            <option>VEREADOR</option>
            <option>PREFEITO</option>
          </select>
        </label>
        <label className="campo">
          Eleição
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="campo">
          Estado
          <select value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="TODAS">Todos (6 estados)</option>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
      </div>
      <Estado carregando={r.carregando} erro={r.erro} vazio={!!d && !todos} msgVazio="Sem eleitos para essa combinação." />

      {d && todos && g1 && g4 && (
        <div style={{ opacity: r.carregando ? 0.4 : 1, transition: "opacity .15s" }}>
          <div className="grade g4">
            <Stat
              rotulo={`Idade média dos ${cargo === "PREFEITO" ? "prefeitos" : "vereadores"} eleitos: município mais velho × mais jovem`}
              valor={sinal(g4.idade_media - g1.idade_media)}
              detalhe={`anos: ${g4.idade_media.toFixed(1).replace(".", ",")} nos municípios mais envelhecidos contra ${g1.idade_media.toFixed(1).replace(".", ",")} nos mais jovens`}
              hero
            />
            <Stat
              rotulo="Correlação entre município e eleitos"
              valor={corr ? corr.correlacao.toFixed(2).replace(".", ",") : "—"}
              detalhe={corr ? `${forca(corr.correlacao)}: cada ano a mais na idade mediana do município vai com ${corr.inclinacao.toFixed(2).replace(".", ",")} ano a mais na idade média dos eleitos` : undefined}
            />
            <Stat
              rotulo="Eleitos com 60 anos ou mais"
              valor={pct(g4.pct_60_mais)}
              detalhe={`nos municípios mais envelhecidos, contra ${pct(g1.pct_60_mais)} nos mais jovens`}
            />
            <Stat
              rotulo="Prefeito de partido diferente do anterior"
              valor={temAlt ? pct(altTodos.pct_partido_mudou) : "—"}
              detalhe={temAlt ? `${num(altTodos.transicoes)} municípios · reeleição de ${altTodos.pct_reeleicao == null ? "—" : pct(altTodos.pct_reeleicao)} dos que tentaram` : "2004 é o primeiro pleito: não há anterior para comparar"}
            />
          </div>

          <div className="grade g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Idade dos eleitos: diferença para a média · {ano}</h3>
              <p className="sub">Idade média dos eleitos de cada grupo menos a de todos os municípios ({todos.idade_media.toFixed(1).replace(".", ",")} anos). Barras para a direita: eleitos mais velhos que a média.</p>
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={diffs} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} />
                    <YAxis domain={[-limite, limite]} ticks={[-limite, -limite / 2, 0, limite / 2, limite]} tickFormatter={(v) => (v > 0 ? "+" : "") + Number(v.toFixed(1)).toString().replace(".", ",")} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={40} />
                    <ReferenceLine y={0} stroke={t.axis} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.5 }}
                      content={({ active, payload }) => {
                        const x = payload?.[0]?.payload as (typeof diffs)[number] | undefined;
                        return active && x ? (
                          <Dica titulo={rotulo(x.g)} linhas={[{ rotulo: "idade média dos eleitos", valor: `${x.media.toFixed(1).replace(".", ",")} anos` }, { rotulo: "diferença para a média", valor: `${sinal(x.diff)} ano(s)` }, { rotulo: "eleitos", valor: num(x.eleitos) }]} />
                        ) : null;
                      }}
                    />
                    <Bar isAnimationActive={false} dataKey="diff" radius={[4, 4, 4, 4]} maxBarSize={44}>
                      {diffs.map((x) => <Cell key={x.g} fill={t[COR_GRUPO[x.g]]} />)}
                      <LabelList dataKey="diff" content={(lp) => {
                        const v = Number(lp.value);
                        const y0 = Number(lp.y);
                        const y1 = Number(lp.y) + Number(lp.height);
                        return <text x={Number(lp.x) + Number(lp.width) / 2} y={v >= 0 ? Math.min(y0, y1) - 6 : Math.max(y0, y1) + 14} textAnchor="middle" fill={t["text-primary"]} fontSize={12}>{sinal(v)}</text>;
                      }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Legenda itens={[1, 2, 3, 4].map((g) => ({ rotulo: rotulo(g), cor: t[COR_GRUPO[g]] }))} />
            </div>

            <div className="card">
              <h3>Os eleitos ficaram mais velhos, em todos os grupos</h3>
              <p className="sub">Idade média dos {cargo === "PREFEITO" ? "prefeitos" : "vereadores"} eleitos em cada pleito municipal.</p>
              <Linhas dados={serieIdade} t={t} formato={(v) => `${v.toFixed(1).replace(".", ",")} anos`} eixo={(v) => String(v)} rotulo={rotulo} />
            </div>
          </div>

          <div className="card">
            <h3>Alternância de poder: o prefeito mudou de partido?</h3>
            <p className="sub">
              Compara o prefeito eleito com o do pleito anterior, município a município. Partidos renomeados ou fundidos (PMDB→MDB; PFL, DEM e PSL→União)
              contam como o mesmo partido. Vale para prefeito, qualquer que seja o cargo escolhido acima.
            </p>
            <Linhas dados={serieAlt} t={t} formato={(v) => pct(v)} eixo={(v) => `${v}%`} rotulo={rotulo} dominio={[40, 90]} />
            <Tabela<Alt>
              colunas={[
                { titulo: "Pleito", valor: (x) => x.ano, numero: true },
                { titulo: "Municípios", valor: (x) => num(x.transicoes), numero: true },
                { titulo: "Partido mudou", valor: (x) => pct(x.pct_partido_mudou), numero: true },
                { titulo: "Prefeito mudou", valor: (x) => pct(x.pct_prefeito_mudou), numero: true },
                { titulo: "Prefeito tentou reeleição", valor: (x) => pct(x.pct_tentou_reeleicao), numero: true },
                { titulo: "Reeleito, entre os que tentaram", valor: (x) => (x.pct_reeleicao == null ? "—" : pct(x.pct_reeleicao)), numero: true },
              ]}
              linhas={d.alternancia.filter((x) => x.grupo_ordem === 0)}
            />
            <p className="nota">
              A taxa de reeleição só considera quem concorreu: a lei limita a duas eleições seguidas. Entre os grupos de município não há um padrão
              ligado à idade: a ordem entre eles muda de um pleito para o outro, e o que mais varia é o próprio pleito.
            </p>
          </div>

          <div className="card">
            <h3>Os números · {cargo === "PREFEITO" ? "prefeitos" : "vereadores"} eleitos em {ano}</h3>
            <Tabela<Idade>
              colunas={[
                { titulo: "Grupo de município", valor: (x) => rotulo(x.grupo_ordem) },
                { titulo: "Municípios", valor: (x) => num(x.municipios), numero: true },
                { titulo: "Eleitos", valor: (x) => num(x.eleitos), numero: true },
                { titulo: "Idade média", valor: (x) => x.idade_media.toFixed(1).replace(".", ","), numero: true },
                { titulo: "Idade mediana", valor: (x) => x.idade_mediana_eleitos, numero: true },
                { titulo: "Até 34 anos", valor: (x) => pct(x.pct_ate_34), numero: true },
                { titulo: "60 anos ou mais", valor: (x) => pct(x.pct_60_mais), numero: true },
              ]}
              linhas={[...idAno].sort((a, b) => (a.grupo_ordem || 9) - (b.grupo_ordem || 9))}
            />
            <p className="nota">
              Leia com cautela: a relação entre a idade do município e a dos eleitos é fraca, principalmente para prefeito. A idade mediana é de 2022 e
              descreve o município hoje; em 2004 ele pode ter sido bem diferente. A idade é calculada com a data de nascimento declarada ao TSE.
            </p>
            <VerSQL sql={r.sql} />
          </div>
        </div>
      )}
    </Secao>
  );
}

function Linhas(p: { dados: Record<string, number | null>[]; t: Tokens; formato: (v: number) => string; eixo: (v: number) => string; rotulo: (g: number) => string; dominio?: [number, number] }) {
  const { t } = p;
  return (
    <>
      <Legenda itens={[1, 2, 3, 4].map((g) => ({ rotulo: p.rotulo(g), cor: t[COR_GRUPO[g]] }))} />
      <div style={{ height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={p.dados} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey="ano" type="number" domain={["dataMin", "dataMax"]} ticks={p.dados.map((x) => Number(x.ano))} tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} />
            <YAxis domain={p.dominio ?? ["auto", "auto"]} tickFormatter={p.eixo} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={44} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <Dica
                    titulo={String(label)}
                    linhas={[1, 2, 3, 4].map((g) => {
                      const v = payload.find((x) => x.dataKey === `g${g}`)?.value;
                      return { rotulo: p.rotulo(g).split(" · ")[0], valor: v == null ? "—" : p.formato(Number(v)), cor: t[COR_GRUPO[g]] };
                    })}
                  />
                ) : null
              }
            />
            {[1, 2, 3, 4].map((g) => (
              <Line key={g} isAnimationActive={false} type="linear" dataKey={`g${g}`} stroke={t[COR_GRUPO[g]]} strokeWidth={2} dot={{ r: 4, stroke: t.surface, strokeWidth: 2, fill: t[COR_GRUPO[g]] }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
