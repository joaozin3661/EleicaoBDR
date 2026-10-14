import { useState } from "react";
import { useApi } from "../api";
import { Estado, Secao, Stat, Tabela, VerSQL } from "../componentes";
import { dataBR, num, pct } from "../formato";

type Indicador = { indicador: string; valor: number };
type Doc = {
  id_pessoa: number; nome_atual: string; nome_declarado: string; ano: number; cargo: string; local: string;
  titulo_declarado: string | null; cpf_declarado: string | null; data_nascimento: string | null; situacao_resultado: string | null;
};

const EXEMPLOS = [
  {
    id: "tamboara",
    aba: "Um título, várias pessoas",
    titulo: "037697100620",
    texto:
      "Em Tamboara (PR), 2004, três vereadores eleitos aparecem com o mesmo título: o de ARNALDO ALVES DOS SANTOS, que o usa " +
      "de 2004 a 2016. EDSON CATHCART veio ainda com o CPF de ANTONIO CAUNETO FILHO. Se o título fosse a chave, os três virariam " +
      "uma pessoa só. A carga separa porque nome e nascimento não batem — e o EDSON aparece com o título verdadeiro dele de 2008 " +
      "em diante, já ligado à mesma pessoa.",
  },
  {
    id: "manoel",
    aba: "Uma pessoa, dois títulos",
    titulo: "000217462143",
    texto:
      "Em 2002 o título veio com os dígitos deslocados (000217462143 em vez de 002174462143). Pelo título seriam duas pessoas: " +
      "um suplente de deputado e um prefeito eleito duas vezes. O CPF, igual nos três registros, une a carreira.",
  },
  {
    id: "jessica",
    aba: "Mudança de nome",
    titulo: "058842961392",
    texto:
      "Mesmo título, CPF e nascimento, com o nome mudando entre as eleições. A pessoa guarda o nome mais recente, " +
      "e a busca da Q10 encontra qualquer um dos nomes usados.",
  },
];

export function Qualidade() {
  const q = useApi<Indicador[]>("/api/qualidade");
  const [ex, setEx] = useState(EXEMPLOS[0]);
  const e = useApi<Doc[]>(`/api/exemplo?titulo=${ex.titulo}`);
  const v = Object.fromEntries((q.dados ?? []).map((i) => [i.indicador, i.valor]));

  return (
    <Secao
      id="qualidade"
      num="02 · Tratamento"
      titulo="Quem é quem: identidade dos políticos"
      descricao={
        <>
          A pergunta 10 depende de reconhecer a mesma pessoa em eleições diferentes. O título de eleitor parecia a chave
          natural, mas a vistoria mostrou que ele <span className="destaque">erra nos dois sentidos</span>, e o CPF vem oculto em
          2024. Por isso PESSOA ganhou uma chave própria (<code>id_pessoa</code>), e título e CPF ficaram na candidatura,
          como o TSE publicou.
        </>
      }
    >
      <Estado carregando={q.carregando} erro={q.erro} />
      {q.dados && (
        <div className="grade g4">
          <Stat rotulo="Pessoas com mais de um título" valor={num(v.pessoas_com_mais_de_um_titulo)} detalhe="unidas pelo CPF ou nome + nascimento" />
          <Stat rotulo="Títulos usados por pessoas diferentes" valor={num(v.titulos_de_mais_de_uma_pessoa)} detalhe="separados: erro de cópia na origem" />
          <Stat
            rotulo="CPF recuperado em 2024"
            valor={num(v.candidaturas_2024_cpf_recuperado)}
            detalhe={`${pct((100 * v.candidaturas_2024_cpf_recuperado) / v.candidaturas_2024)} das candidaturas de 2024, que vêm com CPF oculto`}
          />
          <Stat rotulo="Registros repetidos no mesmo ano" valor={num(v.mesma_pessoa_duas_vezes_no_ano)} detalhe="mantidos e marcados (APTO / INAPTO)" />
        </div>
      )}

      <div className="card">
        <h3>Casos reais da base</h3>
        <div className="abas" style={{ marginTop: 16 }}>
          {EXEMPLOS.map((x) => (
            <button key={x.id} className={x.id === ex.id ? "ativo" : ""} onClick={() => setEx(x)}>
              {x.aba}
            </button>
          ))}
        </div>
        <p className="sub" style={{ maxWidth: "80ch" }}>{ex.texto}</p>
        <Estado carregando={e.carregando} erro={e.erro} />
        {e.dados && (
          <Tabela<Doc>
            colunas={[
              { titulo: "id_pessoa", valor: (l) => l.id_pessoa, numero: true },
              { titulo: "Nome declarado", valor: (l) => l.nome_declarado },
              { titulo: "Nascimento", valor: (l) => dataBR(l.data_nascimento) },
              { titulo: "Ano", valor: (l) => l.ano, numero: true },
              { titulo: "Cargo", valor: (l) => l.cargo },
              { titulo: "Local", valor: (l) => l.local },
              { titulo: "Título declarado", valor: (l) => <code>{l.titulo_declarado ?? "—"}</code> },
              { titulo: "CPF declarado", valor: (l) => <code>{l.cpf_declarado ?? "oculto"}</code> },
              { titulo: "Resultado", valor: (l) => l.situacao_resultado ?? "—" },
            ]}
            linhas={e.dados}
          />
        )}
        <VerSQL sql={e.sql} />
      </div>
      <VerSQL sql={q.sql} />
    </Secao>
  );
}
