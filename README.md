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
| Site de consulta | `site_eleicoes/` | Os dados das perguntas, com filtros (React + API em Node, lê o banco). [Detalhes](site_eleicoes/README.md) |
| Site de apresentação | `site_novo/` | O relatório visual: as perguntas como capítulos, o hemiciclo com cada eleito, o mapa por município, as fotos dos candidatos e a página de consultas com o SQL das views. Estático: abre sem banco. [Detalhes](site_novo/README.md) |

**Regra do projeto:** o site e o app só leem **views** do banco (`views_*.sql`). Toda regra de negócio fica nas views,
não no front. Mudou um critério? Mude a view.

## Para começar (quem recebeu o projeto)

### 1. Pegar o código novo

O código atual está na branch `main`. Se você já tinha clonado o repositório antes, a sua cópia está **antiga**:
atualize assim, dentro da pasta do projeto:

```
git switch main
git pull origin main
```

Se ainda não tem o projeto:

```
git clone https://github.com/joaozin3661/EleicaoBDR.git
cd EleicaoBDR
```

Para conferir que pegou a versão nova: a pasta `site_novo/` tem que existir, e `git log --oneline -3` mostra
os commits mais recentes (o do site novo é "Site de apresentação (site_novo) ..."). Se o `git pull` reclamar de
alterações locais, guarde as suas antes com `git stash` e rode o `git pull` de novo.

### 2. Ter o banco

O banco não fica no git. A cópia está anexada a uma release do GitHub: veja
[docs/COMO_RESTAURAR_O_BANCO.md](docs/COMO_RESTAURAR_O_BANCO.md) (baixar, restaurar e conferir, uns 10 minutos).

### 3. Abrir o site de apresentação (`site_novo`)

Ele não precisa do banco: as respostas das views já estão gravadas em `site_novo/dados/`. Só precisa de um servidor
local, porque o navegador não lê os arquivos de dados se você abrir o `index.html` com dois cliques.

```
cd site_novo
python -m http.server 8000
```

(no Windows, se `python` não existir, use `py -m http.server 8000`; com Node instalado, `npx serve -l 8000` também serve).
Abra http://localhost:8000. A página de consultas, com o SQL de cada pergunta, fica em http://localhost:8000/consultas.html.

Para regerar os dados do `site_novo` a partir do **seu** banco (depois de mudar uma view, por exemplo), veja
`site_novo/README.md`.

## Estrutura do repositório

```
crawler/                      pacote Python que baixa os dados (python -m crawler)
docs/CRAWLER.md               documentação completa do crawler e das fontes
docs/DER_v2.md                diagrama entidade-relacionamento do banco eleicoes_v2 (imagem, fonte e mudanças da v1)
dados/
├── INDICE_PERGUNTAS.md       quais arquivos cada uma das 10 perguntas usa
├── LeiaParaEntenderProjeto/  dossiê do projeto (Word/PDF), handoff e SQL das versões antigas
├── questoes/
│   ├── carga_v2/             PIPELINE ATUAL: scripts de carga, DDL e views (banco eleicoes_v2)
│   ├── questao1/ questao10/  entradas e scripts da v1 (legado; os CSVs não ficam no Git)
├── tse/leiames_unificados/   dicionários de dados do TSE (significado de cada coluna)
└── (tse/, ibge/, ipea_atlas/ ...)  dados brutos: NÃO ficam no Git, o crawler baixa
site_eleicoes/                site de consulta (React + Express + TypeScript)
site_novo/                    site de apresentação (HTML, CSS e JS sem build; dados e fotos já gravados)
docs/COMO_RESTAURAR_O_BANCO.md  como baixar e restaurar a cópia do banco
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
   python dados/questoes/carga_v2/carga_receitas.py
   python dados/questoes/carga_v2/carga_eleitorado.py
   python dados/questoes/carga_v2/carga_idade_municipio.py
   python dados/questoes/carga_v2/baixa_ibge_2010.py
   python dados/questoes/carga_v2/carga_q3.py
   python dados/questoes/carga_v2/carga_q5.py
   ```
3. Importar no banco (o primeiro cria as tabelas com `der_eleicoes_v2.sql`; para recomeçar, mude `RECRIAR = True` dentro do arquivo):
   ```
   python dados/questoes/carga_v2/importar_v2.py
   python dados/questoes/carga_v2/importar_bens.py
   python dados/questoes/carga_v2/importar_receitas.py
   python dados/questoes/carga_v2/importar_eleitorado.py
   python dados/questoes/carga_v2/importar_idade.py
   python dados/questoes/carga_v2/importar_q3.py
   python dados/questoes/carga_v2/importar_q5.py
   ```
4. No pgAdmin (Query Tool no `eleicoes_v2`), rode **nesta ordem**:
   1. `views_v2.sql` (base, Q1, Q10, resumo e qualidade)
   2. `views_q2.sql` (patrimônio x sucesso)
   3. `views_q3.sql` (IDHM e PIB x abstenção, brancos, nulos e partidos, 2008 e 2012)
   4. `views_q4.sql` (escolaridade)
   5. `views_q5.sql` (eleitos por votos de legenda; leva cerca de 1 minuto)
   6. `views_q6.sql` (idade do município e alternância)
   7. `views_q8.sql` (dinheiro público x privado)
   8. `views_q9.sql` (categorias de despesa e nuvem de palavras; leva cerca de 6 minutos)

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

**Versão estática (para mandar um link, sem banco):** com o `npm start` rodando, execute `npm run grava:estatico` e depois
`npm run build:estatico`. A pasta `dist-estatico/` pode ser hospedada em qualquer lugar (por exemplo, arrastada em
https://app.netlify.com/drop). Ela inclui a página de justificativas. Detalhes em `site_eleicoes/README.md`.

Alternativa em Python: `pip install streamlit plotly` e `streamlit run dados/questoes/carga_v2/app_v2.py` (Q1 e Q10).

## Estado atual

| Item | Situação |
|---|---|
| Crawler (TSE, IBGE, IPEA, Dataverse) | pronto |
| Carga v2: pessoa, candidatura, vaga, despesa, bens, receitas, eleitorado, idade do município, indicadores de 2010, totalização 2008/2012 | pronta |
| Perguntas respondidas (banco + site): **Q1, Q2, Q3, Q4, Q5, Q6, Q8, Q9, Q10** | prontas, com verificação independente em pandas |
| Q7 (ideologia dos partidos) | adiada: falta a base de ideologia |
| Tabelas `votacao` e `votacao_legenda` | carregadas para as eleições proporcionais (2018 a 2024) |
| Site: carga, tratamento e as 9 perguntas, mais versão estática com página de justificativas | pronto |
| DER da v2 (`docs/DER_v2.md`, com imagem) | pronto |
| Site de apresentação (`site_novo`): capítulos das perguntas, hemiciclo, mapa por município, Q3 aprofundada, fotos | pronto (Q10 como capítulo próprio em andamento) |
| Cópia do banco para colaboradores (release `banco-2026-10-22`) | pronta |
| Dossiê Word atualizado para a v2 (incluir o DER novo e o texto das mudanças) | pendente |

Os dados usados e as decisões de cada pergunta (o que foi conferido e as limitações) estão em `JUSTIFICATIVA_DADOS.md`.

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
