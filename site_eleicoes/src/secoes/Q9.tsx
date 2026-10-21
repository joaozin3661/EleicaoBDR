import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { brl, brlCurto, num, pct } from "../formato";
import { useTokens, type Tokens } from "../tema";

type Categoria = { ano: number; grupo: string; propaganda: boolean; tipo_despesa: string; valor: number; despesas: number; candidatos: number };
type Palavra = { palavra: string; despesas: number; valor: number };

/** Cor fixa por canal: o canal mantém a cor em todos os gráficos. O que não é propaganda fica cinza. */
const CANAIS = ["Impressos e adesivos", "Rádio, TV, vídeo e som", "Internet", "Militância, comícios e eventos"] as const;
const COR_CANAL: Record<string, keyof Tokens> = {
  "Impressos e adesivos": "series-1",
  "Rádio, TV, vídeo e som": "series-2",
  "Internet": "series-3",
  "Militância, comícios e eventos": "series-4",
};
const cor = (t: Tokens, grupo: string) => t[COR_CANAL[grupo] ?? "neutral"];
const UFS = ["AL", "PA", "PB", "PR", "SC", "SE"];

export function Q9() {
  const t = useTokens();
  const op = useApi<string[]>("/api/q9/opcoes");
  const [cargo, setCargo] = useState("TODOS");
  const [uf, setUf] = useState("TODAS");
  const r = useApi<Categoria[]>(`/api/q9/categorias?${qs({ cargo, uf })}`);
  const anos = useMemo(() => [...new Set((r.dados ?? []).map((c) => c.ano))].sort(), [r.dados]);
  const [ano, setAno] = useState(2024);
  useEffect(() => {
    if (anos.length && !anos.includes(ano)) setAno(anos[anos.length - 1]);
  }, [anos, ano]);

  const doAno = (r.dados ?? []).filter((c) => c.ano === ano);
  const total = doAno.reduce((s, c) => s + c.valor, 0);
  const prop = doAno.filter((c) => c.propaganda);
  const totalProp = prop.reduce((s, c) => s + c.valor, 0);
  const somaPor = (linhas: Categoria[]) => {
    const m = new Map<string, number>();
    linhas.forEach((c) => m.set(c.grupo, (m.get(c.grupo) ?? 0) + c.valor));
    return m;
  };
  const grupos = [...somaPor(doAno)].map(([grupo, valor]) => ({ grupo, valor, pct: (100 * valor) / total })).sort((a, b) => b.valor - a.valor);
  const canalTop = grupos.find((g) => COR_CANAL[g.grupo]);
  const tiposProp = [...prop].sort((a, b) => b.valor - a.valor).slice(0, 12);

  // evolução: participação de cada canal no gasto com propaganda, por pleito
  const evolucao = anos.map((a) => {
    const linhas = (r.dados ?? []).filter((c) => c.ano === a && c.propaganda);
    const tot = linhas.reduce((s, c) => s + c.valor, 0);
    const m = somaPor(linhas);
    return Object.fromEntries([["ano", String(a)], ...CANAIS.map((k) => [k, tot ? (100 * (m.get(k) ?? 0)) / tot : 0])]);
  });

  return (
    <Secao
      id="q9"
      num="09 · Pergunta 9"
      titulo="Onde o candidato investe em propaganda?"
      descricao={
        <>
          As 41 categorias de despesa do TSE foram agrupadas em <span className="destaque">quatro canais de propaganda</span>{" "}
          (impressos e adesivos; rádio, TV, vídeo e som; internet; militância, comícios e eventos) e dois grupos que não são
          propaganda (estrutura da campanha e outras despesas). A nuvem vem das descrições livres que o próprio candidato
          escreveu, contadas palavra a palavra no banco. Valores de despesas contratadas, 2018 a 2024.
        </>
      }
    >
      <div className="filtros">
        <label className="campo">
          Cargo
          <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
            <option value="TODOS">Todos os cargos</option>
            {(op.dados ?? []).map((c) => <option key={c}>{c}</option>)}
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
      <Estado carregando={r.carregando} erro={r.erro ?? op.erro} vazio={!!r.dados && doAno.length === 0} msgVazio="Sem despesas para essa combinação." />

      {doAno.length > 0 && (
        <div style={{ opacity: r.carregando ? 0.4 : 1, transition: "opacity .15s" }}>
          <div className="grade g4">
            <Stat rotulo={`Gasto total · ${ano}`} valor={brlCurto(total)} detalhe={`${num(doAno.reduce((s, c) => s + c.despesas, 0))} despesas`} />
            <Stat rotulo="Foi para propaganda" valor={pct((100 * totalProp) / total)} detalhe={brl(totalProp)} hero />
            <Stat rotulo="Canal que mais recebeu" valor={<span style={{ fontSize: 22 }}>{canalTop?.grupo ?? "—"}</span>} detalhe={canalTop ? `${pct((100 * canalTop.valor) / totalProp)} da propaganda` : undefined} />
            <Stat
              rotulo="Internet"
              valor={pct((100 * (somaPor(prop).get("Internet") ?? 0)) / (totalProp || 1))}
              detalhe="da propaganda (impulsionamento e páginas)"
            />
          </div>

          <div className="grade g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Para onde vai o dinheiro</h3>
              <p className="sub">Parte de cada grupo no gasto total. Cinza = não é propaganda.</p>
              <BarrasH
                linhas={grupos.map((g) => ({ rotulo: g.grupo, valor: g.valor, cor: cor(t, g.grupo), extra: pct(g.pct) }))}
                t={t}
                largRotulo={200}
              />
            </div>
            <div className="card">
              <h3>As categorias de propaganda</h3>
              <p className="sub">As 12 maiores, na cor do canal.</p>
              <BarrasH
                linhas={tiposProp.map((c) => ({ rotulo: c.tipo_despesa, valor: c.valor, cor: cor(t, c.grupo), extra: pct((100 * c.valor) / totalProp) }))}
                t={t}
                largRotulo={250}
              />
            </div>
          </div>
          <Legenda itens={[...CANAIS.map((k) => ({ rotulo: k, cor: cor(t, k) })), { rotulo: "Não é propaganda", cor: t.neutral }]} />

          {anos.length > 1 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Como a propaganda mudou entre os pleitos</h3>
              <p className="sub">
                Participação de cada canal no gasto com propaganda{cargo === "TODOS" ? ". Anos pares alternam eleição geral e municipal" : ""}.
              </p>
              <Legenda itens={CANAIS.map((k) => ({ rotulo: k, cor: cor(t, k) }))} />
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={evolucao} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis dataKey="ano" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={44} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.5 }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <Dica
                            titulo={`Propaganda em ${label}`}
                            linhas={[...payload].reverse().map((p) => ({ rotulo: String(p.dataKey), valor: pct(Number(p.value)), cor: cor(t, String(p.dataKey)) }))}
                          />
                        ) : null
                      }
                    />
                    {CANAIS.map((k, i) => (
                      <Bar isAnimationActive={false} key={k} dataKey={k} stackId="p" fill={cor(t, k)} maxBarSize={48} stroke={t.surface} strokeWidth={2}
                        radius={i === CANAIS.length - 1 ? [4, 4, 0, 0] : 0} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {anos.includes(ano) && <Nuvem ano={ano} cargo={cargo} uf={uf} />}

          <div className="card">
            <h3>Todas as categorias · {ano}</h3>
            <Tabela<Categoria>
              colunas={[
                { titulo: "Categoria do TSE", valor: (c) => c.tipo_despesa },
                { titulo: "Grupo", valor: (c) => <span className="tag"><i style={{ background: cor(t, c.grupo) }} />{c.grupo}</span> },
                { titulo: "Valor", valor: (c) => brl(c.valor), numero: true },
                { titulo: "% do total", valor: (c) => pct((100 * c.valor) / total), numero: true },
                { titulo: "Despesas", valor: (c) => num(c.despesas), numero: true },
                { titulo: "Candidatos", valor: (c) => num(c.candidatos), numero: true },
              ]}
              linhas={[...doAno].sort((a, b) => b.valor - a.valor)}
            />
            <VerSQL sql={r.sql} />
          </div>
        </div>
      )}
    </Secao>
  );
}

function BarrasH(p: { linhas: { rotulo: string; valor: number; cor: string; extra: string }[]; t: Tokens; largRotulo: number }) {
  const { t } = p;
  return (
    <div style={{ height: 40 + 34 * p.linhas.length }}>
      <ResponsiveContainer>
        <BarChart layout="vertical" data={p.linhas} margin={{ top: 8, right: 64, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={t.grid} />
          <XAxis type="number" tickFormatter={brlCurto} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 11 }} />
          <YAxis type="category" dataKey="rotulo" width={p.largRotulo} tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-secondary"], fontSize: 12 }} interval={0} />
          <Tooltip
            cursor={{ fill: t.grid, opacity: 0.5 }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as (typeof p.linhas)[number] | undefined;
              return active && d ? <Dica titulo={d.rotulo} linhas={[{ rotulo: "valor", valor: brl(d.valor), cor: d.cor }, { rotulo: "participação", valor: d.extra }]} /> : null;
            }}
          />
          <Bar isAnimationActive={false} dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {p.linhas.map((l) => <Cell key={l.rotulo} fill={l.cor} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ordem estável e "misturada" para a nuvem: as maiores ficam espalhadas, não todas no começo. */
function embaralha<T>(xs: T[], chave: (x: T) => string) {
  const h = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return [...xs].sort((a, b) => h(chave(a)) - h(chave(b)));
}

function Nuvem({ ano, cargo, uf }: { ano: number; cargo: string; uf: string }) {
  const [escopo, setEscopo] = useState<"PROPAGANDA" | "TODAS">("PROPAGANDA");
  const [medida, setMedida] = useState<"despesas" | "valor">("despesas");
  const r = useApi<Palavra[]>(`/api/q9/palavras?${qs({ escopo, ano, cargo, uf })}`);
  const palavras = (r.dados ?? []).slice(0, 80);
  const vals = palavras.map((p) => p[medida]);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const tamanho = (v: number) => 13 + 37 * Math.sqrt((v - min) / (max - min || 1));
  const ordenadas = [...palavras].sort((a, b) => b[medida] - a[medida]);
  const top = new Set(ordenadas.slice(0, 10).map((p) => p.palavra));

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>O que os candidatos escrevem nas despesas</h3>
      <p className="sub">
        As {palavras.length} palavras mais frequentes nas descrições de {ano}. Tamanho = {medida === "despesas" ? "número de despesas que citam a palavra" : "valor somado dessas despesas"}.
      </p>
      <div className="filtros" style={{ marginTop: 12 }}>
        <div className="abas" style={{ margin: 0 }}>
          <button className={escopo === "PROPAGANDA" ? "ativo" : ""} onClick={() => setEscopo("PROPAGANDA")}>Só propaganda</button>
          <button className={escopo === "TODAS" ? "ativo" : ""} onClick={() => setEscopo("TODAS")}>Todas as despesas</button>
        </div>
        <div className="abas" style={{ margin: 0 }}>
          <button className={medida === "despesas" ? "ativo" : ""} onClick={() => setMedida("despesas")}>Por frequência</button>
          <button className={medida === "valor" ? "ativo" : ""} onClick={() => setMedida("valor")}>Por valor</button>
        </div>
      </div>
      <Estado carregando={r.carregando} erro={r.erro} vazio={!!r.dados && palavras.length === 0} msgVazio="Sem descrições para essa combinação." />
      <div style={{ opacity: r.carregando ? 0.4 : 1, transition: "opacity .15s" }}>
      {palavras.length > 0 && (
        <div className="nuvem" role="list" aria-label="Nuvem de palavras">
          {embaralha(palavras, (p) => p.palavra).map((p) => (
            <span
              key={p.palavra}
              role="listitem"
              className={top.has(p.palavra) ? "forte" : undefined}
              style={{ fontSize: tamanho(p[medida]) }}
              title={`${p.palavra}: ${num(p.despesas)} despesas · ${brl(p.valor)}`}
            >
              {p.palavra.toLowerCase()}
            </span>
          ))}
        </div>
      )}
      {palavras.length > 0 && (
        <details className="sql">
          <summary>Ver as palavras como tabela</summary>
          <Tabela<Palavra>
            colunas={[
              { titulo: "#", valor: (p) => ordenadas.indexOf(p) + 1, numero: true },
              { titulo: "Palavra", valor: (p) => p.palavra },
              { titulo: "Despesas que citam", valor: (p) => num(p.despesas), numero: true },
              { titulo: "Valor somado", valor: (p) => brl(p.valor), numero: true },
            ]}
            linhas={ordenadas}
          />
        </details>
      )}
      </div>
      <VerSQL sql={r.sql} />
    </div>
  );
}
