/* DER das Eleicoes - versao 2 (banco eleicoes_v2)
   Fontes: TSE, IBGE, Atlas Brasil e Estudo Harvard (DOI 10.7910/DVN/MFIXKW)
   Mudanca principal: PESSOA tem chave sintetica (id_pessoa). Titulo e CPF declarados
   em cada eleicao ficam na CANDIDATURA, como vieram do TSE. */

CREATE TABLE pessoa (
    id_pessoa        INT           PRIMARY KEY,
    titulo_eleitor   VARCHAR(12),
    cpf              VARCHAR(11),
    nome             VARCHAR(150)  NOT NULL,
    data_nascimento  DATE,
    sexo             VARCHAR(20),
    raca_cor         VARCHAR(30),
    uf_nascimento    CHAR(2),
    CONSTRAINT ck_pessoa_cpf    CHECK (cpf ~ '^[0-9]{11}$'),
    CONSTRAINT ck_pessoa_titulo CHECK (titulo_eleitor ~ '^[0-9]{12}$')
);

CREATE TABLE eleicao (
    id_eleicao   INT          PRIMARY KEY,
    ano          SMALLINT     NOT NULL UNIQUE,
    tipo_eleicao VARCHAR(40)  NOT NULL,
    CONSTRAINT ck_eleicao_tipo CHECK (tipo_eleicao IN ('GERAL', 'MUNICIPAL'))
);

CREATE TABLE partido (
    numero_partido    SMALLINT      PRIMARY KEY,
    sigla             VARCHAR(20)   NOT NULL,
    nome              VARCHAR(100),
    espectro_politico VARCHAR(20)
);

CREATE TABLE municipio (
    cod_ibge INT           PRIMARY KEY,
    cod_tse  CHAR(5)       NOT NULL UNIQUE,
    nome     VARCHAR(100)  NOT NULL,
    uf       CHAR(2)       NOT NULL,
    regiao   VARCHAR(15)
);

CREATE TABLE candidatura (
    id_candidatura       BIGINT        PRIMARY KEY,
    id_pessoa            INT           NOT NULL,
    id_eleicao           INT           NOT NULL,
    numero_partido       SMALLINT      NOT NULL,
    cod_ibge             INT,
    sg_uf                CHAR(2)       NOT NULL,
    cargo                VARCHAR(60)   NOT NULL,
    abrangencia          VARCHAR(15),
    numero_candidato     INT,
    nome_urna            VARCHAR(100),
    nome_declarado       VARCHAR(150),
    titulo_declarado     VARCHAR(13),
    cpf_declarado        VARCHAR(11),
    sigla_partido        VARCHAR(20)   NOT NULL,
    grau_instrucao       VARCHAR(80),
    ocupacao             VARCHAR(120),
    situacao_candidatura VARCHAR(20),
    detalhe_situacao     VARCHAR(80),
    situacao_resultado   VARCHAR(100),
    total_votos          INT,
    CONSTRAINT fk_candidatura_pessoa    FOREIGN KEY (id_pessoa)      REFERENCES pessoa(id_pessoa),
    CONSTRAINT fk_candidatura_eleicao   FOREIGN KEY (id_eleicao)     REFERENCES eleicao(id_eleicao),
    CONSTRAINT fk_candidatura_partido   FOREIGN KEY (numero_partido) REFERENCES partido(numero_partido),
    CONSTRAINT fk_candidatura_municipio FOREIGN KEY (cod_ibge)       REFERENCES municipio(cod_ibge),
    CONSTRAINT ck_candidatura_votos     CHECK (total_votos >= 0)
);

CREATE TABLE bem_declarado (
    id_bem         BIGINT        PRIMARY KEY,
    id_candidatura BIGINT        NOT NULL,
    tipo_bem       VARCHAR(150),
    descricao      TEXT,
    valor          DECIMAL(15,2),
    CONSTRAINT fk_bem_candidatura FOREIGN KEY (id_candidatura) REFERENCES candidatura(id_candidatura),
    CONSTRAINT ck_bem_valor CHECK (valor >= 0)
);

