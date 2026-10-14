import type { ReactNode } from "react";

export function Secao(p: { id: string; num: string; titulo: string; children: ReactNode; descricao?: ReactNode }) {
  return (
    <section className="secao" id={p.id}>
      <div className="secao-cab">
        <div className="num">{p.num}</div>
        <h2>{p.titulo}</h2>
        {p.descricao && <p>{p.descricao}</p>}
      </div>
      {p.children}
    </section>
  );
}

export function Stat(p: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; hero?: boolean }) {
  return (
    <div className={"stat" + (p.hero ? " hero-num" : "")}>
      <div className="r">{p.rotulo}</div>
      <div className="v">{p.valor}</div>
      {p.detalhe && <div className="d">{p.detalhe}</div>}
    </div>
  );
}

/** Mostra o SQL que a API executou, com os valores preenchidos. */
export function VerSQL({ sql }: { sql?: string }) {
  if (!sql) return null;
  return (
    <details className="sql">
      <summary>Ver o SQL executado no banco</summary>
      <pre>{sql}</pre>
    </details>
  );
}

export function Estado(p: { carregando: boolean; erro?: string; vazio?: boolean; msgVazio?: string }) {
  if (p.erro) return <p className="erro">Erro ao consultar o banco: {p.erro}</p>;
  if (p.carregando) return <p className="aviso">Consultando o banco…</p>;
  if (p.vazio) return <p className="aviso">{p.msgVazio ?? "Nada encontrado."}</p>;
  return null;
}

export type Coluna<T> = { titulo: string; valor: (l: T) => ReactNode; numero?: boolean };

export function Tabela<T>({ colunas, linhas }: { colunas: Coluna<T>[]; linhas: T[] }) {
  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.titulo} className={c.numero ? "n" : undefined}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>
              {colunas.map((c) => (
                <td key={c.titulo} className={c.numero ? "n" : undefined}>{c.valor(l)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Legenda({ itens }: { itens: { rotulo: string; cor: string }[] }) {
  return (
    <div className="legenda">
      {itens.map((i) => (
        <span key={i.rotulo}>
          <i style={{ background: i.cor }} />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

/** Caixa de dica dos gráficos (Recharts). */
export function Dica(p: { titulo: ReactNode; linhas: { rotulo: string; valor: string; cor?: string }[] }) {
  return (
    <div className="dica">
      <div className="t">{p.titulo}</div>
      {p.linhas.map((l) => (
        <div className="l" key={l.rotulo}>
          <span>
            {l.cor && <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: l.cor, marginRight: 6 }} />}
            {l.rotulo}
          </span>
          <b>{l.valor}</b>
        </div>
      ))}
    </div>
  );
}
