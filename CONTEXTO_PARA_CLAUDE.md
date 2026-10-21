# Contexto e histórico do projeto BD Eleições (passagem de bastão)

> **Para o Claude que está lendo:** este arquivo resume tudo o que foi feito em duas sessões do Claude Code com o João (14/10/2026), para você continuar de onde pararam sem perder decisões. Leia inteiro antes de responder. Depois leia o [README.md](README.md) (como montar tudo do zero) e confirme com a pessoa que está falando com você o que ela quer fazer agora. A pessoa pode ser o João ou o colega de grupo dele. Se for o colega, o banco dele é **local e vazio** até ele rodar as cargas (seção 9).

---

## 1. O projeto

- **O que é:** trabalho da disciplina de Banco de Dados Relacional (UFPI), em grupo. O dossiê cita também o Antônio Inácio.
- **Objetivo:** modelar, carregar e consultar dados eleitorais públicos do **TSE** (mais IBGE/IPEA) para responder **10 perguntas oficiais, que são fixas**.
- **Escopo:** 6 UFs (**AL, PA, PB, PR, SC, SE**, 1.238 municípios), eleições de **2002 a 2024**. As perguntas principais usam 2018, 2020, 2022 e 2024; a Q10 usa o histórico todo.
- **Stack:** PostgreSQL 18 + pgAdmin 4, Python (pandas, psycopg2) para as cargas, Node/Express + React + TypeScript para o site. Windows, VS Code, Code Runner.
- **Próxima entrega:** apresentação ao professor, cujo objetivo é **mostrar que o load foi feito, que os dados estão no banco e responder as perguntas** (uma maneira principal por pergunta, com variações guardadas).
- **Repositório:** https://github.com/joaozin3661/EleicaoBDR (privado), branch `main`.

### Regra de arquitetura (decisão do João)
O front só consulta **views** do banco. Toda regra de negócio fica nas views (`views_*.sql`), não no código do site. Se um critério mudar, muda a view.

```
TSE/IBGE/IPEA ──crawler──> arquivos ──carga_v2.py──> CSVs ──importar_v2.py──> PostgreSQL eleicoes_v2
                                                                                  │ views (vw_*, mv_*)
                                                          navegador (React) ──/api──> Express ──SELECT──┘
```

---

## 2. Linha do tempo do que foi feito

### Sessão 1 (pasta `crawler\dados`, 13 a 14/10/2026)

1. **Diagnóstico do projeto herdado.** O Claude leu a pasta `dados\LeiaParaEntenderProjeto` (dossiê v8, scripts, SQLs). O banco original `eleicoes` (v1) tinha Q1 e Q10 carregadas: 569.184 candidaturas, 359.740 pessoas, 2,1 milhões de despesas. Problemas achados na v1:
   - mesma pessoa duas vezes no mesmo ano (1.332 casos), o que quebra a linha do tempo da Q10;
   - DDLs desatualizados em relação ao banco, sem `CHECK` e sem índices nas chaves estrangeiras;
   - no app, o "Ver o SQL" mostrava `%s` em vez dos valores, e a métrica de custo por cadeira misturava cargos.