CREATE TABLE receita (
    id_receita     BIGINT        PRIMARY KEY,
    id_candidatura BIGINT        NOT NULL,
    origem_recurso VARCHAR(100),
    tipo_doador    VARCHAR(100),
    nome_doador    VARCHAR(250),
    valor          DECIMAL(15,2),
    data_receita   DATE,
    CONSTRAINT fk_receita_candidatura FOREIGN KEY (id_candidatura) REFERENCES candidatura(id_candidatura),
    CONSTRAINT ck_receita_valor CHECK (valor >= 0)
);

CREATE TABLE despesa (
    id_despesa      BIGINT        PRIMARY KEY,
    sq_despesa      BIGINT,
    id_candidatura  BIGINT        NOT NULL,
    tipo_despesa    VARCHAR(150),
    descricao       TEXT,
    nome_fornecedor VARCHAR(250),
    valor           DECIMAL(15,2),
    data_despesa    DATE,
    CONSTRAINT fk_despesa_candidatura FOREIGN KEY (id_candidatura) REFERENCES candidatura(id_candidatura),
    CONSTRAINT ck_despesa_valor CHECK (valor >= 0)
);

CREATE TABLE votacao (
    id_candidatura BIGINT     NOT NULL,
    cod_ibge       INT        NOT NULL,
    turno          SMALLINT   NOT NULL,
    votos_nominais INT,
    PRIMARY KEY (id_candidatura, cod_ibge, turno),
    CONSTRAINT fk_votacao_candidatura FOREIGN KEY (id_candidatura) REFERENCES candidatura(id_candidatura),
    CONSTRAINT fk_votacao_municipio   FOREIGN KEY (cod_ibge)       REFERENCES municipio(cod_ibge),
    CONSTRAINT ck_votacao_turno CHECK (turno IN (1, 2)),
    CONSTRAINT ck_votacao_votos CHECK (votos_nominais >= 0)
);

CREATE TABLE votacao_legenda (
    numero_partido SMALLINT     NOT NULL,
    id_eleicao     INT          NOT NULL,
    cod_ibge       INT          NOT NULL,
    turno          SMALLINT     NOT NULL,
    cargo          VARCHAR(60)  NOT NULL,
    votos_legenda  INT,
    PRIMARY KEY (numero_partido, id_eleicao, cod_ibge, turno, cargo),
    CONSTRAINT fk_legenda_partido   FOREIGN KEY (numero_partido) REFERENCES partido(numero_partido),
    CONSTRAINT fk_legenda_eleicao   FOREIGN KEY (id_eleicao)     REFERENCES eleicao(id_eleicao),
    CONSTRAINT fk_legenda_municipio FOREIGN KEY (cod_ibge)       REFERENCES municipio(cod_ibge),
    CONSTRAINT ck_legenda_votos CHECK (votos_legenda >= 0)
);

CREATE TABLE eleitorado (
    cod_ibge       INT          NOT NULL,
    id_eleicao     INT          NOT NULL,
    turno          SMALLINT     NOT NULL,
    faixa_etaria   VARCHAR(40)  NOT NULL,
    grau_instrucao VARCHAR(80)  NOT NULL,
    qtd_eleitores  INT,
    PRIMARY KEY (cod_ibge, id_eleicao, turno, faixa_etaria, grau_instrucao),
    CONSTRAINT fk_eleitorado_municipio FOREIGN KEY (cod_ibge)   REFERENCES municipio(cod_ibge),
    CONSTRAINT fk_eleitorado_eleicao   FOREIGN KEY (id_eleicao) REFERENCES eleicao(id_eleicao),
    CONSTRAINT ck_eleitorado_qtd CHECK (qtd_eleitores >= 0)
);

