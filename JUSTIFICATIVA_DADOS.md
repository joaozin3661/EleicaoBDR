# Justificativa dos dados e das decisões metodológicas

Projeto de Banco de Dados Relacional (UFPI): banco `eleicoes_v2` no PostgreSQL, com dados eleitorais do TSE de seis estados
(AL, PA, PB, PR, SC e SE, 1.238 municípios). Este documento cobre as perguntas **1, 2, 3, 4, 5, 6, 8, 9 e 10**, as já respondidas.
Para cada uma: que dados foram usados e por quê, que decisões foram tomadas, o que foi conferido e o que ficou como limitação.

Os números citados foram lidos do banco ou dos arquivos de carga durante a construção. As consultas que os produzem estão
nos arquivos `views_*.sql` e aparecem no site, no botão "Ver o SQL executado no banco" de cada bloco.

---

## 1. Decisões que valem para todas as perguntas

### 1.1 Por que o TSE
Todos os dados eleitorais vêm do Portal de Dados Abertos do TSE. É a fonte oficial e pública, publicada com um arquivo
`leiame` que documenta cada campo, e traz o identificador `SQ_CANDIDATO`, que liga o mesmo candidato entre candidaturas, bens,
receitas e despesas. Sem essa chave comum, cruzar patrimônio, financiamento e gastos com o resultado da eleição seria
impossível. O IBGE entra só na tabela de correspondência entre o código de município do TSE e o do IBGE.

### 1.2 Recorte
- **Geográfico:** 6 estados, nas regiões Norte, Nordeste e Sul.
- **Temporal:** 2018, 2020, 2022 e 2024 nas perguntas 1, 2, 8 e 9, que é o escopo definido pelo professor ("E.P."). A pergunta 10
  usa os doze pleitos de 2002 a 2024, porque a carreira de um político só aparece em série longa, a pergunta 4 usa 2022 e 2024 (a pergunta pede essas duas eleições), e a pergunta 6 usa os seis pleitos
  municipais de 2004 a 2024, porque compara cada eleição com a anterior no mesmo município.
- **Presidente fica de fora.** Esse cargo só existe no arquivo nacional, fora do recorte de seis estados.

### 1.3 Quem entra nas comparações
| Regra | Justificativa |
|---|---|
| Só candidaturas que chegaram a um resultado (eleito, não eleito ou suplente) | Uma taxa de sucesso só faz sentido onde o resultado existe. |
| **Eleito** = todo resultado que começa com `ELEITO` (por QP, por média, direto) | O TSE usa rótulos diferentes por ano. A carga padronizou "MÉDIA" para "ELEITO POR MÉDIA", então um único critério vale em todos os anos. |
| **Não eleito** inclui os suplentes | Suplente não assumiu a cadeira na eleição. |
| **Vices e suplentes de senador ficam de fora** nas perguntas 1, 2 e 8 | Disputam a mesma vaga do titular, e a receita e a despesa deles saem na conta do titular. Incluí-los contaria a cadeira duas vezes. |
| **Quem não declarou nada conta como R$ 0** (despesa, bem ou receita) | Decisão tomada com o grupo. Declarar nada é uma informação real, e tirar esses candidatos tornaria a base mais "limpa" do que a realidade. Em todas as telas esse grupo aparece separado. |

### 1.4 Eleições suplementares e segundo turno
Os arquivos municipais misturam a eleição ordinária com eleições suplementares feitas meses ou anos depois. Elas foram descartadas
(790 candidaturas na carga principal), porque repetiriam candidatos e vagas. Os bens, as receitas e as despesas dessas eleições não
se ligam a nenhuma candidatura do banco e saem junto: 681 bens (2020) e 188 (2024); 968 receitas (2020) e 188 (2024).
Quando o candidato disputou dois turnos, fica a linha do último, que traz o resultado final.

### 1.5 Identidade das pessoas
O título de eleitor não é uma chave confiável: a mesma pessoa aparece com títulos diferentes e pessoas diferentes aparecem com o
mesmo título. A vistoria nos arquivos brutos mostrou:

| Problema na fonte | Casos |
|---|---|
| Pessoas com mais de um título | 486 |
| Títulos usados por pessoas diferentes | 166 |
| Candidaturas de 2024 com CPF oculto pelo TSE (valor `-4`) | 93.365, ou seja, todas |
| CPF de 2024 recuperado de eleições anteriores | 45.517 |
| Mesma pessoa, duas candidaturas no mesmo ano (registro indeferido mais o válido) | 1.208 pares |

Por isso `PESSOA` tem uma chave própria (`id_pessoa`). A carga agrupa pelo título, separa quem tem nome e nascimento diferentes,
e une quem tem o mesmo CPF válido ou o mesmo nome, nascimento e UF de nascimento. Título e CPF originais ficam guardados na
candidatura, sem alteração. O resultado são 359.408 pessoas para 569.184 candidaturas.

### 1.6 Por que o site lê views
As regras (o que é eleito, o que é público, o que é propaganda) estão escritas uma vez, no banco. O site só faz `SELECT`. As
consultas que agregam milhões de linhas, como a soma de 2,1 milhões de despesas, são views materializadas e respondem em milissegundos.

### 1.7 Como os números foram conferidos
Nas perguntas 2, 8 e 9, os resultados foram **recalculados de forma independente em Python (pandas)** a partir dos arquivos brutos
ou dos CSVs de carga, sem usar as views, e comparados com o que o banco devolve. Na Q2 e na Q9 isso foi feito por duas rodadas de
verificadores separados, e os problemas apontados foram corrigidos. Na Q1, o resultado reproduz o número que o grupo já havia
validado no início do trabalho.

---

## 2. Pergunta 1: quanto custa uma cadeira?

**Dados usados**

| Tabela | Origem no TSE | Para quê |
|---|---|---|
| `candidatura` | `consulta_cand`: `DS_CARGO`, `DS_SIT_TOT_TURNO` | cargo, estado e resultado de cada candidato |
| `vaga` | `consulta_vagas`: `QT_VAGA` (7.512 linhas) | número de cadeiras em disputa |
| `despesa` | prestação de contas, despesas contratadas: `VR_DESPESA_CONTRATADA` (2.099.197 linhas) | quanto cada campanha gastou |

**Por que esses dados:** custo da cadeira exige duas coisas, o gasto e o número de cadeiras. O número de vagas vem do próprio
TSE; sem ele, só daria para comparar candidatos, não o custo de preencher uma vaga.

