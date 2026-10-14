# Projeto BD Eleições (TSE / IBGE)

Trabalho de **Banco de Dados Relacional** (UFPI). Modela, carrega e consulta dados eleitorais públicos
para responder **10 perguntas oficiais**, no escopo de **6 estados (AL, PA, PB, PR, SC, SE; 1.238 municípios)**
e eleições de **2002 a 2024**.

O projeto tem três partes:

```
TSE / IBGE / IPEA          Python                      PostgreSQL                    Node + React
(arquivos públicos) ─────> crawler/ ──> carga_v2 ──>  banco eleicoes_v2  ──views──> site_eleicoes/
                           baixa        gera CSV e      tabelas + views              API só faz SELECT
                                        importa                                      nas views
```

| Parte | Pasta | O que faz |
|---|---|---|
| Crawler | `crawler/` | Baixa dos sites oficiais só os arquivos necessários (6 GB de download, ~33 GB em disco). [Detalhes](docs/CRAWLER.md) |
| Carga e banco | `dados/questoes/carga_v2/` | Limpa os dados, resolve a identidade das pessoas, gera um CSV por tabela, importa no PostgreSQL e cria as views |
| Site | `site_eleicoes/` | Página de apresentação (React + API em Node). [Detalhes](site_eleicoes/README.md) |

**Regra do projeto:** o site e o app só leem **views** do banco (`views_*.sql`). Toda regra de negócio fica nas views,
não no front. Mudou um critério? Mude a view.

## Estrutura do repositório

```
crawler/                      pacote Python que baixa os dados (python -m crawler)
docs/CRAWLER.md               documentação completa do crawler e das fontes
dados/
├── INDICE_PERGUNTAS.md       quais arquivos cada uma das 10 perguntas usa
├── LeiaParaEntenderProjeto/  dossiê do projeto (Word/PDF), handoff e SQL das versões antigas
├── questoes/
│   ├── carga_v2/             PIPELINE ATUAL: scripts de carga, DDL e views (banco eleicoes_v2)
│   ├── questao1/ questao10/  entradas e scripts da v1 (legado; os CSVs não ficam no Git)
├── tse/leiames_unificados/   dicionários de dados do TSE (significado de cada coluna)
└── (tse/, ibge/, ipea_atlas/ ...)  dados brutos: NÃO ficam no Git, o crawler baixa
site_eleicoes/                site (React + Express + TypeScript)
```

## O banco `eleicoes_v2`

14 tabelas (`pessoa`, `eleicao`, `partido`, `municipio`, `candidatura`, `bem_declarado`, `receita`, `despesa`, `votacao`,
`votacao_legenda`, `eleitorado`, `totalizacao_municipio`, `vaga`, `indicador_municipal`). DDL em
`dados/questoes/carga_v2/der_eleicoes_v2.sql`.

Decisões que valem saber antes de mexer:

- **`pessoa` tem chave sintética (`id_pessoa`)**, não o título de eleitor. No TSE a mesma pessoa aparece com títulos diferentes
  e pessoas diferentes aparecem com o mesmo título. A identidade é resolvida em `carga_v2.py` (descrição no topo do arquivo)
  e pode ser conferida com `conferir_identidade.py`.
- `candidatura.titulo_declarado` e `cpf_declarado` guardam o valor original do TSE, sem alteração.
- Despesas usadas: **contratadas** (não as pagas). Candidato sem despesa conta como R$ 0.
- Eleições suplementares são descartadas. Vices e suplentes de senador não entram no custo por cadeira.
- Formato do TSE: Latin-1, separador `;`, nulos como `#NULO`, `#NE`, `-1`, `-3`, `-4`. O CPF vem oculto (`-4`) em 2024.
- Os 6 estados e os anos estão definidos dentro dos scripts (não há argumentos de linha de comando).

## Montar tudo do zero

Pré-requisitos: **Python 3.10+**, **PostgreSQL 18** (com pgAdmin 4) e **Node.js 20+**.

### 1. Clonar e preparar o ambiente

```
git clone <URL-DO-REPOSITORIO>
cd <pasta-clonada>
pip install -r requirements.txt
pip install pandas psycopg2-binary
```

Copie `.env.example` para `.env` (na raiz) e preencha `PGPASSWORD` com a senha do **seu** postgres. O `.env` nunca vai para o GitHub.

### 2. Obter os dados

Os dados brutos **não estão no Git** (dezenas de GB). Há duas origens:

