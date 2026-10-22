import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { num, pct, vezes } from "../formato";
import { useTokens, type Tokens } from "../tema";
import { Colunas } from "./Q2";

type Sucesso = { ordem: number; grau: string; candidatos: number; eleitos: number; taxa_sucesso: number };
type Repr = { ordem: number; grau: string; candidatos: number; eleitos: number; eleitores: number; pct_candidatos: number; pct_eleitos: number | null; pct_eleitorado: number };
type Grupo = {
  grupo_ordem: number; municipios: number; eleitos: number; anos_eleitorado_min: number; anos_eleitorado_max: number;
  anos_eleitorado_medio: number; anos_eleitos_medio: number; pct_superior_eleitorado: number; pct_superior_eleitos: number;
  anos_votados_medio: number | null; pct_superior_votados: number | null;
};
type Dados = { sucesso: Sucesso[]; representacao: Repr[]; grupos: Grupo[]; correlacao: { municipios: number; correlacao: number; inclinacao: number; correlacao_votados: number | null } | null; municipal: boolean };

const UFS = ["AL", "PA", "PB", "PR", "SC", "SE"];
const CURTO = ["Analf.", "Lê/escr.", "Fund. i.", "Fund. c.", "Méd. i.", "Méd. c.", "Sup. i.", "Sup. c."]; // i = incompleto, c = completo
const ANOS_ESTUDO = [0, 2, 5, 9, 10, 12, 14, 16]; // anos de estudo equivalentes por grau (convenção do projeto)
const virgula = (v: number, c = 1) => v.toFixed(c).replace(".", ",");
const forca = (r: number) => (Math.abs(r) < 0.1 ? "praticamente nenhuma" : Math.abs(r) < 0.3 ? "fraca" : Math.abs(r) < 0.5 ? "moderada" : "forte");
const NOME_GRUPO = ["Todos os municípios", "1º quarto · eleitorado menos escolarizado", "2º quarto", "3º quarto", "4º quarto · eleitorado mais escolarizado"];