**Decisões**
- **Resposta principal:** gasto total de campanha do cargo ÷ vagas, por pleito e estado. O gasto dos derrotados entra, porque também faz
  parte do que custou preencher a cadeira. Resultado para deputado federal: R$ 1,7 a 2,6 mi por cadeira em 2018 e R$ 5,3 a 7,7 mi em 2022.
- **Leitura complementar:** gasto por candidato de eleitos contra não eleitos, por **média e mediana**. Os totais isolados enganam, porque os
  grupos têm tamanhos muito diferentes. Para deputado federal em 2018: 92 eleitos gastaram em média R$ 1.058.181 contra
  R$ 104.948 dos 1.053 não eleitos (10,1×); pela mediana a razão sobe para 97,8×, porque a maioria dos derrotados gastou muito pouco.
- **Despesas contratadas, não só pagas:** o que a campanha se comprometeu a gastar. É uma escolha do projeto e é declarada como limitação.

**Limitações:** os valores são despesas contratadas, não necessariamente pagas. Em 2022, 0,8% do valor das despesas (R$ 8,1 mi)
está em linhas totalmente idênticas; pode ser item repetido legítimo ou duplicata, e o arquivo não permite distinguir.

---

## 3. Pergunta 2: taxa de sucesso por patrimônio declarado

**Dados usados**

| Tabela | Origem no TSE | Para quê |
|---|---|---|
| `bem_declarado` | bens de candidatos: `VR_BEM_CANDIDATO`, `DS_TIPO_BEM_CANDIDATO` (442.621 bens, R$ 58,08 bi) | patrimônio de cada candidato |
| `candidatura` | mesma da Q1 | resultado |

**Por que esses dados:** o patrimônio é declarado pelo próprio candidato ao registrar a candidatura, e o TSE o publica por candidato. É a
única fonte oficial de patrimônio individual. Cerca de **100% dos bens de eleições ordinárias se ligam a uma candidatura** do banco
pelo `SQ_CANDIDATO`, e os bens e valores do banco batem com os do arquivo bruto até o centavo.

**Decisões**
- **Patrimônio = soma dos bens da candidatura.** Quem não declarou bem tem R$ 0 e forma um grupo próprio: 36,2% dos vereadores de 2024 e
  33,9% dos candidatos a deputado federal de 2022.
- **Sempre dentro de um cargo.** O patrimônio típico de um vereador (mediana de R$ 99 mil entre os eleitos em 2024) e o de um
  governador estão em escalas diferentes, e misturá-los criaria uma associação falsa só pela diferença de cargo.
- **Duas leituras:** (a) faixas fixas em reais, com limites em escala aproximadamente logarítmica, de R$ 50 mil a R$ 5 mi; (b) quintos
  dentro do cargo, entre quem declarou algum bem, que comparam ricos e pobres de cada disputa.
- **Mediana, nunca média.** A base contém declarações absurdas, como uma casa de R$ 1 bilhão e um patrimônio de R$ 2,4 bi para um vereador.
  O TSE publica o dado como veio; alterá-lo seria inventar informação. A mediana não é afetada por esses casos.
- **Desempate nos quintos** pelo identificador da candidatura, para o resultado ser o mesmo a cada atualização.
- **Quintos escondidos quando algum grupo tem menos de 20 candidatos** (governador e senador por estado têm 1 ou 2 por grupo), porque
  taxas de 0% ou 100% sobre um candidato não significam nada. Nesses casos a tela mostra só as faixas.

**Resultado:** deputado federal 2022: 0,7% de eleitos entre quem não declarou bens e 22,4% no quinto mais rico (33,4×). Vereador 2024: 9,0%
contra 24,4% (2,7×). Há exceções, e a tela as mostra: em prefeito de Sergipe em 2020, quem não declarou bens se elegeu mais (35,1%) que o quinto mais rico (28,2%).

**Limitações:** candidatos com registro indeferido que foram à urna contam como não eleitos. Em 2024 o TSE não publica a situação da
candidatura, então não dá para separá-los em todos os anos. Nos anos em que dá (2018 e 2022, deputados), tirá-los sobe a taxa de sucesso
em 0,3 a 0,5 ponto percentual (deputado federal 2022: 5,2% com eles, 5,5% sem).
O patrimônio é autodeclarado.

---

## 4. Pergunta 3: municípios mais desenvolvidos votam e elegem diferente?

**Recorte.** Só há IDHM municipal e Censo de 2010. Por isso a pergunta foi respondida para as **eleições municipais de 2008 e 2012**, as duas que cercam 2010,
e os índices de 2010 valem como retrato do município nas duas. Não foi feita versão estadual ou nacional: deputado, governador e senador não pertencem a um
município, então não há como ligá-los a um índice municipal sem inventar uma regra de distribuição. O custo do recorte é declarado na tela: 2008 vem
dois anos antes do retrato e 2012, dois anos depois.

**Dados.**

| O quê | Fonte | Observação |
|---|---|---|
| IDHM 1991, 2000 e 2010 | Atlas do Desenvolvimento Humano (já carregado) | só 2010 é usado na pergunta |
| PIB municipal 2010 | IBGE, SIDRA tabela 5938 | em mil reais; 5.565 municípios |
| População 2010 | IBGE, SIDRA tabela 202 (Censo) | 5.565 municípios |
| PIB per capita | calculado: PIB x 1.000 / população | |
| Eleitores aptos, comparecimento, abstenção, brancos e nulos | TSE, detalhe da votação por município | 1º turno, cargo de prefeito, 2008 e 2012 (4.963 linhas); eleições suplementares removidas por janela de 0 a 28 dias |
| Partidos dos eleitos | tabela `candidatura` | prefeito e vereador, `situacao_resultado` começando por ELEITO |

**Decisões.**

1. **Isentos** = abstenções + votos em branco + votos nulos, como percentual dos eleitores aptos. A pergunta fala em "comportamento do eleitor"; os três
   componentes são mostrados separados, porque se movem em sentidos diferentes (abaixo).
2. **Grupos de município.** IDHM pelas cinco faixas oficiais do Atlas (muito baixo abaixo de 0,500; baixo; médio; alto; muito alto a partir de 0,800).
   PIB per capita em quartis calculados sobre os 1.235 municípios que têm os dois índices. Os grupos extremos do IDHM são pequenos (10 e 13 municípios), e a tela avisa.
3. **Taxas agregadas, não média de taxas.** O percentual de um grupo é a soma dos votos do grupo sobre a soma dos aptos, de modo que um município de 3 mil eleitores
   não pesa o mesmo que uma capital.
