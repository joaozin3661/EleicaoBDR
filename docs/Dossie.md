> Versão em Markdown do dossiê entregue numa etapa anterior do trabalho (outubro de 2026, com seis estados). Fica como registro: os números e o escopo atuais (27 UFs) estão no [README](../README.md) e em [QUESTOES.md](QUESTOES.md).

**UNIVERSIDADE FEDERAL DO PIAUÍ**

**CENTRO DE CIÊNCIAS DA NATUREZA**

**DISCIPLINA: BANCO DE DADOS RELACIONAIS**

**BACHARELADO EM CIÊNCIA DA COMPUTAÇÃO**

**ANTÔNIO INÁCIO DA SILVA NETO**

**JOÃO MARCELO BARROS CARDOSO VENTURA**

**  
**

**TERESINA – PI**

2026

**SUMÁRIO**

**1 INTRODUÇÃO** 3

> 1.1 Do que se trata 3
>
> 1.2 Objetivo 3
>
> 1.3 Fontes de dados 3

**2 PERGUNTAS** 6

**3 DIAGRAMA ENTIDADE-RELACIONAMENTO** 10

> 3.1 Relacionamentos 11
>
> 3.2 Decisões de modelagem 11

**4 MODELO RELACIONAL** 13

**5 DICIONÁRIO DE DADOS** 15

**6 CARGA DOS DADOS** 23

> 6.1 O que foi carregado 23
>
> 6.2 Método de carga 24
>
> 6.3 Tratamentos aplicados 24
>
> 6.4 Problemas encontrados e soluções 26
>
> 6.5 Validações 26
>
> 6.6 Alterações no modelo decorrentes da carga 27
>
> 6.7 Limitações conhecidas 27

**7 MÉTODOS DE RESPOSTA ÀS PERGUNTAS** 29

> 7.1 Pergunta 1: quanto custa uma cadeira 29
>
> 7.2 Pergunta 2: taxa de sucesso por patrimônio declarado 30
>
> 7.3 Pergunta 3: índices do município 30
>
> 7.4 Pergunta 4: escolaridade do candidato e do eleitorado 31
>
> 7.5 Pergunta 5: eleitos por votos de legenda 31
>
> 7.6 Pergunta 6: idade do município, alternância e idade dos eleitos 32
>
> 7.7 Pergunta 7: viés político do município 33
>
> 7.8 Pergunta 8: recursos públicos e privados 33
>
> 7.9 Pergunta 9: onde o candidato investe em propaganda 34
>
> 7.10 Pergunta 10: sobrevivência da carreira de um político 34
>
> 7.11 Interface de consulta 34

# **1 INTRODUÇÃO**

## **1.1 Do que se trata**

Este documento apresenta o projeto da disciplina de Banco de Dados Relacional, cujo objeto é a construção de uma base de dados relacional a partir de informações públicas sobre as eleições brasileiras. O recorte principal abrange os pleitos de 2018, 2020, 2022 e 2024, estendido a todos os pleitos de 2002 a 2016 na pergunta que trata da trajetória de carreira dos políticos. Geograficamente, o projeto se restringe a seis unidades federativas, Alagoas, Pará, Paraíba, Paraná, Santa Catarina e Sergipe, que somam 1.238 municípios e cobrem as regiões Norte, Nordeste e Sul.

A matéria-prima do projeto são os dados abertos da Justiça Eleitoral, que publicam, a cada pleito, o registro de todos os candidatos, os bens que declararam, as receitas e despesas de suas campanhas, a votação apurada por município e o perfil do eleitorado. A esses dados somam-se indicadores socioeconômicos municipais, que permitem observar o resultado eleitoral à luz do contexto em que ele foi produzido. Nenhuma das fontes exige cadastro ou autorização: todas são de acesso público e livre.

O trabalho não se propõe a explicar causalmente o comportamento eleitoral. Sua finalidade é modelar um conjunto de dados heterogêneo de forma normalizada e consistente, de modo que perguntas analíticas possam ser respondidas por consultas SQL sobre uma estrutura bem definida.

## **1.2 Objetivo**

O objetivo geral é projetar e implementar um banco de dados relacional capaz de integrar dados eleitorais e socioeconômicos e de responder, por meio de consultas, a um conjunto de dez perguntas definidas previamente.

Desdobram-se daí quatro objetivos específicos. O primeiro é modelar o domínio eleitoral em um diagrama entidade-relacionamento que represente candidatos, partidos, pleitos, territórios, financiamento e votação sem redundância. O segundo é derivar desse diagrama um modelo relacional normalizado, com chaves primárias e estrangeiras explícitas. O terceiro é documentar cada atributo em um dicionário de dados que registre tipo, restrição e origem, de forma que qualquer integrante do grupo consiga rastrear de onde veio cada informação. O quarto é garantir que as dez perguntas sejam efetivamente respondíveis pela estrutura projetada, o que foi verificado atributo a atributo durante a modelagem.

## **1.3 Fontes de dados**

As fontes foram escolhidas por serem públicas, documentadas e passíveis de carregamento automatizado. O Portal de Dados Abertos do TSE é construído sobre a plataforma CKAN e disponibiliza os arquivos em CSV compactados por ano e por unidade federativa, acessíveis tanto por download direto quanto pela interface programática do próprio CKAN. O IBGE, por sua vez, oferece serviços REST, entre eles o SIDRA, para consulta a tabelas agregadas. Vale registrar que a correspondência entre o código de município do TSE e o do IBGE não precisa ser construída: o próprio TSE publica essa tabela de de-para no portal de dados abertos.

Cabe um registro metodológico sobre o IDHM. Embora seja calculado a partir de dados censitários do IBGE, o índice não é publicado por ele: é divulgado pelo Atlas do Desenvolvimento Humano no Brasil, mantido em conjunto pelo PNUD, pelo Ipea e pela Fundação João Pinheiro. Por isso o Atlas aparece como fonte própria no quadro abaixo. Vale notar também que o IDHM é divulgado por edição censitária, e não anualmente, o que restringe os anos em que ele pode ser cruzado com os pleitos.

| **Fonte**                       | **Conjunto de dados**                            | **Alimenta**          | **Perguntas** |
|---------------------------------|--------------------------------------------------|-----------------------|---------------|
| TSE                             | Candidatos                                       | PESSOA, CANDIDATURA   | 1 a 10        |
| TSE                             | Bens de candidatos                               | BEM_DECLARADO         | 2             |
| TSE                             | Prestação de contas — receitas                   | RECEITA               | 8             |
| TSE                             | Prestação de contas — despesas                   | DESPESA               | 1, 9          |
| TSE                             | Votação nominal por município e zona             | VOTACAO               | 4, 5, 7       |
| TSE                             | Votação por partido (legenda)                    | VOTACAO_LEGENDA       | 5             |
| TSE                             | Detalhe da votação por município e zona          | TOTALIZACAO_MUNICIPIO | 3             |
| TSE                             | Comparecimento e abstenção por perfil do eleitor | ELEITORADO            | 4, 6          |
| TSE                             | De-para de municípios TSE × IBGE                 | MUNICIPIO             | 3 a 7         |
| TSE                             | Vagas por cargo e unidade eleitoral              | VAGA                  | 1, 5          |
| IBGE                            | PIB dos Municípios (2010) — SIDRA 5938           | INDICADOR_MUNICIPAL   | 3             |
| IBGE                            | População: Censo 2010 — SIDRA 202                | INDICADOR_MUNICIPAL   | 3             |
| IBGE                            | Idade mediana e envelhecimento — SIDRA 9515      | INDICADOR_MUNICIPAL   | 6             |
| IBGE                            | Cadastro de municípios                           | MUNICIPIO             | 3 a 7         |
| Atlas Brasil (PNUD, Ipea e FJP) | IDHM municipal (1991, 2000 e 2010)               | INDICADOR_MUNICIPAL   | 3             |

A cobertura temporal dos indicadores merece atenção porque não é uniforme e afeta diretamente o que as perguntas 3 e 6 podem afirmar. O IDHM municipal e o Censo (população) existem em 2010, e por isso a pergunta 3 foi respondida para as eleições municipais de 2008 e 2012, tratando os índices de 2010 como um retrato do município; o PIB municipal de 2010 e a população do Censo 2010 foram baixados do SIDRA (tabelas 5938 e 202) para esse fim. As séries mais recentes do IBGE, como o PIB de 2017 a 2023 e as estimativas de população, ficaram fora do banco, porque o IDHM, que não se atualiza, pararia em 2010. A idade mediana e o índice de envelhecimento existem apenas para 2022, de modo que classificam o município, mas não acompanham sua mudança entre os pleitos. O IDHM cobre 1.235 dos 1.238 municípios: três foram criados depois de 2010 e ficam fora da pergunta 3. Essas são limitações do dado, não do modelo, e são declaradas nas análises.

Os endereços das fontes são: dadosabertos.tse.jus.br, para os dados eleitorais; servicodados.ibge.gov.br e apisidra.ibge.gov.br, para os serviços do IBGE; e atlasbrasil.org.br, para o IDHM.

# **2 PERGUNTAS**

As dez perguntas abaixo foram definidas pelo professor e orientaram toda a modelagem. Para cada uma registra-se o recorte temporal, o que ela deve responder e os dados do modelo que a sustentam. A sigla E.P. usada em aula corresponde ao conjunto de pleitos de 2018, 2020, 2022 e 2024. Em outubro de 2026, nove das dez perguntas estão respondidas e disponíveis no site de apresentação (1, 2, 3, 4, 5, 6, 8, 9 e 10); a pergunta 7 aguarda uma base atualizada de classificação ideológica dos partidos. Algumas perguntas tiveram o recorte ajustado à disponibilidade dos dados, e o ajuste está registrado em cada uma.

### **Pergunta 1 — Quanto custa uma cadeira?**

**Escopo:** 2018, 2020, 2022 e 2024.

**O que deve responder:** Quanto custa, em gasto de campanha, cada cadeira em disputa. Foram adotadas duas leituras complementares. A principal divide o gasto total das campanhas de um cargo, em cada UF e pleito, pelo número de vagas em disputa: é o custo da cadeira para o sistema como um todo, incluindo o que gastaram os derrotados, e permite observar a variação entre pleitos. A segunda compara o gasto por candidato de eleitos e não eleitos, pela média e pela mediana, para medir quanto mais gasta quem vence.

**Dados envolvidos:** DESPESA (despesas contratadas) somada por CANDIDATURA e agrupada por cargo, sg_uf e ano; VAGA fornece o número de cadeiras em disputa; CANDIDATURA.situacao_resultado separa eleitos (todo resultado iniciado por ELEITO) de não eleitos (NÃO ELEITO e SUPLENTE). Os vices ficam de fora, pois disputam a mesma vaga do titular.

### **Pergunta 2 — Taxa de sucesso eleitoral por patrimônio declarado**

**Escopo:** 2018, 2020, 2022 e 2024.

**O que deve responder:** Se candidatos mais ricos se elegem com mais frequência. Somando os bens declarados por candidatura e agrupando os candidatos em faixas de patrimônio, calcula-se a proporção de eleitos em cada faixa.

**Dados envolvidos:** BEM_DECLARADO somado por candidatura, cruzado com CANDIDATURA.situacao_resultado e segmentado por cargo.

### **Pergunta 3 — Índices do município e os eleitos e partidos mais vitoriosos**

**Escopo:** Eleições municipais de 2008 e 2012. O IDHM municipal e o Censo só existem para 2010; foram escolhidas as duas eleições que cercam esse ano, e os índices de 2010 valem como retrato do município nas duas. Não há versão estadual ou nacional, porque deputado, governador e senador não pertencem a um município.

**O que deve responder:** Se o perfil socioeconômico do município se associa ao seu resultado eleitoral. Cruza PIB per capita, IDHM, razão entre eleitores e população total e o volume de "isentos" (brancos, nulos e abstenções) com os partidos e candidatos vencedores naquele território.