CREATE TABLE totalizacao_municipio (
    cod_ibge        INT          NOT NULL,
    id_eleicao      INT          NOT NULL,
    turno           SMALLINT     NOT NULL,
    cargo           VARCHAR(60)  NOT NULL,
    eleitores_aptos INT,
    comparecimento  INT,
    abstencoes      INT,
    votos_brancos   INT,
    votos_nulos     INT,
    PRIMARY KEY (cod_ibge, id_eleicao, turno, cargo),
    CONSTRAINT fk_totalizacao_municipio FOREIGN KEY (cod_ibge)   REFERENCES municipio(cod_ibge),
    CONSTRAINT fk_totalizacao_eleicao   FOREIGN KEY (id_eleicao) REFERENCES eleicao(id_eleicao),
    CONSTRAINT ck_totalizacao_soma CHECK (eleitores_aptos = comparecimento + abstencoes),
    CONSTRAINT ck_totalizacao_valores CHECK (comparecimento >= 0 AND abstencoes >= 0
                                             AND votos_brancos >= 0 AND votos_nulos >= 0)
);

CREATE TABLE vaga (
    id_vaga    INT           PRIMARY KEY,
    id_eleicao INT           NOT NULL,
    cod_ibge   INT,
    sg_uf      CHAR(2)       NOT NULL,
    cargo      VARCHAR(60)   NOT NULL,
    qt_vaga    INT           NOT NULL,
    dt_posse   DATE,
    CONSTRAINT fk_vaga_eleicao   FOREIGN KEY (id_eleicao) REFERENCES eleicao(id_eleicao),
    CONSTRAINT fk_vaga_municipio FOREIGN KEY (cod_ibge)   REFERENCES municipio(cod_ibge),
    CONSTRAINT ck_vaga_qt CHECK (qt_vaga > 0)
);

CREATE TABLE indicador_municipal (
    cod_ibge               INT          NOT NULL,
    ano                    SMALLINT     NOT NULL,
    pib                    DECIMAL(18,2),
    populacao              INT,
    pib_per_capita         DECIMAL(15,2),
    idade_mediana          DECIMAL(4,1),
    indice_envelhecimento  DECIMAL(6,2),
    idhm                   DECIMAL(4,3),
    PRIMARY KEY (cod_ibge, ano),
    CONSTRAINT fk_indicador_municipio FOREIGN KEY (cod_ibge) REFERENCES municipio(cod_ibge),
    CONSTRAINT ck_indicador_valores CHECK (populacao >= 0 AND idhm BETWEEN 0 AND 1)
);

/* Indices nas chaves estrangeiras e nas buscas mais usadas
   (o PostgreSQL nao cria indice automatico em chave estrangeira) */
CREATE INDEX ix_candidatura_pessoa    ON candidatura (id_pessoa);
CREATE INDEX ix_candidatura_eleicao   ON candidatura (id_eleicao, cargo);
CREATE INDEX ix_candidatura_municipio ON candidatura (cod_ibge);
CREATE INDEX ix_candidatura_partido   ON candidatura (numero_partido);
CREATE INDEX ix_despesa_candidatura   ON despesa (id_candidatura);
CREATE INDEX ix_receita_candidatura   ON receita (id_candidatura);
CREATE INDEX ix_bem_candidatura       ON bem_declarado (id_candidatura);
CREATE INDEX ix_vaga_eleicao          ON vaga (id_eleicao, cargo);
CREATE INDEX ix_pessoa_titulo         ON pessoa (titulo_eleitor);
CREATE INDEX ix_pessoa_cpf            ON pessoa (cpf);

/* Busca por nome sem diferenciar acento e com ILIKE '%...%' rapido */
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE INDEX ix_pessoa_nome_trgm ON pessoa USING gin (nome gin_trgm_ops);
CREATE INDEX ix_candidatura_nome_trgm ON candidatura USING gin (nome_declarado gin_trgm_ops);
