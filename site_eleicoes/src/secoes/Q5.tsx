import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs, useApi } from "../api";
import { Dica, Estado, Legenda, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { num, pct } from "../formato";
import { useTokens } from "../tema";

type Resumo = {
  circunscricoes: number; vagas: number; eleitos: number; eleitos_por_legenda: number; pct_por_legenda: number; faixa_100_mais: number;
  faixa_50_99: number; faixa_20_49: number; faixa_menos_20: number; fora_dos_mais_votados: number; pct_fora_dos_mais_votados: number;
  mediana_pct_quociente: number; votos_validos: number; votos_legenda: number; pct_votos_legenda: number;
};
type Partido = {
  partido: string; eleitos: number; eleitos_por_legenda: number; pct_por_legenda: number; eleitos_votos_proprios: number;
  fora_dos_mais_votados: number; votos_nominais: number; votos_legenda: number; pct_votos_legenda: number | null; posicao: number;
};
type Caso = {
  nome_urna: string; partido: string; sg_uf: string; municipio: string | null; votos: number; quociente: number; pct_do_quociente: number;
  posicao_votos: number; vagas: number;
};
type Dados = { resumo: Resumo | null; partidos: Partido[]; menos: Caso[]; barrados: Caso[] };

const UFS = ["AL", "PA", "PB", "PR", "SC", "SE"];
const CARGOS_DO_ANO: Record<number, string[]> = {
  2018: ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"],
  2020: ["VEREADOR"],
  2022: ["DEPUTADO FEDERAL", "DEPUTADO ESTADUAL"],
  2024: ["VEREADOR"],
};
const rc = (v: number) => v.toFixed(1).replace(".", ",");
const local = (c: Caso) => (c.municipio ? `${c.municipio}/${c.sg_uf}` : c.sg_uf);

export function Q5() {
  const t = useTokens();
  const [ano, setAno] = useState(2022);
  const [cargo, setCargo] = useState("DEPUTADO FEDERAL");
  const [uf, setUf] = useState("TODAS");
  useEffect(() => {
    if (!CARGOS_DO_ANO[ano].includes(cargo)) setCargo(CARGOS_DO_ANO[ano][0]);
  }, [ano, cargo]);
  const valido = CARGOS_DO_ANO[ano].includes(cargo);
  const r = useApi<Dados>(valido ? `/api/q5?${qs({ ano, cargo, uf })}` : null);
  const d = r.dados;
  const s = d?.resumo;
  const cor = { proprios: t["series-1"], legenda: t["series-2"] };

  const faixas = s
    ? [
        { rotulo: "100% ou mais", n: s.faixa_100_mais, legenda: false },
        { rotulo: "50 a 99%", n: s.faixa_50_99, legenda: true },
        { rotulo: "20 a 49%", n: s.faixa_20_49, legenda: true },
        { rotulo: "Menos de 20%", n: s.faixa_menos_20, legenda: true },
      ]
    : [];
  const topPartidos = (d?.partidos ?? []).slice(0, 12).map((p) => ({ ...p, proprios: p.eleitos_votos_proprios, legenda: p.eleitos_por_legenda }));
  const altura = 70 + 34 * topPartidos.length;

  return (
    <Secao
      id="q5"
      num="07 · Pergunta 5"
      titulo="Quantos eleitos de cada partido entraram por votos de legenda?"
      descricao={
        <>
          Nas eleições proporcionais, os votos do partido formam o <span className="destaque">quociente partidário</span> e as vagas vão para os mais votados
          dentro dele. Aqui, um eleito conta como <span className="destaque">eleito por legenda</span> quando seus votos nominais ficaram abaixo do{" "}
          <span className="destaque">quociente eleitoral</span> (votos válidos ÷ vagas) da disputa: sozinho ele não teria feito uma vaga, e o partido o levou.
          Cobre deputados federal e estadual (2018 e 2022) e vereador (2020 e 2024) nos seis estados.
        </>
      }
    >
      <div className="filtros">
        <label className="campo">
          Eleição
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {Object.keys(CARGOS_DO_ANO).map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="campo">
          Cargo
          <select value={valido ? cargo : CARGOS_DO_ANO[ano][0]} onChange={(e) => setCargo(e.target.value)}>
            {CARGOS_DO_ANO[ano].map((c) => <option key={c}>{c}</option>)}
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
      <Estado carregando={r.carregando} erro={r.erro} vazio={!!d && !s} msgVazio="Sem dados para essa combinação." />

      {d && s && (
        <div style={{ opacity: r.carregando ? 0.4 : 1, transition: "opacity .15s" }}>
          <div className="grade g4">
            <Stat
              rotulo="Eleitos por votos de legenda"
              valor={pct(s.pct_por_legenda)}
              detalhe={`${num(s.eleitos_por_legenda)} de ${num(s.eleitos)} eleitos tiveram menos votos que o quociente`}
              hero
            />
            <Stat
              rotulo="Votos próprios do eleito típico"
              valor={pct(s.mediana_pct_quociente)}
              detalhe="do quociente eleitoral, na mediana dos eleitos"
            />
            <Stat
              rotulo="Eleitos fora dos mais votados"
              valor={pct(s.pct_fora_dos_mais_votados)}
              detalhe={`${num(s.fora_dos_mais_votados)} ocupam a vaga de alguém com mais votos`}
            />
            <Stat
              rotulo="Votos de legenda no total"
              valor={pct(s.pct_votos_legenda)}
              detalhe={`${num(s.votos_legenda)} dos ${num(s.votos_validos)} votos válidos`}
            />
          </div>

          <div className="grade g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Quanto do quociente cada eleito fez sozinho · {ano}</h3>
              <p className="sub">
                Eleitos por faixa de votos próprios, em % do quociente eleitoral da disputa. O quociente é o "preço" de uma vaga do partido; quase ninguém o atinge sozinho.
              </p>
              <Legenda itens={[{ rotulo: "votos próprios (quociente ou mais)", cor: cor.proprios }, { rotulo: "por legenda (abaixo do quociente)", cor: cor.legenda }]} />
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={faixas} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={t.grid} />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-muted"], fontSize: 12 }} interval={0} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} width={48} tickFormatter={(v) => num(v)} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.5 }}
                      content={({ active, payload }) => {
                        const x = payload?.[0]?.payload as (typeof faixas)[number] | undefined;
                        return active && x ? (
                          <Dica
                            titulo={`${x.rotulo} do quociente`}
                            linhas={[{ rotulo: "eleitos", valor: num(x.n), cor: x.legenda ? cor.legenda : cor.proprios }, { rotulo: "do total", valor: pct((100 * x.n) / s.eleitos) }]}
                          />
                        ) : null;
                      }}
                    />
                    <Bar isAnimationActive={false} dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={72}>
                      {faixas.map((f) => (
                        <Cell key={f.rotulo} fill={f.legenda ? cor.legenda : cor.proprios} />
                      ))}
                      <LabelList dataKey="n" position="top" formatter={(v: number) => num(v)} fill={t["text-primary"]} fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3>Eleitos por partido · {ano}, {cargo.toLowerCase()}</h3>
              <p className="sub">Os 12 partidos com mais eleitos, divididos entre quem ficou abaixo do quociente (legenda) e quem o atingiu sozinho.</p>
              <div style={{ height: altura }}>
                <ResponsiveContainer>
                  <BarChart layout="vertical" data={topPartidos} margin={{ top: 4, right: 36, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={t.grid} />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: t["text-muted"], fontSize: 12 }} tickFormatter={(v) => num(v)} />
                    <YAxis type="category" dataKey="partido" width={104} tickLine={false} axisLine={{ stroke: t.axis }} tick={{ fill: t["text-secondary"], fontSize: 12 }} interval={0} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.4 }}
                      content={({ active, payload }) => {
                        const p = payload?.[0]?.payload as Partido | undefined;
                        return active && p ? (
                          <Dica
                            titulo={`${p.partido} · ${num(p.eleitos)} eleitos`}
                            linhas={[
                              { rotulo: "por legenda", valor: `${num(p.eleitos_por_legenda)} (${pct(p.pct_por_legenda)})`, cor: cor.legenda },
                              { rotulo: "votos próprios", valor: num(p.eleitos_votos_proprios), cor: cor.proprios },
                              { rotulo: "fora dos mais votados", valor: num(p.fora_dos_mais_votados) },
                              { rotulo: "votos de legenda do partido", valor: p.pct_votos_legenda == null ? "—" : pct(p.pct_votos_legenda) },
                            ]}
                          />
                        ) : null;
                      }}
                    />
                    <Bar isAnimationActive={false} dataKey="proprios" stackId="p" fill={cor.proprios} stroke={t.surface} strokeWidth={2} maxBarSize={22} />
                    <Bar isAnimationActive={false} dataKey="legenda" stackId="p" fill={cor.legenda} stroke={t.surface} strokeWidth={2} maxBarSize={22} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="eleitos" position="right" formatter={(v: number) => num(v)} fill={t["text-primary"]} fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Todos os partidos · {ano}, {cargo.toLowerCase()}{uf === "TODAS" ? "" : ` em ${uf}`}</h3>
            <Tabela<Partido>
              colunas={[
                { titulo: "Partido", valor: (p) => p.partido },
                { titulo: "Eleitos", valor: (p) => num(p.eleitos), numero: true },
                { titulo: "Por legenda", valor: (p) => num(p.eleitos_por_legenda), numero: true },
                { titulo: "% por legenda", valor: (p) => pct(p.pct_por_legenda), numero: true },
                { titulo: "Votos próprios", valor: (p) => num(p.eleitos_votos_proprios), numero: true },
                { titulo: "Fora dos mais votados", valor: (p) => num(p.fora_dos_mais_votados), numero: true },
                { titulo: "Votos de legenda do partido", valor: (p) => (p.pct_votos_legenda == null ? "—" : pct(p.pct_votos_legenda)), numero: true },
              ]}
              linhas={d.partidos}
            />
          </div>

          <div>
            <div className="card">
              <h3>Eleitos com menos votos próprios</h3>
              <p className="sub">Menor percentual do quociente entre os eleitos da disputa.</p>
              <Tabela<Caso>
                colunas={[
                  { titulo: "Eleito", valor: (c) => c.nome_urna },
                  { titulo: "Partido", valor: (c) => c.partido },
                  { titulo: "Onde", valor: (c) => local(c) },
                  { titulo: "Votos", valor: (c) => num(c.votos), numero: true },
                  { titulo: "% do quociente", valor: (c) => pct(c.pct_do_quociente), numero: true },
                  { titulo: "Posição em votos", valor: (c) => `${num(c.posicao_votos)}º de ${num(c.vagas)} vagas`, numero: true },
                ]}
                linhas={d.menos}
              />
            </div>
            <div className="card">
              <h3>Mais votados que não se elegeram</h3>
              <p className="sub">Entre os mais votados da disputa (até o número de vagas), mas sem vaga porque o partido não fez quociente suficiente.</p>
              <Tabela<Caso>
                colunas={[
                  { titulo: "Candidato", valor: (c) => c.nome_urna },
                  { titulo: "Partido", valor: (c) => c.partido },
                  { titulo: "Onde", valor: (c) => local(c) },
                  { titulo: "Votos", valor: (c) => num(c.votos), numero: true },
                  { titulo: "% do quociente", valor: (c) => pct(c.pct_do_quociente), numero: true },
                  { titulo: "Posição em votos", valor: (c) => `${num(c.posicao_votos)}º de ${num(c.vagas)} vagas`, numero: true },
                ]}
                linhas={d.barrados}
              />
            </div>
          </div>

          <p className="nota">
            Quociente eleitoral = votos válidos (nominais + legenda) ÷ vagas, com a fração arredondada como no Código Eleitoral; para deputado a disputa é o estado
            ({s.circunscricoes} no recorte) e para vereador é o município. Os votos válidos conferem com o total oficial do TSE em todas as disputas. Como o quociente é o preço
            de uma vaga do partido, "abaixo do quociente" vale para quase todo eleito ({rc(s.pct_por_legenda)}% aqui); a medida mais sensível é a de "fora dos mais votados" ({rc(s.pct_fora_dos_mais_votados)}%).
            O partido é o do candidato; em 2018 houve coligações e em 2022 federações, que somam votos e vagas e não aparecem separadas aqui.
            Seis municípios de 2024 (Ananindeua, Breu Branco, Placas, Melgaço, Rurópolis e Nossa Senhora das Dores) ficam de fora: o TSE não publicou os votos de vereador, ou os publicou incompletos.
          </p>
          <VerSQL sql={r.sql} />
        </div>
      )}
    </Secao>
  );
}
