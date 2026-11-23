# As 10 perguntas, uma por uma

As dez perguntas foram definidas pelo professor e não mudam. Aqui está o que cada uma pede, o recorte de anos, o critério
adotado e onde está a resposta (view no banco). O "porquê" detalhado de cada decisão fica em
[JUSTIFICATIVA_DADOS.md](JUSTIFICATIVA_DADOS.md); as tabelas citadas estão no [DER](DER.md).

**Leitura rápida**

| # | Pergunta | Anos | Views | Estado |
|---|---|---|---|---|
| 1 | Quanto custa uma cadeira? | 2018, 2020, 2022, 2024 | `mv_q1_*` | respondida |
| 2 | Taxa de sucesso por patrimônio declarado | 2018, 2020, 2022, 2024, 2026 | `vw_q2_patrimonio`, `mv_q2_*` | respondida |
| 3 | Índices do município x eleitos e partidos | 2008 e 2012 (índices de 2010) | `vw_q3_*`, `mv_q3_*` | respondida |
| 4 | Escolaridade do candidato x do eleitorado | 2022, 2024 e 2026 | `vw_q4_*`, `mv_q4_*` | respondida |
| 5 | Eleitos por votos de legenda, por partido | 2018 a 2026 (proporcionais) | `mv_q5_*` | respondida |
| 6 | Idade do município, alternância e idade dos eleitos | 2004 a 2024 (municipais) | `vw_q6_*`, `mv_q6_*` | respondida |
| 7 | Viés político do município na linha do tempo | 2018, 2020, 2022, 2024, 2026 | `vw_q7_votos_partido`, `mv_q7_*` | respondida |
| 8 | Recursos públicos x privados | 2018, 2020, 2022, 2024 | `vw_q8_*`, `mv_q8_*` | respondida |
| 9 | Onde o candidato investe em propaganda | 2018, 2020, 2022, 2024 | `vw_q9_*`, `mv_q9_*` | respondida |
| 10 | Sobrevivência da carreira de um político | 2002 a 2026 | `vw_q10_*`, `mv_q10_nomes` | respondida |

"E.P." nas aulas quer dizer o conjunto de pleitos 2018, 2020, 2022 e 2024. Os arquivos ficam em `banco/sql/views/`
(`02_q2.sql` a `09_q9.sql`; a Q1 e a Q10 estão em `01_base.sql`). Nas views, `mv_` é view materializada (guarda o
resultado) e `vw_` é view comum. O site (`frontend/`) só lê essas views.

**Presidente.** Desde a carga de 16/11/2026, as candidaturas a presidente e vice de 2002 a 2026 estão no banco, com
`sg_uf = 'BR'` e abrangência FEDERAL; despesas, receitas e bens de 2018 em diante também. O total de votos de presidente soma
as 27 UFs e o exterior. Em 2006 o TSE publica o resultado de presidente vazio; ele vem de `banco/referencia/
resultado_presidente_2006.csv`, montado com os votos nominais do próprio TSE (2º turno: Lula 58.295.042, Alckmin 37.543.178).

**A eleição de 2026.** Entra onde o dado já está fechado: candidaturas, bens, resultado e votos (Q2, Q4, Q5, Q7 e Q10).
Os arquivos do TSE foram baixados em 13/11/2026 e atualizados em 16/11/2026, já com o 2º turno decidido. Ficam fora a Q1, a Q8 e a Q9, porque a
prestação de contas de 2026 ainda é parcial (a Q3 e a Q6 são só de eleições municipais). Nesse download os deputados
federais e estaduais do Amapá (8 + 24 cadeiras) ainda vêm sem resultado e sem votos nominais: ficam fora da Q2, da Q4 e
da Q5 em 2026, e a Q7 do Amapá em 2026 usa só presidente, governador e senador. A situação da candidatura vem como
`#NE` em todas as linhas de 2026 (fica vazia no banco); vale a situação do resultado.

---

## Q1. Quanto custa uma cadeira?

**Pede:** quanto se gasta em campanha para cada cadeira em disputa.

**Como foi respondida:** duas leituras.
1. *Principal:* gasto total das campanhas de um cargo, em cada UF e pleito, dividido pelo número de vagas. É o custo da
   cadeira para o sistema, incluindo o que gastaram os derrotados. Permite ver a variação entre pleitos.
2. *Complementar:* gasto por candidato de eleitos contra não eleitos (média e mediana), para ver quanto a mais gasta
   quem vence.

