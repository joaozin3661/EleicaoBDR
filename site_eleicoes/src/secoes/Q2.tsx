import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { brl, brlCurto, num, pct, vezes } from "../formato";
import { useTokens, type Tokens } from "../tema";

type Resumo = {
  candidatos: number; eleitos: number; taxa_sucesso: number; pct_sem_bens: number;
  mediana_eleitos: number; mediana_nao_eleitos: number; declaracoes_acima_100mi: number;
};
type Faixa = { ordem: number; faixa: string; candidatos: number; eleitos: number; taxa_sucesso: number; patrimonio_mediano: number };
type Quintil = { quintil: number; candidatos: number; eleitos: number; taxa_sucesso: number; patrimonio_min: number; patrimonio_max: number };
type Dados = { resumo: Resumo | null; faixas: Faixa[]; quintis: Quintil[] };

const UFS = ["AL", "PA", "PB", "PR", "SC", "SE"];
const CURTO = ["Sem bens", "Até 50 mil", "50–200 mil", "200 mil–1 mi", "1–5 mi", "Mais de 5 mi"];
const NOME_QUINTIL = ["Sem bens", "1º quinto", "2º quinto", "3º quinto", "4º quinto", "5º quinto"];
const DESC_QUINTIL = ["não declarou nenhum bem", "os 20% com menos patrimônio", "", "", "", "os 20% com mais patrimônio"];

const MIN_QUINTO = 20;
const taxa = (g: { eleitos: number; candidatos: number }) => g.eleitos / g.candidatos;

/** Compara a taxa de sucesso de dois grupos com eleitos/candidatos crus (não com a taxa já arredondada). */
function compara(a: Quintil | undefined, b: Quintil | undefined, ok: boolean, nomeB: string) {
  if (!a || !b || !ok) return { valor: "—", detalhe: "poucos candidatos com bens nesta seleção para dividir em quintos" };
  const ta = 100 * taxa(a);
  const tb = 100 * taxa(b);
  if (b.eleitos === 0) return { valor: `${pct(ta)} × 0%`, detalhe: `nenhum eleito ${nomeB}` };
  const r = ta / tb;
  const aviso = b.eleitos < 5 ? ` · só ${b.eleitos} eleito(s) ${nomeB}, leia com cautela` : "";
  // o texto acompanha o número exibido: 0,95 a 1,05 aparece como "1,0×" e é praticamente a mesma taxa
  const leitura = r >= 0.95 && r < 1.05 ? " — praticamente a mesma taxa" : r < 1 ? " — aqui os mais ricos se elegem menos" : "";
  return { valor: vezes(r), detalhe: `${pct(ta)} contra ${pct(tb)} ${nomeB}${leitura}${aviso}` };
}

const faixaQuintil = (q: Quintil) =>
  q.quintil === 0 ? "R$ 0" : q.quintil === 1 ? `até ${brlCurto(q.patrimonio_max)}` : `${brlCurto(q.patrimonio_min)} a ${brlCurto(q.patrimonio_max)}`;

