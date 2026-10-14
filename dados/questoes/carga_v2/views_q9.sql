/* Views da Q9 (banco eleicoes_v2). Arquivo separado porque a nuvem de palavras
   quebra 2 milhoes de descricoes e leva alguns minutos para ser criada.
   Rodar no pgAdmin depois do views_v2.sql. Depois de recarregar despesas, rode de novo. */

DROP MATERIALIZED VIEW IF EXISTS mv_q9_palavras CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_q9_categoria CASCADE;
DROP VIEW IF EXISTS vw_q9_despesa CASCADE;

/* ====================================================================
   Q9 - Onde o candidato investe em propaganda
   ==================================================================== */

/* Cada despesa com ano, cargo e UF da candidatura e o canal (grupo) da categoria do TSE.
   Quatro grupos sao propaganda; os outros dois sao custo de estrutura ou despesas sem relacao direta. */
CREATE VIEW vw_q9_despesa AS
WITH t AS (
  SELECT d.id_despesa, d.id_candidatura, d.tipo_despesa, d.descricao, d.valor,
         UPPER(unaccent(d.tipo_despesa)) AS tipo_n
  FROM despesa d)
SELECT t.id_despesa, t.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sg_uf AS uf,
       t.tipo_despesa, t.descricao, t.valor,
       CASE WHEN tipo_n LIKE 'PUBLICIDADE POR MATERIAIS IMPRESSOS%' OR tipo_n LIKE 'PUBLICIDADE POR ADESIVOS%'
              OR tipo_n LIKE 'PUBLICIDADE POR JORNAIS%' OR tipo_n LIKE 'CORRESPONDENCIAS%' THEN 'Impressos e adesivos'
            WHEN tipo_n LIKE 'PRODUCAO DE PROGRAMAS%' OR tipo_n LIKE 'PRODUCAO DE JINGLES%'
              OR tipo_n LIKE 'PUBLICIDADE POR CARROS DE SOM%' THEN 'Rádio, TV, vídeo e som'
            WHEN tipo_n LIKE '%IMPULSIONAMENTO%' OR tipo_n LIKE '%PAGINAS NA INTERNET%' THEN 'Internet'
            WHEN tipo_n LIKE 'ATIVIDADES DE MILITANCIA%' OR tipo_n LIKE 'COMICIOS%'
              OR tipo_n LIKE 'EVENTOS DE PROMOCAO%' THEN 'Militância, comícios e eventos'
            WHEN tipo_n LIKE 'DIVERSAS%' OR tipo_n LIKE 'DOACOES%' OR tipo_n LIKE 'ENCARGOS FINANCEIROS%'
              OR tipo_n LIKE 'MULTAS%' OR tipo_n LIKE 'IMPOSTOS%' OR tipo_n LIKE 'TAXA DE ADMINISTRACAO%'
              OR tipo_n LIKE 'REEMBOLSOS%' THEN 'Outras despesas'
            ELSE 'Estrutura da campanha' END AS grupo
FROM t
JOIN candidatura c ON c.id_candidatura = t.id_candidatura;

/* Gasto por categoria. cargo = 'TODOS' e uf = 'TODAS' somam tudo. */
CREATE MATERIALIZED VIEW mv_q9_categoria AS
SELECT ano, COALESCE(cargo, 'TODOS') AS cargo, COALESCE(uf, 'TODAS') AS uf, grupo,
       grupo NOT IN ('Estrutura da campanha', 'Outras despesas') AS propaganda,
       tipo_despesa,
       ROUND(SUM(valor), 2) AS valor,
       COUNT(*) AS despesas,
       COUNT(DISTINCT id_candidatura) AS candidatos
FROM vw_q9_despesa
GROUP BY GROUPING SETS ((ano, cargo, uf, grupo, tipo_despesa), (ano, cargo, grupo, tipo_despesa),
                        (ano, uf, grupo, tipo_despesa), (ano, grupo, tipo_despesa));
CREATE INDEX ix_mv_q9_cat ON mv_q9_categoria (cargo, uf, ano);