4. **Correlação** de Pearson entre o índice e a taxa de cada município. Para o PIB usa-se o logaritmo do PIB per capita, pela distribuição muito assimétrica.
   É associação entre municípios, não causa, e a tela diz isso.
5. **Partidos.** Contagem de eleitos por grupo, com participação do partido no grupo. Sigla do partido na época da eleição.

**Anomalia encontrada: votação anulada.** O TSE conta como "nulos" os votos dados a candidatos cujo registro foi indeferido. Em alguns municípios isso
produz percentuais de nulos muito acima do normal (de 12,8% a 59,1% dos aptos em 2008; de 10,1% a 84,7% em 2012), que não refletem o comportamento do eleitor e
distorcem qualquer média. Hipótese testada: nos municípios com nulos atípicos, 89% (2008) e 69% (2012) tinham candidato a prefeito com registro indeferido,
contra 6% e 4% nos demais. A marcação é objetiva e sem corte escolhido a olho: município é sinalizado quando o percentual de nulos fica acima de
**Q3 + 3 x (Q3 - Q1)** da própria eleição (a cerca externa de Tukey). Resultado: **84 de 1.235 municípios em 2008 e 67 em 2012**. Eles ficam fora das medidas
de isentos, abstenção, brancos, nulos e das correlações dessas medidas, e entram na relação eleitores/população e na contagem de partidos, que não dependem dos votos.
A tabela da tela mostra a coluna "Sem votação anulada" com o tamanho real de cada grupo.

**Ajuste no modelo.** A restrição `ck_totalizacao_soma` exigia aptos = comparecimento + abstenções exatamente. Em 2012 há linhas do TSE em que a soma
difere em 1 ou 2 eleitores (Aracaju, por exemplo). A restrição passou a tolerar diferença de até 10, e a carga mantém os números como o TSE publicou, em vez de
descartar o município. O `importar_q3.py` aplica a mudança também ao banco já existente.

**Municípios fora.** Três municípios do banco não têm IDHM ou PIB de 2010 (criados depois do Censo) e ficam de fora; sobram **1.235** em cada eleição.

**Resultados** (6 estados, valores já excluindo votação anulada).

| Medida | 2008 | 2012 |
|---|---|---|
| Isentos nos municípios de IDHM muito baixo, baixo, médio, alto, muito alto | 24,3%, 21,4%, 19,4%, 18,7%, 19,4% | 24,0%, 19,5%, 19,4%, 20,0%, 20,0% |
| Correlação IDHM x isentos | -0,40 | -0,24 |
| Correlação IDHM x votos nulos | -0,59 | -0,47 |
| Correlação IDHM x abstenção | -0,34 | -0,20 |
| Correlação IDHM x votos em branco | +0,08 | +0,09 |
| Correlação IDHM x eleitores/população | +0,15 | +0,22 |
| Correlação PIB per capita x isentos | -0,34 | -0,27 |

Leitura: municípios menos desenvolvidos têm mais isentos, mas o efeito vem da **abstenção e dos nulos**; o voto em branco sobe levemente com o desenvolvimento
(correlação positiva, fraca). A relação entre eleitores e habitantes é de 55 por 100 no IDHM muito baixo e cerca de 70 nos demais em 2012, refletindo a estrutura etária
(mais crianças, menos eleitores), não a participação. Nos partidos, o PMDB é o que mais elege prefeitos e vereadores no conjunto; em 2012 a participação dele entre os prefeitos
vai de 20% no IDHM muito baixo a 38% no muito alto, e o PT elege proporcionalmente mais nos municípios menos desenvolvidos.

**Verificação independente.** Um script em pandas, lendo os CSVs de carga e sem passar pelas views, recalculou os agrupamentos por IDHM e por PIB em 2008 e 2012, quatro
correlações e as contagens de partidos (prefeito 2012 por IDHM; vereador 2008 por PIB). Resultado: **0 divergências**.

**Limitações da Q3.** Índices de 2010 aplicados a 2008 e 2012; municípios criados depois de 2010 ausentes; marcação de votação anulada é uma regra estatística (acerta
a maioria dos casos com indeferimento, mas não é uma lista oficial); sem recorte estadual ou nacional por falta de ligação com município.

---

## 5. Pergunta 4: escolaridade de quem se candidata, de quem se elege e de quem vota

**A pergunta tem duas partes.** (1) O grau de instrução do candidato se relaciona à chance de ser eleito? (2) Municípios de menor escolaridade
tendem a eleger candidatos de escolaridade semelhante à do seu eleitorado? Escopo: 2022 e 2024.

**Dados usados**

| Tabela | Origem no TSE | Para quê |
|---|---|---|
| `candidatura` | `consulta_cand`: `DS_GRAU_INSTRUCAO` (preenchido em todas as candidaturas de 2022 e 2024) | escolaridade do candidato |
| `eleitorado` | perfil de comparecimento e abstenção: `QT_APTOS` por município, faixa etária e grau de escolaridade (680.519 linhas, 2018 a 2024) | escolaridade do eleitorado |

### 4.1 Por que esses dados
O perfil do eleitorado do TSE usa **os mesmos graus de escolaridade dos candidatos** (analfabeto, lê e escreve, fundamental, médio e superior,
completos e incompletos), o que permite comparar candidato e eleitor diretamente, sem converter categorias. Outra fonte, como o nível de instrução do
Censo do IBGE, tem faixas diferentes, é de uma só data e cobre moradores e não eleitores. O arquivo vem aberto por zona, gênero, estado civil, cor e
outras dimensões que o modelo não usa; somar tudo dá a mesma população apta (27.136.743 aptos em 2022 e 27.914.914 em 2024 nos 6 estados, conferidos
contra o arquivo bruto). A tabela `eleitorado` foi carregada para os quatro pleitos (2018 a 2024), porque também serve às perguntas 3 e 6.

### 4.2 Decisões
- **Só o 1º turno.** O perfil dos aptos é o mesmo nos dois turnos, e o arquivo de 2022 repete o 1º turno como "2º turno"; carregar os dois contaria cada
  eleitor em dobro.
- **Escala de anos de estudo equivalentes** para tirar médias: fundamental incompleto 5, completo 9, médio incompleto 10, completo 12, superior incompleto 14
  e superior completo 16 (analfabeto 0, lê e escreve 2). É uma convenção nossa, declarada na tela, e as conclusões não dependem dela: os percentuais por
  grau são mostrados ao lado.
