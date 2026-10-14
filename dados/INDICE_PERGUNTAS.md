# Arquivos por pergunta

Gerado pelo crawler (`python -m crawler`) em 24/09/2026 10:07. Caminhos relativos a esta pasta.
Os dados ficam organizados por fonte/tipo/ano; este índice diz o que cada pergunta usa.

## P1. Quanto custa uma cadeira?

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/despesas_contratadas_candidatos/<ano>/` - Despesas contratadas: tipo, descrição livre, fornecedor e valor. baixados: 2018, 2020, 2022, 2024
- `tse/vagas/<ano>/` - Número de vagas (cadeiras) por cargo e unidade eleitoral. baixados: 2018, 2020, 2022, 2024

## P2. Qual a taxa de sucesso eleitoral por patrimônio declarado?

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/bens_candidatos/<ano>/` - Bens declarados pelos candidatos (patrimônio). baixados: 2018, 2020, 2022, 2024

## P3. Índices do município (PIB per capita, IDHM, eleitores/população, isentos) x eleitos/partidos mais vitoriosos

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/votacao_candidato_munzona/<ano>/` - Votos de cada candidato por município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/votacao_partido_munzona/<ano>/` - Votos nominais e de legenda por partido, município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/detalhe_votacao_munzona/<ano>/` - Aptos, comparecimento, abstenções, brancos, nulos e válidos por município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/municipio_tse_ibge/` - Correspondência entre códigos de município do TSE e do IBGE. ok
- `ibge/pib/pib_municipios_tabela5938.csv` - PIB municipal a preços correntes (SIDRA 5938), para o PIB per capita
- `ibge/populacao/estimativas_populacao_tabela6579.csv` - População residente estimada (SIDRA 6579)
- `ibge/populacao/censo2022_populacao_tabela4709.csv` - População residente do Censo 2022 (SIDRA 4709)
- `ipea_atlas/idhm_municipios.csv` - IDHM e subíndices (educação, longevidade, renda) por município

## P4. Escolaridade do candidato x escolaridade dos votantes

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2022, 2024
- `tse/comparecimento_abstencao/<ano>/` - Aptos, comparecimento e abstenção por município/zona, faixa etária e escolaridade. baixados: 2022, 2024
- `tse/votacao_candidato_munzona/<ano>/` - Votos de cada candidato por município e zona. baixados: 2022, 2024
- `tse/municipio_tse_ibge/` - Correspondência entre códigos de município do TSE e do IBGE. ok
- `ibge/censo2022/nivel_instrucao_18mais_tabela10061.csv` - Pessoas de 18+ anos por nível de instrução, Censo 2022 (SIDRA 10061)

## P5. Quantos candidatos de dado partido foram eleitos por votos de legenda?

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/votacao_candidato_munzona/<ano>/` - Votos de cada candidato por município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/votacao_partido_munzona/<ano>/` - Votos nominais e de legenda por partido, município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/detalhe_votacao_munzona/<ano>/` - Aptos, comparecimento, abstenções, brancos, nulos e válidos por município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/vagas/<ano>/` - Número de vagas (cadeiras) por cargo e unidade eleitoral. baixados: 2018, 2020, 2022, 2024

## P6. Idade média do município x alternância de poder e idade dos eleitos

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/comparecimento_abstencao/<ano>/` - Aptos, comparecimento e abstenção por município/zona, faixa etária e escolaridade. baixados: 2018, 2020, 2022, 2024
- `tse/votacao_candidato_munzona/<ano>/` - Votos de cada candidato por município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/municipio_tse_ibge/` - Correspondência entre códigos de município do TSE e do IBGE. ok
- `ibge/censo2022/idade_mediana_envelhecimento_tabela9515.csv` - Idade mediana e índice de envelhecimento, Censo 2022 (SIDRA 9515)

## P7. Viés político de um município/região na linha do tempo

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/votacao_partido_munzona/<ano>/` - Votos nominais e de legenda por partido, município e zona. baixados: 2018, 2020, 2022, 2024
- `tse/municipio_tse_ibge/` - Correspondência entre códigos de município do TSE e do IBGE. ok
- `ibge/territorio/municipios.csv` - Municípios com UF, região, meso/microrregião e regiões imediata/intermediária
- `ideologia_partidos/Codebook_experts.docx`, `ideologia_partidos/df_experts.csv` - Classificação ideológica dos partidos por especialistas (Bolognesi et al.)

## P8. Sucesso de candidatos dependentes de repasses públicos x financiados por outras fontes

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/receitas_candidatos/<ano>/` - Receitas de campanha com fonte (FEFC, Fundo Partidário, outros) e doador originário. baixados: 2018, 2020, 2022, 2024

## P9. Onde o candidato investe em propaganda (nuvem de palavras)?

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 2018, 2020, 2022, 2024
- `tse/despesas_contratadas_candidatos/<ano>/` - Despesas contratadas: tipo, descrição livre, fornecedor e valor. baixados: 2018, 2020, 2022, 2024

## P10. Sobrevivência da carreira de um político

- `tse/candidatos/<ano>/` - Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título. baixados: 1994, 1996, 1998, 2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024
