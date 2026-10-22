# Site de apresentação — Eleições em Dados

Página única que mostra a carga do banco `eleicoes_v2`, o tratamento de identidade, e as perguntas 1, 2, 3, 4, 5, 6, 8, 9 e 10.
Tudo é consultado ao vivo no PostgreSQL, **somente por views** (`dados/questoes/carga_v2/views_v2.sql`, `views_q2.sql`, `views_q3.sql`, `views_q4.sql`, `views_q5.sql`, `views_q6.sql`, `views_q8.sql` e `views_q9.sql`).

```
navegador (React, src/)  ──/api──>  API (Express, server/index.ts)  ──SELECT──>  views do eleicoes_v2
```

## Primeira vez

1. Copie `.env.example` para `.env` e troque `COLOQUE_SUA_SENHA_AQUI` pela senha do postgres.
2. No terminal, dentro desta pasta: `npm install`

## Para apresentar

```
npm run build
npm start
```

Abra http://localhost:3001. Tudo roda num processo só.

## Para mexer no código

```
npm run dev
```

O site abre em http://localhost:5173 e recarrega sozinho a cada alteração (a API roda em :3001).

## Versão estática (para mandar um link)

O site normal precisa do banco e da API no seu computador. A versão estática grava as respostas em arquivos e abre em qualquer hospedagem, sem banco:

```
npm start                    (em um terminal, com o banco ligado)
npm run grava:estatico       (em outro: grava as respostas em estatico/dados, leva alguns segundos)
npm run build:estatico       (gera a pasta dist-estatico, com o site, os dados e a página de justificativas)
```

Hospede a pasta `dist-estatico` inteira, por exemplo arrastando-a em https://app.netlify.com/drop. Ela não abre com duplo clique (o navegador bloqueia a leitura dos arquivos), só por um endereço http.
Refaça os dois primeiros passos sempre que os dados do banco mudarem. A busca de políticos da Q10 cobre os 2.500 com mais candidaturas; as demais telas têm todas as combinações de filtros.

## Depois de recarregar dados no banco

Rode de novo o `views_v2.sql` no pgAdmin (ele recria as views e atualiza as materializadas).

## Onde está cada coisa

| Arquivo | O quê |
|---|---|
| `server/index.ts` | API: um endpoint por tela, cada um com o SELECT na view correspondente |
| `src/App.tsx` | Menu, abertura e ordem das seções |
| `src/secoes/Banco.tsx` | 01 · Contagem das tabelas e candidaturas por pleito |
| `src/secoes/Qualidade.tsx` | 02 · Resolução de identidade e casos reais |
| `src/secoes/Q1.tsx` | 03 · Custo por cadeira (estado, município) e eleitos × não eleitos |
| `src/secoes/Q2.tsx` | Taxa de sucesso eleitoral por patrimônio declarado (`views_q2.sql`) |
| `src/secoes/Q3.tsx` | IDHM e PIB per capita × abstenção, brancos, nulos e partidos eleitos, 2008 e 2012 (`views_q3.sql`) |
| `src/secoes/Q4.tsx` | Escolaridade do candidato, do eleito e do eleitorado (`views_q4.sql`) |
| `src/secoes/Q5.tsx` | Eleitos por votos de legenda: quociente eleitoral, partidos, menos votados e barrados (`views_q5.sql`) |
| `src/secoes/Q6.tsx` | Idade do município, idade dos eleitos e alternância de poder (`views_q6.sql`) |
| `src/secoes/Q8.tsx` | Dinheiro público x privado e desempenho eleitoral (`views_q8.sql`) |
| `src/secoes/Q9.tsx` | Gasto por categoria e nuvem de palavras das despesas (`views_q9.sql`) |
| `src/secoes/Q10.tsx` | 04 · Busca e linha do tempo do político |
| `src/styles.css` | Cores (claro e escuro) e layout |
