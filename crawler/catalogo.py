"""Catálogo do que o crawler baixa: perguntas, escopos de tempo e arquivos.

É o único lugar a editar para incluir ou remover dados. Cada pergunta declara
os itens de que precisa e em quais anos; o crawler baixa a união disso e nada
além disso.
"""
from dataclasses import dataclass

EP = (2018, 2020, 2022, 2024)        # Escopo Padrão
ANOS_P4 = (2022, 2024)               # escopo da pergunta 4
PRIMEIRO_ANO_CANDIDATOS = 1994       # 1ª eleição com dados por candidato no TSE
ULTIMO_ANO_COM_RESULTADO = 2024      # 2026 só tem registro de candidaturas (eleição em outubro)
CARREIRA = "carreira"                # marcador: de 1994 até --carreira-ate, de 2 em 2 anos

PERGUNTAS = {
    1: "Quanto custa uma cadeira?",
    2: "Qual a taxa de sucesso eleitoral por patrimônio declarado?",
    3: "Índices do município (PIB per capita, IDHM, eleitores/população, isentos) x eleitos/partidos mais vitoriosos",
    4: "Escolaridade do candidato x escolaridade dos votantes",
    5: "Quantos candidatos de dado partido foram eleitos por votos de legenda?",
    6: "Idade média do município x alternância de poder e idade dos eleitos",
    7: "Viés político de um município/região na linha do tempo",
    8: "Sucesso de candidatos dependentes de repasses públicos x financiados por outras fontes",
    9: "Onde o candidato investe em propaganda (nuvem de palavras)?",
    10: "Sobrevivência da carreira de um político",
}


@dataclass(frozen=True)
class Item:
    chave: str                  # identificador; para o TSE é também o nome da pasta
    fonte: str                  # tse | ibge | ipea | dataverse
    descricao: str
    zip_cdn: str = ""           # (TSE) caminho do zip no CDN, com {ano} quando anual
    conjunto_ckan: str = ""     # (TSE) nome do conjunto no portal, usado se o CDN mudar
    membros: str | None = None  # (TSE) regex dos arquivos de dados a extrair; None = todos
    docs: str | None = None     # (TSE) regex dos PDFs de documentação; None = todos

    @property
    def anual(self) -> bool:
        return "{ano}" in self.zip_cdn


_PRESTACAO = "prestacao_contas/prestacao_de_contas_eleitorais_candidatos_{ano}.zip"

ITENS = {i.chave: i for i in (
    # ---- TSE -----------------------------------------------------------------
    Item("candidatos", "tse",
         "Candidaturas: cargo, partido, idade, escolaridade, situação final, reeleição, CPF/título",
         "consulta_cand/consulta_cand_{ano}.zip", "candidatos"),
    Item("bens_candidatos", "tse", "Bens declarados pelos candidatos (patrimônio)",
         "bem_candidato/bem_candidato_{ano}.zip", "candidatos"),
    Item("vagas", "tse", "Número de vagas (cadeiras) por cargo e unidade eleitoral",
         "consulta_vagas/consulta_vagas_{ano}.zip", "candidatos"),
    Item("votacao_candidato_munzona", "tse", "Votos de cada candidato por município e zona",
         "votacao_candidato_munzona/votacao_candidato_munzona_{ano}.zip", "resultados"),
    Item("votacao_partido_munzona", "tse", "Votos nominais e de legenda por partido, município e zona",
         "votacao_partido_munzona/votacao_partido_munzona_{ano}.zip", "resultados"),
    Item("detalhe_votacao_munzona", "tse",
         "Aptos, comparecimento, abstenções, brancos, nulos e válidos por município e zona",
         "detalhe_votacao_munzona/detalhe_votacao_munzona_{ano}.zip", "resultados"),
    Item("receitas_candidatos", "tse",
         "Receitas de campanha com fonte (FEFC, Fundo Partidário, outros) e doador originário",
         _PRESTACAO, "prestacao-de-contas-eleitorais",
         membros=r"^receitas_candidatos_", docs=r"^leiame_receitas"),
    Item("despesas_contratadas_candidatos", "tse",
         "Despesas contratadas: tipo, descrição livre, fornecedor e valor",
         _PRESTACAO, "prestacao-de-contas-eleitorais",
         membros=r"^despesas_contratadas_candidatos_", docs=r"^leiame_despesas-contratadas"),
    Item("comparecimento_abstencao", "tse",
         "Aptos, comparecimento e abstenção por município/zona, faixa etária e escolaridade",
         "perfil_comparecimento_abstencao/perfil_comparecimento_abstencao_{ano}.zip",
         "comparecimento-e-abstencao"),
    Item("municipio_tse_ibge", "tse", "Correspondência entre códigos de município do TSE e do IBGE",
         "municipio_tse_ibge/municipio_tse_ibge.zip",
         "codigos-oficiais-de-uf-e-municipios-segundo-o-tse-e-o-ibge"),
    # ---- IBGE ----------------------------------------------------------------
    Item("ibge_municipios", "ibge",
         "Municípios com UF, região, meso/microrregião e regiões imediata/intermediária"),
    Item("ibge_pib", "ibge", "PIB municipal a preços correntes (SIDRA 5938), para o PIB per capita"),
    Item("ibge_populacao_estimada", "ibge", "População residente estimada (SIDRA 6579)"),
    Item("ibge_censo2022_populacao", "ibge", "População residente do Censo 2022 (SIDRA 4709)"),
    Item("ibge_censo2022_idade", "ibge", "Idade mediana e índice de envelhecimento, Censo 2022 (SIDRA 9515)"),
    Item("ibge_censo2022_instrucao", "ibge", "Pessoas de 18+ anos por nível de instrução, Censo 2022 (SIDRA 10061)"),
    # ---- Atlas Brasil / PNUD (via Ipeadata) ------------------------------------
    Item("idhm", "ipea", "IDHM e subíndices (educação, longevidade, renda) por município"),
    # ---- Harvard Dataverse -----------------------------------------------------
    Item("ideologia_partidos", "dataverse",
         "Classificação ideológica dos partidos por especialistas (Bolognesi et al.)"),
)}