**Critérios:** vices ficam de fora (disputam a mesma vaga do titular); candidato sem despesa conta como zero; eleito é
quem tem resultado iniciado por `ELEITO`, não eleito é `NÃO ELEITO` ou `SUPLENTE`.

**Dados:** `despesa` somada por candidatura, `vaga` (cadeiras), `candidatura.situacao_resultado`.
**Views:** `vw_gasto_candidatura`, `mv_q1_custo_cadeira`, `mv_q1_custo_municipio`, `mv_q1_eleitos_vs_nao`.

## Q2. Taxa de sucesso eleitoral por patrimônio declarado

**Pede:** candidatos mais ricos se elegem mais?

**Como foi respondida:** o patrimônio de cada candidatura é a soma dos bens declarados; quem não declarou conta como
R$ 0 e forma grupo próprio. Calcula-se a proporção de eleitos em cada faixa de patrimônio, sempre dentro de um cargo.
Duas leituras: faixas fixas em reais e quintos de patrimônio dentro de cada disputa (entre quem declarou algo).

**Critérios:** usa-se a mediana, nunca a média, porque a base tem declarações absurdas; vices e suplentes de senador
ficam fora; bens negativos são descartados. A associação não é causal. Em 2026 os valores são os declarados no
registro (sem correção pela inflação, como nos outros anos).

**Dados:** `bem_declarado` somado por candidatura, `candidatura.situacao_resultado`.
**Views:** `vw_q2_patrimonio`, `mv_q2_faixas`, `mv_q2_quintis`, `mv_q2_resumo`.

## Q3. Índices do município e os eleitos e partidos mais vitoriosos

**Pede:** o perfil socioeconômico do município (PIB per capita, IDHM, razão eleitores/população, "isentos") se associa
a quem ele elege e a quais partidos vencem?

**Recorte:** eleições municipais de 2008 e 2012. O IDHM municipal e o Censo só existem para 2010, então escolheram-se
as duas eleições que cercam esse ano e os índices de 2010 valem como retrato do município nas duas. Não há versão
estadual ou nacional, porque deputado, governador e senador não pertencem a um município.

**Como foi respondida:** municípios agrupados nas faixas oficiais do IDHM e em quartis do PIB per capita. Isentos =
abstenções + brancos + nulos, em % dos eleitores aptos, calculados sobre os totais do grupo (não pela média das taxas).
Correlação de Pearson com o log do PIB per capita. Municípios com votação anulada (muitos nulos por registros
indeferidos) saem das medidas de isentos; municípios criados depois de 2010 ficam de fora.

**Dados:** `indicador_municipal`, `totalizacao_municipio`, `candidatura`, `partido`.
**Views:** `vw_q3_municipio`, `vw_q3_eleicao`, `mv_q3_grupos`, `mv_q3_partidos`, `mv_q3_correlacao`.

## Q4. Escolaridade do candidato e escolaridade do eleitorado

**Pede:** duas coisas. (1) O grau de instrução do candidato se relaciona à chance de se eleger? (2) Municípios de menor
escolaridade elegem candidatos de escolaridade parecida com a do seu eleitorado?

**Recorte:** 2022, 2024 e 2026.

**Como foi respondida:** parte 1, taxa de sucesso por grau (de analfabeto a superior completo) e comparação das
distribuições de eleitorado, candidatos e eleitos. Para médias, cada grau vale anos de estudo equivalentes. Parte 2,
municípios em quartis pela escolaridade média do eleitorado, comparados com a dos eleitos: em 2024 (prefeito e
vereador) pela média dos eleitos do município; em 2022 e 2026 (deputados, que representam o estado) pela média dos eleitos
ponderada pelos votos que o município deu a eles. Governador e senador ficam fora da parte 2.

**Dados:** `candidatura.grau_instrucao`, `eleitorado.grau_instrucao`, `votacao`.
**Views:** `vw_q4_grau`, `vw_q4_candidato`, `mv_q4_sucesso`, `mv_q4_representacao`, `mv_q4_municipio`, `mv_q4_grupos`,
`mv_q4_correlacao`.

## Q5. Eleitos por votos de legenda, por partido

**Pede:** quantos eleitos de cada partido devem a cadeira ao desempenho da legenda e não ao próprio voto nominal.

**Recorte:** eleições proporcionais de 2018 a 2026: deputado federal e estadual (2018, 2022, 2026) e vereador (2020, 2024).