- **Fora da comparação:** "não informado" (eleitor, 0,00% a 0,02%) e "não divulgável" (candidato, 1 caso em 2024).
- **Analfabeto aparece só no eleitorado** (3,8% a 4,3%): nenhum candidato declarou esse grau, e o grupo foi mantido nos gráficos para a distribuição do
  eleitorado somar 100%.
- **Parte 2 em nível de município, em dois formatos.** Em 2024, prefeito e vereador pertencem a um município, e a comparação é município a município
  (escolaridade média dos eleitos do município, uma pessoa um peso). Em 2022 os eleitos são deputados, que representam o estado; ali a escolaridade "dos
  eleitos" de um município é medida **pelos votos**: a média da escolaridade dos deputados eleitos, ponderada pelos votos que o município deu a eles
  (usa a tabela `votacao`, carregada para a Q5). Como medida complementar, a média sobre todos os candidatos votados, eleitos ou não. A parte 2 de 2022
  cobre deputado federal e estadual; **governador e senador ficam fora**, porque os votos por município deles não foram carregados.
- **Grupos de município** pelos quartis da escolaridade média do eleitorado nos 1.238 municípios (1º quarto = eleitorado menos escolarizado). Ao escolher
  um estado, só mudam os municípios mostrados, não os cortes.

### 4.3 O que os dados mostram
**Parte 1: só o superior completo se destaca.** Vereador 2024: superior completo se elege 20,1% das vezes contra 13,4% dos demais candidatos (1,5×); entre os
outros graus a taxa varia pouco e sem ordem (12,0% no fundamental incompleto, 12,5% no completo, 10,0% no médio incompleto, 14,9% no médio completo).
Deputado federal 2022: 6,9% contra 2,3% (3,0×).

**Quem vota, quem se candida, quem se elege.** O eleitorado é muito menos escolarizado que os eleitos:

| | Eleitorado | Candidatos | Eleitos |
|---|---|---|---|
| Vereador 2024, com superior completo | 10,8% | 27,3% | 36,0% |
| Deputado federal 2022, com superior completo | 10,8% | 63,0% | 83,7% |
| Vereador 2024, escolaridade média (anos de estudo equivalentes) | 9,2 | | 12,5 |
| Deputado federal 2022, escolaridade média | 9,1 | | 15,4 |

Até o fundamental completo estão 41,1% do eleitorado (2024), mas só 19,6% dos vereadores eleitos; em 2022, 43,2% do eleitorado e 2,2% dos deputados federais eleitos.

**Parte 2: a relação existe e é moderada para vereador.** Quanto mais escolarizado o eleitorado do município, mais escolarizados os vereadores eleitos
(correlação 0,47; cada ano de estudo a mais no eleitorado vai com 0,59 ano a mais nos eleitos). Nos municípios de eleitorado menos escolarizado, 27,6% dos
vereadores eleitos têm superior completo; nos de eleitorado mais escolarizado, 49,9%. Para prefeito a correlação é fraca (0,15). Mas em **todos os grupos** os
eleitos são mais escolarizados que o eleitorado (cerca de 4 anos de estudo equivalentes a mais): o eleitorado "parecido com o eleito" não existe em nenhum grupo.

**Parte 2, deputados em 2022: quase nenhuma relação.** O eleitorado dos quartos de município vai de 6,4 a 9,5 anos de estudo equivalentes, mas a escolaridade dos
deputados que cada grupo de municípios elege (ponderada pelos votos) fica praticamente parada.

| 2022 | Eleitorado, do 1º ao 4º quarto | Eleitos, do 1º ao 4º quarto | Correlação município a município | Eleitos com superior, do 1º ao 4º quarto |
|---|---|---|---|---|
| Deputado federal | 6,4 / 7,6 / 8,5 / 9,5 | 15,5 / 15,5 / 15,6 / 15,5 | 0,11 (fraca; 0,22 com todos os votados) | 80,1% / 83,4% / 88,5% / 86,9% |
| Deputado estadual | 6,4 / 7,6 / 8,5 / 9,5 | 14,8 / 15,1 / 15,2 / 15,3 | 0,05 (praticamente nenhuma; 0,07 com todos os votados) | 68,6% / 76,8% / 80,3% / 82,9% |

Qualquer município, de eleitorado mais ou menos escolarizado, vota em deputados com escolaridade média de 15 anos de estudo equivalentes (superior completo é 16), contra 8,0 do eleitorado:
mais do que em 2024, a diferença entre quem vota e quem é eleito é de mais de 7 anos. Em Santa Catarina a correlação do deputado federal é até negativa (-0,20), mas com 295 municípios.

### 4.4 Conferência
Taxa de sucesso por grau em quatro combinações, a distribuição eleitorado, candidatos e eleitos em três, os grupos de município e a correlação foram recalculados
em pandas a partir dos CSVs, sem usar as views, **sem nenhuma diferença**. A parte 2 de 2022 foi conferida à parte: 20 grupos (deputado federal e estadual, nos 6 estados e no Pará, de todos os
municípios e de cada quarto) e as correlações e inclinações (6 estados e Santa Catarina), também **sem diferença**. Os resultados de 2024 não mudaram com a ampliação das views.

**Limitações:** a escolaridade do candidato é autodeclarada. A do eleitor é a do cadastro eleitoral, que pode estar desatualizada. A associação entre estudo e
eleição não é causal: quem tem mais estudo também tende a ter mais patrimônio, mais estrutura de campanha e partidos maiores (a tela diz isso). A parte 2 de 2022 mede a escolaridade
dos eleitos pelos votos do município, não por quem o município "elegeu" (o deputado representa o estado); e não cobre governador e senador.

---

## 6. Pergunta 5: quantos eleitos de cada partido entraram por votos de legenda?

**Escopo.** Eleições proporcionais dos seis estados: deputado federal e estadual (2018 e 2022) e vereador (2020 e 2024). Para deputado a disputa é o estado;
para vereador, o município. São 2.494 disputas.

**Definição escolhida (combinada com o usuário).** Um eleito é "por legenda" quando seus **votos nominais ficaram abaixo do quociente eleitoral** da disputa.
Sozinho ele não teria feito uma vaga; o partido o levou. O quociente eleitoral é votos válidos (nominais + legenda) dividido pelas vagas, com a fração arredondada como
no Código Eleitoral (art. 106: desprezada se igual ou inferior a meio, 1 se superior). Em vez de "refazer a distribuição sem votos de legenda" (que exigiria reimplementar
as regras de cada eleição, com coligações em 2018 e federações em 2022), usamos esta medida, que se calcula direto dos dados.

