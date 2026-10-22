# DER do banco eleicoes_v2

Diagrama entidade-relacionamento da versão 2 do banco, gerado a partir do DDL real (`dados/questoes/carga_v2/der_eleicoes_v2.sql`):
14 entidades. Imagem para o dossiê: [DER_v2.png](DER_v2.png) (ou [DER_v2.svg](DER_v2.svg), que amplia sem perder qualidade).
O código-fonte do diagrama é [DER_v2.mmd](DER_v2.mmd); o bloco abaixo é o mesmo e o GitHub o desenha sozinho.

![DER v2](DER_v2.png)

## O que mudou da v1 para a v2

| Mudança | Por quê |
|---|---|
| `PESSOA` ganhou a chave sintética `id_pessoa`; `titulo_eleitor` e `cpf` viraram atributos comuns | No TSE a mesma pessoa aparece com títulos diferentes e pessoas diferentes com o mesmo título. A identidade é resolvida na carga (CPF, nome + nascimento, título) |
| `CANDIDATURA` guarda `titulo_declarado`, `cpf_declarado` e `nome_declarado` como vieram do TSE, e ganhou `id_pessoa` como chave estrangeira | Preserva o dado original e permite revisar a resolução de identidade |
| `CANDIDATURA` ganhou `numero_candidato`, `nome_urna`, `sigla_partido` (sigla da época), `detalhe_situacao` e `situacao_candidatura` | A sigla muda entre eleições (renomeações e fusões); a situação separa registro deferido de indeferido |
| `PESSOA` ganhou `uf_nascimento` | Dado do cadastro de candidatos, útil para conferir identidade |
| `RECEITA` ganhou `sq_receita` e `natureza` (financeiro ou estimável) | O código do TSE se repete em várias linhas; a natureza separa doação em dinheiro de doação em bens e serviços |
| `DESPESA` ganhou `sq_despesa` | Mesmo motivo da receita |
| `VOTACAO` e `VOTACAO_LEGENDA` carregadas (2018 a 2024, eleições proporcionais) | Já existiam no modelo, mas sem carga; sustentam a Q5 e a parte 2 da Q4 |
| `CANDIDATURA.total_votos` preenchido | Soma dos votos nominais válidos do candidato |
| `TOTALIZACAO_MUNICIPIO`: soma aptos = comparecimento + abstenções tolera diferença de até 10 eleitores | O TSE publica 4 linhas de 2012 (ex.: Aracaju) com diferença de 1 ou 2 |

As entidades `ELEICAO`, `PARTIDO`, `MUNICIPIO`, `ELEITORADO`, `VAGA` e `INDICADOR_MUNICIPAL` seguem como na v1 (a `INDICADOR_MUNICIPAL` agora recebe IDHM, PIB e população de 2010 e a idade mediana de 2022). Todos os relacionamentos são um-para-muitos; `MUNICIPIO`
é opcional em `CANDIDATURA` e `VAGA` (deputados, governador, senador e presidente não pertencem a um município).

## Diagrama (Mermaid)

```mermaid
erDiagram
    PESSOA ||--o{ CANDIDATURA : "concorre em"
    ELEICAO ||--o{ CANDIDATURA : "abriga"
    PARTIDO ||--o{ CANDIDATURA : "lança"
    MUNICIPIO |o--o{ CANDIDATURA : "sedia"
    CANDIDATURA ||--o{ BEM_DECLARADO : "declara"
    CANDIDATURA ||--o{ RECEITA : "arrecada"
    CANDIDATURA ||--o{ DESPESA : "gasta"
    CANDIDATURA ||--o{ VOTACAO : "obtém"
    MUNICIPIO ||--o{ VOTACAO : "apura"
    PARTIDO ||--o{ VOTACAO_LEGENDA : "recebe"
    ELEICAO ||--o{ VOTACAO_LEGENDA : "contabiliza"
    MUNICIPIO ||--o{ VOTACAO_LEGENDA : "apura legenda"
    MUNICIPIO ||--o{ ELEITORADO : "possui"
    ELEICAO ||--o{ ELEITORADO : "registra"
    MUNICIPIO ||--o{ TOTALIZACAO_MUNICIPIO : "totaliza"
    ELEICAO ||--o{ TOTALIZACAO_MUNICIPIO : "apura totais"
    MUNICIPIO ||--o{ INDICADOR_MUNICIPAL : "tem"
    ELEICAO ||--o{ VAGA : "oferece"
    MUNICIPIO |o--o{ VAGA : "sedia vagas"

    PESSOA {
        int id_pessoa PK
        string titulo_eleitor
        string cpf
        string nome
        date data_nascimento
        string sexo
        string raca_cor
        string uf_nascimento
    }
    ELEICAO {
        int id_eleicao PK
        int ano
        string tipo_eleicao
    }
    PARTIDO {
        int numero_partido PK
        string sigla
        string nome
        string espectro_politico
    }
    MUNICIPIO {
        int cod_ibge PK
        string cod_tse
        string nome
        string uf
        string regiao
    }
    CANDIDATURA {
        bigint id_candidatura PK
        int id_pessoa FK
        int id_eleicao FK
        int numero_partido FK
        int cod_ibge FK
        string sg_uf
        string cargo
        string abrangencia
        int numero_candidato
        string nome_urna
        string nome_declarado
        string titulo_declarado
        string cpf_declarado
        string sigla_partido
        string grau_instrucao
        string ocupacao
        string situacao_candidatura
        string detalhe_situacao
        string situacao_resultado
        int total_votos
    }
    BEM_DECLARADO {
        bigint id_bem PK
        bigint id_candidatura FK
        string tipo_bem
        string descricao
        decimal valor
    }
    RECEITA {
        bigint id_receita PK
        bigint sq_receita
        bigint id_candidatura FK
        string origem_recurso
        string tipo_doador
        string natureza
        string nome_doador
        decimal valor
        date data_receita
    }
    DESPESA {
        bigint id_despesa PK
        bigint sq_despesa
        bigint id_candidatura FK
        string tipo_despesa
        string descricao
        string nome_fornecedor
        decimal valor
        date data_despesa
    }
    VOTACAO {
        bigint id_candidatura PK,FK
        int cod_ibge PK,FK
        int turno PK
        int votos_nominais
    }
    VOTACAO_LEGENDA {
        int numero_partido PK,FK
        int id_eleicao PK,FK
        int cod_ibge PK,FK
        int turno PK
        string cargo PK
        int votos_legenda
    }
    ELEITORADO {
        int cod_ibge PK,FK
        int id_eleicao PK,FK
        int turno PK
        string faixa_etaria PK
        string grau_instrucao PK
        int qtd_eleitores
    }
    TOTALIZACAO_MUNICIPIO {
        int cod_ibge PK,FK
        int id_eleicao PK,FK
        int turno PK
        string cargo PK
        int eleitores_aptos
        int comparecimento
        int abstencoes
        int votos_brancos
        int votos_nulos
    }
    VAGA {
        int id_vaga PK
        int id_eleicao FK
        int cod_ibge FK
        string sg_uf
        string cargo
        int qt_vaga
        date dt_posse
    }
    INDICADOR_MUNICIPAL {
        int cod_ibge PK,FK
        int ano PK
        decimal pib
        int populacao
        decimal pib_per_capita
        decimal idade_mediana
        decimal indice_envelhecimento
        decimal idhm
    }
```

## Como regerar a imagem

Edite `DER_v2.mmd` e cole o conteúdo em https://mermaid.live para exportar PNG ou SVG. Se mudar o DDL (`der_eleicoes_v2.sql`), atualize também este arquivo.