export function Q2() {
  const op = useApi<{ ano: number; cargo: string }[]>("/api/q2/opcoes");
  const cargos = useMemo(() => [...new Set((op.dados ?? []).map((o) => o.cargo))], [op.dados]);
  const [cargo, setCargo] = useState("VEREADOR");
  const anos = (op.dados ?? []).filter((o) => o.cargo === cargo).map((o) => o.ano);
  const [ano, setAno] = useState(2024);
  const [uf, setUf] = useState("TODAS");
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[anos.length - 1]);
  }, [anos.join(), ano]);
  const r = useApi<Dados>(op.dados && anos.includes(ano) ? `/api/q2?${qs({ ano, cargo, uf })}` : null);
  const d = r.dados;
  const sem = d?.quintis.find((q) => q.quintil === 0);
  const ricos = d?.quintis.find((q) => q.quintil === 5);
  const pobres = d?.quintis.find((q) => q.quintil === 1);
  // quintos só fazem sentido com grupos de tamanho razoável (governador/senador por UF têm 1 ou 2 por quinto)
  const menorQuinto = Math.min(...(d?.quintis ?? []).filter((q) => q.quintil > 0).map((q) => q.candidatos), Infinity);
  const quintisOk = !!ricos && menorQuinto >= MIN_QUINTO;

  return (
    <Secao
      id="q2"
      num="04 · Pergunta 2"
      titulo="Quem tem mais patrimônio se elege mais?"
      descricao={
        <>
          Patrimônio = soma dos bens que o candidato declarou ao TSE no registro da candidatura;{" "}
          <span className="destaque">quem não declarou nenhum bem conta como R$ 0</span>. Taxa de sucesso = eleitos ÷
          candidatos que chegaram ao resultado. Sempre dentro de um cargo, porque o patrimônio típico de um vereador e o
          de um governador estão em escalas diferentes. Vices e suplentes de senador ficam de fora. Candidatos com registro
          indeferido que foram à urna contam como não eleitos (o TSE não publica essa situação em 2024, então não dá para
          separá-los em todos os anos).
        </>
      }
    >
      <div className="filtros">
        <label className="campo">
          Cargo
          <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
            {cargos.map((c) => <option key={c}>{c}</option>)}
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
      <Estado carregando={op.carregando || r.carregando} erro={op.erro ?? r.erro} vazio={!!d && !d.resumo} msgVazio="Sem candidatos para essa combinação." />

      {d?.resumo && (
        <>
          <div className="grade g4">
            <Stat rotulo="Quinto mais rico × sem bens" {...compara(ricos, sem, quintisOk, "entre quem não declarou bens")} hero />
            <Stat rotulo="Quinto mais rico × quinto mais pobre" {...compara(ricos, pobres, quintisOk, "no quinto mais pobre")} />
            <Stat
              rotulo="Patrimônio mediano dos eleitos"
              valor={brlCurto(d.resumo.mediana_eleitos)}
              detalhe={`contra ${brlCurto(d.resumo.mediana_nao_eleitos)} dos não eleitos`}
            />
            <Stat
              rotulo="Não declararam nenhum bem"
              valor={pct(d.resumo.pct_sem_bens)}
              detalhe={`dos ${num(d.resumo.candidatos)} candidatos · taxa geral de sucesso ${pct(d.resumo.taxa_sucesso)}`}
            />
          </div>

          <div className="grade g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Taxa de sucesso por faixa de patrimônio</h3>
              <p className="sub">Faixas fixas em reais. A linha marca a taxa geral do cargo.</p>
              <Colunas
                linhas={d.faixas.map((f) => ({
                  rotulo: CURTO[f.ordem],
                  taxa: f.taxa_sucesso,
                  detalhe: [
                    { rotulo: "candidatos", valor: num(f.candidatos) },
                    { rotulo: "eleitos", valor: num(f.eleitos) },
                    { rotulo: "patrimônio mediano", valor: brl(f.patrimonio_mediano) },
                  ],
                }))}
                geral={d.resumo.taxa_sucesso}
              />
            </div>
            <div className="card">
              <h3>Taxa de sucesso por quinto de patrimônio</h3>
              <p className="sub">Quem declarou algum bem, dividido em 5 grupos do mesmo tamanho, do mais pobre ao mais rico.</p>
              {!quintisOk ? (
                <p className="aviso" style={{ marginTop: 24 }}>
                  Poucos candidatos com bens nesta seleção para dividir em cinco grupos
                  {Number.isFinite(menorQuinto) ? ` (o menor teria ${menorQuinto})` : ""}. Use as faixas ao lado
                  {uf === "TODAS" ? " — este cargo tem poucos candidatos mesmo somando os 6 estados." : ' ou escolha "Todos (6 estados)".'}
                </p>
              ) : (
              <Colunas
                linhas={d.quintis.map((q) => ({
                  rotulo: NOME_QUINTIL[q.quintil],
                  taxa: q.taxa_sucesso,
                  detalhe: [
                    { rotulo: "candidatos", valor: num(q.candidatos) },
                    { rotulo: "eleitos", valor: num(q.eleitos) },
                    { rotulo: "patrimônio", valor: faixaQuintil(q) },
                  ],
                }))}
                geral={d.resumo.taxa_sucesso}
              />
              )}
            </div>
          </div>

          <div className="card">
            <h3>Os números</h3>
            <div className="grade g2">
              <Tabela<Faixa>
                colunas={[
                  { titulo: "Faixa", valor: (f) => f.faixa },
                  { titulo: "Candidatos", valor: (f) => num(f.candidatos), numero: true },
                  { titulo: "Eleitos", valor: (f) => num(f.eleitos), numero: true },
                  { titulo: "Taxa", valor: (f) => pct(f.taxa_sucesso), numero: true },
                  { titulo: "Mediana", valor: (f) => brl(f.patrimonio_mediano), numero: true },
                ]}
                linhas={d.faixas}
              />
              {quintisOk || d.quintis.some((q) => q.quintil === 0) ? (
                <Tabela<Quintil>
                  colunas={[
                    { titulo: "Grupo", valor: (q) => <>{NOME_QUINTIL[q.quintil]}{DESC_QUINTIL[q.quintil] && <span className="vazio"> · {DESC_QUINTIL[q.quintil]}</span>}</> },
                    { titulo: "Patrimônio", valor: (q) => faixaQuintil(q) },
                    { titulo: "Candidatos", valor: (q) => num(q.candidatos), numero: true },
                    { titulo: "Taxa", valor: (q) => pct(q.taxa_sucesso), numero: true },
                  ]}
                  linhas={quintisOk ? d.quintis : d.quintis.filter((q) => q.quintil === 0)}
                />
              ) : (
                <p className="aviso">Quintos ocultos: poucos candidatos com bens nesta seleção.</p>
              )}
            </div>
            <p className="nota">
              Usamos faixas e mediana, nunca a média: a base tem declarações absurdas, como uma casa de R$ 1 bilhão
              (erro de digitação na origem, que o TSE publica como veio).
              {d.resumo.declaracoes_acima_100mi > 0 && ` Nesta seleção, ${d.resumo.declaracoes_acima_100mi} candidato(s) declararam mais de R$ 100 milhões.`}
            </p>
            <VerSQL sql={r.sql} />
          </div>
        </>
      )}
    </Secao>
  );
}

