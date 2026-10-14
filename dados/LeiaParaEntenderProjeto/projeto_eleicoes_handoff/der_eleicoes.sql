-- =====================================================================
-- DER das Eleições — Banco de Dados Relacional
-- TSE + IBGE + Atlas Brasil + Estudo Harvard (ideologia partidária)
-- DOI do estudo de ideologia: 10.7910/DVN/MFIXKW
-- =====================================================================

-- ===== NÚCLEO ELEITORAL =====

CREATE TABLE PESSOA (
    titulo_eleitor  VARCHAR(13)   PRIMARY KEY,  -- título de eleitor (12 díg.) ou S+SQ se ausente
    cpf             VARCHAR(11),                -- opcional: o TSE oculta em 2024
    nome            VARCHAR(100)  NOT NULL,
    data_nascimento DATE,
    sexo            VARCHAR(20),
    raca_cor        VARCHAR(30)
);

CREATE TABLE ELEICAO (
    id_eleicao   INT           PRIMARY KEY,
    ano          SMALLINT      NOT NULL,
    tipo_eleicao VARCHAR(40)
);

CREATE TABLE PARTIDO (
    numero_partido    SMALLINT      PRIMARY KEY,
    sigla             VARCHAR(15)   NOT NULL,
    nome              VARCHAR(100),
    espectro_politico VARCHAR(20)   -- Estudo Harvard (DOI 10.7910/DVN/MFIXKW)
);

CREATE TABLE MUNICIPIO (
    cod_ibge INT           PRIMARY KEY,
    cod_tse  CHAR(5),
    nome     VARCHAR(100),
    uf       CHAR(2),
    regiao   VARCHAR(15)
);

CREATE TABLE CANDIDATURA (
    id_candidatura     BIGINT        PRIMARY KEY,
    titulo_eleitor     VARCHAR(13)   NOT NULL,
    id_eleicao         INT           NOT NULL,
    numero_partido     SMALLINT      NOT NULL,
    cod_ibge           INT,
    sg_uf              CHAR(2),
    cargo              VARCHAR(30),
    abrangencia        VARCHAR(15),
    grau_instrucao     VARCHAR(40),
    ocupacao           VARCHAR(60),
    situacao_resultado VARCHAR(40),
    total_votos        INT,
    CONSTRAINT fk_candidatura_pessoa   FOREIGN KEY (titulo_eleitor) REFERENCES PESSOA(titulo_eleitor),
    CONSTRAINT fk_candidatura_eleicao  FOREIGN KEY (id_eleicao)     REFERENCES ELEICAO(id_eleicao),
    CONSTRAINT fk_candidatura_partido  FOREIGN KEY (numero_partido) REFERENCES PARTIDO(numero_partido),
    CONSTRAINT fk_candidatura_municipio FOREIGN KEY (cod_ibge)      REFERENCES MUNICIPIO(cod_ibge)
);

-- ===== FINANCIAMENTO E PATRIMÔNIO =====

CREATE TABLE BEM_DECLARADO (
    id_bem         BIGINT        PRIMARY KEY,
    id_candidatura BIGINT        NOT NULL,
    tipo_bem       VARCHAR(60),
    descricao      VARCHAR(255),
    valor          DECIMAL(15,2),
    CONSTRAINT fk_bem_candidatura FOREIGN KEY (id_candidatura) REFERENCES CANDIDATURA(id_candidatura)
);

CREATE TABLE RECEITA (
    id_receita     BIGINT        PRIMARY KEY,
    id_candidatura BIGINT        NOT NULL,
    origem_recurso VARCHAR(60),
    tipo_doador    VARCHAR(40),
    nome_doador    VARCHAR(120),
    valor          DECIMAL(15,2),
    data_receita   DATE,
    CONSTRAINT fk_receita_candidatura FOREIGN KEY (id_candidatura) REFERENCES CANDIDATURA(id_candidatura)
);

CREATE TABLE DESPESA (
    id_despesa      BIGINT        PRIMARY KEY,  -- id da linha (item); o do TSE não é único
    sq_despesa      BIGINT,                     -- SQ_DESPESA do TSE: 1 documento pode ter vários itens
    id_candidatura  BIGINT        NOT NULL,
    tipo_despesa    VARCHAR(80),
    descricao       VARCHAR(255),
    nome_fornecedor VARCHAR(120),
    valor           DECIMAL(15,2),
    data_despesa    DATE,
    CONSTRAINT fk_despesa_candidatura FOREIGN KEY (id_candidatura) REFERENCES CANDIDATURA(id_candidatura)
);

