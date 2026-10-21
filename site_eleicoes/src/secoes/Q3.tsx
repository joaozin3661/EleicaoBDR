import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { brl, num, pct } from "../formato";
import { useTokens } from "../tema";

type Grupo = {
  dimensao: string; grupo_ordem: number; municipios: number; municipios_anulados: number; aptos: number; pct_isentos: number | null;
  pct_abstencao: number | null; pct_brancos: number | null; pct_nulos: number | null; pct_eleitores_pop: number; idhm_medio: number;
  pib_per_capita_mediano: number; idhm_min: number; idhm_max: number; pib_min: number; pib_max: number;
};
type Partido = { dimensao: string; grupo_ordem: number; partido: string; eleitos: number; pct_do_grupo: number; posicao: number };
type Corr = { medida: string; municipios: number; correlacao: number };
type Dados = { grupos: Grupo[]; partidos: Partido[]; correlacao: Corr[] };

const UFS = ["AL", "PA", "PB", "PR", "SC", "SE"];
const NOME: Record<string, string[]> = {
  IDHM: ["", "Muito baixo (< 0,500)", "Baixo (0,500 a 0,599)", "Médio (0,600 a 0,699)", "Alto (0,700 a 0,799)", "Muito alto (0,800 ou mais)"],
  PIB: ["", "1º quartil · menor PIB per capita", "2º quartil", "3º quartil", "4º quartil · maior PIB per capita"],
};
const CURTO: Record<string, string[]> = {
  IDHM: ["", "Muito baixo", "Baixo", "Médio", "Alto", "Muito alto"],
  PIB: ["", "1º quartil", "2º quartil", "3º quartil", "4º quartil"],
};
const forca = (r: number) => (Math.abs(r) < 0.1 ? "praticamente nenhuma" : Math.abs(r) < 0.3 ? "fraca" : Math.abs(r) < 0.5 ? "moderada" : "forte");
const rc = (r: number) => r.toFixed(2).replace(".", ",");