# Para cada pergunta: item -> anos (None = item sem ano). Os comentários dizem o uso.
NECESSIDADES = {
    1: {  # gasto de campanha dos eleitos / cadeiras em disputa
        "candidatos": EP,                         # quem foi eleito (DS_SIT_TOT_TURNO)
        "despesas_contratadas_candidatos": EP,    # quanto cada candidato gastou
        "vagas": EP,                              # quantas cadeiras havia
    },
    2: {  # patrimônio declarado x eleito/não eleito
        "candidatos": EP,
        "bens_candidatos": EP,                    # VR_BEM_CANDIDATO somado por SQ_CANDIDATO
    },
    3: {  # indicadores do município x quem venceu nele
        "candidatos": EP,
        "votacao_candidato_munzona": EP,          # mais votados no município (inclui cargos estaduais/federais)
        "votacao_partido_munzona": EP,            # partidos mais votados no município
        "detalhe_votacao_munzona": EP,            # aptos, abstenções, brancos e nulos ("isentos")
        "municipio_tse_ibge": None,               # liga o código TSE ao código IBGE
        "ibge_pib": None,
        "ibge_populacao_estimada": None,
        "ibge_censo2022_populacao": None,
        "idhm": None,
    },
    4: {  # escolaridade do candidato x do eleitorado que votou
        "candidatos": ANOS_P4,                    # DS_GRAU_INSTRUCAO + situação
        "comparecimento_abstencao": ANOS_P4,      # aptos/comparecimento por escolaridade, município e zona
        "votacao_candidato_munzona": ANOS_P4,     # em que zonas cada candidato teve votos
        "municipio_tse_ibge": None,
        "ibge_censo2022_instrucao": None,         # escolaridade da população (checagem do dado do TSE)
    },
    5: {  # eleitos "puxados" pela legenda / quociente partidário
        "candidatos": EP,                         # ELEITO POR QP / ELEITO POR MÉDIA
        "votacao_candidato_munzona": EP,          # votos nominais de cada eleito
        "votacao_partido_munzona": EP,            # votos de legenda do partido/federação
        "detalhe_votacao_munzona": EP,            # votos válidos -> quociente eleitoral
        "vagas": EP,
    },
    6: {  # perfil etário do município x alternância e idade dos eleitos
        "candidatos": EP,                         # idade na posse, partido do vencedor
        "comparecimento_abstencao": EP,           # eleitorado e comparecimento por faixa etária
        "votacao_candidato_munzona": EP,          # voto por zona x perfil etário da zona
        "municipio_tse_ibge": None,
        "ibge_censo2022_idade": None,             # idade mediana e índice de envelhecimento
    },
    7: {  # votos por partido ao longo do tempo, com escala ideológica
        "candidatos": EP,
        "votacao_partido_munzona": EP,
        "municipio_tse_ibge": None,
        "ibge_municipios": None,                  # agrega municípios em regiões
        "ideologia_partidos": None,
    },
    8: {  # peso do FEFC/Fundo Partidário na receita x sucesso
        "candidatos": EP,
        "receitas_candidatos": EP,                # DS_FONTE_RECEITA, DS_ORIGEM_RECEITA, doador originário
    },
    9: {  # nuvem de palavras das despesas
        "candidatos": EP,
        "despesas_contratadas_candidatos": EP,    # DS_ORIGEM_DESPESA, DS_DESPESA (texto livre), fornecedor
    },
    10: {  # trajetória: todas as eleições com dados por candidato
        "candidatos": CARREIRA,                   # CPF/título/nome ligam o político entre eleições
    },
}


def requisitos(pergunta: int, carreira_ate: int = ULTIMO_ANO_COM_RESULTADO) -> dict[str, tuple[int, ...] | None]:
    """Itens e anos de uma pergunta, com o marcador CARREIRA já expandido."""
    anos_carreira = tuple(range(PRIMEIRO_ANO_CANDIDATOS, carreira_ate + 1, 2))
    return {chave: anos_carreira if anos == CARREIRA else anos
            for chave, anos in NECESSIDADES[pergunta].items()}


def montar_plano(perguntas, fontes=None, anos=None,
                 carreira_ate: int = ULTIMO_ANO_COM_RESULTADO) -> dict[str, dict[int | None, set[int]]]:
    """União do que as perguntas pedem: item -> {ano (ou None): perguntas atendidas}."""
    plano: dict[str, dict[int | None, set[int]]] = {}
    for pergunta in perguntas:
        for chave, anos_item in requisitos(pergunta, carreira_ate).items():
            if fontes and ITENS[chave].fonte not in fontes:
                continue
            alvos = (None,) if anos_item is None else [a for a in anos_item if not anos or a in anos]
            for ano in alvos:
                plano.setdefault(chave, {}).setdefault(ano, set()).add(pergunta)
    return plano