-- ===== VOTOS =====

CREATE TABLE VOTACAO (
    id_candidatura BIGINT     NOT NULL,
    cod_ibge       INT        NOT NULL,
    turno          SMALLINT   NOT NULL,
    votos_nominais INT,
    PRIMARY KEY (id_candidatura, cod_ibge, turno),
    CONSTRAINT fk_votacao_candidatura FOREIGN KEY (id_candidatura) REFERENCES CANDIDATURA(id_candidatura),
    CONSTRAINT fk_votacao_municipio   FOREIGN KEY (cod_ibge)       REFERENCES MUNICIPIO(cod_ibge)
);

CREATE TABLE VOTACAO_LEGENDA (
    numero_partido SMALLINT     NOT NULL,
    id_eleicao     INT          NOT NULL,
    cod_ibge       INT          NOT NULL,
    turno          SMALLINT     NOT NULL,
    cargo          VARCHAR(30)  NOT NULL,
    votos_legenda  INT,
    PRIMARY KEY (numero_partido, id_eleicao, cod_ibge, turno, cargo),
    CONSTRAINT fk_legenda_partido   FOREIGN KEY (numero_partido) REFERENCES PARTIDO(numero_partido),
    CONSTRAINT fk_legenda_eleicao   FOREIGN KEY (id_eleicao)     REFERENCES ELEICAO(id_eleicao),
    CONSTRAINT fk_legenda_municipio FOREIGN KEY (cod_ibge)       REFERENCES MUNICIPIO(cod_ibge)
);

-- ===== ELEITORADO E CONTEXTO =====

CREATE TABLE ELEITORADO (
    cod_ibge       INT          NOT NULL,
    id_eleicao     INT          NOT NULL,
    turno          SMALLINT     NOT NULL,
    faixa_etaria   VARCHAR(30)  NOT NULL,
    grau_instrucao VARCHAR(40)  NOT NULL,
    qtd_eleitores  INT,
    PRIMARY KEY (cod_ibge, id_eleicao, turno, faixa_etaria, grau_instrucao),
    CONSTRAINT fk_eleitorado_municipio FOREIGN KEY (cod_ibge)   REFERENCES MUNICIPIO(cod_ibge),
    CONSTRAINT fk_eleitorado_eleicao   FOREIGN KEY (id_eleicao) REFERENCES ELEICAO(id_eleicao)
);

CREATE TABLE TOTALIZACAO_MUNICIPIO (
    cod_ibge        INT          NOT NULL,
    id_eleicao      INT          NOT NULL,
    turno           SMALLINT     NOT NULL,
    cargo           VARCHAR(30)  NOT NULL,
    eleitores_aptos INT,
    comparecimento  INT,
    abstencoes      INT,
    votos_brancos   INT,
    votos_nulos     INT,
    PRIMARY KEY (cod_ibge, id_eleicao, turno, cargo),
    CONSTRAINT fk_totalizacao_municipio FOREIGN KEY (cod_ibge)   REFERENCES MUNICIPIO(cod_ibge),
    CONSTRAINT fk_totalizacao_eleicao   FOREIGN KEY (id_eleicao) REFERENCES ELEICAO(id_eleicao)
);

CREATE TABLE VAGA (
    id_vaga    INT           PRIMARY KEY,
    id_eleicao INT           NOT NULL,
    cod_ibge   INT,
    sg_uf      CHAR(2),
    cargo      VARCHAR(30),
    qt_vaga    INT,
    dt_posse   DATE,
    CONSTRAINT fk_vaga_eleicao   FOREIGN KEY (id_eleicao) REFERENCES ELEICAO(id_eleicao),
    CONSTRAINT fk_vaga_municipio FOREIGN KEY (cod_ibge)   REFERENCES MUNICIPIO(cod_ibge)
);

CREATE TABLE INDICADOR_MUNICIPAL (
    cod_ibge               INT          NOT NULL,
    ano                    SMALLINT     NOT NULL,
    pib                    DECIMAL(18,2),
    populacao              INT,
    pib_per_capita         DECIMAL(15,2),
    idade_mediana          DECIMAL(4,1),
    indice_envelhecimento  DECIMAL(6,2),
    idhm                   DECIMAL(4,3),
    PRIMARY KEY (cod_ibge, ano),
    CONSTRAINT fk_indicador_municipio FOREIGN KEY (cod_ibge) REFERENCES MUNICIPIO(cod_ibge)
);
