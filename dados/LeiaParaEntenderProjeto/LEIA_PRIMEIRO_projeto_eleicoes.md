> **Aviso (14/10/2026):** este documento descreve a **v1** do projeto (banco `eleicoes`, título de eleitor como chave da `pessoa`). O trabalho atual está no banco `eleicoes_v2`, com `id_pessoa` sintético, e está documentado no [README da raiz](../../README.md). Aqui vale o histórico das decisões e dos problemas já resolvidos.

# Projeto: Banco de Dados Relacional Eleitoral (TSE / IBGE)

> **Para o Claude que está lendo:** este documento é a passagem de bastão de um projeto em andamento, feito por mim (Claude) com o João numa conta anterior. Leia tudo antes de responder. O João prefere respostas em **português**, diretas, com o passo a passo exato do que rodar. Ele trabalha no **Windows**, com **VS Code (Code Runner)**, **pgAdmin 4** e **PostgreSQL 18**.

---

## 1. O que é o projeto

Trabalho da faculdade da disciplina de **Banco de Dados Relacional**. O grupo modela, carrega e consulta dados eleitorais públicos do **TSE** (e alguns do IBGE) para responder **10 perguntas oficiais**, que são fixas.

- **Escopo geográfico:** só 6 estados, **AL, PA, PB, PR, SC e SE**, que somam **1.238 municípios**.
- **Anos:** 2002 a 2024. As perguntas principais usam 2018, 2020, 2022 e 2024, e a Q10 usa o histórico todo.
- **Banco:** PostgreSQL 18 local, banco **`eleicoes`**, operado pelo pgAdmin 4.
- **Pasta do João:** `C:\Users\joaom\OneDrive\Área de Trabalho\crawler\dados\questoes\`, com as subpastas `questao1\` e `questao10\`.

## 2. Situação atual (13/10/2026)

**Fase:** carga feita e validada para a **Q1** e a **Q10**. A próxima entrega é a **apresentação ao professor**, cujo objetivo principal é **mostrar que o load foi feito e os dados estão no banco**, respondendo Q1 e Q10 com **uma maneira cada**.

| Item | Status |
|---|---|
| Modelo (14 tabelas) criado no PostgreSQL | ✅ feito |
| Carga Q1 (2018, 2020, 2022, 2024) | ✅ carregada e validada |
| Carga Q10 (2002 a 2016, somada ao que já existia) | ✅ carregada e validada |
| SQL final da Q1 e da Q10 | ✅ pronto (seção 7) |
| Interface Streamlit para a apresentação | ✅ pronta (`app_apresentacao.py`), ainda **não testada no banco real** |
| Resumo da carga (docx) | ✅ pronto |
| Atualizar dossiê Word e DER com as mudanças de modelo | ⏳ **pendente** |
| Cargas das outras questões (receitas, bens, votação, eleitorado, indicadores) | ⏳ pendente |
| Decidir se recupera ~400 pessoas sem título usando CPF | ⏳ pendente (seção 9) |

## 3. Modelo de dados (14 entidades)

PESSOA, ELEICAO, PARTIDO, MUNICIPIO, CANDIDATURA, BEM_DECLARADO, RECEITA, DESPESA, VOTACAO, VOTACAO_LEGENDA, ELEITORADO, TOTALIZACAO_MUNICIPIO, VAGA, INDICADOR_MUNICIPAL.

Decisões importantes, todas já aplicadas no banco:

- **`pessoa.titulo_eleitor VARCHAR(13)` é a chave da pessoa**, não o CPF. O CPF vem escondido em 2024 (valor `-4`) e falta em parte dos anos, por isso ficou como coluna opcional. Quem não tem título recebe um código reserva começando com **`S`**.
- **PESSOA é separada de CANDIDATURA.** É isso que permite a trajetória da Q10: a mesma pessoa aparece em várias eleições.
- **`candidatura.id_candidatura BIGINT`:**
  - de 2018 a 2024 é o `SQ_CANDIDATO` do TSE;
  - de 2002 a 2016 é `ano × 1.000.000.000 + sequência`, porque o SQ antigo se repete entre municípios.
- **`candidatura.sigla_partido VARCHAR(20)`** guarda o partido **da época** (PFL e DEM, PMDB e MDB etc.). Essa coluna foi adicionada via `ALTER TABLE`.
- **Colunas ampliadas:**
  - `candidatura.situacao_resultado` passou para `VARCHAR(100)`, `grau_instrucao` para `VARCHAR(80)` e `cargo` para `VARCHAR(60)`;
  - `pessoa.nome` passou para `VARCHAR(150)`;
  - `despesa.descricao` virou `TEXT`.
- **`despesa`:**
  - `id_despesa` é sintético (`ano × 1e9 + sequência`);
  - `sq_despesa` guarda o documento original, que se repete, porque um documento tem vários itens.
- **`municipio`:** tem `cod_ibge` (chave) e `cod_tse CHAR(5)`. A ponte entre eles veio de `municipio_tse_ibge.csv`.
- **`eleicao`:** `id_eleicao` é o próprio ano, e `tipo_eleicao` é GERAL ou MUNICIPAL.

## 4. O que está no banco (contagens validadas)

| Tabela | Linhas | Observação |
|---|---|---|
| municipio | 1.238 | 6 UFs |
| eleicao | 12 | 2002 a 2024, anos pares |
| partido | 39 | sigla mais recente por número |
| pessoa | 359.740 | chave é o título de eleitor |
| candidatura | 569.184 | 212.993 de 2018 a 2024 mais 356.191 de 2002 a 2016; 0 sem sigla |
| vaga | 7.512 | só de 2018 a 2024 |
| despesa | 2.099.197 | só de 2018 a 2024, despesas **contratadas** |

As demais tabelas existem mas estão **vazias**, porque pertencem às outras questões.

## 5. Arquivos-fonte usados

- **Q1:** `consulta_cand` (candidatos), `consulta_vagas` e as **despesas contratadas** da prestação de contas, de 2018, 2020, 2022 e 2024, além de `municipio_tse_ibge`.
- **Q10:** `consulta_cand` de 2002 a 2016, nas pastas `questao10\candidato2002` … `candidato2016`. São arquivos `.csv`/`.txt`, um por UF. A Q10 reaproveita 2018 a 2024 da Q1. Vagas e despesas **não** são usadas na Q10.

## 6. Tratamentos e problemas já resolvidos (não reabrir)

- **Formato TSE:** Latin-1, separador `;` e nulos marcados como `#NULO`, `#NE`, `-1`, `-3` ou `-4`. Usar só os arquivos por UF, nunca junto com o `_BRASIL`.
- **SG_UE:** traz a UF em eleições gerais e o código TSE do município (5 dígitos) em eleições municipais.
- **Eleições suplementares:** foram removidas. Nos anos antigos o filtro é pela **data** (até 28 dias após a 1ª votação, o que preserva o 2º turno). Fica a linha do último turno.
- **2004:** o `SQ_CANDIDATO` só é único **dentro do município**. A primeira carga colapsou milhares de candidatos, e a correção foi incluir `SG_UE` na chave.
- **Resultado "MÉDIA"** (2004 a 2010) foi padronizado para "ELEITO POR MÉDIA". Assim, `LIKE 'ELEITO%'` identifica todo vencedor.
- **Data de nascimento com ano 0046** derrubou o import. Datas fora de 1900 a 2010 viram vazio.
- **pgAdmin guardou a lista antiga de colunas** depois do `ALTER TABLE`. A solução foi importar numa tabela temporária e depois fazer `INSERT INTO candidatura SELECT * FROM tmp_candidatura`.
- **Comentários `--` colados no pgAdmin já deram erro.** Em SQL para o João, prefira `/* */` ou nenhum comentário.
- **Code Runner não passa argumentos** para o script. Os anos ficam definidos dentro do arquivo.