**Dados envolvidos:** INDICADOR_MUNICIPAL (IDHM, PIB per capita e população de 2010) e TOTALIZACAO_MUNICIPIO (eleitores aptos, abstenções, brancos e nulos do prefeito, 1º turno, 2008 e 2012) fornecem o contexto e os isentos; CANDIDATURA e PARTIDO fornecem os partidos dos prefeitos e vereadores eleitos.

### **Pergunta 4 — Escolaridade do candidato e escolaridade do eleitorado**

**Escopo:** 2022 e 2024.

**O que deve responder:** Duas coisas. Primeiro, se o grau de instrução do candidato se relaciona à sua chance de ser eleito. Segundo, se municípios de menor escolaridade tendem a eleger candidatos de escolaridade semelhante à do seu eleitorado.

**Dados envolvidos:** CANDIDATURA.grau_instrucao confrontado com a distribuição de ELEITORADO.grau_instrucao do município. Em 2024 (prefeito e vereador) compara-se a escolaridade dos eleitos de cada município com a do seu eleitorado; em 2022 (deputados), que representam o estado, a escolaridade dos eleitos de cada município é a média ponderada pelos votos que o município deu a eles (VOTACAO).

### **Pergunta 5 — Eleitos por votos de legenda, por partido**

**Escopo:** 2018 a 2024, nas eleições proporcionais: deputado federal e estadual (2018 e 2022) e vereador (2020 e 2024).

**O que deve responder:** Quantos eleitos de cada partido devem a cadeira ao desempenho da legenda e não ao próprio desempenho nominal. Aplica-se aos cargos proporcionais, vereador e deputado, em que a distribuição de vagas passa pelo quociente partidário.

**Dados envolvidos:** VOTACAO (votos nominais válidos de cada candidato), VOTACAO_LEGENDA (votos de legenda), VAGA (cadeiras) e CANDIDATURA (partido e resultado). O quociente eleitoral é a soma dos votos válidos dividida pelas vagas da disputa; é eleito por votos de legenda quem teve votos nominais abaixo dele.

### **Pergunta 6 — Idade do município, alternância de poder e idade dos eleitos**

**Escopo:** Pleitos municipais de 2004 a 2024, cada um comparado ao anterior; a idade do município é a do Censo 2022.

**O que deve responder:** Se a estrutura etária do município se reflete em quem ele elege. Classifica-se cada município como mais jovem ou mais envelhecido, verifica-se a idade média dos candidatos eleitos ali e observa-se se há tendência de alternância de poder entre os pleitos.

**Dados envolvidos:** INDICADOR_MUNICIPAL.idade_mediana (Censo 2022) classifica o município em quatro grupos; PESSOA.data_nascimento com ELEICAO.ano dá a idade do eleito; a sequência de partidos vencedores ao longo das eleições, tratando renomeações e fusões como o mesmo partido, revela a alternância.

### **Pergunta 7 — Viés político do município ou região na linha do tempo**

**Escopo:** 2018, 2020, 2022 e 2024.

**O que deve responder:** Como a preferência partidária de cada território evoluiu ao longo dos pleitos, seja pela sigla vencedora, seja pela participação de cada espectro ideológico no total de votos válidos do município.

**Dados envolvidos:** VOTACAO agregada por MUNICIPIO e PARTIDO ao longo de ELEICAO.ano, usando PARTIDO.espectro_politico para agrupar siglas e MUNICIPIO.regiao para a leitura regional. Situação: adiada, à espera de uma base de classificação ideológica dos partidos que a equipe está pesquisando; PARTIDO.espectro_politico ainda não foi preenchido.

### **Pergunta 8 — Recursos públicos e recursos privados**

**Escopo:** 2018, 2020, 2022 e 2024.

**O que deve responder:** Se candidatos financiados majoritariamente por repasses públicos, ou seja, Fundo Especial de Financiamento de Campanha e Fundo Partidário, têm desempenho diferente daqueles sustentados por doações privadas e recursos próprios.

**Dados envolvidos:** RECEITA agrupada por origem_recurso e por candidatura, calculando a participação de cada fonte, cruzada com CANDIDATURA.situacao_resultado.

### **Pergunta 9 — Onde o candidato investe em propaganda**

**Escopo:** 2018, 2020, 2022 e 2024.

**O que deve responder:** Em que o dinheiro de campanha é efetivamente gasto, e com que peso cada tipo de propaganda aparece. A consulta devolve a distribuição dos valores por categoria e o texto das descrições, do qual se gera a nuvem de palavras.

**Dados envolvidos:** DESPESA.tipo_despesa e DESPESA.descricao agregadas por candidatura, cargo e ano. A nuvem de palavras é produzida fora do banco, a partir do texto retornado pela consulta.

### **Pergunta 10 — Sobrevivência da carreira de um político**

**Escopo:** 2002 a 2024, ou seja, todos os doze pleitos gerais e municipais do período.

**O que deve responder:** A trajetória completa de um político: em quais pleitos concorreu, por quais partidos, quais cargos disputou, quando venceu, quando perdeu e quando se reelegeu. É a pergunta que justifica separar a pessoa da candidatura no modelo.

**Dados envolvidos:** PESSOA ligada, pelo identificador id_pessoa, a suas várias CANDIDATURAs, ordenadas por ELEICAO.ano, com o cargo, a sigla do partido na época (CANDIDATURA.sigla_partido) e situacao_resultado em cada uma.

# **3 DIAGRAMA ENTIDADE-RELACIONAMENTO**

O diagrama está em [DER.md](DER.md), que mostra o modelo atual.

## **3.1 Relacionamentos**

| **Relacionamento**                          | **Cardinalidade** | **Leitura**                                                                                             |
|---------------------------------------------|-------------------|---------------------------------------------------------------------------------------------------------|
| PESSOA — CANDIDATURA                        | 1 : N             | Uma pessoa concorre em várias eleições ao longo do tempo; cada candidatura pertence a uma única pessoa. |
| ELEICAO — CANDIDATURA                       | 1 : N             | Um pleito abriga muitas candidaturas.                                                                   |
| PARTIDO — CANDIDATURA                       | 1 : N             | Um partido lança muitos candidatos; a candidatura tem uma legenda por pleito.                           |
| MUNICIPIO — CANDIDATURA                     | 0..1 : N          | Só as candidaturas municipais se vinculam a um município; nas demais a unidade eleitoral é a UF.        |
| CANDIDATURA — BEM_DECLARADO                 | 1 : N             | Uma candidatura declara vários bens.                                                                    |
| CANDIDATURA — RECEITA                       | 1 : N             | Uma campanha registra vários lançamentos de arrecadação.                                                |
| CANDIDATURA — DESPESA                       | 1 : N             | Uma campanha registra vários gastos.                                                                    |
| CANDIDATURA — VOTACAO — MUNICIPIO           | N : N             | A votação é a associação entre candidatura e município, com os votos nominais como atributo.            |
| PARTIDO — VOTACAO_LEGENDA — MUNICIPIO       | N : N             | Votos de legenda por partido, município e pleito.                                                       |
| MUNICIPIO — ELEITORADO — ELEICAO            | N : N             | Perfil do eleitorado por município e pleito, aberto por faixa etária e escolaridade.                    |
| MUNICIPIO — TOTALIZACAO_MUNICIPIO — ELEICAO | N : N             | Totais de urna do município no pleito, incluindo abstenções, brancos e nulos.                           |
| MUNICIPIO — INDICADOR_MUNICIPAL             | 1 : N             | Um município tem um conjunto de indicadores por ano de referência.                                      |
| ELEICAO — VAGA                              | 1 : N             | Um pleito oferece vagas em vários cargos e unidades eleitorais.                                         |
| MUNICIPIO — VAGA                            | 0..1 : N          | Só as vagas de cargos municipais se vinculam a um município.                                            |

## **3.2 Decisões de modelagem**

Algumas escolhas merecem justificativa, por não serem óbvias à primeira leitura do diagrama.

A separação entre PESSOA e CANDIDATURA é a mais importante. Os arquivos do TSE são organizados por pleito, de modo que o mesmo político aparece repetido a cada eleição. Manter uma entidade de identidade estável é o que torna possível reconstruir a trajetória de carreira pedida na pergunta 10 e comparar a idade do candidato entre pleitos distintos. A identidade é uma chave sintética (id_pessoa), e não o título de eleitor nem o CPF, como previam as versões anteriores do modelo. A vistoria dos arquivos mostrou que nenhum dos dois é confiável: 486 pessoas aparecem com mais de um título, 166 títulos são usados por pessoas diferentes, o TSE oculta o CPF em todas as candidaturas de 2024 (o campo vem com o valor -4) e ele falta em parte dos registros de outros anos. A carga resolve a identidade em três passos: agrupa os registros pelo título, separa quem tem nome e nascimento diferentes e une quem tem o mesmo CPF válido ou o mesmo nome, data e UF de nascimento. Título, CPF e nome originais ficam na candidatura (titulo_declarado, cpf_declarado e nome_declarado), sem alteração, de modo que a decisão pode ser revisada. O resultado são 359.408 pessoas para 569.184 candidaturas.

ELEITORADO e TOTALIZACAO_MUNICIPIO foram mantidas separadas porque têm granularidades diferentes. O perfil do eleitorado se abre por faixa etária e escolaridade, enquanto abstenções, brancos e nulos são totais do município em um cargo. Reuni-las em uma única tabela repetiria os totais em cada linha de perfil, violando a terceira forma normal.

VOTACAO_LEGENDA existe como entidade própria porque o voto de legenda pertence ao partido, e não a um candidato. Registrá-lo como atributo da votação nominal atribuiria ao candidato um voto que não é dele e inviabilizaria a pergunta 5.

O município é identificado pelo código do IBGE, e não pelo código do TSE. Os dois sistemas usam codificações distintas para o mesmo município, e como o projeto precisa cruzar dados eleitorais com indicadores do IBGE, adotou-se o código do IBGE como chave primária e guardou-se o código do TSE como atributo. A tabela de correspondência entre as duas codificações é publicada pelo próprio TSE, de modo que a entidade MUNICIPIO é carregada inteira a partir dela.

O atributo espectro_politico, em PARTIDO, não vem de nenhuma fonte oficial do TSE ou IBGE. Vem do Estudo Harvard, uma pesquisa acadêmica de especialistas sobre ideologia partidária (DOI 10.7910/DVN/MFIXKW), necessária para agrupar siglas nas perguntas 6 e 7. Por ser uma fonte externa, e não um dado eleitoral, deve ser declarada como tal na apresentação do trabalho.

O turno não é atributo de ELEICAO. Os arquivos do TSE identificam a eleição em CD_ELEICAO e o turno em NR_TURNO, e o mesmo pleito pode ter dois turnos. Colocar o turno em ELEICAO faria as duas apurações colidirem na mesma linha; colocá-lo na chave de ELEICAO quebraria a ligação com a candidatura, que é única no pleito e não se repete a cada turno. A solução adotada é a que o próprio dado sugere: ELEICAO representa o pleito, e o turno entra na chave das tabelas apuradas turno a turno, que são VOTACAO, VOTACAO_LEGENDA, ELEITORADO e TOTALIZACAO_MUNICIPIO. Como o arquivo de candidatos também é publicado por turno, a carga de CANDIDATURA guarda a situação do último turno em que o candidato aparece.

A entidade VAGA foi acrescentada depois da leitura dos arquivos. Sem o número de cadeiras em disputa, a pergunta 5 só conseguiria inferir quem entrou pela legenda; com ele, o quociente partidário pode ser calculado como manda a regra eleitoral. É um caso em que a leitura da fonte mudou o modelo, e não o contrário.

Por fim, total_votos em CANDIDATURA é uma redundância controlada: o valor pode ser recalculado somando VOTACAO, mas mantê-lo materializado evita agregações repetidas nas consultas que só precisam do desempenho total do candidato. Está preenchido, com a soma dos votos nominais válidos, para as eleições proporcionais de 2018 a 2024 (deputado federal e estadual em 2018 e 2022, vereador em 2020 e 2024).