/* Nuvem de palavras: as 100 palavras mais citadas nas descricoes, por ano, cargo e UF.
   escopo = 'PROPAGANDA' usa so as despesas de propaganda; 'TODAS' usa todas.
   Uma palavra conta uma vez por despesa; valor = soma das despesas que a citam.
   Normalizacao: variantes e abreviacoes viram uma forma so (BOTTONS -> BOTON, ADES -> ADESIVO),
   plural vira singular (IMPRESSOES -> IMPRESSAO, PANFLETAGENS -> PANFLETAGEM, ADESIVOS -> ADESIVO), nomes proprios terminados
   em S ficam intactos (CARLOS, SANTOS) e palavras vazias saem (artigos, cargos, codigos de
   documento, tarifas bancarias, medidas). */
CREATE MATERIALIZED VIEW mv_q9_palavras AS
WITH vazias(p) AS (VALUES
  ('DE'),('DA'),('DO'),('DAS'),('DOS'),('PARA'),('COM'),('POR'),('NAS'),('NOS'),('NA'),('NO'),('EM'),('AO'),('AOS'),
  ('UMA'),('UM'),('QUE'),('SEM'),('OU'),('REF'),('REFERENTE'),('CONF'),('CONFORME'),('DOC'),('TED'),('TAR'),('NF'),('NFE'),
  ('NOTA'),('FISCAL'),('SERV'),('PREST'),('PRESTACAO'),('PRESTADO'),('SERVICO'),('DESPESA'),('DESP'),
  ('CAMPANHA'),('ELEITORAL'),('ELEITORAIS'),('ELEICAO'),('CANDIDATO'),('CANDIDATA'),('CANDIDATURA'),
  ('VEREADOR'),('VEREADORA'),('VEREADORES'),('PREFEITO'),('PREFEITA'),('PREF'),('VICE'),('DEPUTADO'),('DEPUTADA'),
  ('SENADOR'),('GOVERNADOR'),('POLITICO'),('POLITICA'),('TAM'),('TAMANHO'),('COR'),('CORES'),('DIA'),('DIAS'),
  ('PERIODO'),('VALOR'),('PAGAMENTO'),('PGTO'),('CONTRATO'),('ATIVIDADE'),('ATIVIDADES'),('ATIV'),
  ('MATERIAL'),('MATERIAIS'),('GERAIS'),('ORIGINAL'),('VER'),('CONT'),('TRANSF'),('DIVERSO'),('ETC'),
  ('UNID'),('QTD'),('MIL'),('COMUM'),('OUTRO'),('OUTRA'),('ATE'),('SOB'),('TIPO'),('MODELO'),('UNIDADE'),('UNIDADES'),('REAIS'),
  ('NFS'),('NFSE'),('DANFE'),('DACTE'),('CTE'),('CPF'),('CNPJ'),
  ('MED'),('MEDINDO'),('MEDIDA'),('FORMATO'),('CMX'),
  ('TARIFA'),('BANCARIA'),('ENCARGO'),('ELETRONICO'),('TAXA'),('CHEQUE'),('RECURSO'),('CONTA'),('TEDINTERNET'),
  ('DEBITADO'),('TEV'),('IBC'),('EXTRATO'),('INDV'),('IND'),('SPCE'),('TRANSFERENCIA'),('PIX'),('BANCARIO'),
  ('CONTR'),('PRES'),('PRESATCAO'),('CAMP'),('CAMAPANHA'),('DEP'),('DEPS'),('SEN'),('GOV'),('CAND'),('CANDID'),
  ('ELEIT'),('ELEI'),('VEREA'),('VEREAD'),('COMO'),('MAIS'),('SEUS'),('CADA'),('TODA')),