**Dados.**

| O quê | Fonte | Tabela no banco |
|---|---|---|
| Votos nominais válidos por candidato e município | TSE, votação por candidato em município e zona (arquivos de 2 a 3 GB por ano, lidos em blocos) | `votacao` (2,29 milhões de linhas) |
| Votos de legenda válidos por partido, município e cargo | TSE, votação por partido em município e zona | `votacao_legenda` (165,7 mil linhas) |
| Vagas | tabela `vaga` (já carregada) | `vaga` |
| Quem foi eleito, e o partido | tabela `candidatura` | `candidatura` (`total_votos` agora preenchido) |

Os votos de legenda incluem os "nominais convertidos em legenda" (candidatos indeferidos cujos votos o TSE reverte ao partido), como na coluna
`QT_TOTAL_VOTOS_LEG_VALIDOS` do TSE. Votos de candidatos anulados não entram.

**Conferência dos votos válidos com o TSE.** Para cada município e cargo, nominais + legenda foram comparados ao total de votos válidos oficial (`QT_TOTAL_VOTOS_VALIDOS` do detalhe da votação).
Em 2018, 2020 e 2022 a igualdade é **exata em todas as disputas** (35,2, 18,4 e 39,3 milhões de votos válidos). O quociente depende dessa soma.

**Municípios excluídos.** Em 2024, seis municípios não passaram na conferência e saem da Q5: **Ananindeua, Breu Branco, Placas, Rurópolis e Nossa Senhora das Dores**, onde o TSE não
publicou votos de vereador por candidato nem por partido (e todos os candidatos estão sem resultado), e **Melgaço**, onde parte da votação foi refeita em 17/05/2026 e os arquivos ficaram incompletos.
Sobram 1.232 municípios em 2024 (12.646 eleitos, que é exatamente o número de vagas dessas disputas). O total de vagas de 2024 no banco (12.730) inclui esses seis.

**Medidas.** Além da definição principal, três leituras complementares:
- **Faixa do quociente:** quanto do quociente o eleito fez sozinho (100% ou mais, 50 a 99%, 20 a 49%, menos de 20%) e a mediana.
- **Fora dos mais votados:** o eleito não está entre os N candidatos mais votados da disputa (N = vagas), isto é, ocupa a vaga de alguém com mais votos. É a medida mais sensível,
  porque a definição principal é quase estrutural (abaixo).
- **Mais votados que não se elegeram ("barrados"):** candidatos entre os N mais votados sem vaga (3.670 no total, 3.186 deles suplentes).

**Resultados** (6 estados).

| Eleição e cargo | Eleitos | Por legenda (abaixo do quociente) | Fora dos mais votados | Mediana dos votos próprios (% do quociente) | Votos de legenda no total |
|---|---|---|---|---|---|
| 2018 deputado federal | 92 | 88 (95,7%) | 10 (10,9%) | 49,8% | 6,3% |
| 2018 deputado estadual | 222 | 220 (99,1%) | 22 (9,9%) | 47,2% | 7,7% |
| 2020 vereador | 12.621 | 12.400 (98,2%) | 1.878 (14,9%) | 43,3% | 5,1% |
| 2022 deputado federal | 92 | 87 (94,6%) | 11 (12,0%) | 47,5% | 3,6% |
| 2022 deputado estadual | 222 | 216 (97,3%) | 22 (9,9%) | 50,4% | 6,2% |
| 2024 vereador | 12.646 | 12.333 (97,5%) | 1.659 (13,1%) | 46,5% | 3,2% |

**Leitura.** Entre **94,6% e 99,1%** dos eleitos têm votos nominais abaixo do quociente. Isso não é uma peculiaridade dos partidos: o quociente é o preço de uma vaga do partido, e no
sistema proporcional de lista aberta quase ninguém o alcança sozinho. A tela explica isso. O que distingue partidos e disputas é a medida de "fora dos mais votados" (de 9,9% a 14,9% dos eleitos) e a participação dos
votos de legenda (3% a 8% dos votos válidos). Exemplo: em 2022, para deputado federal, só 5 dos 92 eleitos atingiram o quociente sozinhos; em 2020, houve vereadores de municípios pequenos eleitos
com menos de 10% do quociente.

**Verificação independente.** Um script em pandas, lendo os CSVs de carga e sem usar as views, recalculou o quociente e os votos válidos das 2.494 disputas, todos os grupos do resumo (ano, cargo, UF e faixas)
e as contagens de eleitos por partido (689 combinações): **0 divergências**. Em toda disputa o número de eleitos é igual ao número de vagas. Um teste de consistência independente do quociente: em 2020 (sem
coligação nem federação), em 99,96% dos 4.710 casos em que o partido atingiu o quociente, o número de eleitos "por quociente partidário" do TSE é exatamente `votos do partido ÷ quociente`, e em nenhum caso foi maior.

**Limitações da Q5.** A definição principal é quase estrutural (ver acima), por isso há medidas complementares. O partido é o do candidato; coligações (2018) e federações (2022) somam votos e vagas e não aparecem separadas. A medida não refaz a distribuição
de vagas sem os votos de legenda (definição B, descartada pela complexidade das regras). Seis municípios de 2024 ficam de fora por dados incompletos no TSE. Eleições suplementares são descartadas, como nas demais perguntas.

---

## 7. Pergunta 6: a idade do município se reflete em quem ele elege?

**A pergunta:** se a estrutura etária do município se reflete em quem ele elege: classificar cada município como mais jovem ou mais
envelhecido, ver a idade média dos eleitos ali e observar se há tendência de alternância de poder entre os pleitos.

**Dados usados**

| Tabela | Origem | Para quê |
|---|---|---|
| `indicador_municipal` | IBGE, Censo 2022, SIDRA tabela 9515: idade mediana e índice de envelhecimento (1.238 municípios) | classificar o município |
| `candidatura` | prefeitos e vereadores eleitos nos pleitos municipais de 2004 a 2024 (cargo, partido da época, município, resultado) | quem foi eleito e por qual partido |
| `pessoa` | data de nascimento declarada ao TSE (99,96% a 100% dos eleitos têm) | idade do eleito |