export function Q3() {
  const t = useTokens();
  const [ano, setAno] = useState(2012);
  const [dim, setDim] = useState<"IDHM" | "PIB">("IDHM");
  const [cargo, setCargo] = useState<"PREFEITO" | "VEREADOR">("PREFEITO");
  const [uf, setUf] = useState("TODAS");
  const r = useApi<Dados>(`/api/q3?${qs({ ano, dim, cargo, uf })}`);
  const d = r.dados;

  const grupos = (d?.grupos ?? []).filter((g) => g.dimensao === dim && g.grupo_ordem > 0);
  const todos = d?.grupos.find((g) => g.dimensao === "TODOS");
  const corr = (m: string) => d?.correlacao.find((c) => c.medida === m);
  const nome = (g: number) => NOME[dim][g];
  const curto = (g: number) => CURTO[dim][g];

  // partidos: os 4 que mais elegem no total; os demais viram "Outros"
  const top = useMemo(() => (d?.partidos ?? []).filter((p) => p.dimensao === "TODOS").slice(0, 4).map((p) => p.partido), [d]);
  const corPartido = (p: string) => (p === "Outros" ? t.neutral : t[(["series-1", "series-2", "series-3", "series-4"] as const)[top.indexOf(p)]]);
  const linhasPartido = grupos.map((g) => {
    const ps = (d?.partidos ?? []).filter((p) => p.dimensao === dim && p.grupo_ordem === g.grupo_ordem);
    const total = ps.reduce((s, p) => s + p.eleitos, 0);
    const o: Record<string, number | string> = { grupo: curto(g.grupo_ordem), total, ordem: g.grupo_ordem };
    let usado = 0;
    for (const p of top) {
      const e = ps.find((x) => x.partido === p)?.eleitos ?? 0;
      o[p] = total ? (100 * e) / total : 0;
      o[`#${p}`] = e;
      usado += e;
    }
    o["Outros"] = total ? (100 * (total - usado)) / total : 0;
    o["#Outros"] = total - usado;
    const lider = ps[0];
    o["lider"] = lider ? `${lider.partido} (${pct(lider.pct_do_grupo)})` : "—";
    return o;
  });
  const chavesPartido = [...top, "Outros"];
  const topTodos = (d?.partidos ?? []).filter((p) => p.dimensao === "TODOS")[0];

  const isentos = grupos.map((g) => ({
    rotulo: curto(g.grupo_ordem), Abstenção: g.pct_abstencao ?? 0, Brancos: g.pct_brancos ?? 0, Nulos: g.pct_nulos ?? 0, g,
  }));
  const corIs = { Abstenção: t["series-1"], Brancos: t["series-3"], Nulos: t["series-2"] };
  const nomeIndice = dim === "IDHM" ? "IDHM" : "PIB per capita (em escala logarítmica)";

  return (
    <Secao
      id="q3"
      num="05 · Pergunta 3"
      titulo="Municípios mais desenvolvidos votam e elegem diferente?"
      descricao={
        <>
          Cruzamos os índices do município (<span className="destaque">IDHM, PIB per capita e a relação entre eleitores e população</span>) com o
          comportamento do eleitor (<span className="destaque">isentos = abstenções + votos em branco + votos nulos</span>) e com os partidos que
          mais elegem. O recorte é <span className="destaque">2008 e 2012</span>, as eleições municipais que cercam 2010, o único ano com IDHM
          municipal e Censo: os índices de 2010 valem como retrato do município para as duas eleições. Municípios cujo percentual de nulos foge muito do
          normal (votos de candidatos com registro indeferido entram como nulos no TSE) ficam fora das medidas de isentos, e a tela diz quantos.
        </>
      }
    >
      <div className="filtros">
        <label className="campo">
          Eleição
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            <option>2008</option>
            <option>2012</option>
          </select>
        </label>
        <label className="campo">
          Agrupar municípios por
          <select value={dim} onChange={(e) => setDim(e.target.value as "IDHM" | "PIB")}>
            <option value="IDHM">IDHM 2010 (faixas oficiais)</option>
            <option value="PIB">PIB per capita 2010 (quartis)</option>
          </select>
        </label>
        <label className="campo">
          Partidos de
          <select value={cargo} onChange={(e) => setCargo(e.target.value as "PREFEITO" | "VEREADOR")}>
            <option value="PREFEITO">Prefeitos eleitos</option>
            <option value="VEREADOR">Vereadores eleitos</option>
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
      <Estado carregando={r.carregando} erro={r.erro} vazio={!!d && grupos.length === 0} msgVazio="Sem municípios para essa combinação." />

      {d && grupos.length > 0 && (
        <div style={{ opacity: r.carregando ? 0.4 : 1, transition: "opacity .15s" }}>
          <div className="grade g4">
            <Stat
              rotulo={`Correlação ${nomeIndice} × isentos`}
              valor={corr("pct_isentos") ? rc(corr("pct_isentos")!.correlacao) : "—"}
              detalhe={corr("pct_isentos") ? `${forca(corr("pct_isentos")!.correlacao)}: municípios mais desenvolvidos têm ${corr("pct_isentos")!.correlacao < 0 ? "menos" : "mais"} isentos (${num(corr("pct_isentos")!.municipios)} municípios)` : undefined}
              hero
            />
            <Stat
              rotulo="Correlação com votos nulos"
              valor={corr("pct_nulos") ? rc(corr("pct_nulos")!.correlacao) : "—"}
              detalhe={corr("pct_nulos") ? `${forca(corr("pct_nulos")!.correlacao)}; com a abstenção: ${corr("pct_abstencao") ? rc(corr("pct_abstencao")!.correlacao) : "—"}; com votos em branco: ${corr("pct_brancos") ? rc(corr("pct_brancos")!.correlacao) : "—"}` : undefined}
            />
            <Stat
              rotulo="Eleitores por habitante"
              valor={todos ? pct(todos.pct_eleitores_pop) : "—"}
              detalhe={corr("pct_eleitores_pop") ? `no conjunto; correlação com o índice: ${rc(corr("pct_eleitores_pop")!.correlacao)} (${forca(corr("pct_eleitores_pop")!.correlacao)})` : undefined}
            />
            <Stat
              rotulo={`Partido que mais elege ${cargo === "PREFEITO" ? "prefeitos" : "vereadores"}`}
              valor={topTodos ? topTodos.partido : "—"}
              detalhe={topTodos ? `${pct(topTodos.pct_do_grupo)} dos eleitos (${num(topTodos.eleitos)})` : undefined}
            />
          </div>

          <div className="grade g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Quem não escolhe candidato · {ano}</h3>
              <p className="sub">Abstenções, votos em branco e nulos, em % dos eleitores aptos, por grupo de município (prefeito, 1º turno).</p>
              <Legenda itens={(["Abstenção", "Brancos", "Nulos"] as const).map((k) => ({ rotulo: k, cor: corIs[k] }))} />
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={isentos} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} interval={0} />
                    <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={44} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.5 }}
                      content={({ active, payload }) => {
                        const x = payload?.[0]?.payload as (typeof isentos)[number] | undefined;
                        return active && x ? (
                          <Dica
                            titulo={nome(x.g.grupo_ordem)}
                            linhas={[
                              { rotulo: "abstenção", valor: pct(x.Abstenção), cor: corIs.Abstenção },
                              { rotulo: "brancos", valor: pct(x.Brancos), cor: corIs.Brancos },
                              { rotulo: "nulos", valor: pct(x.Nulos), cor: corIs.Nulos },
                              { rotulo: "total de isentos", valor: x.g.pct_isentos == null ? "—" : pct(x.g.pct_isentos) },
                              { rotulo: "municípios na medida", valor: `${num(x.g.municipios - x.g.municipios_anulados)} de ${num(x.g.municipios)}` },
                            ]}
                          />
                        ) : null;
                      }}
                    />
                    {(["Abstenção", "Brancos", "Nulos"] as const).map((k, i) => (
                      <Bar key={k} isAnimationActive={false} dataKey={k} stackId="i" fill={corIs[k]} stroke={t.surface} strokeWidth={2} maxBarSize={56}
                        radius={i === 2 ? [4, 4, 0, 0] : 0}>
                        {k !== "Brancos" && (
                          <LabelList dataKey={k} content={(lp) => Number(lp.value) >= 3.5 ? (
                            <text x={Number(lp.x) + Number(lp.width) / 2} y={Number(lp.y) + Number(lp.height) / 2} dy={4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>{Number(lp.value).toFixed(0)}%</text>
                          ) : null} />
                        )}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3>Eleitores para cada 100 habitantes · {ano}</h3>
              <p className="sub">Eleitores aptos da eleição divididos pela população do Censo 2010. Reflete a idade da população: onde há mais crianças, há menos eleitores.</p>
              <div style={{ height: 300, marginTop: 28 }}>
                <ResponsiveContainer>
                  <BarChart data={grupos.map((g) => ({ rotulo: curto(g.grupo_ordem), v: g.pct_eleitores_pop, g }))} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} interval={0} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}`} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={36} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.5 }}
                      content={({ active, payload }) => {
                        const x = payload?.[0]?.payload as { g: Grupo; v: number } | undefined;
                        return active && x ? <Dica titulo={nome(x.g.grupo_ordem)} linhas={[{ rotulo: "eleitores por 100 habitantes", valor: x.v.toFixed(1).replace(".", ",") }, { rotulo: "municípios", valor: num(x.g.municipios) }]} /> : null;
                      }}
                    />
                    <Bar isAnimationActive={false} dataKey="v" fill={t["series-1"]} radius={[4, 4, 0, 0]} maxBarSize={56}>
                      <LabelList dataKey="v" position="top" formatter={(v: number) => v.toFixed(0)} fill={t["text-primary"]} fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Quais partidos mais elegem em cada tipo de município · {cargo === "PREFEITO" ? "prefeitos" : "vereadores"} de {ano}</h3>
            <p className="sub">Participação de cada partido entre os eleitos do grupo. Os quatro partidos que mais elegem no conjunto têm cor própria; os demais aparecem juntos em cinza. Sigla do partido na época.</p>
            <Legenda itens={chavesPartido.map((p) => ({ rotulo: p, cor: corPartido(p) }))} />
            <div style={{ height: 70 + 52 * linhasPartido.length }}>
              <ResponsiveContainer>
                <BarChart layout="vertical" data={linhasPartido} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={t.grid} />
                  <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} />
                  <YAxis type="category" dataKey="grupo" width={92} tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-secondary"], fontSize: 13 }} />
                  <Tooltip
                    cursor={{ fill: t.grid, opacity: 0.4 }}
                    content={({ active, payload }) => {
                      const l = payload?.[0]?.payload as Record<string, number | string> | undefined;
                      if (!active || !l) return null;
                      return (
                        <Dica
                          titulo={`${nome(Number(l.ordem))} · ${num(Number(l.total))} eleitos`}
                          linhas={chavesPartido.map((p) => ({ rotulo: p, valor: `${pct(Number(l[p]))} · ${num(Number(l[`#${p}`]))}`, cor: corPartido(p) }))}
                        />
                      );
                    }}
                  />
                  {chavesPartido.map((p, i) => (
                    <Bar key={p} isAnimationActive={false} dataKey={p} stackId="p" fill={corPartido(p)} stroke={t.surface} strokeWidth={2} maxBarSize={36}
                      radius={i === chavesPartido.length - 1 ? [0, 4, 4, 0] : 0}>
                      <LabelList dataKey={p} content={(lp) => Number(lp.value) >= 9 ? (
                        <text x={Number(lp.x) + Number(lp.width) / 2} y={Number(lp.y) + Number(lp.height) / 2} dy={4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600}>{Math.round(Number(lp.value))}%</text>
                      ) : null} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>Os números · {ano}, agrupado por {dim === "IDHM" ? "IDHM" : "PIB per capita"}</h3>
            <Tabela<Grupo>
              colunas={[
                { titulo: "Grupo", valor: (g) => nome(g.grupo_ordem) },
                { titulo: "Municípios", valor: (g) => num(g.municipios), numero: true },
                { titulo: "Sem votação anulada", valor: (g) => num(g.municipios - g.municipios_anulados), numero: true },
                { titulo: "Isentos", valor: (g) => (g.pct_isentos == null ? "—" : pct(g.pct_isentos)), numero: true },
                { titulo: "Abstenção", valor: (g) => (g.pct_abstencao == null ? "—" : pct(g.pct_abstencao)), numero: true },
                { titulo: "Brancos", valor: (g) => (g.pct_brancos == null ? "—" : pct(g.pct_brancos)), numero: true },
                { titulo: "Nulos", valor: (g) => (g.pct_nulos == null ? "—" : pct(g.pct_nulos)), numero: true },
                { titulo: "Eleitores/100 hab.", valor: (g) => g.pct_eleitores_pop.toFixed(1).replace(".", ","), numero: true },
                { titulo: "PIB per capita mediano", valor: (g) => brl(g.pib_per_capita_mediano), numero: true },
              ]}
              linhas={grupos}
            />
            <p className="nota">
              As faixas do IDHM são as oficiais do Atlas Brasil; os grupos "muito baixo" e "muito alto" são pequenos (10 e 13 municípios nos 6 estados), então leia-os com cautela.
              Isentos e seus componentes não incluem os municípios com votação anulada (coluna "Sem votação anulada"); a relação eleitores/população inclui todos.
              IDHM, PIB e população são de 2010: a eleição de 2008 vem dois anos antes do retrato e a de 2012, dois anos depois. Três municípios criados depois de 2010 ficam de fora.
              As correlações medem associação entre municípios, não causa.
            </p>
            <VerSQL sql={r.sql} />
          </div>
        </div>
      )}
    </Secao>
  );
}