2. **O João decidiu tratar os dados antes de avançar** (identidade da pessoa, CPF ausente ou oculto, título faltando).
3. **Vistoria de identidade** nos 569.184 registros brutos do TSE. Conclusão: **o título de eleitor não serve como chave da pessoa**, porque erra nos dois sentidos (detalhes na seção 4).
4. **Carga nova (`carga_v2.py`)** com `id_pessoa` sintético e resolução de identidade; banco novo `eleicoes_v2`; o `eleicoes` antigo ficou como backup. O importador falhou uma vez porque `uf_nascimento CHAR(2)` recebeu "Não divulgável" em 330 registros; corrigido (viram vazio). Importação final: todas as contagens batem (seção 5).
5. **Views da Q1 e da Q10** no modelo novo (`views_v2.sql`). Dois problemas de desempenho resolvidos separando `vw_q10_base` de `vw_q10_carreira` (carreira de uma pessoa: 4,5 s → 4 ms) e a busca por nome em dois passos (2,7 s → instantânea). A pessoa guarda só o nome mais recente, então a busca por nome antigo falhava; a carga passou a gravar `nome_declarado` por candidatura e a busca acha os dois nomes.
6. **App Streamlit (`app_v2.py`)** lendo só das views, depois **substituído por um site em TypeScript** (`site_eleicoes/`), com seções Banco, Qualidade, Q1 e Q10, modo claro/escuro e responsivo. Cada bloco tem "Ver o SQL executado".
7. **Q9 (propaganda)** e **Q2 (patrimônio)** escolhidas como as duas mais fáceis. O João pediu **não mexer na Q3** (só há IDHM de 2010 e o grupo ainda decide como fazer). Q9 não precisou de carga nova; Q2 precisou de `bem_declarado`.
8. **Verificação independente** por workflows de agentes (duas rodadas): recalcularam Q2 e Q9 em pandas sem usar as views e compararam com o banco. Números bateram; sobraram acabamentos (texto, avisos de poucos candidatos, limpeza da nuvem), todos corrigidos.

### Sessão 2 (pasta `crawler\site_eleicoes`, 14/10/2026): Git e documentação

1. O João pediu para subir tudo no GitHub porque o colega vai trabalhar junto.
2. **Incidente:** o git ativo estava na pasta de usuário `C:\Users\joaom` inteira (269 arquivos pessoais em stage, 6 GB de objetos, sem commits). Para não subir arquivos pessoais, foi criado um **repositório separado só em `crawler\`**. Depois, a pedido do João, o `C:\Users\joaom\.git` foi **apagado** (sem commits, sem remote; nenhum arquivo foi tocado). A pasta `FlowIA` já estava apagada do disco antes disso; o `FlowIA.zip` na Área de Trabalho tem os arquivos.
3. **Senha removida do código:** o `importar_v2.py` tinha a senha do postgres como valor padrão. Agora lê `PGPASSWORD` do ambiente ou de um `.env` local (não versionado).
4. **Caminhos portáteis:** `carga_v2.py` e `carga_bens.py` usavam `C:\Users\joaom\...`; agora são relativos à pasta do script. Scripts legados (v1) ainda têm caminho fixo e foram marcados como legado.
5. Foram feitos 2 commits e o push para `origin/main`. README novo, `docs/CRAWLER.md` (README antigo do crawler), aviso de "v1" nos `LEIA_PRIMEIRO`.

---

## 3. Decisões de modelagem e de negócio (não reabrir sem motivo)

| Decisão | Por quê |
|---|---|
| `pessoa.id_pessoa` sintético, **não** o título | O TSE repete título em pessoas diferentes e dá títulos diferentes à mesma pessoa |
| `candidatura` guarda `titulo_declarado`, `cpf_declarado`, `nome_declarado`, `nome_urna`, `numero_candidato` | Fonte intacta; a identificação fica separada (fácil de defender) |
| `candidatura.situacao_candidatura` (APTO/INAPTO) e `detalhe_situacao` | Marca os 1.208 casos de pessoa repetida no mesmo ano |
| Título e CPF validados pelo dígito verificador | Há valores inválidos na origem |
| Atributos da pessoa por regra: nascimento e CPF mais frequentes; nome, sexo e cor/raça mais recentes | Cor/raça não existe antes de 2014 (`#NE`) |
| `candidatura.id_candidatura`: 2018+ é o `SQ_CANDIDATO`; 2002 a 2016 é `ano×1e9 + sequência` | O SQ antigo se repete entre municípios |
| `candidatura.sigla_partido` = partido **da época** | PFL/DEM, PMDB/MDB etc. |
| Despesas **contratadas** (não as pagas) | Escolha do projeto para P1 e P9 |
| **Candidato sem despesa conta R$ 0** (`LEFT JOIN` + `COALESCE`) | Informação real; derruba a mediana dos perdedores |
| **Candidato sem bem declarado conta patrimônio R$ 0** (faixa própria "sem bens") | Decidido pelo João na Q2, mesma lógica da Q1 |
| Vices e **suplentes de senador** fora da Q1 | Disputam a vaga do titular; apareciam com custo R$ 0 |
| Eleições **suplementares** descartadas (filtro por data, até 28 dias após a 1ª votação, preservando o 2º turno) | Fora do escopo; os bens de suplementares também ficam de fora |
| Eleito = `situacao_resultado LIKE 'ELEITO%'` ("MÉDIA" padronizado para "ELEITO POR MÉDIA") | Um único critério para todos os anos |
| Q2: **mediana**, não média | Há declarações absurdas na origem (ex.: bem de R$ 1 bi), mantidas sem alteração |
| Views comuns para consultas de uma pessoa; **materializadas** (`mv_*`) onde agrega milhões de linhas | Desempenho; depois de recarregar dados, rodar `REFRESH` ou reaplicar o `.sql` |
| Recuperar pessoas sem título pelo CPF: **descartado** | Das 467 pessoas com código `S`, só 29 têm CPF e só 10 seriam recuperadas |