A sigla do partido também é gravada na candidatura. PARTIDO é identificado pelo número da legenda e guarda a sigla mais recente, mas várias legendas mudaram de nome no período (PFL para DEM, PMDB para MDB, PPB para PP). Sem a sigla da época, a linha do tempo da pergunta 10 mostraria o partido com o nome atual em eleições em que ele ainda tinha outro nome.

O identificador da candidatura segue regras diferentes conforme o período. De 2018 a 2024 é o SQ_CANDIDATO do TSE, que é único entre todos esses anos. De 2002 a 2008 o SQ_CANDIDATO é um número pequeno que se repete entre municípios e entre anos, por isso, para todo o período de 2002 a 2016, a chave é gerada na carga como ano × 10⁹ + sequência, o que não colide com as chaves recentes.

Em DESPESA a chave também é gerada na carga. O identificador do TSE (SQ_DESPESA) corresponde ao documento de despesa, e um mesmo documento traz vários itens, cada um em uma linha do arquivo. O identificador original foi preservado na coluna sq_despesa, para rastreabilidade.

Em RECEITA o identificador do TSE (SQ_RECEITA) também se repete entre linhas, quase sempre com valores diferentes, e por isso a chave é gerada na carga (ano × 10⁹ + sequência) e o código original fica em sq_receita. Os dois campos que descrevem o recurso têm papéis distintos: origem_recurso guarda a fonte (Fundo Especial de Financiamento de Campanha, Fundo Partidário ou Outros Recursos), que é o que separa dinheiro público de privado na pergunta 8, e tipo_doador guarda quem doou (pessoa física, partido, o próprio candidato). A coluna natureza distingue o recurso financeiro da doação estimável, em bens ou serviços.

# **4 MODELO RELACIONAL**

Notação: <u>chave primária</u> aparece sublinhada e *chave estrangeira* em itálico. Atributos que são simultaneamente chave primária e estrangeira aparecem sublinhados e em itálico. As referências de cada chave estrangeira estão indicadas abaixo da relação correspondente.

**PESSOA(**<u>id_pessoa</u>, titulo_eleitor, cpf, nome, data_nascimento, sexo, raca_cor, uf_nascimento**)**

**ELEICAO(**<u>id_eleicao</u>, ano, tipo_eleicao**)**

**PARTIDO(**<u>numero_partido</u>, sigla, nome, espectro_politico**)**

**MUNICIPIO(**<u>cod_ibge</u>, cod_tse, nome, uf, regiao**)**

**CANDIDATURA(**<u>id_candidatura</u>, *id_pessoa*, *id_eleicao*, *numero_partido*, *cod_ibge*, sg_uf, cargo, abrangencia, numero_candidato, nome_urna, nome_declarado, titulo_declarado, cpf_declarado, sigla_partido, grau_instrucao, ocupacao, situacao_candidatura, detalhe_situacao, situacao_resultado, total_votos**)**

> *FK: id_pessoa → PESSOA(id_pessoa); id_eleicao → ELEICAO(id_eleicao); numero_partido → PARTIDO(numero_partido); cod_ibge → MUNICIPIO(cod_ibge)*

**BEM_DECLARADO(**<u>id_bem</u>, *id_candidatura*, tipo_bem, descricao, valor**)**

> *FK: id_candidatura → CANDIDATURA(id_candidatura)*

**RECEITA(**<u>id_receita</u>, sq_receita, *id_candidatura*, origem_recurso, tipo_doador, natureza, nome_doador, valor, data_receita**)**

> *FK: id_candidatura → CANDIDATURA(id_candidatura)*

**DESPESA(**<u>id_despesa</u>, sq_despesa, *id_candidatura*, tipo_despesa, descricao, nome_fornecedor, valor, data_despesa**)**

> *FK: id_candidatura → CANDIDATURA(id_candidatura)*

**VOTACAO(***<u>id_candidatura</u>*, *<u>cod_ibge</u>*, <u>turno</u>, votos_nominais**)**

> *FK: id_candidatura → CANDIDATURA(id_candidatura); cod_ibge → MUNICIPIO(cod_ibge)*

**VOTACAO_LEGENDA(***<u>numero_partido</u>*, *<u>id_eleicao</u>*, *<u>cod_ibge</u>*, <u>turno</u>, <u>cargo</u>, votos_legenda**)**

> *FK: numero_partido → PARTIDO(numero_partido); id_eleicao → ELEICAO(id_eleicao); cod_ibge → MUNICIPIO(cod_ibge)*

**ELEITORADO(***<u>cod_ibge</u>*, *<u>id_eleicao</u>*, <u>turno</u>, <u>faixa_etaria</u>, <u>grau_instrucao</u>, qtd_eleitores**)**

> *FK: cod_ibge → MUNICIPIO(cod_ibge); id_eleicao → ELEICAO(id_eleicao)*

**TOTALIZACAO_MUNICIPIO(***<u>cod_ibge</u>*, *<u>id_eleicao</u>*, <u>turno</u>, <u>cargo</u>, eleitores_aptos, comparecimento, abstencoes, votos_brancos, votos_nulos**)**

> *FK: cod_ibge → MUNICIPIO(cod_ibge); id_eleicao → ELEICAO(id_eleicao)*

**VAGA(**<u>id_vaga</u>, *id_eleicao*, *cod_ibge*, sg_uf, cargo, qt_vaga, dt_posse**)**

> *FK: id_eleicao → ELEICAO(id_eleicao); cod_ibge → MUNICIPIO(cod_ibge)*

**INDICADOR_MUNICIPAL(***<u>cod_ibge</u>*, <u>ano</u>, pib, populacao, pib_per_capita, idade_mediana, indice_envelhecimento, idhm**)**

> *FK: cod_ibge → MUNICIPIO(cod_ibge)*

Quanto às restrições de integridade, valem as seguintes regras. Toda chave estrangeira deve referenciar uma tupla existente na relação de destino, com exceção de cod_ibge em CANDIDATURA, que aceita valor nulo nos cargos de abrangência estadual e federal. Os campos de valor monetário em BEM_DECLARADO, RECEITA e DESPESA não admitem valores negativos. As quantidades de votos e de eleitores são inteiros não negativos. Em TOTALIZACAO_MUNICIPIO deve valer a identidade entre eleitores aptos, comparecimento e abstenções, com tolerância de 10 eleitores, porque o TSE publica quatro linhas de 2012 (como a de Aracaju) com diferença de um ou dois; serve como verificação de consistência na carga dos dados. Em PESSOA, o CPF tem 11 dígitos e o título de eleitor, 12, quando informados.

# **5 DICIONÁRIO DE DADOS**

O dicionário descreve cada atributo do modelo, com tipo, condição de chave, significado e origem. A coluna de origem indica o conjunto de dados e, quando aplicável, o nome do campo no arquivo público correspondente, de modo que qualquer atributo possa ser rastreado até sua fonte. Os nomes de campo foram conferidos nos arquivos "leiame" que acompanham os downloads do TSE.

Três observações da própria documentação do TSE valem para toda a etapa de carga. Os arquivos são codificados em Latin 1, com campos entre aspas e separados por ponto e vírgula, inclusive os numéricos. Campos vazios no banco aparecem como \#NULO, ou -1 nos campos numéricos. E campos que naquele ano não eram registrados pelos sistemas eleitorais aparecem como \#NE, ou -3 nos numéricos, o que é a forma correta de descobrir a disponibilidade real de cada informação por ano: os leiames descrevem um leiaute comum a vários pleitos e, por isso, listar uma coluna não garante que ela esteja preenchida naquele ano.

Há ainda uma diferença de nomenclatura entre versões do mesmo leiaute que a carga precisa absorver. No arquivo de candidatos de 2018, a abrangência da eleição se chama TP_ABRANGENCIA_ELEICAO, enquanto nos demais anos se chama TP_ABRANGENCIA; o endereço eletrônico aparece ora como NM_EMAIL, ora como DS_EMAIL. O caminho seguro é ler o cabeçalho de cada CSV antes de carregá-lo, em vez de assumir um leiaute fixo para todos os anos.

### **5.1 Tabela PESSOA**

Identidade estável do político, independente da eleição em que concorre. A chave é sintética (id_pessoa), gerada na carga pela resolução de identidade; o título de eleitor e o CPF são atributos comuns, e os valores declarados em cada eleição ficam na CANDIDATURA.

| **Campo**       | **Tipo**     | **Chave** | **Descrição**                                                                                                                                                                                                                                   | **Origem**                                       |
|-----------------|--------------|-----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| id_pessoa       | INT          | PK        | Identificador sintético da pessoa, gerado na carga. Registros do TSE com o mesmo CPF válido, ou com o mesmo nome, data e UF de nascimento, recebem o mesmo id_pessoa; títulos iguais com nome e nascimento diferentes recebem ids diferentes.   | Gerado na carga                                  |
| titulo_eleitor  | VARCHAR(12)  |           | Título de eleitor mais recente da pessoa, com 12 dígitos e zeros à esquerda. Pode ficar vazio (cerca de 0,1% das pessoas). O título como declarado em cada eleição fica em CANDIDATURA.titulo_declarado.                                        | TSE — Candidatos (NR_TITULO_ELEITORAL_CANDIDATO) |
| cpf             | VARCHAR(11)  |           | CPF do candidato, quando tem 11 dígitos válidos. Opcional: oculto pelo TSE em 2024 e ausente em parte dos registros de outros anos; para 2024 é recuperado de eleições anteriores da mesma pessoa. Preenchido para 311.130 das 359.408 pessoas. | TSE — Candidatos (NR_CPF_CANDIDATO)              |
| nome            | VARCHAR(150) |           | Nome mais recente da pessoa. O nome declarado em cada eleição fica em CANDIDATURA.nome_declarado, o que permite achar quem mudou de nome.                                                                                                       | TSE — Candidatos (NM_CANDIDATO)                  |
| data_nascimento | DATE         |           | Data de nascimento; base para o cálculo da idade na data do pleito. Datas impossíveis (anos fora de 1900 a 2010, como 0046) ficam vazias.                                                                                                       | TSE — Candidatos (DT_NASCIMENTO)                 |
| sexo            | VARCHAR(20)  |           | Sexo/gênero declarado.                                                                                                                                                                                                                          | TSE — Candidatos (DS_GENERO)                     |
| raca_cor        | VARCHAR(30)  |           | Cor/raça autodeclarada. Nos anos em que a informação não era registrada, o TSE preenche o campo com \#NE.                                                                                                                                       | TSE — Candidatos (DS_COR_RACA)                   |
| uf_nascimento   | CHAR(2)      |           | Sigla da UF de nascimento do candidato; usada, com o nome e a data de nascimento, na resolução de identidade.                                                                                                                                   | TSE — Candidatos (SG_UF_NASCIMENTO)              |

### **5.2 Tabela ELEICAO**

Cada pleito considerado no recorte do projeto. O turno não é atributo desta entidade: ele varia dentro do mesmo pleito e por isso entra na chave das tabelas apuradas por turno.

| **Campo**    | **Tipo**    | **Chave** | **Descrição**                                                                                                                                | **Origem**                  |
|--------------|-------------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|
| id_eleicao   | INT         | PK        | Identificador do pleito. Na carga adotou-se o próprio ano, já que o recorte tem uma única eleição ordinária por ano.                         | Ano do pleito (ANO_ELEICAO) |
| ano          | SMALLINT    |           | Ano do pleito: de 2002 a 2024, anos pares.                                                                                                   | TSE (ANO_ELEICAO)           |
| tipo_eleicao | VARCHAR(40) |           | GERAL (2002, 2006, 2010, 2014, 2018 e 2022) ou MUNICIPAL (2004, 2008, 2012, 2016, 2020 e 2024). Eleições suplementares não foram carregadas. | Derivado do ano             |

### **5.3 Tabela PARTIDO**

Legenda partidária. Inclui um atributo de classificação ideológica vindo do Estudo Harvard, necessário à pergunta 7.

