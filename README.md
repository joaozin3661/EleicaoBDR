# Eleições BDR

Eleições de 2002 a 2026 no Brasil inteiro (as 27 unidades da federação, 5.571 municípios, 2,9 milhões de candidaturas),
com dados públicos do TSE, do IBGE e do Atlas Brasil. O projeto modela e carrega esses dados num banco PostgreSQL
(`eleicoes`) e responde **10 perguntas** com views SQL, mostradas num site com o SQL de cada resposta.

Começou como trabalho de **Banco de Dados Relacional** (UFPI, 2026), de Antônio Inácio da Silva Neto e João Marcelo
Barros Cardoso Ventura.

```
TSE / IBGE / IPEA        coleta/            banco/carga/          PostgreSQL               api/                 frontend/
(arquivos públicos) ───> baixa ───> dados/ ───> CSVs ───> eleicoes + views ───> SELECT nas views ───> site
```

| Pasta | O que tem |
|---|---|
| `frontend/` | O site: `index.html` (o relatório), `consultas.html` (as perguntas, com filtros, gráficos e o SQL) e `sobre.html` (fontes, método, limitações e autores). HTML, CSS e JS sem build. |
| `api/` | Servidor em Node (Express + TypeScript): os endpoints que fazem SELECT nas views e servem o `frontend/`. Em `api/exportacao/`, o que grava os dados do site para ele funcionar sem banco. |
| `banco/` | `sql/esquema.sql` (as 14 tabelas), `sql/views/` (as views de cada pergunta), `carga/` (scripts que geram e importam os CSVs) e `testes/`. |
| `coleta/` | Baixa os arquivos oficiais (`python -m coleta`) e as fotos dos candidatos (`baixar_fotos.py`). |
| `dados/` | O que a coleta baixa e a carga gera (fora do git) e os dicionários de dados do TSE (`tse/leiames_unificados/`). |
| `docs/` | O DER, a coleta, as justificativas dos dados, a descrição de cada pergunta (`QUESTOES.md`) e o dossiê. |

**Regra do projeto:** o site só lê **views** do banco. Toda regra de negócio fica nas views (`banco/sql/views/`), não
no front. Mudou um critério? Mude a view.

## Rodar o site

Precisa do **PostgreSQL 18**, do **Node.js 20+** e do **Python 3.10+**.