---

## 4. Resultados da vistoria de identidade (para citar na apresentação)

- Mesma pessoa com títulos diferentes: ~480 casos. Em 2002 e 2004 há títulos com dígitos deslocados e títulos reemitidos. Exemplo: Manoel Gomes de Freitas, suplente em 2002 e prefeito eleito em 2004 e 2008, aparecia como duas pessoas.
- Pessoas diferentes com o mesmo título: 171 títulos. Em 2004 o TSE copiou título e CPF de um candidato para outros da mesma câmara (ex.: 3 vereadores eleitos de Tamboara-PR com o mesmo título).
- Trocas de nome com documento igual: o caso de GERALDO → SHIRLEY COSTA DA SILVA (mesma pessoa); a JÉSSICA LULA LIMA MAGNO virou PAULA JÉSSICA LIMA MAGNO em 2020 e 2024.
- CPF 100% oculto em 2024 (`-4`); 45.517 dos 93.365 candidatos de 2024 recuperaram o CPF de eleições anteriores.
- Travas contra uniões erradas: não une quem disputou o mesmo ano em municípios diferentes; em título repetido na mesma eleição, nome diferente conta como outra pessoa.
- Pessoas: 359.740 (v1) → 359.408 (v2). Candidaturas iguais nas duas: 569.184.
- Revisão por amostragem: `saida\revisao_separados.csv` e `saida\revisao_unidos.csv`, gerados por `conferir_identidade.py`.
- Limitação: em 2024 a situação da candidatura vem `#NE` para todos; só o resultado diferencia os registros.

---

## 5. Estado atual do banco `eleicoes_v2` (contagens validadas)

| Tabela | Linhas | Obs. |
|---|---|---|
| municipio | 1.238 | 6 UFs |
| eleicao | 12 | 2002 a 2024 |
| partido | 39 | |
| pessoa | 359.408 | |
| candidatura | 569.184 | |
| vaga | 7.512 | 2018 a 2024 |
| despesa | 2.099.197 | R$ 3.292.637.753,14 no total; nenhuma negativa |
| bem_declarado | 442.621 | R$ 58.079.144.716,98; 2018 a 2024 |
| receita, votacao, votacao_legenda, eleitorado, totalizacao_municipio, indicador_municipal | 0 | criadas e **vazias**; cargas pendentes (Q3 a Q8) |

Views: `views_v2.sql` (base, Q1, Q10, resumo da carga, qualidade), `views_q2.sql` (patrimônio), `views_q9.sql` (categorias e nuvem de palavras; leva ~6 min por causa da nuvem).
Extensões usadas: `pg_trgm` e `unaccent` (criadas no `der_eleicoes_v2.sql`).