**Como foi respondida:** a disputa é o estado (deputado) ou o município (vereador). O quociente eleitoral é a soma dos
votos válidos (nominais + legenda) dividida pelas vagas, com a fração arredondada como no art. 106 do Código
Eleitoral. É eleito por votos de legenda quem se elegeu com votos nominais abaixo do quociente: sozinho não teria feito
a vaga, o partido o levou. Os votos válidos são conferidos com o total oficial do TSE em cada disputa; disputas em que o
TSE é inconsistente são excluídas (ex.: o Amazonas inteiro em 2018, cujos votos de legenda não batem).

**Dados:** `votacao`, `votacao_legenda`, `vaga`, `candidatura`.
**Views:** `mv_q5_circunscricao`, `mv_q5_eleito`, `mv_q5_barrado`, `mv_q5_resumo`, `mv_q5_partido`.

## Q6. Idade do município, alternância de poder e idade dos eleitos

**Pede:** a estrutura etária do município se reflete em quem ele elege? Há tendência de alternância de poder?

**Recorte:** pleitos municipais de 2004 a 2024, cada um comparado ao anterior. A idade do município é a do Censo 2022.

**Como foi respondida:** municípios em quatro grupos pelos quartis da idade mediana (como só há idade mediana em 2022,
o grupo é uma característica estrutural e vale para todos os pleitos). Idade do eleito em 1º de outubro do ano da
eleição, a partir da data de nascimento. Alternância medida de três jeitos: o partido do prefeito mudou, o prefeito
mudou, e a taxa de reeleição entre quem tentou. Renomeações e fusões de partido contam como o mesmo partido (PMDB para
MDB, PFL e DEM para União, etc.).

**Dados:** `indicador_municipal.idade_mediana`, `pessoa.data_nascimento`, `eleicao.ano`, `candidatura`.
**Views:** `vw_q6_linhagem`, `vw_q6_municipio`, `vw_q6_grupo`, `vw_q6_eleito`, `mv_q6_idade`, `mv_q6_correlacao`,
`mv_q6_alternancia`.

## Q7. Viés político do município ou região na linha do tempo

**Pede:** como a preferência partidária de cada território evoluiu entre os pleitos, pela sigla vencedora ou pela
participação de cada espectro ideológico no total de votos válidos do município.

**Como foi respondida:** pela participação de cada espectro, numa escala contínua. Cada partido recebe a nota do survey
com especialistas de Bolognesi, Codato, Ribeiro e Silva (Harvard Dataverse, doi:10.7910/DVN/MFIXKW): a média das notas
de 0 (extrema esquerda) a 10 (extrema direita), levada a −100 a +100.

    viés do partido = (média dos especialistas − 5) × 20
    viés do cargo   = Σ (votos do partido × viés do partido) ÷ Σ votos dos partidos com viés
    viés do lugar   = média simples dos cargos

2018 e 2020 usam a onda de 2018 do survey; 2022, 2024 e 2026, a de 2022 (a última publicada). Os votos são os válidos do 1º turno (nominais +
legenda), de todos os cargos: presidente, governador, senador e deputados nos anos gerais; prefeito e vereador nos
municipais. A média entre cargos tem peso igual, para que os dois votos de senador em 2018 não pesem em dobro. Estado,
região e Brasil fazem a mesma conta somando os votos dos seus municípios.

**Critérios:** a chave do viés é ano + número do partido, porque números mudam de dono (o 25 era DEM e em 2024 é PRD).
Renomeado mantém a nota (PRB → Republicanos, PPS → Cidadania, PMN → Mobiliza, PMB → Democrata em 2026); fusão depois da onda recebe a média
dos partidos de origem (PRD = PTB e Patriota); incorporação mantém a nota de quem incorporou (Podemos com o PSC,
Solidariedade com o PROS). As regras ficam em `banco/referencia/sucessao_partidos.csv`, com a origem de cada valor.
Partido sem nota na onda fica fora da conta, sem virar 0, e a cobertura mostra quanto do voto entrou (a UP em 2020 e o
Missão, partido novo, em 2026).
Compare anos do mesmo tipo (gerais com gerais, municipais com municipais), porque os cargos mudam. Entre 2020 e 2024
muda também a onda do survey, então parte da diferença vem da reavaliação dos partidos. Os valores são quase todos
positivos porque os especialistas põem a maioria dos partidos grandes à direita do centro: a leitura é comparativa.

