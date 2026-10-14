# Site de apresentação — Eleições em Dados

Página única que mostra a carga do banco `eleicoes_v2`, o tratamento de identidade, a Q1 e a Q10.
Tudo é consultado ao vivo no PostgreSQL, **somente por views** (`dados/questoes/carga_v2/views_v2.sql`, `views_q2.sql` e `views_q9.sql`).

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
| `src/secoes/Q9.tsx` | Gasto por categoria e nuvem de palavras das despesas (`views_q9.sql`) |
| `src/secoes/Q10.tsx` | 04 · Busca e linha do tempo do político |
| `src/styles.css` | Cores (claro e escuro) e layout |