### Números de referência para conferir se o banco do colega está certo
- **Q1**, deputado federal 2018, 6 UFs: **92 eleitos**, média R$ 1.058.181,39, mediana R$ 965.545; **1.053 não eleitos + suplentes** (465 + 588), média R$ 104.948, mediana R$ 9.874. Razão: 10,1× pela média e 97,8× pela mediana.
- **Q2**: deputado federal 2022: 0,7% de eleitos entre os sem bens contra 22,4% no quinto mais rico (33,4×); mediana de patrimônio dos eleitos R$ 1,3 mi contra R$ 72 mil dos não eleitos. Vereador 2024: 9,0% contra 24,4% (2,7×). Exceção que a tela mostra: prefeito/SE 2020, em que quem não declarou bens se elegeu mais (35,1% contra 28,2%).
- **Q9**: em 2024, 53,1% do gasto foi para propaganda, metade em impressos e adesivos; internet 8,3% da propaganda em 2024. Nuvem de vereador 2024: ADESIVO, SANTINHO, MILITÂNCIA, PERFURADO, RUA...
- **Q10**: busca "helder barbalho" acha HELDER ZAHLUTH BARBALHO; busca "JÉSSICA LULA LIMA MAGNO" acha a carreira 2018 → 2020 → 2024 pelo nome antigo.
- A conferência do `importar_v2.py` deve imprimir `OK` em todas as tabelas.

---

## 6. O que cada pergunta usa e como foi respondida

| # | Tema | Situação | Onde |
|---|---|---|---|
| Q1 | Custo de uma cadeira | **Pronta** (site + views) | `mv_q1_custo_cadeira`, `mv_q1_custo_municipio`, `mv_q1_eleitos_vs_nao` |
| Q2 | Sucesso eleitoral x patrimônio | **Pronta** | `views_q2.sql`: faixas fixas e quintos dentro do cargo |
| Q3 | Índices do município x eleitos | **Não mexer**: só há IDHM 2010; o grupo decide como fazer | |
| Q4 a Q8 | Escolaridade, eleitos por legenda, idade do município, viés político, recursos públicos x privados | Não iniciadas | `dados/INDICE_PERGUNTAS.md` lista os arquivos de cada uma |
| Q9 | Onde o candidato investe em propaganda | **Pronta** | `views_q9.sql` |
| Q10 | Sobrevivência da carreira | **Pronta** | `vw_q10_base`, `vw_q10_carreira`, `mv_q10_nomes`, `vw_q10_busca` |

- **Q1, definição principal:** custo por cadeira = gasto total do cargo ÷ vagas em disputa (por ano, cargo, UF). Complementar: eleitos × não eleitos (média e mediana, com e sem quem gastou R$ 0; suplentes separados). Defender o critério: "não eleitos" inclui SUPLENTE; candidato sem despesa conta R$ 0.
- **Q9, canais:** as 41 categorias de despesa do TSE foram agrupadas em Impressos e adesivos, Rádio/TV/vídeo/som, Internet, Militância/comícios/eventos, e o que **não** é propaganda (estrutura e outras). A nuvem é calculada **no banco** (quebra descrições em palavras, junta singular e plural, descarta palavras vazias).
- **Q10:** reeleição = eleito para o mesmo cargo 4 anos depois de um mandato (8 anos para senador); troca de partido/cargo via `LAG`. **Sempre consultar `vw_q10_carreira` com `WHERE id_pessoa = ...`**, senão calcula a carreira de todo mundo e demora. Limitações a citar: presidente não aparece (arquivo nacional, fora do escopo); vices antigos vêm sem resultado; sigla que só mudou de nome conta como troca de partido.
- **Próxima mais viável, segundo o Claude:** Q8 (dados já baixados; o campo `DS_FONTE_RECEITA` separa FUNDO ESPECIAL, FUNDO PARTIDARIO e OUTROS), com a ressalva de que repasses do partido muitas vezes vêm do fundo público e é preciso decidir como contar. Arquivos grandes (1,5 GB em 2020). Q5 (votação de 4 GB), Q4 (eleitorado de 2,4 GB/ano), Q6 e Q7 são mais pesadas.

---

## 7. Problemas já resolvidos (não reabrir)