| **Campo**         | **Tipo**     | **Chave** | **Descrição**                                                                                                                                                                         | **Origem**                                                         |
|-------------------|--------------|-----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| numero_partido    | SMALLINT     | PK        | Número oficial da legenda.                                                                                                                                                            | TSE (NR_PARTIDO)                                                   |
| sigla             | VARCHAR(15)  |           | Sigla do partido.                                                                                                                                                                     | TSE (SG_PARTIDO)                                                   |
| nome              | VARCHAR(100) |           | Nome por extenso do partido.                                                                                                                                                          | TSE (NM_PARTIDO)                                                   |
| espectro_politico | VARCHAR(20)  |           | Esquerda, centro ou direita. Classificação externa vinda do Estudo Harvard; não é fornecida pelo TSE. Ainda não foi carregada: a base de ideologia será atualizada para a pergunta 7. | Estudo Harvard (pesquisa de especialistas), DOI 10.7910/DVN/MFIXKW |

### **5.4 Tabela MUNICIPIO**

Município brasileiro. É a entidade que integra os dados do TSE aos do IBGE, e por isso guarda os dois códigos. O próprio TSE publica a tabela de correspondência entre as duas codificações, o que dispensa montar o de-para manualmente.

| **Campo** | **Tipo**     | **Chave** | **Descrição**                                                                                                                                                                                                   | **Origem**                                      |
|-----------|--------------|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------|
| cod_ibge  | INT          | PK        | Código IBGE de 7 dígitos; chave de integração com as bases do IBGE.                                                                                                                                             | TSE — De-para de municípios (CD_MUNICIPIO_IBGE) |
| cod_tse   | CHAR(5)      |           | Código do município na codificação do TSE, guardado com 5 dígitos e zeros à esquerda. Aparece como CD_MUNICIPIO nos arquivos de votação e como SG_UE nos de candidatos, quando a unidade eleitoral é municipal. | TSE — De-para de municípios (CD_MUNICIPIO_TSE)  |
| nome      | VARCHAR(100) |           | Nome do município.                                                                                                                                                                                              | IBGE — Cadastro de municípios (municipio)       |
| uf        | CHAR(2)      |           | Sigla da unidade federativa.                                                                                                                                                                                    | IBGE — Cadastro de municípios (sg_uf)           |
| regiao    | VARCHAR(15)  |           | Grande região (Norte, Nordeste, Centro-Oeste, Sudeste, Sul). O cadastro traz ainda mesorregião, microrregião e as regiões intermediária e imediata, caso o grupo queira um recorte mais fino.                   | IBGE — Cadastro de municípios (regiao)          |

### **5.5 Tabela CANDIDATURA**

Entidade central do modelo: a participação de uma pessoa em um pleito, por um partido, disputando um cargo. Toda informação de campanha e de votação se pendura nela.

| **Campo**            | **Tipo**     | **Chave** | **Descrição**                                                                                                                                                                                                                                   | **Origem**                          |
|----------------------|--------------|-----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------|
| id_candidatura       | BIGINT       | PK        | Identificador da candidatura. De 2018 a 2024 é o SQ_CANDIDATO do TSE; de 2002 a 2016, como o SQ_CANDIDATO se repete entre municípios, é gerado na carga (ano × 10⁹ + sequência).                                                                | TSE (SQ_CANDIDATO) ou gerado        |
| id_pessoa            | INT          | FK        | Pessoa que concorre.                                                                                                                                                                                                                            | Resolvido na carga                  |
| id_eleicao           | INT          | FK        | Pleito da candidatura.                                                                                                                                                                                                                          | Ano do pleito                       |
| numero_partido       | SMALLINT     | FK        | Legenda pela qual concorre.                                                                                                                                                                                                                     | TSE (NR_PARTIDO)                    |
| cod_ibge             | INT          | FK        | Município da disputa, obtido da unidade eleitoral e convertido para o código IBGE. Nulo para cargos estaduais e federais, cuja unidade eleitoral é a UF ou o país.                                                                              | TSE (SG_UE), convertido             |
| sg_uf                | CHAR(2)      |           | UF da unidade eleitoral.                                                                                                                                                                                                                        | TSE (SG_UF)                         |
| cargo                | VARCHAR(60)  |           | Cargo disputado (vereador, prefeito, deputado, senador, governador e seus vices e suplentes). Presidente fica fora do recorte de seis UFs.                                                                                                      | TSE (DS_CARGO)                      |
| abrangencia          | VARCHAR(15)  |           | MUNICIPAL ou ESTADUAL, derivado do tipo de pleito na carga.                                                                                                                                                                                     | Derivado                            |
| numero_candidato     | INT          |           | Número do candidato na urna.                                                                                                                                                                                                                    | TSE (NR_CANDIDATO)                  |
| nome_urna            | VARCHAR(100) |           | Nome que aparece na urna.                                                                                                                                                                                                                       | TSE (NM_URNA_CANDIDATO)             |
| nome_declarado       | VARCHAR(150) |           | Nome civil como declarado na candidatura, sem alteração; a busca da pergunta 10 usa este campo, o que acha quem mudou de nome.                                                                                                                  | TSE (NM_CANDIDATO)                  |
| titulo_declarado     | VARCHAR(13)  |           | Título de eleitor como veio do TSE em cada eleição, sem alteração (pode ter dígitos deslocados ou erro de digitação).                                                                                                                           | TSE (NR_TITULO_ELEITORAL_CANDIDATO) |
| cpf_declarado        | VARCHAR(11)  |           | CPF como veio do TSE; vazio em 2024, quando o TSE o oculta.                                                                                                                                                                                     | TSE (NR_CPF_CANDIDATO)              |
| grau_instrucao       | VARCHAR(80)  |           | Escolaridade declarada pelo candidato.                                                                                                                                                                                                          | TSE (DS_GRAU_INSTRUCAO)             |
| ocupacao             | VARCHAR(120) |           | Ocupação declarada.                                                                                                                                                                                                                             | TSE (DS_OCUPACAO)                   |
| situacao_candidatura | VARCHAR(20)  |           | Situação do registro (apto, indeferido e outras). O TSE não publica este campo para 2024.                                                                                                                                                       | TSE (DS_SITUACAO_CANDIDATURA)       |
| detalhe_situacao     | VARCHAR(80)  |           | Detalhe da situação do registro (deferido, indeferido com recurso, renúncia e outras).                                                                                                                                                          | TSE (DS_DETALHE_SITUACAO_CAND)      |
| situacao_resultado   | VARCHAR(100) |           | Resultado final do último turno disputado: eleito (por QP ou por média), não eleito, suplente, entre outros. O valor "MÉDIA" usado de 2004 a 2010 foi padronizado para "ELEITO POR MÉDIA", de modo que todo eleito começa com ELEITO.           | TSE (DS_SIT_TOT_TURNO)              |
| total_votos          | INT          |           | Total de votos nominais válidos recebidos na unidade eleitoral; redundância controlada para acelerar consultas. Preenchido para as eleições proporcionais de 2018 a 2024 (deputado federal, deputado estadual e vereador), a partir de VOTACAO. | Derivado de VOTACAO                 |
| sigla_partido        | VARCHAR(20)  |           | Sigla do partido na data do pleito (por exemplo, PFL ou PMDB), já que PARTIDO guarda a sigla mais recente de cada número.                                                                                                                       | TSE (SG_PARTIDO)                    |

### **5.6 Tabela BEM_DECLARADO**

Cada bem declarado pelo candidato no registro da candidatura. A soma dos bens de uma candidatura é o patrimônio usado na pergunta 2.

| **Campo**      | **Tipo**      | **Chave** | **Descrição**                                                          | **Origem**                  |
|----------------|---------------|-----------|------------------------------------------------------------------------|-----------------------------|
| id_bem         | BIGINT        | PK        | Identificador gerado na carga (ano × 10⁹ + sequência).                 | Gerado                      |
| id_candidatura | BIGINT        | FK        | Candidatura à qual o bem pertence.                                     | TSE (SQ_CANDIDATO)          |
| tipo_bem       | VARCHAR(150)  |           | Natureza do bem (imóvel, veículo, aplicação financeira, entre outros). | TSE (DS_TIPO_BEM_CANDIDATO) |
| descricao      | TEXT          |           | Descrição textual do bem.                                              | TSE (DS_BEM_CANDIDATO)      |
| valor          | DECIMAL(15,2) |           | Valor declarado do bem, em reais.                                      | TSE (VR_BEM_CANDIDATO)      |

### **5.7 Tabela RECEITA**

Lançamentos de arrecadação da campanha. A origem do recurso é o que separa financiamento público de financiamento privado na pergunta 8.

| **Campo**      | **Tipo**      | **Chave** | **Descrição**                                                                                                                                                           | **Origem**                |
|----------------|---------------|-----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------|
| id_receita     | BIGINT        | PK        | Identificador gerado na carga (ano × 10⁹ + sequência), porque o do TSE se repete.                                                                                       | Gerado                    |
| sq_receita     | BIGINT        |           | Identificador do lançamento no TSE; várias linhas dividem o mesmo código, quase sempre com valores diferentes. Linhas com -1 (candidato sem receita) foram descartadas. | TSE (SQ_RECEITA)          |
| id_candidatura | BIGINT        | FK        | Campanha que recebeu o recurso.                                                                                                                                         | TSE (SQ_CANDIDATO)        |
| origem_recurso | VARCHAR(100)  |           | Fonte do recurso: Fundo Especial de Financiamento de Campanha (FEFC), Fundo Partidário ou Outros Recursos. É o que separa dinheiro público de privado.                  | TSE (DS_FONTE_RECEITA)    |
| tipo_doador    | VARCHAR(100)  |           | Quem doou: pessoa física, partido, o próprio candidato, financiamento coletivo e outros.                                                                                | TSE (DS_ORIGEM_RECEITA)   |
| natureza       | VARCHAR(20)   |           | FINANCEIRO ou ESTIMÁVEL (doação em bens ou serviços).                                                                                                                   | TSE (DS_NATUREZA_RECEITA) |
| nome_doador    | VARCHAR(250)  |           | Nome do doador ou originário do recurso.                                                                                                                                | TSE (NM_DOADOR)           |
| valor          | DECIMAL(15,2) |           | Valor do lançamento, em reais.                                                                                                                                          | TSE (VR_RECEITA)          |
| data_receita   | DATE          |           | Data do lançamento.                                                                                                                                                     | TSE (DT_RECEITA)          |

### **5.8 Tabela DESPESA**

Gastos contratados pela campanha. O tipo e a descrição da despesa alimentam a nuvem de palavras da pergunta 9.

| **Campo**       | **Tipo**      | **Chave** | **Descrição**                                                                                                                        | **Origem**                  |
|-----------------|---------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|
| id_despesa      | BIGINT        | PK        | Identificador gerado na carga (ano × 10⁹ + sequência), porque o identificador do TSE se repete entre os itens de um mesmo documento. | Gerado                      |
| sq_despesa      | BIGINT        |           | Identificador do documento de despesa no TSE; pode se repetir. Linhas com valor -1 (sem despesa real) foram descartadas.             | TSE (SQ_DESPESA)            |
| id_candidatura  | BIGINT        | FK        | Campanha que realizou o gasto.                                                                                                       | TSE (SQ_CANDIDATO)          |
| tipo_despesa    | VARCHAR(150)  |           | Categoria do gasto (material impresso, internet, comícios, entre outras).                                                            | TSE (DS_ORIGEM_DESPESA)     |
| descricao       | TEXT          |           | Descrição livre do gasto; texto-base da nuvem de palavras.                                                                           | TSE (DS_DESPESA)            |
| nome_fornecedor | VARCHAR(250)  |           | Fornecedor contratado.                                                                                                               | TSE (NM_FORNECEDOR)         |
| valor           | DECIMAL(15,2) |           | Valor do gasto, em reais. São despesas contratadas, não apenas as pagas.                                                             | TSE (VR_DESPESA_CONTRATADA) |
| data_despesa    | DATE          |           | Data da contratação.                                                                                                                 | TSE (DT_DESPESA)            |

### **5.9 Tabela VOTACAO**

Votos nominais de uma candidatura em um município. É o elo entre o candidato e o território, base das perguntas sobre viés político e perfil do eleitorado. Carregada para as eleições proporcionais: deputado federal e estadual (2018 e 2022) e vereador (2020 e 2024), com 2,29 milhões de linhas.