### 5.1 Por que esses dados
O IBGE é a fonte oficial de idade mediana por município, e a tabela 9515 cobre **os 1.238 municípios sem nenhum faltando**. O índice de
envelhecimento (idosos para cada 100 jovens) também veio e tem correlação de 0,95 com a idade mediana; foi usada a idade mediana por ser
mais fácil de explicar. A idade do eleito vem da data de nascimento que o próprio candidato declara no registro, a mesma base que já usamos
na pergunta 10. Como o banco já tinha 6 pleitos municipais de prefeito e vereador, a análise de alternância usa **cinco comparações entre
pleitos consecutivos** (2004→2008 até 2020→2024), mais do que os pleitos pedidos.

### 5.2 Decisões
- **Quatro grupos pelos quartis da idade mediana** (cortes em 32, 35 e 37 anos: 339, 364, 235 e 300 municípios). Os quartis dividem
  em grupos de tamanho parecido sem escolher cortes à mão; como a idade mediana é um número inteiro, há empates e os grupos não ficam
  exatamente iguais.
- **O grupo etário é de 2022 e vale para todos os pleitos.** O IBGE só publica a idade mediana por município no Censo de 2022. Isso é uma
  caracterização estrutural do município (um município jovem em 2022 provavelmente já era mais jovem que a média em 2004), não uma medida da
  época de cada eleição. A tela e o dossiê declaram essa limitação.
- **Só pleitos municipais.** Em 2018 e 2022 os eleitos são deputados, governadores e senadores, que não pertencem a um município; por isso esses
  anos não entram na Q6.
- **Idade do eleito** = anos completos em 1º de outubro do ano da eleição, calculada com a data de nascimento.
- **Alternância pela linhagem do partido, e não pelo número.** Comparar o partido do prefeito com o do pleito anterior parece simples, mas o
  número do partido é reaproveitado (o 44 era o PRP até 2016 e hoje é o União; o 25 era o DEM e hoje é o PRD), e a sigla muda por renomeação ou
  fusão. Sem tratar isso, 22 municípios que passaram de DEM para União em 2024 contariam como troca de partido. As renomeações e fusões
  conhecidas (PMDB→MDB; PFL, DEM e PSL→União; PTB, Patriota e PRP→PRD; PROS→Solidariedade; PSC e PHS→Podemos; entre outras) foram tratadas
  como o mesmo partido, em uma lista de 28 siglas no `views_q6.sql`.
- **Três medidas de alternância:** o partido mudou, o prefeito mudou, e a taxa de reeleição **entre os que tentaram** (a lei limita a duas
  eleições seguidas, então só quem concorreu entra no denominador).

### 5.3 O que os dados mostram
O resultado principal é uma **relação fraca**:

| | Município mais envelhecido × mais jovem | Correlação |
|---|---|---|
| Vereador 2024 | eleitos 46,4 contra 44,5 anos (+1,9) | 0,23 (fraca) |
| Prefeito 2024 | eleitos 50,7 contra 48,5 anos (+2,2) | 0,05 (praticamente nenhuma) |

- **Vereadores:** nos municípios mais envelhecidos, 11,4% dos eleitos têm 60 anos ou mais, contra 7,2% nos mais jovens. A correlação sobe de 0,10 (2004)
  para 0,23 (2016 a 2024).
- **Prefeitos:** a diferença entre os grupos existe, mas a correlação município a município fica entre 0,04 e 0,08 em todos os pleitos: a idade do
  município explica quase nada da idade de quem governa.
- **Os eleitos ficaram mais velhos em todos os grupos:** prefeitos de 46,1 anos (2004) para 49,7 (2024); vereadores de 41,8 para 45,3. Esse efeito
  do tempo é maior que a diferença entre grupos de município.
- **Alternância:** o partido do prefeito mudou em 60,0% dos municípios em 2008, 66,9% em 2012, 72,3% em 2016, 69,7% em 2020 e 65,7% em 2024. Entre
  os grupos etários não há padrão consistente: a ordem entre eles muda de um pleito para o outro.
- **Reeleição:** em 2024, metade dos prefeitos (50,4%) concorreu de novo e 81,2% dos que concorreram venceram.

### 5.4 Conferência
Quatro combinações de idade dos eleitos (prefeito e vereador, em anos diferentes), duas correlações e a alternância de dois pleitos foram
recalculadas em pandas a partir dos CSVs, sem usar as views, **sem nenhuma diferença**.

**Limitações:** a idade mediana é de 2022. A lista de linhagens partidárias é uma decisão nossa e é estática (trata como um só partido os que se
fundiram, o que pode subestimar um pouco a alternância, por exemplo uma troca entre dois partidos que depois se fundiram). Em cada pleito, 6 a 14
municípios não têm prefeito eleito nos dados (eleição anulada ou sem resultado) e ficam fora da comparação. A data de nascimento é autodeclarada. A
correlação fraca é um resultado, mas é um resultado sobre associação, não sobre causa.

---

## 8. Pergunta 8: recursos públicos ou privados, quem se elege?

**A pergunta:** se candidatos financiados majoritariamente por repasses públicos têm desempenho diferente dos sustentados por doações
privadas e recursos próprios.

**Dados usados**

| Tabela | Origem no TSE | Para quê |
|---|---|---|
| `receita` | receitas de candidatos: `DS_FONTE_RECEITA`, `DS_ORIGEM_RECEITA`, `DS_NATUREZA_RECEITA`, `VR_RECEITA` (969.901 linhas, R$ 3,62 bi) | quanto cada campanha arrecadou e de onde |
| `candidatura` | mesma da Q1 | resultado |

### 6.1 Por que a fonte da receita define "público"
O TSE classifica cada receita em três **fontes**: **Fundo Especial de Financiamento de Campanha (FEFC)**, **Fundo Partidário** e **Outros
Recursos**. Os dois primeiros são dinheiro público; o terceiro reúne tudo que é privado. Usar esse campo é a leitura mais direta e
mais defensável, porque a classificação é do próprio TSE e não nossa.

Isso resolve o ponto mais delicado da pergunta, o **repasse do partido ao candidato**. O partido é um intermediário: o dinheiro que ele
repassa pode ser público ou privado. O TSE já marca isso na fonte. Em 2022, dos R$ 844,9 mi de dinheiro público que chegaram aos
candidatos, quase tudo veio por repasse do partido (R$ 734,8 mi em FEFC e R$ 80,3 mi em Fundo Partidário), e todos aparecem como públicos. O que o
partido repassa de outras fontes, suas doações privadas, aparece como "Outros Recursos" e fica como privado.