- **Formato TSE:** Latin-1, separador `;`, nulos como `#NULO`, `#NE`, `-1`, `-3`, `-4`. Usar só os arquivos por UF, nunca junto com o `_BRASIL`. (O crawler baixa o `_BRASIL`; a carga filtra as 6 UFs.)
- **SG_UE:** traz a UF em eleições gerais e o código TSE do município (5 dígitos) nas municipais.
- **2004:** o `SQ_CANDIDATO` só é único dentro do município; a chave inclui `SG_UE`.
- **Data de nascimento com ano 0046** derrubou um import; datas fora de 1900 a 2010 viram vazio.
- **`uf_nascimento`:** "Não divulgável" vira vazio (330 registros).
- **`tipo_bem`:** ampliado para `VARCHAR(150)` (o TSE usa até 112).
- **pgAdmin e `ALTER TABLE`:** guardou lista antiga de colunas; solução era importar em tabela temporária. (O `importar_v2.py` usa `COPY` e evita isso.)
- **Verificação independente da Q2/Q9:** bens batem com o bruto até o centavo; 84 combinações do resumo da Q2, 456 linhas de faixas, 493 de quintos, total da Q9 e top 100 da nuvem conferidos. Coisas corrigidas depois: razões calculadas de taxas já arredondadas, texto "mais/menos" invertido, avisos de poucos candidatos (governador e senador nunca têm quintos confiáveis), ano inválido na API agora devolve 400.
- **Limitações conhecidas da nuvem da Q9:** ainda aparecem algumas abreviações dos próprios candidatos e REDES/REDE, SOCIAIS/SOCIAL como palavras separadas (é texto livre).
- **Limitação da busca da Q10:** nome muito comum ("maria") traz só as 100 pessoas com mais candidaturas entre as 500 primeiras achadas.
- **Observações de dados:** 7.402 candidaturas de 2018+ têm resultado vazio (indeferidos, renúncias) e entram na contagem de "candidatos" da Q1; 16 municípios sem prefeito eleito em 2020/2024 (provável eleição anulada).

---

## 8. Pendências

1. **Cargas e telas das demais perguntas** (Q4 a Q8; Q3 só depois da decisão do grupo). Padrão: script gera CSV → importa na ordem das dependências → confere contagens → views → API → tela. Atualizar `importar_v2.py`/DDL conforme necessário.
2. **Atualizar o dossiê Word e o DER** para a v2 (`id_pessoa` sintético, `titulo_declarado`/`cpf_declarado`, `sigla_partido`, `sq_despesa`, `cod_tse CHAR(5)`, novos tamanhos). O DER interativo e o Mermaid antigos não estão mais em disco. O `der_eleicoes_v2.sql` já é o DDL atual.
3. **Colocar no README o link (Drive) das pastas `dados/questoes/questao1` e `questao10`** (~2,5 GB, entrada do `carga_v2.py`, **não vão no Git** e não são geradas pelo crawler).
4. **Proteger a `main`** no GitHub (PR obrigatório) e convidar o colega em Settings > Collaborators.
5. Se o João trocou a senha do postgres, atualizar o `.env` local (nunca no Git).

---

## 9. Como o colega monta o ambiente (resumo; detalhes no README)

1. Clonar o repositório; `pip install -r requirements.txt pandas psycopg2-binary`; copiar `.env.example` para `.env` e colocar a **senha do postgres dele**.
2. Obter os dados: `python -m crawler` (TSE, IBGE, IPEA, Dataverse; ~6 GB de download, ~33 GB em disco) **e** pedir ao João as pastas `questao1` e `questao10`.
3. pgAdmin: criar o banco `eleicoes_v2`.
4. Rodar, nesta ordem: `carga_v2.py` (~20 min), `carga_bens.py`, `importar_v2.py` (~4 min; `RECRIAR = True` só para recomeçar, e voltar para `False`), `importar_bens.py`.
5. No pgAdmin (Query Tool no `eleicoes_v2`): `views_v2.sql` → `views_q2.sql` → `views_q9.sql` (~6 min; trava as consultas da Q9 enquanto roda).
6. Site: em `site_eleicoes`, copiar `.env.example` para `.env`, `npm install`, `npm run build`, `npm start`, abrir http://localhost:3001 (ou `npm run dev` em :5173).