| **Campo**      | **Tipo** | **Chave** | **Descrição**                                                                                          | **Origem**                                      |
|----------------|----------|-----------|--------------------------------------------------------------------------------------------------------|-------------------------------------------------|
| id_candidatura | BIGINT   | PK, FK    | Candidatura votada.                                                                                    | TSE (SQ_CANDIDATO)                              |
| cod_ibge       | INT      | PK, FK    | Município onde os votos foram apurados.                                                                | TSE (CD_MUNICIPIO), convertido para código IBGE |
| turno          | SMALLINT | PK        | Turno da apuração. A mesma candidatura pode ser votada em dois turnos.                                 | TSE (NR_TURNO)                                  |
| votos_nominais | INT      |           | Votos nominais válidos recebidos no município, somadas as zonas eleitorais; votos anulados não entram. | TSE (QT_VOTOS_NOMINAIS_VALIDOS)                 |

### **5.10 Tabela VOTACAO_LEGENDA**

Votos dados à legenda, que pertencem ao partido e não a um candidato. Entidade separada justamente porque a granularidade é outra. Carregada para as mesmas eleições proporcionais da VOTACAO.

| **Campo**      | **Tipo**    | **Chave** | **Descrição**                                                                                                                                                                                                              | **Origem**                       |
|----------------|-------------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------|
| numero_partido | SMALLINT    | PK, FK    | Partido votado.                                                                                                                                                                                                            | TSE (NR_PARTIDO)                 |
| id_eleicao     | INT         | PK, FK    | Pleito.                                                                                                                                                                                                                    | TSE (CD_ELEICAO)                 |
| cod_ibge       | INT         | PK, FK    | Município de apuração.                                                                                                                                                                                                     | TSE (CD_MUNICIPIO), convertido   |
| turno          | SMALLINT    | PK        | Turno da apuração.                                                                                                                                                                                                         | TSE (NR_TURNO)                   |
| cargo          | VARCHAR(60) | PK        | Cargo proporcional em disputa (vereador ou deputado).                                                                                                                                                                      | TSE (DS_CARGO)                   |
| votos_legenda  | INT         |           | Votos de legenda válidos no município, somando os nominais convertidos em legenda (como o TSE publica em QT_TOTAL_VOTOS_LEG_VALIDOS). Com os votos nominais válidos, forma os votos válidos que dão o quociente eleitoral. | TSE (QT_TOTAL_VOTOS_LEG_VALIDOS) |

### **5.11 Tabela ELEITORADO**

Perfil do eleitorado de um município em um pleito, aberto por faixa etária e escolaridade. Responde ao lado "do eleitor" das perguntas 4 e 6. O arquivo de origem é uma tabela cruzada por município, zona e várias dimensões de perfil, de modo que a carga precisa somar as zonas e as dimensões que o modelo não usa.

| **Campo**      | **Tipo**    | **Chave** | **Descrição**                                                      | **Origem**                                                  |
|----------------|-------------|-----------|--------------------------------------------------------------------|-------------------------------------------------------------|
| cod_ibge       | INT         | PK, FK    | Município.                                                         | TSE — Comparecimento e abstenção (CD_MUNICIPIO), convertido |
| id_eleicao     | INT         | PK, FK    | Pleito de referência.                                              | TSE (ANO_ELEICAO)                                           |
| turno          | SMALLINT    | PK        | Turno, já que o eleitorado apto é apurado turno a turno.           | TSE (NR_TURNO)                                              |
| faixa_etaria   | VARCHAR(30) | PK        | Faixa etária do eleitor (16-17, 18-20, 21-24, e assim por diante). | TSE (DS_FAIXA_ETARIA)                                       |
| grau_instrucao | VARCHAR(40) | PK        | Escolaridade do eleitor.                                           | TSE (DS_GRAU_INSTRUCAO)                                     |
| qtd_eleitores  | INT         |           | Eleitores aptos no cruzamento faixa etária × escolaridade.         | TSE (QT_APTOS)                                              |

### **5.12 Tabela TOTALIZACAO_MUNICIPIO**

Totais de urna por município e cargo. Guarda os "isentos" da pergunta 3 — brancos, nulos e abstenções — que são grandezas do município, não do candidato. O arquivo de origem é por município e zona eleitoral, então a carga soma as zonas de cada município. Está carregada para as eleições municipais de 2008 e 2012 (prefeito e vereador), recorte da pergunta 3.

| **Campo**       | **Tipo**    | **Chave** | **Descrição**                                                                           | **Origem**                                          |
|-----------------|-------------|-----------|-----------------------------------------------------------------------------------------|-----------------------------------------------------|
| cod_ibge        | INT         | PK, FK    | Município.                                                                              | TSE — Detalhe da votação (CD_MUNICIPIO), convertido |
| id_eleicao      | INT         | PK, FK    | Pleito.                                                                                 | TSE (CD_ELEICAO)                                    |
| turno           | SMALLINT    | PK        | Turno a que se referem os totais.                                                       | TSE (NR_TURNO)                                      |
| cargo           | VARCHAR(30) | PK        | Cargo a que se referem os totais.                                                       | TSE (DS_CARGO)                                      |
| eleitores_aptos | INT         |           | Eleitores aptos a votar.                                                                | TSE (QT_APTOS)                                      |
| comparecimento  | INT         |           | Eleitores que compareceram.                                                             | TSE (QT_COMPARECIMENTO)                             |
| abstencoes      | INT         |           | Eleitores que não compareceram.                                                         | TSE (QT_ABSTENCOES)                                 |
| votos_brancos   | INT         |           | Votos em branco.                                                                        | TSE (QT_VOTOS_BRANCOS)                              |
| votos_nulos     | INT         |           | Votos nulos, incluindo os nulos técnicos, que vêm separados em QT_VOTOS_NULOS_TECNICOS. | TSE (QT_TOTAL_VOTOS_NULOS)                          |

### **5.13 Tabela VAGA**

Quantas cadeiras estão em disputa em cada cargo e unidade eleitoral, com a data de posse. Sem ela não é possível calcular o quociente partidário, que é o mecanismo por trás da pergunta 5.

| **Campo**  | **Tipo**    | **Chave** | **Descrição**                                                                                       | **Origem**              |
|------------|-------------|-----------|-----------------------------------------------------------------------------------------------------|-------------------------|
| id_vaga    | INT         | PK        | Identificador gerado na carga (ano × 100.000 + sequência), já que o arquivo não traz chave própria. | Gerado                  |
| id_eleicao | INT         | FK        | Pleito em que as vagas são disputadas.                                                              | TSE (CD_ELEICAO)        |
| cod_ibge   | INT         | FK        | Município, quando o cargo é municipal. Nulo nos cargos estaduais e federais.                        | TSE (SG_UE), convertido |
| sg_uf      | CHAR(2)     |           | UF da unidade eleitoral.                                                                            | TSE (SG_UF)             |
| cargo      | VARCHAR(30) |           | Cargo em disputa.                                                                                   | TSE (DS_CARGO)          |
| qt_vaga    | INT         |           | Número de cadeiras em disputa.                                                                      | TSE (QT_VAGA)           |
| dt_posse   | DATE        |           | Data prevista de posse dos eleitos.                                                                 | TSE (DT_POSSE)          |

### **5.14 Tabela INDICADOR_MUNICIPAL**

Indicadores socioeconômicos e demográficos do município por ano. É a única entidade alimentada fora do TSE, e é o que permite cruzar política com contexto. Cada indicador tem sua própria cobertura temporal, o que limita o recorte das perguntas 3 e 6.

| **Campo**             | **Tipo**      | **Chave** | **Descrição**                                                                                                                                                                                                                              | **Origem**                        |
|-----------------------|---------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------|
| cod_ibge              | INT           | PK, FK    | Município.                                                                                                                                                                                                                                 | IBGE — Município (Código)         |
| ano                   | SMALLINT      | PK        | Ano de referência do indicador.                                                                                                                                                                                                            | IBGE — Ano (Código)               |
| pib                   | DECIMAL(18,2) |           | Produto Interno Bruto a preços correntes, em mil reais. Carregado só para 2010 (pergunta 3); a série de 2017 a 2023 do IBGE não foi carregada.                                                                                             | IBGE — SIDRA, tabela 5938 (Valor) |
| populacao             | INT           |           | População residente do Censo 2010, usada no PIB per capita e na razão entre eleitores e população (pergunta 3).                                                                                                                            | IBGE — SIDRA, tabela 202 (Valor)  |
| pib_per_capita        | DECIMAL(15,2) |           | PIB per capita, em reais. Calculado na carga, porque a tabela 5938 publica apenas o PIB total.                                                                                                                                             | Calculado (pib ÷ populacao)       |
| idade_mediana         | DECIMAL(4,1)  |           | Idade mediana da população, em anos. O IBGE publica a mediana, não a média. Existe apenas para 2022.                                                                                                                                       | IBGE — SIDRA, tabela 9515 (Valor) |
| indice_envelhecimento | DECIMAL(6,2)  |           | Razão entre idosos e jovens no município, também só para 2022.                                                                                                                                                                             | IBGE — SIDRA, tabela 9515 (Valor) |
| idhm                  | DECIMAL(4,3)  |           | Índice de Desenvolvimento Humano Municipal, disponível apenas para 1991, 2000 e 2010, para 1.235 dos 1.238 municípios (os três criados depois de 2010 não têm IDHM). O arquivo traz também os subíndices de educação, longevidade e renda. | Atlas Brasil (idhm)               |

# **6 CARGA DOS DADOS**

Este capítulo registra como os dados foram efetivamente carregados no PostgreSQL: o que entrou no banco, como cada fonte foi tratada, quais problemas apareceram no caminho e como foram resolvidos. Todas as 14 tabelas do modelo estão carregadas, e nove das dez perguntas já são respondidas por consultas e views sobre elas.

## **6.1 O que foi carregado**

O banco eleicoes_v2, em PostgreSQL 18, foi criado a partir do DDL do modelo relacional com as 14 tabelas (o banco anterior, eleicoes, foi mantido como cópia de segurança). A tabela abaixo mostra o conteúdo de cada uma, com as contagens conferidas no banco após a importação.

| **Tabela**            | **Conteúdo**                                                                | **Linhas** | **Período** |
|-----------------------|-----------------------------------------------------------------------------|------------|-------------|
| MUNICIPIO             | Municípios das 6 UFs, com código IBGE e código TSE                          | 1.238      | —           |
| ELEICAO               | Pleitos gerais e municipais                                                 | 12         | 2002 a 2024 |
| PARTIDO               | Legendas que aparecem nas candidaturas                                      | 39         | 2002 a 2024 |
| PESSOA                | Pessoas, com identidade resolvida e chave sintética                         | 359.408    | 2002 a 2024 |
| CANDIDATURA           | Uma linha por candidato por pleito, com cargo, partido da época e resultado | 569.184    | 2002 a 2024 |
| VAGA                  | Cadeiras em disputa por cargo, pleito e unidade eleitoral                   | 7.512      | 2018 a 2024 |
| DESPESA               | Despesas de campanha contratadas, item a item                               | 2.099.197  | 2018 a 2024 |
| BEM_DECLARADO         | Bens declarados pelos candidatos                                            | 442.621    | 2018 a 2024 |
| RECEITA               | Receitas de campanha, com fonte e natureza                                  | 969.901    | 2018 a 2024 |
| VOTACAO               | Votos nominais válidos por candidato e município (eleições proporcionais)   | 2.286.514  | 2018 a 2024 |
| VOTACAO_LEGENDA       | Votos de legenda por partido, município e cargo                             | 165.739    | 2018 a 2024 |
| ELEITORADO            | Eleitores aptos por município, faixa etária e escolaridade                  | 680.519    | 2018 a 2024 |
| TOTALIZACAO_MUNICIPIO | Aptos, abstenções, brancos e nulos por município e cargo                    | 4.963      | 2008 e 2012 |
| INDICADOR_MUNICIPAL   | IDHM (1991, 2000 e 2010), PIB e população de 2010, idade mediana de 2022    | 4.943      | 1991 a 2022 |

