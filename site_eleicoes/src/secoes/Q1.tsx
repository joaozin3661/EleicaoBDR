import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { brl, brlCurto, num, pct, vezes } from "../formato";
import { COR_ANO, useTokens } from "../tema";

type Custo = { ano: number; cargo: string; uf: string; candidatos: number; cadeiras: number; gasto_total: number; custo_por_cadeira: number };
type CustoMun = Omit<Custo, "cargo"> & { municipio: string };
type Grupo = { resultado: string; candidatos: number; gasto_total: number; media: number; mediana: number };

const ABAS = ["Por estado", "Por município", "Eleitos × não eleitos"] as const;

export function Q1() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Por estado");
  return (
    <Secao
      id="q1"
      num="03 · Pergunta 1"
      titulo="Quanto custa uma cadeira?"
      descricao={
        <>
          Resposta principal: <span className="destaque">gasto total de campanha do cargo ÷ cadeiras em disputa</span>, por
          pleito e UF. O gasto dos derrotados entra, porque também faz parte do que custou preencher a vaga. Despesas
          contratadas; candidato sem despesa declarada conta como R$ 0; vices e suplentes de senador ficam de fora (disputam a vaga do titular).
        </>
      }
    >
      <div className="abas">
        {ABAS.map((a) => (
          <button key={a} className={a === aba ? "ativo" : ""} onClick={() => setAba(a)}>{a}</button>
        ))}
      </div>
      {aba === "Por estado" && <PorEstado />}
      {aba === "Por município" && <PorMunicipio />}
      {aba === "Eleitos × não eleitos" && <EleitosVsNao />}
    </Secao>
  );
}