**Atenção:** o banco de cada pessoa é local. Mudou DDL ou view? Avise o outro para reaplicar. O OneDrive tenta sincronizar `node_modules`; se ficar lento, pause a sincronização ou mova a pasta.

---

## 10. Como trabalhar com o João (preferências)

- **Português**, direto, com **passos numerados e curtos** ("no Query Tool, cole isto e aperte F5").
- **pgAdmin:** não colar SQL com comentários `--` (já deu erro); usar `/* */` ou nenhum comentário.
- **Code Runner não passa argumentos:** anos e UFs ficam definidos dentro dos scripts.
- O Claude **não acessa o banco do João** a menos que rode na máquina dele com a senha; o fluxo típico é o Claude escrever o script/SQL, o João rodar e colar a saída ou um print.
- **Antes de importar qualquer carga, conferir a saída** (contagens, colisões, vazios). Erros reais foram pegos assim.
- Explicar o **porquê** dos números: ele vai apresentar e precisa defender os critérios. Gosta de **uma resposta principal** por pergunta, com variações guardadas.
- Em respostas de código, comentar pouco e seguir o estilo do arquivo (português, docstring no topo explicando o que o script faz).

---

## 11. Segurança e Git (regras)

- **Nunca commitar:** `.env`, senhas, dados brutos, CSVs de `saida/`, `node_modules/`. O `.gitignore` cobre isso. Antes de cada commit, olhar `git status` e conferir se não entrou arquivo grande ou segredo.
- A senha do postgres do João já esteve em texto puro nos arquivos locais dele (não foi commitada). Nunca peça nem grave senha em arquivo versionado; use `PGPASSWORD`/`.env`.
- Fluxo em dupla: `git pull`, uma branch por tarefa, Pull Request para a `main`, revisão do outro.
- Não existe mais git em `C:\Users\joaom` (foi removido de propósito). O único repositório é o da pasta `crawler`.
- Os scripts em `dados/questoes/questao1` e `questao10` (`pythonTABELA.py`, `lerCarga.py` etc.) são exploração da **v1** e têm caminhos fixos do PC do João; o pipeline atual é `dados/questoes/carga_v2/`.

---

## 12. Mapa rápido de arquivos

| Arquivo | Para quê |
|---|---|
| `README.md` | Visão geral e passo a passo (comece por ele) |
| `docs/CRAWLER.md` | Crawler: fontes, uso, o que foi descartado e por quê |
| `dados/INDICE_PERGUNTAS.md` | Arquivos de dados que cada uma das 10 perguntas usa |
| `dados/questoes/carga_v2/carga_v2.py` | Limpa os dados do TSE, resolve identidade, gera 1 CSV por tabela |
| `dados/questoes/carga_v2/importar_v2.py` | Cria as tabelas (`der_eleicoes_v2.sql`), importa via `COPY`, confere contagens |
| `dados/questoes/carga_v2/carga_bens.py`, `importar_bens.py` | Bens declarados (Q2) |
| `dados/questoes/carga_v2/conferir_identidade.py` | Gera os CSVs de revisão da identidade |
| `dados/questoes/carga_v2/views_v2.sql`, `views_q2.sql`, `views_q9.sql` | Todas as regras de negócio |
| `dados/questoes/carga_v2/app_v2.py` | App Streamlit (substituído pelo site, mas funciona) |
| `site_eleicoes/server/index.ts` | API: um endpoint por tela, cada um com SELECT em view |
| `site_eleicoes/src/secoes/*.tsx` | Telas: Banco, Qualidade, Q1, Q2, Q9, Q10 |
| `dados/LeiaParaEntenderProjeto/` | Dossiê (Word/PDF), handoff e SQLs da **v1** (histórico) |
| `dados/tse/leiames_unificados/` | Dicionários de dados do TSE (significado de cada coluna) |