export function Q4() {
  const t = useTokens();
  const op = useApi<{ ano: number; cargo: string }[]>("/api/q4/opcoes");
  const anos = useMemo(() => [...new Set((op.dados ?? []).map((o) => o.ano))].sort(), [op.dados]);
  const [ano, setAno] = useState(2024);
  const cargos = (op.dados ?? []).filter((o) => o.ano === ano).map((o) => o.cargo);
  const [cargo, setCargo] = useState("VEREADOR");
  const [uf, setUf] = useState("TODAS");
  useEffect(() => {
    if (cargos.length && !cargos.includes(cargo)) setCargo(cargos.includes("VEREADOR") ? "VEREADOR" : cargos.includes("DEPUTADO FEDERAL") ? "DEPUTADO FEDERAL" : cargos[0]);
  }, [ano, cargos.join()]);
  const r = useApi<Dados>(op.dados && cargos.includes(cargo) ? `/api/q4?${qs({ ano, cargo, uf })}` : null);
  const d = r.dados;

  const tot = (d?.sucesso ?? []).reduce((a, x) => ({ c: a.c + x.candidatos, e: a.e + x.eleitos }), { c: 0, e: 0 });
  const sup = d?.sucesso.find((x) => x.ordem === 7);
  const resto = sup ? { c: tot.c - sup.candidatos, e: tot.e - sup.eleitos } : null;
  const taxaSup = sup && sup.candidatos ? (100 * sup.eleitos) / sup.candidatos : null;
  const taxaResto = resto && resto.c ? (100 * resto.e) / resto.c : null;
  const rep = (o: number) => d?.representacao.find((x) => x.ordem === o);
  const media = (campo: "pct_eleitorado" | "pct_candidatos" | "pct_eleitos") =>
    (d?.representacao ?? []).reduce((s, x) => s + ((x[campo] ?? 0) * ANOS_ESTUDO[x.ordem]) / 100, 0);
  const ateFund = (campo: "pct_eleitorado" | "pct_eleitos") => (d?.representacao ?? []).filter((x) => x.ordem <= 3).reduce((s, x) => s + (x[campo] ?? 0), 0);
  const grupoOk = (g: Grupo) => g.grupo_ordem > 0;

  return (
    <Secao
      id="q4"
      num="06 · Pergunta 4"
      titulo="Escolaridade de quem se candidata, de quem se elege e de quem vota"
      descricao={
        <>
          Duas perguntas. <span className="destaque">Parte 1:</span> candidatos mais escolarizados se elegem mais? (2022 e 2024.){" "}
          <span className="destaque">Parte 2:</span> municípios cujo eleitorado tem menos escolaridade elegem representantes de menos escolaridade?
          (Em 2024, prefeito e vereador pertencem ao município. Em 2022, para deputados, mede-se pelos votos: a escolaridade dos eleitos ponderada
          pelos votos que o município deu a eles. Governador e senador ficam fora.) A escolaridade do
          candidato é a declarada ao TSE; a do eleitorado vem do perfil dos eleitores aptos do 1º turno. Para tirar médias, cada grau vale uma
          quantidade de anos de estudo equivalentes (fundamental incompleto 5, completo 9, médio completo 12, superior completo 16).
          Vices e suplentes de senador ficam de fora.
        </>
      }
    >
      <div className="filtros">
        <label className="campo">
          Eleição
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="campo">
          Cargo
          <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
            {cargos.map((c) => <option key={c}>{c}</option>)}
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
      <Estado carregando={op.carregando || r.carregando} erro={op.erro ?? r.erro} vazio={!!d && d.sucesso.length === 0} msgVazio="Sem candidatos para essa combinação." />

      {d && d.sucesso.length > 0 && (
        <div style={{ opacity: r.carregando ? 0.4 : 1, transition: "opacity .15s" }}>
          <div className="grade g4">
            <Stat
              rotulo="Candidato com superior completo se elege quantas vezes mais?"
              valor={taxaSup != null && taxaResto ? vezes(taxaSup / taxaResto) : "—"}
              detalhe={taxaSup != null && taxaResto != null ? `${pct(taxaSup)} de sucesso, contra ${pct(taxaResto)} dos candidatos com menos estudo` : "poucos candidatos nesta seleção"}
              hero
            />
            <Stat
              rotulo="Dos eleitos, têm superior completo"
              valor={rep(7)?.pct_eleitos == null ? "—" : pct(rep(7)!.pct_eleitos!)}
              detalhe={rep(7) ? `contra ${pct(rep(7)!.pct_candidatos)} dos candidatos e ${pct(rep(7)!.pct_eleitorado)} do eleitorado` : undefined}
            />
            <Stat
              rotulo="Escolaridade média dos eleitos × eleitorado"
              valor={`${virgula(media("pct_eleitos"))} × ${virgula(media("pct_eleitorado"))}`}
              detalhe="anos de estudo equivalentes: eleitos contra eleitores"
            />
            <Stat
              rotulo="Eleitores até o fundamental completo"
              valor={pct(ateFund("pct_eleitorado"))}
              detalhe={`do eleitorado, mas só ${pct(ateFund("pct_eleitos"))} dos eleitos`}
            />
          </div>

          <div className="grade g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Parte 1 · Taxa de sucesso por escolaridade</h3>
              <p className="sub">Parte dos candidatos de cada grau que foi eleita (Fund. = fundamental, Méd. = médio, Sup. = superior; i = incompleto, c = completo). A linha marca a taxa geral do cargo.</p>
              <Colunas
                linhas={d.sucesso.map((x) => ({
                  rotulo: CURTO[x.ordem],
                  taxa: x.taxa_sucesso,
                  detalhe: [{ rotulo: "candidatos", valor: num(x.candidatos) }, { rotulo: "eleitos", valor: num(x.eleitos) }],
                }))}
                geral={tot.c ? (100 * tot.e) / tot.c : 0}
              />
            </div>
            <div className="card">
              <h3>Quem vota, quem se candidata e quem se elege</h3>
              <p className="sub">Distribuição por escolaridade: o eleitorado ({ano}) contra os candidatos e os eleitos.</p>
              <Representacao linhas={d.representacao} t={t} />
            </div>
          </div>

          {d.municipal ? <Parte2 d={d} t={t} ano={ano} cargo={cargo} grupoOk={grupoOk} /> : (
            <div className="card">
              <h3>Parte 2 · Município a município</h3>
              <p className="aviso" style={{ marginTop: 8 }}>
                Para {cargo.toLowerCase()} de {ano} a comparação município a município não é feita: governador e senador representam o estado e
                os votos por município deles não foram carregados. A parte 2 cobre prefeito e vereador de 2024 e deputado federal e estadual de 2022.
                Aqui a comparação é entre o eleitorado e os eleitos do estado, no gráfico acima.
              </p>
            </div>
          )}

          <div className="card">
            <h3>Os números · {cargo.toLowerCase()} {ano}</h3>
            <Tabela<Repr>
              colunas={[
                { titulo: "Escolaridade", valor: (x) => x.grau.charAt(0) + x.grau.slice(1).toLowerCase() },
                { titulo: "Eleitores", valor: (x) => num(x.eleitores), numero: true },
                { titulo: "% do eleitorado", valor: (x) => pct(x.pct_eleitorado), numero: true },
                { titulo: "Candidatos", valor: (x) => num(x.candidatos), numero: true },
                { titulo: "% dos candidatos", valor: (x) => pct(x.pct_candidatos), numero: true },
                { titulo: "Eleitos", valor: (x) => num(x.eleitos), numero: true },
                { titulo: "% dos eleitos", valor: (x) => (x.pct_eleitos == null ? "—" : pct(x.pct_eleitos)), numero: true },
                { titulo: "Taxa de sucesso", valor: (x) => { const s = d.sucesso.find((y) => y.ordem === x.ordem); return s ? pct(s.taxa_sucesso) : "—"; }, numero: true },
              ]}
              linhas={d.representacao}
            />
            <p className="nota">
              Nenhum candidato a prefeito, vereador ou deputado declarou-se analfabeto, e esse grupo aparece só no eleitorado. Candidatos que não divulgaram a
              escolaridade (1 caso em 2024) ficam de fora. A escolaridade do candidato é autodeclarada; a do eleitor é a do cadastro eleitoral.
              A associação entre estudo e eleição não é causal: quem tem mais estudo também tende a ter mais patrimônio, mais estrutura de campanha e partidos maiores.
            </p>
            <VerSQL sql={r.sql} />
          </div>
        </div>
      )}
    </Secao>
  );
}