Das 569.184 candidaturas, 212.993 são de 2018 a 2024 e servem à maioria das perguntas; as outras 356.191, de 2002 a 2016, foram carregadas para a pergunta 10 e para a pergunta 6, que compara os pleitos municipais desde 2004. Os votos nominais ligam-se a 185.554 candidaturas (as eleições proporcionais de 2018 a 2024), e os totais de urna de 2008 e 2012 servem à pergunta 3.

## **6.2 Método de carga**

A carga é feita em duas etapas. Primeiro, scripts em Python, com a biblioteca pandas, leem os arquivos originais do TSE e do IBGE, filtram as seis UFs, limpam e padronizam os campos e gravam um arquivo CSV por tabela; os arquivos maiores, como os votos por candidato (2 a 3 GB por ano), são lidos em blocos. Depois, scripts de importação carregam cada CSV no PostgreSQL pelo comando COPY, na ordem das dependências entre as tabelas, e ao final conferem a contagem do banco contra a do CSV. Separar a transformação da importação permite inspecionar os dados antes de eles entrarem no banco, e cada script pode ser executado de novo sem duplicar linhas.

Cada conjunto de dados tem seu par de scripts (carga e importação): pessoas, candidaturas, vagas e despesas; bens declarados; receitas; perfil do eleitorado; idade mediana do município; indicadores de 2010 e totalização de 2008 e 2012 (pergunta 3); e votos por candidato e por legenda (pergunta 5). Os pleitos de 2002 a 2024 passam pelo mesmo programa principal, que resolve a identidade das pessoas de todos eles de uma só vez. As respostas às perguntas não são tabelas gravadas à mão: são views (e views materializadas, para as consultas que agregam milhões de linhas), criadas por arquivos SQL, e o site de apresentação só lê essas views.

Antes de cada importação, os scripts imprimem um relatório de conferência: linhas lidas e descartadas, unicidade das chaves dentro do lote e contra os lotes anteriores, candidaturas sem pessoa, partido, eleição ou município correspondente, campos vazios e a distribuição de cargos e resultados por ano. Só depois de conferido esse relatório os arquivos foram importados. Cada importação termina com uma conferência automática das contagens, e os resultados de cada pergunta foram recalculados de forma independente em Python, sem passar pelas views.

## **6.3 Tratamentos aplicados**

**Leitura dos arquivos.** Os arquivos do TSE vêm em Latin 1, separados por ponto e vírgula, e marcam ausência de informação com \#NULO, \#NE, -1, -3 ou -4. Todos esses marcadores viram valor vazio, o texto é gravado em UTF-8 e as datas no formato dd/mm/aaaa são convertidas para o formato do banco. Foram usados apenas os arquivos por UF, nunca junto com o arquivo nacional, que repetiria os mesmos candidatos.

**Municípios.** O campo SG_UE muda de significado conforme o pleito: nas eleições gerais traz a sigla da UF e nas municipais traz o código TSE do município. Nas municipais, esse código é convertido para o código IBGE pela tabela de correspondência publicada pelo TSE; nas gerais, cod_ibge fica nulo.

**Pessoas.** O título de eleitor é limpo para conter apenas dígitos e completado com zeros à esquerda até 12 posições, e o CPF só é aceito com 11 dígitos válidos. A identidade é então resolvida: os registros são agrupados pelo título; dentro de cada grupo, quem tem nome e nascimento diferentes vira pessoa distinta; e registros com o mesmo CPF válido, ou com o mesmo nome, data de nascimento e UF de nascimento, são unidos na mesma pessoa. Para 2024, quando o CPF vem oculto, ele é recuperado de eleições anteriores da mesma pessoa. Quando um candidato aparece duas vezes no mesmo pleito (registro indeferido mais o válido), as duas candidaturas são mantidas e marcadas, e o título, o CPF e o nome de cada uma ficam como vieram, na candidatura.

**Eleições suplementares e segundo turno.** Os arquivos municipais misturam a eleição ordinária com eleições suplementares realizadas meses ou anos depois, que repetiriam candidatos e vagas. Elas foram descartadas: de 2018 a 2024 pela descrição da eleição, e de 2002 a 2016 pela data, mantendo apenas o que ocorreu até 28 dias depois da primeira votação do ano, janela que preserva o segundo turno. Quando o candidato disputou dois turnos, fica a linha do último, que traz o resultado final.

**Despesas.** Linhas com identificador -1, que não representam despesa real, foram descartadas. Os valores são das despesas contratadas.

**Partido e resultado.** A sigla do partido de cada candidatura é guardada como estava no pleito. O resultado "MÉDIA", usado de 2004 a 2010, foi padronizado para "ELEITO POR MÉDIA".

**Receitas.** Linhas com SQ_RECEITA igual a -1 (candidato sem receita, valor zero) são descartadas: 377 em 2018, 16.139 em 2020, 517 em 2022 e 8.991 em 2024; esses candidatos reaparecem nas análises como "sem receita declarada". O SQ_RECEITA não é único, e as linhas que o dividem têm valores diferentes, então todas são mantidas, com chave gerada na carga e o código original em sq_receita; elas somam 0,5% do valor.

**Bens.** Cada bem é ligado à candidatura pelo SQ_CANDIDATO. Os bens de eleições suplementares, que não se ligam a nenhuma candidatura do banco, saem junto: 681 em 2020 e 188 em 2024. Os valores ficam como o TSE os publica, inclusive os absurdos (como uma casa declarada em R\$ 1 bilhão); as análises usam a mediana.

**Votos.** Os votos por candidato e por partido são lidos em blocos dos arquivos de votação por município e zona; as zonas são somadas, só entram as eleições proporcionais do 1º turno, e os votos válidos são conferidos contra o total oficial do detalhe da votação do TSE (nominais mais legenda), município a município. Em 2018, 2020 e 2022 a igualdade é exata; em 2024 seis municípios não passam na conferência (o TSE não publicou, ou publicou de forma incompleta, os votos de vereador) e ficam fora da pergunta 5.

**Totalização e indicadores.** Para a pergunta 3, a totalização por município de 2008 e 2012 vem do detalhe da votação (aptos, comparecimento, abstenções, brancos e nulos, somadas as zonas), e os indicadores de 2010 vêm do Atlas Brasil (IDHM) e do IBGE (PIB e população do Censo).

## **6.4 Problemas encontrados e soluções**

Vários problemas só apareceram ao confrontar os dados com o modelo. A tabela resume os principais.

| **Problema**                                                             | **Causa**                                                                                                                                                                                                              | **Solução**                                                                                                                                                                 |
|--------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Título e CPF inutilizáveis como chave de PESSOA                          | 486 pessoas com mais de um título e 166 títulos usados por pessoas diferentes; o TSE oculta o CPF em 2024 (valor -4) e ele falta em parte dos outros anos.                                                             | Chave sintética id_pessoa, com a identidade resolvida na carga; título, CPF e nome originais guardados na candidatura.                                                      |
| Candidatos de municípios diferentes fundidos em 2004                     | De 2002 a 2008 o SQ_CANDIDATO só é único dentro do município; a primeira versão da carga deixou 2004 com 3.090 vereadores em vez de cerca de 71 mil.                                                                   | Chave de deduplicação passou a incluir o município, e o id da candidatura passou a ser gerado na carga. Teste de colisão (mesmo número com nomes diferentes) retornou zero. |
| Mesma pessoa com duas candidaturas no mesmo pleito                       | Registro indeferido mais registro válido: 1.208 pares.                                                                                                                                                                 | As duas candidaturas são mantidas e marcadas, ligadas à mesma pessoa.                                                                                                       |
| Eleições suplementares duplicando candidatos e vagas                     | Arquivos municipais incluem eleições fora do ciclo ordinário (514 candidaturas de 2002 a 2016 e 276 de 2018 a 2024).                                                                                                   | Filtro pela descrição (anos recentes) e pela data (anos antigos), preservando o segundo turno.                                                                              |
| Chave de DESPESA repetida                                                | SQ_DESPESA identifica o documento, que tem vários itens; havia também linhas com -1.                                                                                                                                   | Chave gerada na carga, original preservado em sq_despesa e linhas -1 descartadas.                                                                                           |
| Importação recusada por data inválida                                    | Data de nascimento com ano 0046, erro de digitação na origem.                                                                                                                                                          | Datas fora de 1900 a 2010 passam a ficar vazias.                                                                                                                            |
| Textos maiores que o campo                                               | Resultados como "RENÚNCIA/FALECIMENTO/CASSAÇÃO ANTES DA ELEIÇÃO" e nomes longos passam do tamanho previsto.                                                                                                            | Colunas de texto ampliadas (ver 6.6).                                                                                                                                       |
| Coluna nova ignorada na importação                                       | Após o ALTER TABLE que criou sigla_partido, o pgAdmin manteve a lista antiga de colunas.                                                                                                                               | Importação em tabela temporária com a mesma estrutura, seguida de INSERT na tabela definitiva.                                                                              |
| Votos de candidatos indeferidos contados como nulos                      | O TSE conta como nulos os votos de candidatos com registro indeferido, o que produz municípios com 10% a 85% de nulos (89% dos municípios de nulos atípicos em 2008 tinham prefeito indeferido, contra 6% dos demais). | Municípios com nulos acima de Q3 + 3 × (Q3 − Q1) da eleição são marcados como votação anulada e saem das medidas de isentos da pergunta 3 (84 em 2008 e 67 em 2012).        |
| Soma de aptos, comparecimento e abstenções diferente em 4 linhas de 2012 | O TSE publica linhas, como a de Aracaju, com diferença de 1 ou 2 eleitores.                                                                                                                                            | Restrição do modelo relaxada para tolerar até 10 eleitores; os números ficam como no TSE.                                                                                   |
| SQ_RECEITA repetido                                                      | Várias linhas dividem o mesmo código, com valores diferentes em 84% dos casos.                                                                                                                                         | Chave gerada na carga e código original em sq_receita; nenhuma linha descartada.                                                                                            |
| Votos de vereador de 2024 ausentes ou incompletos                        | Em Ananindeua, Breu Branco, Placas, Rurópolis, Nossa Senhora das Dores e Melgaço o TSE não publicou, ou publicou de forma incompleta, os votos.                                                                        | A conferência contra o total oficial detecta a diferença, e os seis municípios saem da pergunta 5.                                                                          |

## **6.5 Validações**

Depois de cada importação, as contagens do banco foram comparadas com as dos arquivos gerados, e todas bateram. Também foi conferido que nenhuma candidatura ficou sem sigla de partido, que nenhum SQ_CANDIDATO se repete entre 2018, 2020, 2022 e 2024, que cada município tem vagas para cada cargo municipal em cada pleito e que a quantidade de eleitos por cargo é compatível com o número de vagas: em 2018, por exemplo, os seis estados elegem 92 deputados federais, exatamente o número de eleitos encontrado no banco. Para as perguntas 2 a 9, os resultados foram recalculados de forma independente em Python, a partir dos arquivos brutos ou dos CSVs de carga e sem usar as views, e comparados com o que o banco devolve, sem diferenças. Na pergunta 5, em todas as 2.494 disputas o número de eleitos é igual ao de vagas, e os votos válidos conferem com o total oficial do TSE; os testes das views das perguntas 4 e 5 estão no arquivo testes_q4_q5.sql.

## **6.6 Alterações no modelo decorrentes da carga**