## 7. As respostas escolhidas para a apresentação

### Q1: "Quanto custou uma cadeira?"

Duas definições foram discutidas:

- **B (principal):** custo por cadeira = gasto total de campanha do cargo ÷ vagas em disputa.
- **A (complementar):** gasto médio e mediano de eleitos contra não eleitos.

**SQL principal: custo por ano, cargo e estado, sem vices**

```sql
WITH gasto AS (
  SELECT c.id_eleicao AS ano, UPPER(c.cargo) AS cargo, c.sg_uf AS uf,
         COUNT(DISTINCT c.id_candidatura) AS candidatos,
         SUM(COALESCE(d.valor, 0)) AS gasto_total
  FROM candidatura c
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao >= 2018
    AND UPPER(c.cargo) NOT LIKE 'VICE%'
  GROUP BY c.id_eleicao, UPPER(c.cargo), c.sg_uf),
vagas AS (
  SELECT v.id_eleicao AS ano, UPPER(v.cargo) AS cargo, COALESCE(v.sg_uf, m.uf) AS uf,
         SUM(v.qt_vaga) AS cadeiras
  FROM vaga v
  LEFT JOIN municipio m ON m.cod_ibge = v.cod_ibge
  WHERE v.id_eleicao >= 2018
    AND UPPER(v.cargo) NOT LIKE 'VICE%'
  GROUP BY v.id_eleicao, UPPER(v.cargo), COALESCE(v.sg_uf, m.uf))
SELECT g.ano, g.cargo, g.uf, g.candidatos, v.cadeiras,
       ROUND(g.gasto_total, 2) AS gasto_total,
       ROUND(g.gasto_total / NULLIF(v.cadeiras, 0), 2) AS custo_por_cadeira
FROM gasto g
JOIN vagas v ON v.ano = g.ano AND v.cargo = g.cargo AND v.uf = g.uf
ORDER BY g.cargo, g.ano, g.uf;
```