function Representacao({ linhas, t }: { linhas: Repr[]; t: Tokens }) {
  const dados = linhas.map((x) => ({ rotulo: CURTO[x.ordem], Eleitorado: x.pct_eleitorado, Candidatos: x.pct_candidatos, Eleitos: x.pct_eleitos ?? 0 }));
  const cores = { Eleitorado: t.neutral, Candidatos: t["series-1"], Eleitos: t["series-2"] };
  return (
    <>
      <Legenda itens={(["Eleitorado", "Candidatos", "Eleitos"] as const).map((k) => ({ rotulo: k, cor: cores[k] }))} />
      <div style={{ height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 11 }} interval={0} />
            <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={44} />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.5 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <Dica titulo={String(label)} linhas={(["Eleitorado", "Candidatos", "Eleitos"] as const).map((k) => ({ rotulo: k, valor: pct(Number(payload.find((x) => x.dataKey === k)?.value ?? 0)), cor: cores[k] }))} />
                ) : null
              }
            />
            {(["Eleitorado", "Candidatos", "Eleitos"] as const).map((k) => (
              <Bar key={k} isAnimationActive={false} dataKey={k} fill={cores[k]} radius={[3, 3, 0, 0]} maxBarSize={16} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Parte2({ d, t, ano, cargo, grupoOk }: { d: Dados; t: Tokens; ano: number; cargo: string; grupoOk: (g: Grupo) => boolean }) {
  const quartos = d.grupos.filter(grupoOk);
  const todos = d.grupos.find((g) => g.grupo_ordem === 0);
  const g1 = quartos.find((g) => g.grupo_ordem === 1);
  const g4 = quartos.find((g) => g.grupo_ordem === 4);
  const dados = quartos.map((g) => ({ rotulo: `${g.grupo_ordem}º quarto`, Eleitorado: g.anos_eleitorado_medio, Eleitos: g.anos_eleitos_medio, g }));
  const cor = { Eleitorado: t.neutral, Eleitos: t["series-2"] };
  const c = d.correlacao;
  const deputado = cargo.startsWith("DEPUTADO");
  const eleitosNome = cargo === "PREFEITO" ? "prefeitos" : cargo === "VEREADOR" ? "vereadores" : cargo === "DEPUTADO FEDERAL" ? "deputados federais" : "deputados estaduais";
  return (
    <div className="card">
      <h3>Parte 2 · Eleitorado e eleitos, município a município ({ano})</h3>
      <p className="sub">
        Os municípios foram divididos em quatro grupos pela escolaridade média do eleitorado (anos de estudo equivalentes). Para cada grupo: a escolaridade
        média do eleitorado e a dos {eleitosNome} eleitos
        {deputado ? ", ponderada pelos votos que os municípios do grupo deram a eles (o deputado representa o estado, não o município)" : ""}.
      </p>
      <div className="grade g3" style={{ marginTop: 12 }}>
        <Stat
          rotulo="Correlação município a município"
          valor={c ? virgula(c.correlacao, 2) : "—"}
          detalhe={c ? `${forca(c.correlacao)}: cada ano de estudo a mais no eleitorado vai com ${virgula(c.inclinacao, 2)} ano a mais nos eleitos (${num(c.municipios)} municípios)${c.correlacao_votados != null ? `. Considerando todos os candidatos votados, não só os eleitos: ${virgula(c.correlacao_votados, 2)}` : ""}` : undefined}
          hero
        />
        <Stat
          rotulo="Eleitos com superior completo"
          valor={g1 && g4 ? `${pct(g1.pct_superior_eleitos)} → ${pct(g4.pct_superior_eleitos)}` : "—"}
          detalhe={g1 && g4 ? `nos municípios de eleitorado menos × mais escolarizado (eleitorado com superior: ${pct(g1.pct_superior_eleitorado)} → ${pct(g4.pct_superior_eleitorado)})` : undefined}
        />
        <Stat
          rotulo="Eleitos × eleitorado, em todos os grupos"
          valor={todos ? `+${virgula(todos.anos_eleitos_medio - todos.anos_eleitorado_medio)} anos` : "—"}
          detalhe={todos ? `os eleitos têm ${virgula(todos.anos_eleitos_medio)} anos de estudo equivalentes, o eleitorado ${virgula(todos.anos_eleitorado_medio)}` : undefined}
        />
      </div>
      <Legenda itens={(["Eleitorado", "Eleitos"] as const).map((k) => ({ rotulo: k, cor: cor[k] }))} />
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={dados} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barGap={3}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} />
            <YAxis domain={[0, 16]} ticks={[0, 4, 8, 12, 16]} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={40} />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.5 }}
              content={({ active, payload }) => {
                const x = payload?.[0]?.payload as (typeof dados)[number] | undefined;
                return active && x ? (
                  <Dica
                    titulo={NOME_GRUPO[x.g.grupo_ordem]}
                    linhas={[
                      { rotulo: "anos de estudo do eleitorado", valor: virgula(x.g.anos_eleitorado_medio), cor: cor.Eleitorado },
                      { rotulo: "anos de estudo dos eleitos", valor: virgula(x.g.anos_eleitos_medio), cor: cor.Eleitos },
                      { rotulo: "municípios", valor: num(x.g.municipios) },
                    ]}
                  />
                ) : null;
              }}
            />
            {(["Eleitorado", "Eleitos"] as const).map((k) => (
              <Bar key={k} isAnimationActive={false} dataKey={k} fill={cor[k]} radius={[4, 4, 0, 0]} maxBarSize={36}>
                <LabelList dataKey={k} position="top" formatter={(v: number) => virgula(v)} fill={t["text-primary"]} fontSize={12} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Tabela<Grupo>
        colunas={[
          { titulo: "Grupo de município", valor: (g) => NOME_GRUPO[g.grupo_ordem] },
          { titulo: "Municípios", valor: (g) => num(g.municipios), numero: true },
          { titulo: "Eleitorado (anos de estudo)", valor: (g) => (g.grupo_ordem === 0 ? virgula(g.anos_eleitorado_medio, 2) : `${virgula(g.anos_eleitorado_min, 2)} a ${virgula(g.anos_eleitorado_max, 2)}`), numero: true },
          { titulo: "Eleitorado com superior", valor: (g) => pct(g.pct_superior_eleitorado), numero: true },
          { titulo: "Eleitos (anos de estudo)", valor: (g) => virgula(g.anos_eleitos_medio, 2), numero: true },
          { titulo: "Eleitos com superior", valor: (g) => pct(g.pct_superior_eleitos), numero: true },
          ...(deputado
            ? [{ titulo: "Todos os votados (anos de estudo)", valor: (g: Grupo) => (g.anos_votados_medio == null ? "—" : virgula(g.anos_votados_medio, 2)), numero: true }]
            : []),
        ]}
        linhas={[...d.grupos].sort((a, b) => (a.grupo_ordem || 9) - (b.grupo_ordem || 9))}
      />
      <p className="nota">
        O grupo é definido pelos 1.238 municípios dos 6 estados; ao escolher um estado, só mudam os municípios mostrados, não os cortes.
        {deputado && " Em 2022, a escolaridade dos eleitos de um município é a média da escolaridade dos deputados eleitos, ponderada pelos votos que o município deu a eles; os votos de candidatos sem escolaridade divulgada ficam de fora."}
      </p>
    </div>
  );
}