**Dados:** `votacao_partido_municipio` (votos por partido, município e cargo, lidos do `votacao_partido_munzona` do TSE
por `carga_votos_q7.py`) e `vies_partido` (`carga_vies.py`); os dois entram com `importar_q7.py`. Esta tabela de votos
não exclui municípios como a Q5: o AM de 2018 entra (o TSE publica 7.048 votos de legenda de deputado federal a mais
que o total oficial, 0,4% do estado) e em 2024 o arquivo do TSE vem incompleto em 21 municípios para vereador e 9 para
prefeito (−718 mil e −447 mil votos); ali o viés sai dos votos publicados. O voto do exterior (presidente) não tem
município e fica fora. Um cargo inteiro só sai de um estado quando o TSE não publicou o resultado dele (menos da metade
dos votos válidos oficiais): os deputados do Amapá em 2026. `partido.espectro_politico` guarda a posição mais recente de cada número (esquerda abaixo de −10,
direita acima de +10, centro entre os dois, a faixa de 4,5 a 5,5 do artigo).
**Views:** `vw_q7_votos_partido`, `mv_q7_cargo`, `mv_q7_municipio`, `mv_q7_territorio`. **API:** `/api/q7`,
`/api/q7/municipios?ano=&uf=`, `/api/q7/municipio?cod_ibge=`.

## Q8. Recursos públicos e recursos privados

**Pede:** candidatos financiados sobretudo por repasses públicos (Fundo Especial de Financiamento de Campanha e Fundo
Partidário) têm desempenho diferente dos sustentados por doações privadas e recursos próprios?

**Como foi respondida:** público é o que o TSE classifica, na fonte da receita, como FEFC ou Fundo Partidário; o resto
é privado. Como a classificação é do TSE, o repasse do partido ao candidato já vem com a origem. Cada candidato entra
numa faixa pela parte pública do que arrecadou (sem receita, nenhum, menos de 25%, 25 a 50%, 50 a 75%, 75 a 99%,
100% público); doações estimáveis em bens e serviços entram. Vices e suplentes de senador ficam fora. A relação
não é linear e não prova causa: os partidos distribuem o fundo conforme a chance de vitória de cada um.

**Dados:** `receita` por origem do recurso e por candidatura, `candidatura.situacao_resultado`.
**Views:** `vw_q8_candidato`, `vw_q8_receita`, `mv_q8_faixas`, `mv_q8_origem`, `mv_q8_resumo`.

## Q9. Onde o candidato investe em propaganda

**Pede:** em que o dinheiro de campanha é gasto e com que peso cada tipo de propaganda aparece; e as palavras mais
usadas nas descrições (nuvem de palavras).

**Como foi respondida:** as 41 categorias de despesa do TSE foram reunidas em quatro canais de propaganda (impressos e
adesivos; rádio, TV, vídeo e som; internet; militância, comícios e eventos) e dois grupos que não são propaganda
(estrutura da campanha e outras despesas); cada categoria vai inteira para um grupo. A nuvem é calculada no banco: as
descrições são quebradas em palavras, cada palavra conta uma vez por despesa, plurais e grafias alternativas são
unificadas e palavras vazias saem. O total das categorias bate com o da tabela `despesa`.

**Dados:** `despesa.tipo_despesa` e `despesa.descricao`, por candidatura, cargo e ano.
**Views:** `vw_q9_despesa`, `mv_q9_categoria`, `mv_q9_palavras`. É a mais lenta de montar (a maior parte do tempo das
views).

## Q10. Sobrevivência da carreira de um político

**Pede:** a trajetória completa de um político: em quais pleitos concorreu, por quais partidos, que cargos disputou,
quando venceu, perdeu e se reelegeu. É a pergunta que justifica separar a pessoa da candidatura no modelo.

**Recorte:** 2002 a 2026, todos os treze pleitos gerais e municipais.

**Como foi respondida:** a busca é pelo nome. Liga `pessoa` às suas candidaturas por `id_pessoa` e devolve uma linha
por pleito, em ordem cronológica, com cargo, local, partido da época e resultado. A busca olha o nome mais recente e o
nome declarado em cada eleição (acha quem mudou de nome); a data de nascimento separa homônimos. A versão estendida
marca eventos: reeleição (vencer o mesmo cargo em que foi eleito no pleito anterior desse cargo, quatro anos antes, ou
oito no caso de senador), troca de partido e mudança de cargo.

**Dados:** `pessoa`, `candidatura` (cargo, `sigla_partido`, `situacao_resultado`), `eleicao`, `municipio`.
**Views:** `vw_q10_base`, `vw_q10_carreira`, `mv_q10_nomes`, `vw_q10_busca` (mais `vw_site_carreira`, que alimenta a
página).