export function Colunas(p: { linhas: { rotulo: string; taxa: number; detalhe: { rotulo: string; valor: string }[] }[]; geral: number }) {
  const t: Tokens = useTokens();
  return (
    <div style={{ height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={p.linhas} margin={{ top: 24, right: 64, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={t.grid} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 11 }} interval={0} />
          <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={44} />
          <Tooltip
            cursor={{ fill: t.grid, opacity: 0.5 }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as (typeof p.linhas)[number] | undefined;
              return active && d ? <Dica titulo={d.rotulo} linhas={[{ rotulo: "taxa de sucesso", valor: pct(d.taxa), cor: t["series-1"] }, ...d.detalhe]} /> : null;
            }}
          />
          <ReferenceLine y={p.geral} stroke={t["text-muted"]} label={{ value: `geral ${pct(p.geral)}`, position: "right", fill: t["text-muted"], fontSize: 11 }} />
          <Bar isAnimationActive={false} dataKey="taxa" fill={t["series-1"]} radius={[4, 4, 0, 0]} maxBarSize={36}>
            <LabelList
              dataKey="taxa"
              content={(lp) => (
                <text x={Number(lp.x) + Number(lp.width) / 2} y={Number(lp.y) - 6} textAnchor="middle" fill={t["text-primary"]} fontSize={12}>
                  {pct(Number(lp.value))}
                </text>
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