| **Elemento**                                                                              | **Antes**                                                                                                                      | **Depois**                                                                                                                         |
|-------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| Chave de PESSOA                                                                           | cpf VARCHAR(11) (modelo inicial); titulo_eleitor VARCHAR(13) (primeira versão do banco)                                        | id_pessoa INT, sintética; titulo_eleitor VARCHAR(12) e cpf opcionais                                                               |
| FK de CANDIDATURA para PESSOA                                                             | titulo_eleitor                                                                                                                 | id_pessoa                                                                                                                          |
| CANDIDATURA.sigla_partido                                                                 | não existia                                                                                                                    | VARCHAR(20), sigla do partido na época                                                                                             |
| CANDIDATURA.id_candidatura                                                                | SQ_CANDIDATO                                                                                                                   | SQ_CANDIDATO de 2018 a 2024; gerado de 2002 a 2016                                                                                 |
| DESPESA.sq_despesa                                                                        | não existia                                                                                                                    | BIGINT, documento original do TSE                                                                                                  |
| MUNICIPIO.cod_tse                                                                         | INT                                                                                                                            | CHAR(5), com zeros à esquerda                                                                                                      |
| Tamanhos de texto                                                                         | nome 100, cargo 30, situacao_resultado 40, grau_instrucao 40, ocupacao 60, descricao 255, nome_fornecedor 120, tipo_despesa 80 | nome 150, cargo 60, situacao_resultado 100, grau_instrucao 80, ocupacao 120, descricao TEXT, nome_fornecedor 250, tipo_despesa 150 |
| CANDIDATURA: titulo_declarado, cpf_declarado, nome_declarado, nome_urna, numero_candidato | não existiam                                                                                                                   | valores do TSE como vieram, sem alteração                                                                                          |
| CANDIDATURA: situacao_candidatura, detalhe_situacao                                       | não existiam                                                                                                                   | situação do registro (indisponível para 2024)                                                                                      |
| CANDIDATURA.total_votos                                                                   | vazio                                                                                                                          | preenchido para as eleições proporcionais de 2018 a 2024                                                                           |
| RECEITA.sq_receita e RECEITA.natureza                                                     | não existiam                                                                                                                   | código do TSE (repetido) e financeiro ou estimável                                                                                 |
| PESSOA.uf_nascimento                                                                      | não existia                                                                                                                    | CHAR(2), usada na resolução de identidade                                                                                          |
| TOTALIZACAO_MUNICIPIO: soma                                                               | aptos = comparecimento + abstenções                                                                                            | tolera diferença de até 10 eleitores                                                                                               |

## **6.7 Limitações conhecidas**

O cargo de presidente não aparece, porque é publicado apenas no arquivo nacional, fora do recorte de seis UFs. Nos pleitos antigos, vice-prefeito e vice-governador vêm sem resultado, de modo que sua vitória não é identificada diretamente. Em rankings de troca de partido, siglas que apenas mudaram de nome contam como troca. Os valores de gasto são despesas contratadas, não necessariamente pagas. A escolaridade, o patrimônio e a data de nascimento são autodeclarados. A resolução de identidade é uma regra nossa, com os valores originais preservados na candidatura; casos raros de homônimos ou de dados trocados podem escapar. O IDHM e o Censo de 2010 são aplicados às eleições de 2008 e 2012 como retrato do município (pergunta 3), e a idade mediana é de 2022 (pergunta 6). O TSE não publica a situação do registro em 2024. Seis municípios de 2024 não têm votos de vereador completos e ficam fora da pergunta 5. A classificação ideológica dos partidos (pergunta 7) ainda não foi carregada.

# **7 MÉTODOS DE RESPOSTA ÀS PERGUNTAS**

Com as tabelas carregadas, nove das dez perguntas podem ser respondidas por consultas SQL, reunidas em views que o site de apresentação lê. Para cada uma, registra-se o critério adotado, o resultado principal e onde está a consulta; as perguntas 1 e 10 trazem também a consulta completa, e a pergunta 5, a consulta central do quociente. A pergunta 7 depende de uma base de classificação ideológica que ainda será pesquisada. As justificativas detalhadas dos dados e das decisões estão no documento JUSTIFICATIVA_DADOS.md do repositório.

## **7.1 Pergunta 1: quanto custa uma cadeira**

A resposta principal divide o gasto total das campanhas de cada cargo pelo número de vagas em disputa, por pleito e por UF. Assim, o gasto dos derrotados também entra no custo, porque também faz parte do que custou preencher a vaga. Os vices são excluídos, pois disputam a mesma vaga do titular, e candidatos sem despesa declarada contam como zero. A consulta abaixo devolve uma linha por pleito, cargo e UF.