**SQL de um município (exemplo: Belém, vereador)**

```sql
SELECT e.ano, m.nome, m.uf,
       SUM(d.valor) AS gasto_total, v.cadeiras,
       ROUND(SUM(d.valor) / v.cadeiras, 2) AS custo_por_cadeira
FROM candidatura c
JOIN eleicao e   ON e.id_eleicao = c.id_eleicao
JOIN municipio m ON m.cod_ibge = c.cod_ibge
LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
JOIN (SELECT id_eleicao, cod_ibge, SUM(qt_vaga) AS cadeiras
      FROM vaga WHERE cargo = 'VEREADOR' GROUP BY 1, 2) v
  ON v.id_eleicao = c.id_eleicao AND v.cod_ibge = c.cod_ibge
WHERE c.cargo = 'VEREADOR' AND m.nome = 'Belém' AND m.uf = 'PA'
GROUP BY e.ano, m.nome, m.uf, v.cadeiras
ORDER BY e.ano;
```

**SQL de eleitos contra não eleitos**

Para mudar o filtro, troque `ano`, `cargo` e `uf` na 1ª linha. `NULL` em `uf` traz os 6 estados, e `'PA'` traz só o Pará.

```sql
WITH p AS (SELECT 2018 AS ano, 'DEPUTADO FEDERAL' AS cargo, NULL::text AS uf),
por_cand AS (
  SELECT c.id_candidatura,
         CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'Eleitos'
              WHEN c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE') THEN 'Não eleitos' END AS grupo,
         SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo AND (p.uf IS NULL OR c.sg_uf = p.uf)
  GROUP BY c.id_candidatura, c.situacao_resultado),
resumo AS (
  SELECT grupo, COUNT(*) AS candidatos, SUM(gasto) AS gasto_total, AVG(gasto) AS media,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY gasto) AS mediana
  FROM por_cand WHERE grupo IS NOT NULL GROUP BY grupo)
SELECT grupo, candidatos,
       ROUND(100.0 * candidatos / SUM(candidatos) OVER (), 1) AS pct_dos_candidatos,
       ROUND(gasto_total, 2) AS gasto_total,
       ROUND(100.0 * gasto_total / SUM(gasto_total) OVER (), 1) AS pct_do_gasto_total,
       ROUND(media, 2) AS media_por_candidato,
       ROUND(mediana::numeric, 2) AS mediana_por_candidato
FROM resumo ORDER BY grupo;
```

**Resultado real que o João obteve (deputado federal 2018, 6 UFs):**

| Grupo | Candidatos | Gasto total | Média | Mediana |
|---|---|---|---|---|
| Eleitos | 92 | R$ 97,4 mi | R$ 1.058.181 | R$ 965.545 |
| Não eleitos | 1.053 | R$ 110,5 mi | R$ 104.948 | R$ 9.874 |

O eleito gasta cerca de **10 vezes** mais pela média e cerca de **98 vezes** pela mediana. Os totais não são comparáveis, porque os grupos têm tamanhos muito diferentes.

**Critérios** (o João perguntou, então explique de novo se ele pedir):

- "Não eleitos" inclui NÃO ELEITO e **SUPLENTE**.
- Candidato **sem despesa conta como R$ 0** (`LEFT JOIN` com `COALESCE`). Isso derruba a mediana dos perdedores.
- A interface tem caixas para tirar suplentes e tirar quem gastou R$ 0.

### Q10: "Sobrevivência da carreira de um político"

O enunciado pede, dado um político, a linha do tempo de participações, vitórias, derrotas e reeleições. A busca é **pelo nome**.

**SQL que o João vai usar: histórico completo por nome**

```sql
SELECT p.nome, p.data_nascimento,
       c.id_eleicao AS ano, c.cargo,
       COALESCE(m.nome, c.sg_uf) AS local,
       c.sigla_partido AS partido,
       CASE WHEN c.situacao_resultado LIKE 'ELEITO%' THEN 'GANHOU'
            WHEN c.situacao_resultado = 'NÃO ELEITO' THEN 'PERDEU'
            WHEN c.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
            ELSE 'OUTRO' END AS resultado,
       c.situacao_resultado AS detalhe_resultado
FROM pessoa p
JOIN candidatura c ON c.titulo_eleitor = p.titulo_eleitor
LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
WHERE p.nome ILIKE '%JÉSSICA LULA LIMA MAGNO%'
ORDER BY p.nome, p.data_nascimento, c.id_eleicao;
```