### 6.2 Alternativa considerada e descartada: o arquivo de "doador originário"
O TSE publica também um arquivo de doador originário. Ele foi baixado e inspecionado, e **não foi usado**, porque só traz o nome e o
CNPJ/CPF dos doadores privados por trás de uma parte pequena dos repasses; não diz se o dinheiro era público. Como a classificação
público/privado já está na fonte da receita, carregá-lo não mudaria a resposta e acrescentaria uma tabela sem uso.

### 6.3 Como cada candidato é classificado
Cada candidato entra numa faixa pela **parte do que arrecadou que era dinheiro público**: sem receita declarada; nenhum dinheiro público;
menos de 25%; 25% a 50%; 50% a 75%; 75% a 99%; 100% público. Foram usadas faixas e não apenas "público ou privado", porque os dados mostraram
que a relação **não é linear**: dividir só em dois grupos esconderia justamente o padrão mais interessante.

### 6.4 O que os dados mostram
| Vereador 2024 | Candidatos | Taxa de sucesso |
|---|---|---|
| Sem receita declarada | 7.762 | 3,4% |
| Nenhum dinheiro público | 30.066 | 17,5% |
| Menos de 25% público | 4.656 | **28,7%** |
| 25% a 50% | 5.082 | 22,8% |
| 50% a 75% | 7.005 | 18,3% |
| 75% a 99% | 12.243 | 14,5% |
| 100% público | 16.305 | **9,7%** |

Quem depende só de dinheiro público tem a menor taxa de sucesso, e quem combina pouco dinheiro público com outras fontes tem a maior.
Em deputado federal 2022 o padrão se repete: 20,0% com menos de 25% de dinheiro público e 0,6% com 100%. Quem não declarou nenhuma
receita praticamente não se elege (3,4% entre vereadores em 2024; nenhum dos 135 candidatos a deputado federal em 2022).

O peso do dinheiro público na arrecadação total (todos os candidatos, 6 estados) cresceu e variou ao longo dos pleitos:

| Ano | Arrecadação total | Parte pública (FEFC + Fundo Partidário) |
|---|---|---|
| 2018 | R$ 532,9 mi | 69,6% |
| 2020 | R$ 717,2 mi | 51,3% |
| 2022 | R$ 1.053,0 mi | 80,2% |
| 2024 | R$ 1.319,3 mi | 73,1% |

### 6.5 Decisões e cuidados
- **Doações em bens e serviços (estimáveis) entram.** São R$ 388,3 mi de R$ 3.622 mi (10,7%); excluí-las ignoraria uma parte real do financiamento.
- **Recursos recebidos de outros candidatos** contam como públicos quando a fonte original é um dos fundos, e como privados nos demais casos.
- **A associação não prova causalidade.** Os partidos distribuem o fundo conforme a chance de vitória de cada candidato, e quem depende só dele
  costuma ser candidato de partido pequeno ou sem estrutura própria. A tela diz isso na própria página.
- **Linhas descartadas na carga:** as de `SQ_RECEITA = -1` (candidato sem receita, valor zero): 377 em 2018, 16.139 em 2020, 517 em 2022 e
  8.991 em 2024. Eles reaparecem na análise, corretamente, como "sem receita declarada".
- **`SQ_RECEITA` não é único.** Várias linhas dividem o mesmo código, quase todas "FINAL + FINAL" e com **valores diferentes** (em 84% dos
  casos), ou seja, linhas distintas e não a mesma receita contada duas vezes. Somam 0,5% do total. Todas foram mantidas, com um identificador
  novo por linha, e o código original ficou guardado em `sq_receita`.
- **Os nomes dos campos do TSE são confusos.** `DS_FONTE_RECEITA` diz de onde vem o recurso (fundo ou outros), e `DS_ORIGEM_RECEITA` diz quem é o
  doador (pessoa física, partido, próprio candidato). Na tabela, `origem_recurso` guarda a primeira e `tipo_doador` a segunda.

### 6.6 Conferência
Quatro disputas (vereador 2024, deputado federal 2022, prefeito do Pará 2020 e senador 2018) foram recalculadas em pandas a partir dos CSVs, sem usar
as views: candidatos por faixa, eleitos, receita total, parte pública e as duas taxas "majoritariamente", **sem nenhuma diferença**. A soma das
receitas por fonte em 2022 no banco (R$ 763,1 mi, R$ 81,8 mi e R$ 208,1 mi) é igual à do arquivo bruto.

**Limitações:** a classificação segue a do TSE; se o TSE registrar uma receita na fonte errada, o erro se propaga. O total das views (R$ 3.587,7 mi) é
menor que o da tabela (R$ 3.622,4 mi) porque as views só contam candidatos elegíveis, sem vices e suplentes de senador.

---

## 9. Pergunta 9: onde o candidato investe em propaganda?

**Dados usados:** a tabela `despesa` (a mesma da Q1), com `tipo_despesa` (41 categorias do TSE) e `descricao` (texto livre escrito pelo
candidato, preenchido em 99% das despesas).

**Por que esses dados:** é a única fonte que descreve o que cada gasto foi. A categoria dá a classificação oficial; a descrição dá o detalhe que
a categoria não dá (o tipo de material impresso, o nome da rede social).

**Decisões**
- **Agrupamento em canais.** As 41 categorias foram reunidas em quatro canais de propaganda (impressos e adesivos; rádio, TV, vídeo e som; internet;
  militância, comícios e eventos) e dois grupos que não são propaganda (estrutura da campanha e outras despesas). O agrupamento é nosso, mas cada
  categoria do TSE vai inteira para um grupo, e a tela mostra a categoria original ao lado do grupo. Todas as 41 categorias foram conferidas uma a uma.
- **A nuvem de palavras é calculada no banco**, não no site: as descrições são quebradas em palavras, uma palavra conta uma vez por despesa, e
  plurais e grafias alternativas são unificados (ADESIVOS e ADESIVO, BOTONS e BOTTONS). Palavras vazias (artigos, cargos, códigos de documento, tarifas
  bancárias) saem. A lista de exclusões e de sinônimos está escrita no `views_q9.sql`.
- **Duas leituras:** só despesas de propaganda, ou todas as despesas.

**Resultado:** em 2024, 53,1% do gasto foi para propaganda, e metade disso em impressos e adesivos. A internet ainda é pequena (8,3% da propaganda
em 2024). Nas descrições de vereador em 2024, as palavras mais frequentes são ADESIVO, SANTINHO, MILITÂNCIA, PERFURADO e RUA.