> WITH gasto AS (
>
> SELECT c.id_eleicao AS ano, UPPER(c.cargo) AS cargo, c.sg_uf AS uf,
>
> COUNT(DISTINCT c.id_candidatura) AS candidatos,
>
> SUM(COALESCE(d.valor, 0)) AS gasto_total
>
> FROM candidatura c
>
> LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
>
> WHERE c.id_eleicao \>= 2018 AND UPPER(c.cargo) NOT LIKE 'VICE%'
>
> GROUP BY c.id_eleicao, UPPER(c.cargo), c.sg_uf),
>
> vagas AS (
>
> SELECT v.id_eleicao AS ano, UPPER(v.cargo) AS cargo, COALESCE(v.sg_uf, m.uf) AS uf,
>
> SUM(v.qt_vaga) AS cadeiras
>
> FROM vaga v
>
> LEFT JOIN municipio m ON m.cod_ibge = v.cod_ibge
>
> WHERE v.id_eleicao \>= 2018 AND UPPER(v.cargo) NOT LIKE 'VICE%'
>
> GROUP BY v.id_eleicao, UPPER(v.cargo), COALESCE(v.sg_uf, m.uf))
>
> SELECT g.ano, g.cargo, g.uf, g.candidatos, v.cadeiras,
>
> ROUND(g.gasto_total, 2) AS gasto_total,
>
> ROUND(g.gasto_total / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
>
> FROM gasto g
>
> JOIN vagas v ON v.ano = g.ano AND v.cargo = g.cargo AND v.uf = g.uf
>
> ORDER BY g.cargo, g.ano, g.uf;

A leitura complementar compara o gasto por candidato de eleitos e não eleitos. Eleito é todo resultado iniciado por ELEITO, o que inclui os eleitos por quociente partidário e por média; não eleito reúne NÃO ELEITO e SUPLENTE. Como os dois grupos têm tamanhos muito diferentes, a comparação é feita pela média e pela mediana por candidato, e não pelo total de cada grupo. Os parâmetros ficam na primeira linha da consulta.

> WITH p AS (SELECT 2018 AS ano, 'DEPUTADO FEDERAL' AS cargo, NULL::text AS uf),
>
> por_cand AS (
>
> SELECT c.id_candidatura,
>
> CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'Eleitos'
>
> WHEN c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE') THEN 'Não eleitos'
>
> END AS grupo,
>
> SUM(COALESCE(d.valor, 0)) AS gasto
>
> FROM candidatura c CROSS JOIN p
>
> LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
>
> WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo
>
> AND (p.uf IS NULL OR c.sg_uf = p.uf)
>
> GROUP BY c.id_candidatura, c.situacao_resultado),
>
> resumo AS (
>
> SELECT grupo, COUNT(\*) AS candidatos, SUM(gasto) AS gasto_total, AVG(gasto) AS media,
>
> percentile_cont(0.5) WITHIN GROUP (ORDER BY gasto) AS mediana
>
> FROM por_cand WHERE grupo IS NOT NULL GROUP BY grupo)
>
> SELECT grupo, candidatos,
>
> ROUND(100.0 \* candidatos / SUM(candidatos) OVER (), 1) AS pct_dos_candidatos,
>
> ROUND(gasto_total, 2) AS gasto_total,
>
> ROUND(100.0 \* gasto_total / SUM(gasto_total) OVER (), 1) AS pct_do_gasto_total,
>
> ROUND(media, 2) AS media_por_candidato,
>
> ROUND(mediana::numeric, 2) AS mediana_por_candidato
>
> FROM resumo ORDER BY grupo;

Para deputado federal em 2018, nos seis estados, o resultado foi o seguinte.

| **Grupo**   | **Candidatos** | **Média por candidato** | **Mediana por candidato** |
|-------------|----------------|-------------------------|---------------------------|
| Eleitos     | 92             | R\$ 1.058.181           | R\$ 965.545               |
| Não eleitos | 1.053          | R\$ 104.948             | R\$ 9.874                 |

O total gasto pelos não eleitos (R\$ 110,5 milhões) chega a ser maior que o dos eleitos (R\$ 97,4 milhões), mas eles são onze vezes mais numerosos. Por candidato, o eleito gastou cerca de 10 vezes mais pela média e cerca de 98 vezes mais pela mediana. A diferença entre as duas razões mostra que a maior parte dos derrotados gastou muito pouco, enquanto o eleito típico gastou perto de R\$ 1 milhão.

## **7.2 Pergunta 2: taxa de sucesso por patrimônio declarado**

O patrimônio de cada candidatura é a soma dos seus bens declarados (BEM_DECLARADO); quem não declarou bens conta como R\$ 0 e forma um grupo próprio. A comparação é sempre dentro de um cargo, porque o patrimônio típico de um vereador e o de um governador estão em escalas diferentes. As duas leituras são faixas fixas em reais (limites em escala aproximadamente logarítmica, de R\$ 50 mil a R\$ 5 milhões) e quintos de patrimônio dentro de cada disputa, entre quem declarou algum bem; usa-se a mediana, nunca a média, porque a base contém declarações absurdas. Vices e suplentes de senador ficam fora. As consultas estão em views_q2.sql (mv_q2_faixas, mv_q2_quintis e mv_q2_resumo).

**Resultado.** Em 2022, para deputado federal, 0,7% dos candidatos sem bens declarados foram eleitos, contra 22,4% no quinto mais rico (33 vezes mais); para vereador em 2024, 9,0% contra 24,4% (2,7 vezes). Há exceções: em prefeito de Sergipe em 2020, quem não declarou bens se elegeu mais (35,1%) que o quinto mais rico (28,2%). A associação não é causal.

## **7.3 Pergunta 3: índices do município**

O recorte é o das eleições municipais de 2008 e 2012, as que cercam 2010, único ano com IDHM municipal e Censo; os índices de 2010 valem como retrato do município nas duas. Os municípios são agrupados pelas faixas oficiais do IDHM (muito baixo, baixo, médio, alto e muito alto) e pelos quartis do PIB per capita. Os isentos são as abstenções, os votos em branco e os votos nulos, em percentual dos eleitores aptos, calculados sobre os totais do grupo e não pela média das taxas. A correlação de Pearson usa o logaritmo do PIB per capita. O TSE conta como nulos os votos de candidatos com registro indeferido, o que distorce alguns municípios; os que passam de Q3 + 3 × (Q3 − Q1) dos nulos da eleição (84 em 2008 e 67 em 2012) são marcados como votação anulada e saem das medidas de isentos. Três municípios criados depois de 2010 ficam de fora. As consultas estão em views_q3.sql (vw_q3_municipio, vw_q3_eleicao, mv_q3_grupos, mv_q3_partidos e mv_q3_correlacao).

**Resultado.** Municípios menos desenvolvidos têm mais isentos, e o efeito vem da abstenção e dos votos nulos, não do voto em branco, que sobe levemente com o desenvolvimento. A correlação do IDHM com o percentual de nulos é de -0,59 em 2008 e -0,47 em 2012; com a abstenção, -0,34 e -0,20; com os isentos, -0,40 e -0,24. A relação entre eleitores e habitantes é de 55 por 100 no IDHM muito baixo e cerca de 70 nos demais, reflexo da estrutura etária. O partido que mais elege prefeitos e vereadores no conjunto é o PMDB (em 2012, 20% dos prefeitos no IDHM muito baixo e 38% no muito alto). Os grupos extremos do IDHM são pequenos (10 e 13 municípios).

## **7.4 Pergunta 4: escolaridade do candidato e do eleitorado**

A parte 1 mede a taxa de sucesso por grau de escolaridade do candidato (oito graus, de analfabeto a superior completo) e compara a distribuição de escolaridade do eleitorado, dos candidatos e dos eleitos. Para tirar médias, cada grau vale uma quantidade de anos de estudo equivalentes (fundamental incompleto 5, completo 9, médio completo 12, superior completo 16). A parte 2 agrupa os municípios em quartis pela escolaridade média do eleitorado e compara com a escolaridade dos eleitos: em 2024 (prefeito e vereador) pela média dos eleitos do município; em 2022 (deputado federal e estadual), que representam o estado, pela média dos deputados eleitos ponderada pelos votos que o município deu a eles. Governador e senador ficam fora da parte 2. As consultas estão em views_q4.sql (mv_q4_sucesso, mv_q4_representacao, mv_q4_municipio, mv_q4_grupos e mv_q4_correlacao).

**Resultado.** Parte 1: só o superior completo se destaca; em vereador de 2024 ele se elege 20,1% das vezes contra 13,4% dos demais (1,5 vez), e em deputado federal de 2022, 6,9% contra 2,3% (3 vezes). O eleitorado é muito menos escolarizado que os eleitos: 10,8% do eleitorado tem superior completo, contra 36,0% dos vereadores eleitos em 2024 e 83,7% dos deputados federais eleitos em 2022. Parte 2: em 2024 a relação é moderada para vereador (correlação 0,47) e fraca para prefeito (0,15). Em 2022, para deputados, praticamente não há relação (correlação 0,11 para federal e 0,05 para estadual): o eleitorado dos quartos de município vai de 6,4 a 9,5 anos de estudo equivalentes, mas os deputados que cada grupo elege ficam em torno de 15 anos nos quatro.

## **7.5 Pergunta 5: eleitos por votos de legenda**

Entre os eleitos de um cargo proporcional, é considerado eleito por votos de legenda aquele cujos votos nominais ficaram abaixo do quociente eleitoral da disputa: sozinho ele não teria feito uma vaga, e o partido o levou. O quociente eleitoral é a soma dos votos válidos (nominais mais legenda) dividida pelas vagas, com a fração arredondada como no art. 106 do Código Eleitoral. A disputa é o estado, para deputado, e o município, para vereador. Os votos válidos conferem com o total oficial do TSE em todas as disputas. A consulta abaixo calcula, para deputado federal em 2022, os eleitos de cada partido e quantos deles ficaram abaixo do quociente.

> WITH nom AS (
>
> SELECT c.sg_uf, SUM(v.votos_nominais) AS votos
>
> FROM votacao v JOIN candidatura c ON c.id_candidatura = v.id_candidatura
>
> WHERE c.id_eleicao = 2022 AND c.cargo = 'DEPUTADO FEDERAL' AND v.turno = 1
>
> GROUP BY c.sg_uf),
>
> leg AS (
>
> SELECT m.uf AS sg_uf, SUM(l.votos_legenda) AS votos
>
> FROM votacao_legenda l JOIN municipio m ON m.cod_ibge = l.cod_ibge
>
> WHERE l.id_eleicao = 2022 AND l.cargo = 'DEPUTADO FEDERAL' AND l.turno = 1
>
> GROUP BY m.uf),
>
> vagas AS (
>
> SELECT sg_uf, SUM(qt_vaga) AS vagas FROM vaga
>
> WHERE id_eleicao = 2022 AND cargo = 'DEPUTADO FEDERAL' GROUP BY sg_uf),
>
> q AS (
>
> SELECT n.sg_uf, (n.votos + l.votos)::numeric / g.vagas AS bruto
>
> FROM nom n JOIN leg l USING (sg_uf) JOIN vagas g USING (sg_uf)),
>
> quociente AS (
>
> SELECT sg_uf, CASE WHEN bruto - FLOOR(bruto) \> 0.5 THEN CEIL(bruto) ELSE FLOOR(bruto) END AS qe FROM q)
>
> SELECT c.sigla_partido AS partido,
>
> COUNT(\*) AS eleitos,
>
> COUNT(\*) FILTER (WHERE c.total_votos \< qe.qe) AS eleitos_por_legenda,
>
> ROUND(100.0 \* COUNT(\*) FILTER (WHERE c.total_votos \< qe.qe) / COUNT(\*), 1) AS pct_por_legenda
>
> FROM candidatura c JOIN quociente qe ON qe.sg_uf = c.sg_uf
>
> WHERE c.id_eleicao = 2022 AND c.cargo = 'DEPUTADO FEDERAL' AND c.situacao_resultado LIKE 'ELEITO%'
>
> GROUP BY c.sigla_partido
>
> ORDER BY eleitos DESC, partido;

Para deputado federal em 2022 o resultado é: MDB, 15 eleitos, todos por legenda; PL, 15, dos quais 14; PSD, 13 (12); PT, 12 (11); PP, 11 (10); União, 10 (10).

**Resultado.** Entre 94,6% e 99,1% dos eleitos têm votos nominais abaixo do quociente nas seis eleições (por exemplo, 87 dos 92 deputados federais de 2022 e 12.400 dos 12.621 vereadores de 2020). Isso é quase estrutural: o quociente é o preço de uma vaga do partido, e quase ninguém o atinge sozinho. Por isso há uma medida complementar, os eleitos "fora dos mais votados", que ocupam a vaga de alguém com mais votos: de 9,9% a 14,9% dos eleitos. Os votos de legenda são de 3% a 8% dos votos válidos. A coligação (2018) e a federação (2022) não aparecem separadas: vale o partido do candidato. Seis municípios de 2024 ficam de fora, por dados incompletos no TSE. As consultas completas estão em views_q5.sql (mv_q5_circunscricao, mv_q5_eleito, mv_q5_barrado, mv_q5_resumo e mv_q5_partido).

## **7.6 Pergunta 6: idade do município, alternância e idade dos eleitos**

Os municípios são classificados em quatro grupos pelos quartis da idade mediana do Censo 2022 (cortes em 32, 35 e 37 anos); como só há idade mediana por município em 2022, o grupo é uma caracterização estrutural e vale para todos os pleitos. A idade do eleito é a em 1º de outubro do ano da eleição, a partir da data de nascimento declarada. A alternância é medida pelo partido do prefeito em relação ao do pleito anterior, tratando como o mesmo partido as renomeações e fusões (PMDB para MDB, PFL e DEM para União, entre outras), e por três medidas: o partido mudou, o prefeito mudou e a taxa de reeleição entre os que tentaram. Só entram os pleitos municipais de 2004 a 2024. As consultas estão em views_q6.sql (vw_q6_municipio, vw_q6_linhagem, mv_q6_idade, mv_q6_correlacao e mv_q6_alternancia).

**Resultado.** A relação é fraca: em 2024, os vereadores eleitos nos municípios mais envelhecidos têm 46,4 anos em média contra 44,5 nos mais jovens (correlação 0,23), e os prefeitos, 50,7 contra 48,5 (correlação 0,05). Os eleitos ficaram mais velhos em todos os grupos ao longo do tempo (prefeitos de 46,1 anos em 2004 para 49,7 em 2024). O partido do prefeito mudou em 60,0% dos municípios em 2008 e em 65,7% em 2024, sem padrão consistente entre os grupos etários; em 2024, metade dos prefeitos concorreu de novo e 81,2% dos que concorreram venceram.

## **7.7 Pergunta 7: viés político do município**

Esta pergunta ainda não foi respondida. Ela depende de uma classificação ideológica dos partidos atualizada (PARTIDO.espectro_politico, ainda vazio), que a equipe está pesquisando. Com ela, a votação por partido e município (VOTACAO e VOTACAO_LEGENDA, já carregadas para as eleições proporcionais) mostrará a evolução do viés político de cada território ao longo dos pleitos.

## **7.8 Pergunta 8: recursos públicos e privados**

O dinheiro público é o que o TSE classifica, na fonte da receita, como Fundo Especial de Financiamento de Campanha ou Fundo Partidário; as demais fontes, reunidas em Outros Recursos, são privadas. Essa classificação é do próprio TSE, o que resolve o caso do repasse do partido ao candidato: o partido é um intermediário, e a fonte já indica se o dinheiro era público. Cada candidato entra em uma faixa pela parte do que arrecadou que era dinheiro público (sem receita declarada, nenhum, menos de 25%, 25% a 50%, 50% a 75%, 75% a 99% e 100% público); as doações estimáveis, em bens e serviços, entram. Vices e suplentes de senador ficam fora. As consultas estão em views_q8.sql (vw_q8_receita, vw_q8_candidato, mv_q8_faixas, mv_q8_origem e mv_q8_resumo).

**Resultado.** A relação não é linear. Entre os vereadores de 2024, a taxa de sucesso é de 3,4% para quem não declarou receita, 17,5% para quem não teve dinheiro público, 28,7% para quem teve menos de 25% e 9,7% para quem dependeu só de dinheiro público. Para deputado federal em 2022, 20,0% com menos de 25% de dinheiro público e 0,6% com 100%. A parte pública da arrecadação total foi de 69,6% em 2018, 51,3% em 2020, 80,2% em 2022 e 73,1% em 2024. A associação não prova causa: os partidos distribuem o fundo conforme a chance de vitória de cada candidato.

## **7.9 Pergunta 9: onde o candidato investe em propaganda**

As 41 categorias de despesa do TSE foram reunidas em quatro canais de propaganda (impressos e adesivos; rádio, TV, vídeo e som; internet; militância, comícios e eventos) e dois grupos que não são propaganda (estrutura da campanha e outras despesas); cada categoria vai inteira para um grupo. A nuvem de palavras é calculada no banco, a partir da descrição das despesas: as descrições são quebradas em palavras, cada palavra conta uma vez por despesa, plurais e grafias alternativas são unificados e palavras vazias saem. As consultas estão em views_q9.sql (vw_q9_despesa, mv_q9_categoria e mv_q9_palavras).

**Resultado.** Em 2024, 53,1% do gasto foi para propaganda, metade dela em impressos e adesivos; a internet ainda é pequena (8,3% da propaganda). Nas descrições dos vereadores de 2024, as palavras mais frequentes são ADESIVO, SANTINHO, MILITÂNCIA, PERFURADO e RUA. O total das categorias (R\$ 3,29 bilhões) é igual ao da tabela DESPESA.

## **7.10 Pergunta 10: sobrevivência da carreira de um político**

A trajetória é obtida a partir do nome do político. A consulta liga PESSOA às suas candidaturas pelo identificador da pessoa (id_pessoa) e devolve uma linha por pleito, em ordem cronológica, com o cargo disputado, o local, o partido da época e o resultado. A busca olha o nome mais recente e também o nome declarado em cada eleição (CANDIDATURA.nome_declarado), o que acha quem mudou de nome, e a data de nascimento separa os homônimos.

> SELECT p.nome, p.data_nascimento,
>
> c.id_eleicao AS ano, c.cargo,
>
> COALESCE(m.nome, c.sg_uf) AS local,
>
> c.sigla_partido AS partido,
>
> CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'GANHOU'
>
> WHEN c.situacao_resultado = 'NÃO ELEITO' THEN 'PERDEU'
>
> WHEN c.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
>
> ELSE 'OUTRO' END AS resultado,
>
> c.situacao_resultado AS detalhe_resultado
>
> FROM pessoa p
>
> JOIN candidatura c ON c.id_pessoa = p.id_pessoa
>
> LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
>
> WHERE p.nome ILIKE '%NOME DO POLITICO%' OR c.nome_declarado ILIKE '%NOME DO POLITICO%'
>
> ORDER BY p.nome, p.data_nascimento, c.id_eleicao;

Uma versão estendida da consulta marca também os eventos da carreira, comparando cada candidatura com as anteriores da mesma pessoa. É reeleição quando a pessoa vence para o mesmo cargo em que havia sido eleita no pleito anterior desse cargo, quatro anos antes, ou oito no caso de senador. Também se registra a troca de partido e a mudança de cargo em relação à candidatura anterior, o que mostra, por exemplo, o vereador que passa a disputar uma vaga de deputado.

## **7.11 Interface de consulta**

Para a apresentação, as consultas foram reunidas em um site, com uma API em Node que só executa SELECT nas views do banco e uma interface em React (Vite e Recharts), que substituiu a primeira interface em Streamlit. Cada pergunta tem sua seção, com filtros (eleição, cargo e estado) e gráficos, e cada bloco mostra o SQL executado, o que permite verificar que os números vêm das views. Há também uma versão estática, que grava as respostas do banco em arquivos e pode ser hospedada em qualquer servidor, sem banco nem API, para consulta por link; ela inclui a página com as justificativas dos dados.
