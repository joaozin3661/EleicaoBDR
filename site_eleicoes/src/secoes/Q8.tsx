import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { brl, brlCurto, num, pct, vezes } from "../formato";
import { useTokens, type Tokens } from "../tema";
import { Colunas } from "./Q2";

type Resumo = {
  candidatos: number; eleitos: number; sem_receita: number; receita_total: number; pct_publico_do_dinheiro: number;
  maioria_publica: number; maioria_publica_eleitos: number; maioria_privada: number; maioria_privada_eleitos: number;
  mediana_receita_eleitos: number | null; mediana_receita_nao_eleitos: number | null;
};
type Faixa = { ordem: number; faixa: string; candidatos: number; eleitos: number; taxa_sucesso: number; receita_mediana: number };
type Origem = { grupo: string; categoria: string; publico: boolean; valor: number; candidatos: number };
type Dados = { resumo: Resumo | null; faixas: Faixa[]; origem: Origem[] };

const UFS = ["AL", "PA", "PB", "PR", "SC", "SE"];
const CURTO = ["Sem receita", "0%", "< 25%", "25–50%", "50–75%", "75–99%", "100%"];

/** Dinheiro público em tons de azul (mesma família); privado em cores distintas. Segue a categoria, não a posição. */
const CATEGORIAS: { nome: string; token: keyof Tokens; opaca?: boolean }[] = [
  { nome: "Fundo Especial (FEFC)", token: "series-1" },
  { nome: "Fundo Partidário", token: "series-1", opaca: true },
  { nome: "Pessoas físicas", token: "series-2" },
  { nome: "Partido (outras fontes)", token: "series-4" },
  { nome: "Recursos do próprio candidato", token: "series-3" },
  { nome: "Outros candidatos", token: "neutral" },
  { nome: "Outras fontes", token: "neutral", opaca: true },
];