sinonimos(de, para) AS (VALUES
  ('BOTONS','BOTON'),('BOTTON','BOTON'),('BOTTONS','BOTON'),('JINGLES','JINGLE'),('FOLDERS','FOLDER'),
  ('RUAS','RUA'),('BANNERS','BANNER'),('CARTAZES','CARTAZ'),('FLYERS','FLYER'),('MILITANTES','MILITANTE'),
  ('ADES','ADESIVO'),('SANT','SANTINHO'),('PERF','PERFURADO'),('MOB','MOBILIZACAO'),('PROD','PRODUCAO'),
  ('COORD','COORDENACAO'),('IMP','IMPRESSAO'),('PANF','PANFLETO'),('PANFLET','PANFLETO'),
  ('DISTR','DISTRIBUICAO'),('DISTRIB','DISTRIBUICAO'),('MILIT','MILITANCIA'),('MILITAN','MILITANCIA'),
  ('ADESIV','ADESIVO'),('ADESI','ADESIVO'),('PERFUR','PERFURADO'),('MOBILIZ','MOBILIZACAO'),
  ('DIVULG','DIVULGACAO'),('DIVUL','DIVULGACAO'),('BOTOM','BOTON'),('PLANFETAGEM','PANFLETAGEM'),('PLANFETAGENS','PANFLETAGEM'),
  ('CONTABEIS','CONTABIL'),('JORNAIS','JORNAL'),('SOCIAIS','SOCIAL'),('PESSOAIS','PESSOAL'),
  ('COMERCIAIS','COMERCIAL'),('PROPORCIONAIS','PROPORCIONAL'),('PROMOCIONAIS','PROMOCIONAL'),
  ('PROMOTORES','PROMOTOR'),('REDES','REDE'),('LANCHES','LANCHE')),
nomes(n) AS (VALUES
  ('CARLOS'),('JARBAS'),('DANTAS'),('LUCAS'),('MARCOS'),('SANTOS'),('ALAGOAS'),('MATIAS'),('TOMAS'),('NICOLAS'),
  ('JONAS'),('ELIAS'),('MESSIAS'),('BARROS'),('CAMPOS'),('RAMOS'),('VASCONCELOS'),('MENOS'),('ATRAS'),('PATOS')),
token AS (
  SELECT d.id_despesa, d.ano, d.cargo, d.uf, d.grupo, d.valor, w
  FROM vw_q9_despesa d,
       regexp_split_to_table(UPPER(unaccent(d.descricao)), '[^A-Z]+') AS w
  WHERE d.descricao IS NOT NULL AND length(w) >= 3),
palavra AS (
  SELECT DISTINCT t.id_despesa, t.ano, t.cargo, t.uf, t.grupo, t.valor,
         COALESCE(s.para,
                  CASE WHEN t.w IN (SELECT n FROM nomes) THEN t.w
                       WHEN length(t.w) > 5 AND t.w LIKE '%OES' THEN left(t.w, -3) || 'AO'
                       WHEN length(t.w) > 5 AND t.w LIKE '%ENS' THEN left(t.w, -3) || 'EM'
                       WHEN length(t.w) > 4 AND t.w ~ '[AO]S$' THEN left(t.w, -1)
                       ELSE t.w END) AS palavra
  FROM token t
  LEFT JOIN sinonimos s ON s.de = t.w),
filtrada AS (
  SELECT p.* FROM palavra p WHERE p.palavra NOT IN (SELECT v.p FROM vazias v)),
escopo AS (
  SELECT 'TODAS' AS escopo, f.* FROM filtrada f
  UNION ALL
  SELECT 'PROPAGANDA', f.* FROM filtrada f
  WHERE f.grupo NOT IN ('Estrutura da campanha', 'Outras despesas')),
contagem AS (
  SELECT escopo, ano, COALESCE(cargo, 'TODOS') AS cargo, COALESCE(uf, 'TODAS') AS uf, palavra,
         COUNT(*) AS despesas, ROUND(SUM(valor), 2) AS valor
  FROM escopo
  GROUP BY GROUPING SETS ((escopo, ano, cargo, uf, palavra), (escopo, ano, cargo, palavra),
                          (escopo, ano, uf, palavra), (escopo, ano, palavra))),
ranq AS (
  SELECT c.*, ROW_NUMBER() OVER (PARTITION BY escopo, ano, cargo, uf ORDER BY despesas DESC, palavra) AS pos
  FROM contagem c)
SELECT escopo, ano, cargo, uf, palavra, despesas, valor, pos
FROM ranq
WHERE pos <= 100;
CREATE INDEX ix_mv_q9_pal ON mv_q9_palavras (escopo, ano, cargo, uf);