1. **O banco.** O site lê o `eleicoes`, com as 27 UFs, que se monta com a coleta e a carga
   ([Montar o banco do zero](#montar-o-banco-do-zero), algumas horas).
2. **A senha e o banco.** Copie `.env.example` para `.env`, na raiz, troque `COLOQUE_SUA_SENHA_AQUI` pela senha do
   `postgres` da sua instalação (o exemplo já traz `PGDATABASE=eleicoes`). É o único `.env`
   do projeto e nunca vai para o git.
3. **O site, lendo o banco ao vivo:**
   ```
   cd api
   npm install
   npm start
   ```
   Abra http://localhost:3001. Cada tela pergunta à API, que roda o SQL nas views na hora.

### Sem o banco

O site também funciona sem a API, com as respostas gravadas em `frontend/dados/`. É assim que ele vai para o
GitHub Pages.

```
cd frontend
python -m http.server 8000
```

Abra http://localhost:8000 (no Windows, se `python` não existir, use `py`). O `frontend/js/dados.js` decide sozinho:
servido pela API, pergunta ao banco; servido por outro lugar, lê os arquivos.

### Comandos da API (em `api/`)

| Comando | O que faz |
|---|---|
| `npm start` | Site e API em http://localhost:3001 (`PORT` no `.env` troca a porta). |
| `npm run dev` | O mesmo, reiniciando quando um arquivo `.ts` muda. |
| `npm run grava` | Regrava `frontend/dados/` a partir do banco: as respostas de todas as combinações de filtros, a busca da Q10 e os dados do hemiciclo, do mapa e das carreiras. Rode depois de mudar uma view. |
| `npm run fotos` | Escolhe as fotos que o site usa e gera as miniaturas em `frontend/fotos/`. Precisa das fotos originais (`python coleta/baixar_fotos.py`). |
| `npm run publica -- <pasta>` | Copia para `<pasta>` só o que vai para a internet, sem documentos pessoais. |
| `npm run typecheck` | Confere os tipos do TypeScript. |

As fotos (30 mil miniaturas) ficam fora do git: gere com `npm run fotos` ou copie de quem já tem para `frontend/fotos/`.
Sem elas o site funciona, só sem as fotos.

## O banco `eleicoes`

As 27 UFs, de 2002 a 2026: 5.571 municípios, 2.949.123 candidaturas, 1.856.162 pessoas, 12.062.880 despesas e
22.156.436 linhas de votação (uns 8,5 GB). 2026 entra só com candidaturas, bens, resultado e votos (arquivos do TSE
baixados em 13/11/2026); a prestação de contas de 2026 fica de fora porque ainda é parcial (ver docs/QUESTOES.md). O presidente não entra: o arquivo do TSE o registra na unidade `BR`, e a
carga fica só com as 27 siglas de UF. 14 tabelas: `pessoa`, `eleicao`, `partido`, `municipio`, `candidatura`, `bem_declarado`, `receita`, `despesa`,
`votacao`, `votacao_legenda`, `eleitorado`, `totalizacao_municipio`, `vaga` e `indicador_municipal`
([DER](docs/DER.md)).

Decisões que valem saber antes de mexer:

- **`pessoa` tem chave sintética (`id_pessoa`)**, não o título de eleitor. No TSE a mesma pessoa aparece com títulos
  diferentes e pessoas diferentes aparecem com o mesmo título. A identidade é resolvida em `banco/carga/carga.py`
  (descrição no topo do arquivo) e pode ser conferida com `banco/testes/conferir_identidade.py`. A tela "Identidade dos
  políticos" do site mostra casos reais.
- `candidatura.titulo_declarado` e `cpf_declarado` guardam o valor original do TSE, sem alteração.
- Despesas usadas: **contratadas** (não as pagas). Candidato sem despesa conta como R$ 0.
- Eleições suplementares são descartadas. Vices e suplentes de senador não entram no custo por cadeira.
- Formato do TSE: Latin-1, separador `;`, nulos como `#NULO`, `#NE`, `-1`, `-3`, `-4`. O CPF vem oculto (`-4`) em 2024.

Os dados usados e as decisões de cada pergunta estão em [docs/JUSTIFICATIVA_DADOS.md](docs/JUSTIFICATIVA_DADOS.md).

## Montar o banco do zero

> É o jeito de ter o `eleicoes` (27 UFs). Também serve, com `CARGA_UFS` menor, para montar um banco de teste.

1. **Ambiente:** `pip install -r requirements.txt`, com o `.env` da raiz preenchido.
2. **Dados brutos** (dezenas de GB, fora do git):
   - `python -m coleta --simular` mostra o plano e o espaço; `python -m coleta` baixa para `dados/tse/`,
     `dados/ibge/` e `dados/ipea_atlas/` (pode ser interrompido e retomado). Detalhes em [docs/CRAWLER.md](docs/CRAWLER.md).
   - A carga lê só o que a coleta baixa (os consolidados `_BRASIL` do TSE) e fica com os estados de `CARGA_UFS`.
3. **Estados e banco** (no `.env` da raiz ou no ambiente; o ambiente vale mais):
   - `CARGA_UFS=TODAS` para as 27 UFs, que é o que o site usa hoje. Dá para restringir: `CARGA_UFS=AL,PA,PB,PR,SC,SE`
     (os seis estados do projeto original) ou qualquer lista de siglas. Sem a variável, o código ainda cai nesses
     seis estados.
   - `CARGA_BANCO=eleicoes`: o banco em que os `importar_*.py` gravam (sem ela, o `PGDATABASE`, que também deve
     ser `eleicoes`). Para testar uma carga sem tocar nele, use outro nome: `createdb -U postgres eleicoes_teste` e
     `CARGA_BANCO=eleicoes_teste`.
   - Banco vazio: `createdb -U postgres <nome>` (ou pelo pgAdmin).
4. **Gerar os CSVs** (em `dados/saida_carga/`), nesta ordem:
   ```
   python banco/carga/carga.py
   python banco/carga/carga_bens.py
   python banco/carga/carga_receitas.py
   python banco/carga/carga_eleitorado.py
   python banco/carga/carga_idade_municipio.py
   python coleta/ibge_2010.py
   python banco/carga/carga_q3.py
   python banco/carga/carga_q5.py
   python banco/carga/carga_votos_majoritarios.py
   python banco/carga/carga_votos_q7.py
   python banco/carga/carga_vies.py
   ```
5. **Importar** (o primeiro cria as tabelas com `banco/sql/esquema.sql`; para recomeçar, mude `RECRIAR = True` nele):
   ```
   python banco/carga/importar.py
   python banco/carga/importar_bens.py
   python banco/carga/importar_receitas.py
   python banco/carga/importar_eleitorado.py
   python banco/carga/importar_idade.py
   python banco/carga/importar_q3.py
   python banco/carga/importar_q5.py
   python banco/carga/importar_q7.py
   psql -U postgres -d eleicoes -v pasta="<raiz do projeto>" -f banco/carga/importar_votos_majoritarios.sql
   ```
6. **Views:** `psql -U postgres -d eleicoes -f banco/sql/aplicar_views.sql` (uns 45 minutos com as 27 UFs, contra uns
   4 minutos com seis estados). As views materializadas guardam o resultado: depois de recarregar dados, rode de novo.
   Em `banco/sql/migracoes/` ficam os ajustes pontuais para quem já tem o banco carregado, sem refazer tudo (hoje, a
   `2026-11-17_q1_presidente.sql`, que põe o presidente no custo da cadeira da Q1). Um banco montado agora já vem certo
   pelo `aplicar_views.sql` e não precisa delas.
7. **Conferir:** as contagens de cada passo ficam em `dados/_controle/carga.log` (pessoas, candidaturas, municípios,
   linhas importadas "banco x CSV"), e `psql -U postgres -d eleicoes -f banco/testes/contagens.sql` tem que dar "ok"
   em todas as linhas. Então `npm run grava` em `api/`.

   A carga completa de 27 UFs, medida no `carga.log`: `carga` uns 15 minutos, `importar` uns 28, `importar_q5`
   uns 21 e as views uns 43.

## Estado

| Item | Situação |
|---|---|
| Coleta (TSE, IBGE, IPEA, Dataverse) | pronta |
| Carga (27 UFs, `eleicoes`): pessoa, candidatura, vaga, despesa, bens, receitas, eleitorado, idade do município, indicadores de 2010, totalização 2008/2012, votos | pronta |
| Perguntas respondidas no banco: **Q1 a Q10** | prontas |
| Q7 (viés político) | pronta: banco, API e tela |
| Site: relatório, consultas das perguntas, o banco e a identidade dos políticos | pronto |