/** Colunas agrupadas: x = categoria, uma série por ano (cor fixa por ano). */
function GraficoPorAno<T extends { ano: number }>(p: {
  linhas: T[]; categoria: (l: T) => string; valor: (l: T) => number; detalhe: (l: T) => { rotulo: string; valor: string }[];
}) {
  const t = useTokens();
  const anos = [...new Set(p.linhas.map((l) => l.ano))].sort();
  const cats = [...new Set(p.linhas.map(p.categoria))];
  const dados = cats.map((c) => {
    const o: Record<string, unknown> = { cat: c };
    for (const l of p.linhas.filter((x) => p.categoria(x) === c)) {
      o[`a${l.ano}`] = p.valor(l);
      o[`l${l.ano}`] = l;
    }
    return o;
  });
  return (
    <>
      <Legenda itens={anos.map((a) => ({ rotulo: String(a), cor: t[COR_ANO[a]] }))} />
      <div style={{ height: 340 }}>
        <ResponsiveContainer>
          <BarChart data={dados} margin={{ top: 16, right: 8, left: 8, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey="cat" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} />
            <YAxis tickFormatter={brlCurto} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={88} />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <Dica
                    titulo={label}
                    linhas={payload.flatMap((it) => {
                      const ano = Number(String(it.dataKey).slice(1));
                      const l = (it.payload as Record<string, T>)[`l${ano}`];
                      return [
                        { rotulo: `${ano} · por cadeira`, valor: brl(Number(it.value)), cor: t[COR_ANO[ano]] },
                        ...p.detalhe(l).map((d) => ({ ...d, rotulo: `${ano} · ${d.rotulo}` })),
                      ];
                    })}
                  />
                );
              }}
            />
            {anos.map((a) => (
              <Bar isAnimationActive={false} key={a} dataKey={`a${a}`} name={String(a)} fill={t[COR_ANO[a]]} radius={[4, 4, 0, 0]} maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function PorEstado() {
  const r = useApi<Custo[]>("/api/q1/custo-cadeira");
  const cargos = useMemo(() => [...new Set((r.dados ?? []).map((l) => l.cargo))].sort(), [r.dados]);
  const [cargo, setCargo] = useState("DEPUTADO FEDERAL");
  const linhas = (r.dados ?? []).filter((l) => l.cargo === cargo);
  const gasto = linhas.reduce((s, l) => s + l.gasto_total, 0);
  const cadeiras = linhas.reduce((s, l) => s + l.cadeiras, 0);
  const anos = [...new Set(linhas.map((l) => l.ano))].sort();

  return (
    <>
      <Estado carregando={r.carregando} erro={r.erro} />
      {r.dados && (
        <>
          <div className="filtros">
            <label className="campo">
              Cargo
              <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
                {cargos.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="grade g3">
            <Stat rotulo={`Custo médio por cadeira · ${anos.join(" e ")}`} valor={brl(gasto / cadeiras)} detalhe="6 estados somados" hero />
            <Stat rotulo="Gasto total" valor={brlCurto(gasto)} detalhe={`${num(linhas.reduce((s, l) => s + l.candidatos, 0))} candidatos`} />
            <Stat rotulo="Cadeiras em disputa" valor={num(cadeiras)} detalhe={anos.length > 1 ? "soma dos pleitos" : undefined} />
          </div>
          <div className="card">
            <h3>Custo por cadeira · {cargo.toLowerCase()}</h3>
            <p className="sub">Por estado e pleito. Passe o mouse para ver gasto, cadeiras e candidatos.</p>
            <GraficoPorAno
              linhas={linhas}
              categoria={(l) => l.uf}
              valor={(l) => l.custo_por_cadeira}
              detalhe={(l) => [{ rotulo: "cadeiras", valor: num(l.cadeiras) }, { rotulo: "candidatos", valor: num(l.candidatos) }]}
            />
            <Tabela<Custo>
              colunas={[
                { titulo: "Ano", valor: (l) => l.ano, numero: true },
                { titulo: "UF", valor: (l) => l.uf },
                { titulo: "Candidatos", valor: (l) => num(l.candidatos), numero: true },
                { titulo: "Cadeiras", valor: (l) => num(l.cadeiras), numero: true },
                { titulo: "Gasto total", valor: (l) => brl(l.gasto_total), numero: true },
                { titulo: "Custo por cadeira", valor: (l) => brl(l.custo_por_cadeira), numero: true },
              ]}
              linhas={linhas}
            />
            <VerSQL sql={r.sql} />
          </div>
        </>
      )}
    </>
  );
}

function PorMunicipio() {
  const [texto, setTexto] = useState("belem");
  const [busca, setBusca] = useState("belem");
  const [cargo, setCargo] = useState("VEREADOR");
  useEffect(() => {
    const id = setTimeout(() => setBusca(texto.trim()), 350);
    return () => clearTimeout(id);
  }, [texto]);
  const r = useApi<CustoMun[]>(busca.length >= 3 ? `/api/q1/municipio?${qs({ nome: busca, cargo })}` : null);

  return (
    <>
      <div className="filtros">
        <label className="campo">
          Município (com ou sem acento)
          <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ex.: maringa" />
        </label>
        <label className="campo">
          Cargo
          <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
            <option>VEREADOR</option>
            <option>PREFEITO</option>
          </select>
        </label>
      </div>
      <div className="card">
        <Estado carregando={r.carregando} erro={r.erro} vazio={!!r.dados && r.dados.length === 0} msgVazio="Nenhum município encontrado." />
        {busca.length < 3 && <p className="aviso">Digite pelo menos 3 letras.</p>}
        {r.dados && r.dados.length > 0 && (
          <>
            <h3>Custo por cadeira de {cargo.toLowerCase()}</h3>
            <p className="sub">{new Set(r.dados.map((l) => l.municipio + l.uf)).size} município(s) encontrado(s). Nomes iguais em estados diferentes aparecem separados.</p>
            <GraficoPorAno
              linhas={r.dados.slice(0, 24)}
              categoria={(l) => `${l.municipio}/${l.uf}`}
              valor={(l) => l.custo_por_cadeira}
              detalhe={(l) => [{ rotulo: "cadeiras", valor: num(l.cadeiras) }, { rotulo: "gasto", valor: brlCurto(l.gasto_total) }]}
            />
            <Tabela<CustoMun>
              colunas={[
                { titulo: "Município", valor: (l) => l.municipio },
                { titulo: "UF", valor: (l) => l.uf },
                { titulo: "Ano", valor: (l) => l.ano, numero: true },
                { titulo: "Candidatos", valor: (l) => num(l.candidatos), numero: true },
                { titulo: "Cadeiras", valor: (l) => num(l.cadeiras), numero: true },
                { titulo: "Gasto total", valor: (l) => brl(l.gasto_total), numero: true },
                { titulo: "Custo por cadeira", valor: (l) => brl(l.custo_por_cadeira), numero: true },
              ]}
              linhas={r.dados}
            />
          </>
        )}
        <VerSQL sql={r.sql} />
      </div>
    </>
  );
}

function EleitosVsNao() {
  const t = useTokens();
  const op = useApi<{ ano: number; cargo: string }[]>("/api/q1/opcoes");
  const [ano, setAno] = useState(2018);
  const [cargo, setCargo] = useState("DEPUTADO FEDERAL");
  const [uf, setUf] = useState("TODAS");
  const [suplentes, setSuplentes] = useState(true);
  const [zero, setZero] = useState(true);
  const anos = [...new Set((op.dados ?? []).map((o) => o.ano))];
  const cargos = (op.dados ?? []).filter((o) => o.ano === ano).map((o) => o.cargo);
  useEffect(() => {
    if (cargos.length && !cargos.includes(cargo)) setCargo(cargos.includes("VEREADOR") ? "VEREADOR" : cargos[0]);
  }, [ano, cargos.join()]);

  const r = useApi<Grupo[]>(op.dados ? `/api/q1/eleitos?${qs({ ano, cargo, uf, suplentes, zero })}` : null);
  const e = r.dados?.find((g) => g.resultado === "ELEITO");
  const n = r.dados?.find((g) => g.resultado !== "ELEITO");
  const cores = { Eleitos: t["series-1"], "Não eleitos": t["series-2"] };

  return (
    <>
      <div className="filtros">
        <label className="campo">
          Eleição
          <select value={ano} onChange={(ev) => setAno(Number(ev.target.value))}>
            {anos.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="campo">
          Cargo
          <select value={cargo} onChange={(ev) => setCargo(ev.target.value)}>
            {cargos.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="campo">
          Estado
          <select value={uf} onChange={(ev) => setUf(ev.target.value)}>
            <option value="TODAS">Todos (6 estados)</option>
            {["AL", "PA", "PB", "PR", "SC", "SE"].map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={suplentes} onChange={(ev) => setSuplentes(ev.target.checked)} /> Suplentes contam como não eleitos</label>
        <label className="check"><input type="checkbox" checked={zero} onChange={(ev) => setZero(ev.target.checked)} /> Incluir quem gastou R$ 0</label>
      </div>
      <Estado carregando={op.carregando || r.carregando} erro={op.erro ?? r.erro} vazio={!!r.dados && (!e || !n)} msgVazio="Não há eleitos e não eleitos suficientes nessa combinação." />
      {e && n && (
        <>
          <div className="grade g4">
            <Stat rotulo="Pela média, o eleito gastou" valor={vezes(e.media / n.media)} detalhe={`${brl(e.media)} contra ${brl(n.media)}`} hero />
            <Stat rotulo="Pela mediana, o eleito gastou" valor={n.mediana ? vezes(e.mediana / n.mediana) : "—"} detalhe={`${brl(e.mediana)} contra ${brl(n.mediana)}`} hero />
            <Stat rotulo="Eleitos são" valor={pct((100 * e.candidatos) / (e.candidatos + n.candidatos))} detalhe={`${num(e.candidatos)} de ${num(e.candidatos + n.candidatos)} candidatos`} />
            <Stat rotulo="E ficaram com" valor={pct((100 * e.gasto_total) / (e.gasto_total + n.gasto_total))} detalhe="do gasto total" />
          </div>
          <div className="grade g2" style={{ marginTop: 16 }}>
            {(["media", "mediana"] as const).map((m) => (
              <div className="card" key={m}>
                <h3>{m === "media" ? "Média" : "Mediana"} de gasto por candidato</h3>
                <p className="sub">{m === "media" ? "Puxada pelos poucos que gastam muito." : "O candidato típico de cada grupo."}</p>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={[{ g: "Eleitos", v: e[m] }, { g: "Não eleitos", v: n[m] }]}
                      margin={{ top: 8, right: 96, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke={t.grid} />
                      <XAxis type="number" tickFormatter={brlCurto} tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} />
                      <YAxis type="category" dataKey="g" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-secondary"], fontSize: 13 }} width={92} />
                      <Tooltip
                        cursor={{ fill: t.grid, opacity: 0.5 }}
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <Dica titulo={String(payload[0].payload.g)} linhas={[{ rotulo: m === "media" ? "média" : "mediana", valor: brl(Number(payload[0].value)) }]} />
                          ) : null
                        }
                      />
                      <Bar isAnimationActive={false} dataKey="v" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {["Eleitos", "Não eleitos"].map((g) => <Cell key={g} fill={cores[g as keyof typeof cores]} />)}
                        <LabelList
                          dataKey="v"
                          content={(lp) => {
                            const x = Number(lp.x) + Number(lp.width) + 8;
                            const y = Number(lp.y) + Number(lp.height) / 2;
                            return <text x={x} y={y} dy={4} fill={t["text-primary"]} fontSize={13}>{brlCurto(Number(lp.value))}</text>;
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Os números</h3>
            <p className="sub">Os totais enganam porque os grupos têm tamanhos muito diferentes: compare por candidato. Eleito = todo resultado que começa com ELEITO (QP e média).</p>
            <Tabela<Grupo>
              colunas={[
                { titulo: "Grupo", valor: (l) => (l.resultado === "ELEITO" ? "Eleitos" : l.resultado === "NÃO ELEITO" ? "Não eleitos" : "Não eleitos + suplentes") },
                { titulo: "Candidatos", valor: (l) => num(l.candidatos), numero: true },
                { titulo: "Gasto total", valor: (l) => brl(l.gasto_total), numero: true },
                { titulo: "Média", valor: (l) => brl(l.media), numero: true },
                { titulo: "Mediana", valor: (l) => brl(l.mediana), numero: true },
              ]}
              linhas={r.dados!}
            />
            <VerSQL sql={r.sql} />
          </div>
        </>
      )}
    </>
  );
}