A versão mais completa, que marca **REELEIÇÃO** e **troca de partido/cargo** via `LAG`, está no arquivo `q10_v2.sql`. Ali, reeleição significa eleito para o mesmo cargo 4 anos depois de um mandato, ou 8 anos no caso de senador.

**Limitações da Q10** (citar na apresentação):

- **Presidente não aparece.** Fica no arquivo nacional, fora do escopo, por isso o Lula não aparece.
- Vices dos anos antigos vêm sem resultado.
- Siglas que só mudaram de nome contam como troca de partido.
- Pessoas sem título (código `S`) não são ligadas a outras eleições.

## 8. Arquivos entregues (estão no .zip junto deste documento)

| Arquivo | Para quê |
|---|---|
| `app_apresentacao.py` | **Interface Streamlit da apresentação.** A Q1 tem a parte de cadeiras/custo (estado e município) e a de eleitos x não eleitos; a Q10 tem o histórico por nome. Rodar com `pip install streamlit psycopg2-binary pandas plotly` e `streamlit run app_apresentacao.py`. Há opção de mostrar o SQL de cada tela. |
| `app_eleicoes.py` | Interface anterior, mais completa (coorte etc.). |
| `consultas_q1_q10.sql` | 22 variações de SQL (10 da Q1 e 12 da Q10), todas testadas. |
| `consultas_sql_q1_q10.docx` | As mesmas 22 em Word, com título e explicação de cada uma. |
| `q1_final.sql`, `q10_final.sql`, `q10_v2.sql` | Versões finais escolhidas. O `q1_final.sql` ainda está **sem** o filtro de vices; use o SQL da seção 7. |
| `resumo_da_carga.docx` | Resumo para o professor: o que foi carregado, tratamentos, problemas e soluções, validações e limitações. |
| `carga_questao1.py`, `carga_questao1_v2.py` | Scripts de carga da Q1. |
| `carga_q10.py` | Script de carga da Q10. Gera CSVs em `questao10\saida_carga_q10`. |
| `der_eleicoes.sql`, `der_eleicoes_pgadmin.sql` | DDL. A versão pgAdmin é sem comentários. **Não** inclui o `ALTER` da `sigla_partido` nem os aumentos de VARCHAR da Q10 (ver seção 3). |

O DER interativo publicado como artifact estava na conta antiga. O dossiê Word original e o DER em Mermaid **não estão mais em disco** e precisam ser refeitos ou atualizados.

## 9. Pendências e próximos passos

1. **Testar `app_apresentacao.py` no banco real** e conferir se a Q1 de deputado federal 2018 dá **92 contra 1.053**.
2. **Recuperar pelo CPF quem não tem título** (opcional). O João sugeriu a ideia. Primeiro medir com:
   ```sql
   SELECT COUNT(*) AS recuperaveis
   FROM pessoa s
   JOIN pessoa r ON r.cpf = s.cpf AND r.titulo_eleitor NOT LIKE 'S%'
   WHERE s.titulo_eleitor LIKE 'S%' AND s.cpf IS NOT NULL;
   ```
   Se der um número razoável, escrever o `UPDATE` que repõe o título certo em `candidatura` e apaga a pessoa duplicada. Isso não ajuda de 2018 em diante, porque lá o CPF está oculto.
3. **Atualizar o dossiê e o DER** com o título de eleitor como chave da `PESSOA` (CPF opcional), `sigla_partido` em `CANDIDATURA`, `sq_despesa`, `cod_tse CHAR(5)` e os novos tamanhos de VARCHAR.
4. **Cargas das outras questões:** receitas (`receitas_candidatos`), bens, votação, eleitorado e indicadores municipais (IDHM). Seguir o mesmo padrão: script gera CSV, script de amostra/validação, import no pgAdmin na ordem das dependências, conferência de contagens.

## 10. Como trabalhar com o João (o que funcionou)

- Ele roda tudo **no PC dele**, e o Claude não acessa o banco. O fluxo é: o Claude escreve o script ou SQL, o João roda e cola a saída ou um print, e o Claude analisa.
- **Antes de importar qualquer carga, peça a saída do script** e confira contagens, colisões e vazios. Erros reais foram pegos assim (o caso de 2004).
- Dê **passos numerados e curtos** ("no Query Tool, cole isto e aperte F5").
- Explique o porquê de cada número quando ele perguntar. Ele vai apresentar e precisa defender os critérios.
- Ele gosta de ter **uma resposta principal** por pergunta e variações guardadas para o caso de o professor pedir.