**Conferência:** o total das categorias (R$ 3.292.637.753,14) é igual ao total da tabela `despesa`, e o top 100 da nuvem foi reproduzido em Python.

**Limitações:** a nuvem usa texto digitado pelos candidatos, então ainda sobram algumas abreviações e nomes próprios. O mesmo ponto das despesas
repetidas da Q1 vale aqui.

---

## 10. Pergunta 10: sobrevivência da carreira de um político

**Dados usados:** as candidaturas de todos os doze pleitos (2002 a 2024), ligadas à `pessoa`, com cargo, partido da época, local e resultado.

**Por que esses dados:** a pergunta pede a trajetória de uma pessoa ao longo do tempo, e isso só existe se a mesma pessoa for reconhecida em
eleições diferentes. Por isso a pergunta justifica a separação entre `PESSOA` e `CANDIDATURA` e todo o trabalho de identidade da seção 1.5. Um terço
das pessoas (116.335 de 359.408) disputou mais de uma eleição, e três disputaram as doze.

**Decisões**
- **Sigla do partido guardada na candidatura**, porque os partidos mudam de nome (PMDB virou MDB, PFL virou DEM). Assim a linha do tempo mostra o partido da época.
- **Nome de cada eleição guardado**, além do nome mais recente da pessoa. Sem isso, quem mudou de nome (por casamento ou nome social) não seria achada pelo nome antigo. A
  busca ignora acentos.
- **Reeleição** = eleito para o mesmo cargo no pleito seguinte a um mandato (4 anos; 8 para senador). Troca de partido e de cargo são marcadas comparando cada
  candidatura com a anterior da mesma pessoa.
- **Registros repetidos no mesmo ano** (um indeferido e o válido) são unidos: fica o que tem resultado. Os demais continuam na tabela `candidatura`.
- **A consulta é feita por pessoa** (`WHERE id_pessoa = ...`), o que a mantém em cerca de 4 milissegundos.

**Exemplo:** Helder Barbalho, seis eleições entre 2002 e 2022, cinco vitórias, duas reeleições (prefeito em 2008 e governador em 2022), e a troca de PMDB para MDB.

**Limitações:** presidente não aparece. Vice-prefeito e vice-governador dos anos antigos vêm sem resultado no TSE. Siglas que só mudaram de nome contam como
troca de partido (no exemplo acima, a "troca" de PMDB para MDB é só a mudança de nome do mesmo partido). Candidatos sem título de eleitor na origem (467) não
são ligados a outras eleições; só 14 dariam para ligar por CPF ou nome, então o ganho não justificava uma regra a mais.

---

## 11. Resumo das limitações

| Limitação | Onde afeta | Tamanho |
|---|---|---|
| Despesas contratadas, não necessariamente pagas | Q1, Q9 | escolha declarada |
| Linhas de despesa totalmente idênticas | Q1, Q9 | 0,8% do valor em 2022 |
| Patrimônio autodeclarado, com valores absurdos na origem | Q2 | tratado com mediana e faixas |
| Situação da candidatura (indeferido) não publicada em 2024 | Q2, Q8 | 0,3 a 0,5 ponto percentual na Q2; na Q8 não foi medido |
| Associação entre fonte de dinheiro e vitória não prova causa | Q8 | explicado na tela |
| `SQ_RECEITA` repetido | Q8 | 0,5% do valor, linhas mantidas |
| Texto livre das descrições | Q9 | cosmético |
| Presidente fora; vices antigos sem resultado; siglas renomeadas | Q10 | declarado |
| Idade mediana do município só de 2022, aplicada a pleitos de 2004 a 2024 | Q6 | declarado na tela |
| Lista de linhagens partidárias é uma decisão nossa | Q6 | pode subestimar a alternância um pouco |
| Escolaridade do candidato autodeclarada; escala de anos de estudo é convenção nossa | Q4 | declarado na tela |
| Parte 2 da Q4 em 2022 mede a escolaridade dos eleitos pelos votos do município; governador e senador ficam fora | Q4 | declarado na tela |
| Índices (IDHM, PIB, população) de 2010 aplicados às eleições de 2008 e 2012 | Q3 | declarado na tela |
| Votação anulada identificada por regra estatística (cerca de Tukey), não por lista oficial | Q3 | 84 municípios em 2008, 67 em 2012 |
| Soma aptos = comparecimento + abstenções difere em até 2 eleitores em linhas do TSE | Q3 | restrição relaxada para 10, números mantidos |
| Três municípios sem IDHM/PIB de 2010 | Q3 | 3 de 1.238 |
| Definição principal da Q5 é quase estrutural (94,6% a 99,1% dos eleitos ficam abaixo do quociente) | Q5 | mitigada por medidas complementares |
| Coligações (2018) e federações (2022) não aparecem separadas | Q5 | declarado na tela |
| Seis municípios de 2024 sem votos de vereador completos no TSE | Q5 | 6 de 1.238 |
| Seis estados | todas | recorte do projeto |

---

## 12. Onde está cada coisa

| Arquivo (em `dados/questoes/carga_v2/`) | O quê |
|---|---|
| `carga_v2.py`, `importar_v2.py` | candidaturas, pessoas, vagas e despesas |
| `carga_bens.py`, `importar_bens.py` | bens (Q2) |
| `carga_receitas.py`, `importar_receitas.py` | receitas (Q8) |
| `der_eleicoes_v2.sql` | modelo com chaves, restrições e índices |
| `views_v2.sql` | views da Q1, da Q10 e da qualidade dos dados |
| `carga_eleitorado.py`, `importar_eleitorado.py` | perfil do eleitorado por escolaridade e idade (Q4; serve a Q3 e Q6) |
| `carga_idade_municipio.py`, `importar_idade.py` | idade mediana do IBGE (Q6) |
| `baixa_ibge_2010.py`, `carga_q3.py`, `importar_q3.py` | PIB e população de 2010 (SIDRA) e totalização por município 2008/2012 (Q3) |
| `carga_q5.py`, `importar_q5.py` | votos por candidato e de legenda por partido (Q5) |
| `views_q2.sql`, `views_q3.sql`, `views_q4.sql`, `views_q5.sql`, `views_q6.sql`, `views_q8.sql`, `views_q9.sql` | views das perguntas 2, 3, 4, 5, 6, 8 e 9 |
| `conferir_identidade.py` | gera as listas de revisão da resolução de identidade |
| `site_eleicoes/` | o site de apresentação |