1. **`dados/tse/`, `dados/ibge/`, `dados/ipea_atlas/`:** rode o crawler na raiz do repositório.
   ```
   python -m crawler --simular
   python -m crawler
   ```
   O primeiro comando só mostra o plano e o espaço usado. O segundo baixa (pode ser interrompido e retomado).
2. **`dados/questoes/questao1/` e `dados/questoes/questao10/`** (~2,5 GB: `consulta_cand_*`, `prestacao*`, `vagas`,
   `candidato2002`…`candidato2016`, `municipio_tse_ibge`): são as entradas do `carga_v2.py` e **não são geradas
   pelo crawler**. Peça uma cópia ao João e coloque nessas pastas, mantendo a estrutura.

### 3. Criar o banco e carregar

1. No pgAdmin: botão direito em **Databases > Create > Database...**, nome `eleicoes_v2`.
2. Gerar os CSVs (cria `dados/questoes/carga_v2/saida/`):
   ```
   python dados/questoes/carga_v2/carga_v2.py
   python dados/questoes/carga_v2/carga_bens.py
   ```
3. Importar no banco (o primeiro cria as tabelas com `der_eleicoes_v2.sql`; para recomeçar, mude `RECRIAR = True` dentro do arquivo):
   ```
   python dados/questoes/carga_v2/importar_v2.py
   python dados/questoes/carga_v2/importar_bens.py
   ```
4. No pgAdmin (Query Tool no `eleicoes_v2`), rode **nesta ordem**:
   1. `views_v2.sql` (base, Q1, Q10, resumo e qualidade)
   2. `views_q2.sql` (patrimônio x sucesso)
   3. `views_q9.sql` (categorias de despesa e nuvem de palavras)

   As views materializadas guardam o resultado: depois de recarregar dados, rode os arquivos de novo.

Contagens de referência: ao final, `importar_v2.py` confere o banco contra os CSVs e imprime as divergências, se houver.

### 4. Rodar o site

```
cd site_eleicoes
copy .env.example .env      (edite a senha)
npm install
npm run build
npm start
```

Abra http://localhost:3001. Para desenvolver com recarga automática, use `npm run dev` (http://localhost:5173).

Alternativa em Python: `pip install streamlit plotly` e `streamlit run dados/questoes/carga_v2/app_v2.py` (Q1 e Q10).

## Estado atual

| Item | Situação |
|---|---|
| Crawler (TSE, IBGE, IPEA, Dataverse) | pronto |
| Carga v2: pessoa, candidatura, vaga, despesa, bens | pronta |
| Views: Q1 (custo por cadeira), Q2 (patrimônio), Q9 (categorias e palavras), Q10 (trajetória) | prontas |
| Site: carga do banco, qualidade dos dados, Q1, Q2, Q9, Q10 (rotas `/api/...`) | pronto |
| Tabelas `receita`, `votacao`, `votacao_legenda`, `eleitorado`, `totalizacao_municipio`, `indicador_municipal` | criadas, **vazias** (cargas pendentes: Q3 a Q8) |
| Dossiê Word e DER atualizados para a v2 | pendente |

O documento `dados/LeiaParaEntenderProjeto/LEIA_PRIMEIRO_projeto_eleicoes.md` descreve a **v1** (banco `eleicoes`,
título de eleitor como chave) e está desatualizado nesses pontos; vale pelo histórico das decisões e dos problemas resolvidos.
O significado de cada pergunta e os arquivos que ela usa estão em `dados/INDICE_PERGUNTAS.md`.

## Trabalhando em dupla no Git

1. Antes de começar: `git pull`.
2. Uma branch por tarefa: `git switch -c q3-carga-indicadores`.
3. Commits pequenos, com mensagem dizendo o quê e por quê.
4. Abra um Pull Request para a `main` e peça para o outro revisar. Ninguém dá push direto na `main`.
5. **Nunca commite:** `.env`, senhas, dados brutos, CSVs gerados (`saida/`), `node_modules/`. O `.gitignore` já cobre isso;
   se um arquivo grande aparecer em `git status`, não adicione e avise.
6. Mudou o DDL (`der_eleicoes_v2.sql`) ou uma view? Avise o outro: cada um tem seu banco local e precisa reaplicar.
7. Scripts em `questao1/` e `questao10/` (nomes como `pythonTABELA.py`, `lerCarga.py`) são **exploração da v1** e têm caminhos
   do PC do João fixos no código. Não use como referência; o pipeline atual é o `carga_v2/`.