export function Q8() {
  const t = useTokens();
  const op = useApi<{ ano: number; cargo: string }[]>("/api/q8/opcoes");
  const cargos = useMemo(() => [...new Set((op.dados ?? []).map((o) => o.cargo))], [op.dados]);
  const [cargo, setCargo] = useState("VEREADOR");
  const anos = (op.dados ?? []).filter((o) => o.cargo === cargo).map((o) => o.ano);
  const [ano, setAno] = useState(2024);
  const [uf, setUf] = useState("TODAS");
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[anos.length - 1]);
  }, [anos.join(), ano]);
  const r = useApi<Dados>(op.dados && anos.includes(ano) ? `/api/q8?${qs({ ano, cargo, uf })}` : null);
  const d = r.dados;
  const rs = d?.resumo;

  const taxaPub = rs && rs.maioria_publica > 0 ? (100 * rs.maioria_publica_eleitos) / rs.maioria_publica : null;
  const taxaPriv = rs && rs.maioria_privada > 0 ? (100 * rs.maioria_privada_eleitos) / rs.maioria_privada : null;
  const semR = d?.faixas.find((f) => f.ordem === 0);

  // composição do dinheiro: % de cada categoria dentro de eleitos e de não eleitos
  const composicao = ["Eleitos", "Não eleitos"].map((g) => {
    const linhas = (d?.origem ?? []).filter((o) => o.grupo === g);
    const total = linhas.reduce((s, o) => s + o.valor, 0);
    const linha: Record<string, string | number> = { grupo: g, total };
    for (const c of CATEGORIAS) {
      const v = linhas.filter((o) => o.categoria === c.nome).reduce((s, o) => s + o.valor, 0);
      linha[c.nome] = total ? (100 * v) / total : 0;
      linha[`$${c.nome}`] = v;
    }
    return linha;
  }).filter((l) => Number(l.total) > 0);
  const usadas = CATEGORIAS.filter((c) => composicao.some((l) => Number(l[c.nome]) > 0));

  return (
    <Secao
      id="q8"
      num="09 · Pergunta 8"
      titulo="Dinheiro público ou privado: quem se elege?"
      descricao={
        <>
          O TSE classifica cada receita pela fonte: <span className="destaque">Fundo Especial (FEFC) e Fundo Partidário são
          dinheiro público</span>; todo o resto é privado (pessoas físicas, recursos do próprio candidato, doações do partido de
          outras fontes). Isso vale também para o que o partido repassa ao candidato: o repasse feito com verba do fundo já
          vem marcado como público. Cada candidato é colocado numa faixa pela parte do que arrecadou que era dinheiro público,
          e a taxa de sucesso é calculada em cada faixa. Vices e suplentes de senador ficam de fora.
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
      <Estado carregando={op.carregando || r.carregando} erro={op.erro ?? r.erro} vazio={!!d && !rs} msgVazio="Sem candidatos para essa combinação." />

      {d && rs && (
        <div style={{ opacity: r.carregando ? 0.4 : 1, transition: "opacity .15s" }}>
          <div className="grade g4">
            <Stat
              rotulo="Quem vive de fonte privada se elege quantas vezes mais?"
              valor={taxaPub != null && taxaPriv != null && taxaPub > 0 ? vezes(taxaPriv / taxaPub) : "—"}
              detalhe={
                taxaPub != null && taxaPriv != null
                  ? `${pct(taxaPriv)} de sucesso entre quem arrecadou metade ou mais de fontes privadas, contra ${pct(taxaPub)} entre quem dependeu do dinheiro público (mais da metade)`
                  : "um dos dois grupos não tem candidatos nesta seleção"
              }
              hero
            />
            <Stat
              rotulo="Do dinheiro arrecadado, era público"
              valor={pct(rs.pct_publico_do_dinheiro)}
              detalhe={`de ${brlCurto(rs.receita_total)} arrecadados por ${num(rs.candidatos)} candidatos`}
            />
            <Stat
              rotulo="Receita mediana dos eleitos"
              valor={rs.mediana_receita_eleitos == null ? "—" : brl(rs.mediana_receita_eleitos)}
              detalhe={rs.mediana_receita_nao_eleitos == null ? undefined : `contra ${brl(rs.mediana_receita_nao_eleitos)} dos não eleitos (só quem declarou receita)`}
            />
            <Stat
              rotulo="Não declararam nenhuma receita"
              valor={num(rs.sem_receita)}
              detalhe={semR ? `candidatos · só ${pct(semR.taxa_sucesso)} se elegeram` : "candidatos"}
            />
          </div>

          <div className="grade g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Taxa de sucesso por parte de dinheiro público</h3>
              <p className="sub">Eixo: parte da arrecadação do candidato que veio do FEFC ou do Fundo Partidário (0% = nenhum dinheiro público). A linha marca a taxa geral.</p>
              <Colunas
                linhas={d.faixas.map((f) => ({
                  rotulo: CURTO[f.ordem],
                  taxa: f.taxa_sucesso,
                  detalhe: [
                    { rotulo: "candidatos", valor: num(f.candidatos) },
                    { rotulo: "eleitos", valor: num(f.eleitos) },
                    { rotulo: "receita mediana", valor: brl(f.receita_mediana) },
                  ],
                }))}
                geral={(100 * rs.eleitos) / rs.candidatos}
              />
            </div>
            <div className="card">
              <h3>De onde veio o dinheiro</h3>
              <p className="sub">Composição da arrecadação de eleitos e de não eleitos. Azul = dinheiro público.</p>
              <Legenda itens={usadas.map((c) => ({ rotulo: c.nome, cor: c.opaca ? `color-mix(in srgb, ${t[c.token]} 50%, transparent)` : t[c.token] }))} />
              <div style={{ height: 170 }}>
                <ResponsiveContainer>
                  <BarChart layout="vertical" data={composicao} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={t.grid} />
                    <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} />
                    <YAxis type="category" dataKey="grupo" width={84} tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-secondary"], fontSize: 13 }} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.4 }}
                      content={({ active, payload }) => {
                        const l = payload?.[0]?.payload as Record<string, number | string> | undefined;
                        if (!active || !l) return null;
                        return (
                          <Dica
                            titulo={`${l.grupo} · ${brlCurto(Number(l.total))}`}
                            linhas={usadas.map((c) => ({ rotulo: c.nome, valor: `${pct(Number(l[c.nome]))} · ${brlCurto(Number(l[`$${c.nome}`]))}`, cor: t[c.token] }))}
                          />
                        );
                      }}
                    />
                    {usadas.map((c, i) => (
                      <Bar key={c.nome} isAnimationActive={false} dataKey={c.nome} stackId="o" fill={t[c.token]} fillOpacity={c.opaca ? 0.5 : 1}
                        stroke={t.surface} strokeWidth={2} maxBarSize={44} radius={i === usadas.length - 1 ? [0, 4, 4, 0] : 0}>
                        <LabelList
                          dataKey={c.nome}
                          content={(lp) =>
                            Number(lp.value) >= 8 ? (
                              <text x={Number(lp.x) + Number(lp.width) / 2} y={Number(lp.y) + Number(lp.height) / 2} dy={4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>
                                {Math.round(Number(lp.value))}%
                              </text>
                            ) : null
                          }
                        />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Os números</h3>
            <Tabela<Faixa>
              colunas={[
                { titulo: "Parte de dinheiro público", valor: (f) => f.faixa },
                { titulo: "Candidatos", valor: (f) => num(f.candidatos), numero: true },
                { titulo: "Eleitos", valor: (f) => num(f.eleitos), numero: true },
                { titulo: "Taxa de sucesso", valor: (f) => pct(f.taxa_sucesso), numero: true },
                { titulo: "Receita mediana", valor: (f) => brl(f.receita_mediana), numero: true },
              ]}
              linhas={d.faixas}
            />
            <p className="nota">
              Leia com cautela: os partidos distribuem o fundo público conforme a chance de vitória de cada candidato, então
              a associação não prova que o dinheiro público atrapalha. Quem depende só dele costuma ser candidato de
              partido pequeno ou sem estrutura própria. Entram doações em dinheiro e estimáveis em bens e serviços. O
              dinheiro que o candidato recebe de outros candidatos conta como público quando a fonte original é um dos fundos.
            </p>
            <VerSQL sql={r.sql} />
          </div>
        </div>
      )}
    </Secao>
  );
}
