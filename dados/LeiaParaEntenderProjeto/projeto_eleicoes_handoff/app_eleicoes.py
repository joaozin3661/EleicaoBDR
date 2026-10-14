# -*- coding: utf-8 -*-
"""
Interface do projeto Banco de Dados Eleitoral (AL, PA, PB, PR, SC, SE)

  Q10 - Sobrevivência da carreira de um político (linha do tempo, resumo, coorte)
  Q1  - Custo de uma cadeira (por estado/município) e vencedores x perdedores

Instalar (uma vez):   pip install streamlit psycopg2-binary pandas plotly
Rodar:                streamlit run app_eleicoes.py
"""
import os
import pandas as pd
import plotly.express as px
import psycopg2
import streamlit as st

st.set_page_config(page_title="Eleições · AL PA PB PR SC SE", page_icon="🗳️", layout="wide")

# ----------------------------------------------------------------------------
# Conexão
# ----------------------------------------------------------------------------
with st.sidebar:
    st.header("Banco de dados")
    host = st.text_input("Servidor", os.getenv("PGHOST", "localhost"))
    port = st.text_input("Porta", os.getenv("PGPORT", "5432"))
    dbname = st.text_input("Banco", os.getenv("PGDATABASE", "eleicoes"))
    user = st.text_input("Usuário", os.getenv("PGUSER", "postgres"))
    senha = st.text_input("Senha", os.getenv("PGPASSWORD", ""), type="password")
    st.caption("Escopo: Alagoas, Pará, Paraíba, Paraná, Santa Catarina e Sergipe (1.238 municípios).")


@st.cache_resource(show_spinner=False)
def conectar(host, port, dbname, user, senha):
    con = psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=senha)
    con.autocommit = True
    return con


def consulta(sql, params=None):
    """Executa SELECT e devolve DataFrame. Reabre a conexão se ela caiu."""
    for tentativa in range(2):
        try:
            con = conectar(host, port, dbname, user, senha)
            with con.cursor() as cur:
                cur.execute(sql, params)
                cols = [c[0] for c in cur.description]
                return pd.DataFrame(cur.fetchall(), columns=cols)
        except psycopg2.OperationalError:
            conectar.clear()
            if tentativa == 1:
                raise


def brl(x):
    if x is None or pd.isna(x):
        return "—"
    return "R$ " + f"{x:,.0f}".replace(",", ".")


try:
    consulta("SELECT 1")
except Exception as e:  # noqa
    st.title("🗳️ Eleições")
    st.error(f"Não consegui conectar ao PostgreSQL: {e}")
    st.info("Confira servidor, porta, banco, usuário e senha na barra lateral.")
    st.stop()

# ----------------------------------------------------------------------------
# Regras de negócio compartilhadas
# ----------------------------------------------------------------------------
ORDEM_CARGOS = ["VEREADOR", "VICE-PREFEITO", "PREFEITO", "DEPUTADO ESTADUAL", "DEPUTADO FEDERAL",
                "1º SUPLENTE SENADOR", "2º SUPLENTE SENADOR", "1º SUPLENTE", "2º SUPLENTE",
                "VICE-GOVERNADOR", "SENADOR", "GOVERNADOR"]
CORES = {"VITÓRIA": "#2e9e5b", "DERROTA": "#d64545", "SUPLENTE": "#e0a030",
         "REGISTRO NEGADO": "#7a7a7a", "RENÚNCIA/FALECIMENTO": "#7a7a7a", "SEM RESULTADO": "#b0b0b0"}


def classifica(res):
    r = (res or "").strip()
    if r.startswith("ELEITO"):
        return "VITÓRIA"
    if r == "NÃO ELEITO":
        return "DERROTA"
    if r == "SUPLENTE":
        return "SUPLENTE"
    if r.startswith("REGISTRO NEGADO") or r.startswith("INDEFERIDO"):
        return "REGISTRO NEGADO"
    if r.startswith("RENÚNCIA"):
        return "RENÚNCIA/FALECIMENTO"
    return "SEM RESULTADO"


def monta_carreira(df):
    """Acrescenta resultado, reeleição, troca de partido e de cargo (mesma regra do SQL da Q10)."""
    df = df.sort_values(["ano", "id_candidatura"]).reset_index(drop=True)
    df["resultado"] = df["situacao_resultado"].map(classifica)
    df["eleito"] = df["resultado"] == "VITÓRIA"
    mandatos = set(zip(df.loc[df.eleito, "cargo"], df.loc[df.eleito, "ano"]))
    passo = lambda cargo: 8 if cargo == "SENADOR" else 4
    df["tinha_mandato"] = [(c, a - passo(c)) in mandatos for c, a in zip(df.cargo, df.ano)]

    def evento(r):
        if r.eleito and r.tinha_mandato:
            return "REELEIÇÃO"
        if (not r.eleito) and r.tinha_mandato and r.resultado == "DERROTA":
            return "TENTOU REELEIÇÃO E PERDEU"
        if r.eleito:
            return "ELEITO (1º mandato neste cargo)"
        return ""

    df["evento"] = df.apply(evento, axis=1)
    ant_p, ant_c = df["sigla_partido"].shift(1), df["cargo"].shift(1)
    df["troca_partido"] = [f"de {a}" if pd.notna(a) and a != b else "" for a, b in zip(ant_p, df["sigla_partido"])]
    df["mudanca_cargo"] = [f"de {a}" if pd.notna(a) and a != b else "" for a, b in zip(ant_c, df["cargo"])]
    df["local"] = df["municipio"].fillna(df["sg_uf"])
    return df


tab_carreira, tab_coorte, tab_q1 = st.tabs(
    ["🧑‍💼 Q10 · Carreira de um político", "📉 Q10 · Sobrevivência da coorte", "💰 Q1 · Custo de uma cadeira"])

# ----------------------------------------------------------------------------
# Q10 - carreira
# ----------------------------------------------------------------------------
with tab_carreira:
    st.subheader("Como foi a sobrevivência da carreira deste político?")
    nome = st.text_input("Nome (como está no registro oficial, em qualquer parte)", placeholder="ex.: BARBALHO")
    if len(nome.strip()) >= 3:
        achados = consulta(
            """SELECT p.titulo_eleitor, p.nome, p.data_nascimento,
                      COUNT(*) AS candidaturas, MIN(c.id_eleicao) AS primeira, MAX(c.id_eleicao) AS ultima
               FROM pessoa p JOIN candidatura c ON c.titulo_eleitor = p.titulo_eleitor
               WHERE p.nome ILIKE %s
               GROUP BY p.titulo_eleitor, p.nome, p.data_nascimento
               ORDER BY candidaturas DESC, p.nome LIMIT 200""", (f"%{nome.strip()}%",))
        if achados.empty:
            st.warning("Nenhuma pessoa encontrada. Tente outra parte do nome (a busca não ignora acentos).")
        else:
            achados["rotulo"] = achados.apply(
                lambda r: f"{r.nome} · nasc. {r.data_nascimento or 's/ data'} · {r.candidaturas} candidatura(s) · {r.primeira}–{r.ultima}",
                axis=1)
            escolhido = st.selectbox(f"{len(achados)} pessoa(s) encontrada(s)", achados["rotulo"])
            linha = achados[achados["rotulo"] == escolhido].iloc[0]
            if str(linha.titulo_eleitor).startswith("S"):
                st.caption("⚠️ Esta pessoa não tem título de eleitor na base; só aparecem as candidaturas de uma eleição.")

            df = consulta(
                """SELECT c.id_candidatura, c.id_eleicao AS ano, c.cargo, c.sigla_partido, c.sg_uf,
                          m.nome AS municipio, c.situacao_resultado
                   FROM candidatura c LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
                   WHERE c.titulo_eleitor = %s""", (linha.titulo_eleitor,))
            df = monta_carreira(df)

            c1, c2, c3, c4, c5 = st.columns(5)
            c1.metric("Eleições disputadas", len(df))
            c2.metric("Vitórias", int(df.eleito.sum()))
            c3.metric("Derrotas", int((df.resultado == "DERROTA").sum()))
            c4.metric("Reeleições", int((df.evento == "REELEIÇÃO").sum()))
            c5.metric("Trocas de partido", int((df.troca_partido != "").sum()))
            st.caption(f"Carreira entre {df.ano.min()} e {df.ano.max()} · partidos: "
                       f"{', '.join(dict.fromkeys(df.sigla_partido.dropna()))}")

            cargos = [c for c in ORDEM_CARGOS if c in set(df.cargo)] + sorted(set(df.cargo) - set(ORDEM_CARGOS))
            fig = px.scatter(df, x="ano", y="cargo", color="resultado", text="sigla_partido",
                             color_discrete_map=CORES, category_orders={"cargo": cargos},
                             hover_data={"local": True, "evento": True, "situacao_resultado": True, "ano": True},
                             symbol=df["evento"].eq("REELEIÇÃO").map({True: "reeleição", False: "candidatura"}),
                             symbol_map={"reeleição": "diamond", "candidatura": "circle"})
            fig.update_traces(marker=dict(size=18, line=dict(width=1, color="white")), textposition="top center")
            fig.update_xaxes(dtick=2, title="Ano da eleição")
            fig.update_yaxes(title=None)
            fig.update_layout(height=140 + 70 * len(cargos), legend_title_text="")
            st.plotly_chart(fig, width="stretch")

            mostrar = df[["ano", "cargo", "sigla_partido", "local", "resultado", "evento", "troca_partido",
                          "mudanca_cargo"]].rename(columns={
                "ano": "Ano", "cargo": "Cargo", "sigla_partido": "Partido na época", "local": "Local",
                "resultado": "Resultado", "evento": "Evento", "troca_partido": "Trocou de partido",
                "mudanca_cargo": "Mudou de cargo"})
            st.dataframe(mostrar, width="stretch", hide_index=True)
            st.caption("Reeleição = eleito para o mesmo cargo 4 anos depois de um mandato (8 anos para senador). "
                       "Vice e suplentes de senador podem vir sem resultado nos anos antigos.")

# ----------------------------------------------------------------------------
# Q10 - coorte
# ----------------------------------------------------------------------------
with tab_coorte:
    st.subheader("Quem começou junto continua na política?")
    anos = consulta("SELECT DISTINCT id_eleicao AS ano FROM candidatura ORDER BY 1")["ano"].tolist()
    a, b, c = st.columns(3)
    ano_base = a.selectbox("Eleição inicial da coorte", anos, index=anos.index(2004) if 2004 in anos else 0)
    cargos_base = consulta("SELECT DISTINCT cargo FROM candidatura WHERE id_eleicao = %s ORDER BY 1", (ano_base,))["cargo"].tolist()
    cargo_base = b.selectbox("Cargo disputado nessa eleição", cargos_base,
                             index=cargos_base.index("VEREADOR") if "VEREADOR" in cargos_base else 0)
    quem = c.radio("Quem entra na coorte", ["Todos os candidatos", "Só os eleitos"], horizontal=True)
    filtro_eleito = "AND situacao_resultado LIKE 'ELEITO%%'" if quem == "Só os eleitos" else ""
    d = consulta(f"""
        WITH coorte AS (
          SELECT DISTINCT titulo_eleitor FROM candidatura
          WHERE id_eleicao = %s AND cargo = %s AND titulo_eleitor NOT LIKE 'S%%' {filtro_eleito}),
        part AS (
          SELECT c.id_eleicao AS ano, c.titulo_eleitor,
                 bool_or(c.situacao_resultado LIKE 'ELEITO%%') AS eleito
          FROM candidatura c JOIN coorte USING (titulo_eleitor)
          WHERE c.id_eleicao >= %s
          GROUP BY c.id_eleicao, c.titulo_eleitor)
        SELECT ano, COUNT(*) AS candidatos, COUNT(*) FILTER (WHERE eleito) AS eleitos,
               (SELECT COUNT(*) FROM coorte) AS tamanho
        FROM part GROUP BY ano ORDER BY ano""", (ano_base, cargo_base, ano_base))
    if d.empty:
        st.warning("Coorte vazia para essa combinação.")
    else:
        tam = int(d["tamanho"].iloc[0])
        d["% da coorte candidata"] = (100 * d["candidatos"] / tam).round(1)
        d["% da coorte eleita"] = (100 * d["eleitos"] / tam).round(1)
        st.caption(f"Coorte: {tam:,} pessoas".replace(",", ".") + f" (candidatos a {cargo_base.lower()} em {ano_base}, com título de eleitor identificado).")
        fig = px.bar(d, x="ano", y=["% da coorte candidata", "% da coorte eleita"], barmode="group",
                     color_discrete_sequence=["#5b8def", "#2e9e5b"])
        fig.update_layout(legend_title_text="", yaxis_title="% da coorte inicial", xaxis_title="Eleição", height=380)
        fig.update_xaxes(dtick=2)
        st.plotly_chart(fig, width="stretch")
        st.dataframe(d.rename(columns={"ano": "Eleição", "candidatos": "Ainda candidatos (qualquer cargo)",
                                       "eleitos": "Eleitos (qualquer cargo)"}).drop(columns="tamanho"),
                     width="stretch", hide_index=True)

# ----------------------------------------------------------------------------
# Q1 - custo da cadeira
# ----------------------------------------------------------------------------
with tab_q1:
    st.subheader("Quanto custou uma cadeira?")
    st.caption("Gastos de campanha contratados (despesas contratadas, não só pagas). Disponível para 2018, 2020, 2022 e 2024.")
    opcoes = consulta("""SELECT DISTINCT v.id_eleicao AS ano, UPPER(v.cargo) AS cargo
                         FROM vaga v WHERE v.id_eleicao >= 2018 ORDER BY 1, 2""")
    if opcoes.empty:
        st.warning("Sem dados de vagas carregados.")
    else:
        a, b, c = st.columns(3)
        ano_q1 = a.selectbox("Eleição", sorted(int(x) for x in opcoes.ano.unique()), key="q1ano")
        cargos_q1 = opcoes[opcoes.ano == ano_q1].cargo.tolist()
        cargo_q1 = b.selectbox("Cargo", cargos_q1, key="q1cargo")
        ufs = ["Todos"] + ["AL", "PA", "PB", "PR", "SC", "SE"]
        uf_q1 = c.selectbox("Estado", ufs, key="q1uf")
        uf_param = None if uf_q1 == "Todos" else uf_q1

        # ---- B: gasto total / cadeiras, por estado
        st.markdown("#### Custo por cadeira por estado")
        est = consulta("""
            WITH gasto AS (
              SELECT c.sg_uf AS uf, SUM(COALESCE(d.valor, 0)) AS gasto
              FROM candidatura c LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
              WHERE c.id_eleicao = %s AND UPPER(c.cargo) = %s GROUP BY c.sg_uf),
            vagas AS (
              SELECT COALESCE(v.sg_uf, m.uf) AS uf, SUM(v.qt_vaga) AS cadeiras
              FROM vaga v LEFT JOIN municipio m ON m.cod_ibge = v.cod_ibge
              WHERE v.id_eleicao = %s AND UPPER(v.cargo) = %s GROUP BY 1)
            SELECT g.uf, g.gasto, v.cadeiras, g.gasto / NULLIF(v.cadeiras, 0) AS custo_cadeira
            FROM gasto g JOIN vagas v ON v.uf = g.uf ORDER BY g.uf""", (ano_q1, cargo_q1, ano_q1, cargo_q1))
        if est.empty:
            st.info("Sem gastos ou vagas para essa combinação.")
        else:
            tot_g, tot_v = est.gasto.sum(), est.cadeiras.sum()
            m1, m2, m3 = st.columns(3)
            m1.metric("Gasto total", brl(tot_g))
            m2.metric("Cadeiras", f"{int(tot_v):,}".replace(",", "."))
            m3.metric("Custo por cadeira (6 estados)", brl(tot_g / tot_v if tot_v else None))
            fig = px.bar(est, x="uf", y="custo_cadeira", text=est["custo_cadeira"].map(brl),
                         color_discrete_sequence=["#5b8def"])
            fig.update_layout(height=340, yaxis_title="R$ por cadeira", xaxis_title=None)
            st.plotly_chart(fig, width="stretch")

        # ---- B municipal: ranking
        if cargo_q1 in ("VEREADOR", "PREFEITO"):
            st.markdown("#### Ranking de municípios")
            mun = consulta("""
                WITH gasto AS (
                  SELECT c.cod_ibge, SUM(COALESCE(d.valor, 0)) AS gasto
                  FROM candidatura c LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
                  WHERE c.id_eleicao = %s AND UPPER(c.cargo) = %s AND c.cod_ibge IS NOT NULL
                  GROUP BY c.cod_ibge),
                vagas AS (
                  SELECT cod_ibge, SUM(qt_vaga) AS cadeiras FROM vaga
                  WHERE id_eleicao = %s AND UPPER(cargo) = %s AND cod_ibge IS NOT NULL GROUP BY cod_ibge)
                SELECT m.nome AS municipio, m.uf, g.gasto, v.cadeiras,
                       g.gasto / NULLIF(v.cadeiras, 0) AS custo_cadeira
                FROM gasto g JOIN vagas v USING (cod_ibge) JOIN municipio m USING (cod_ibge)
                WHERE (%s::text IS NULL OR m.uf = %s)
                ORDER BY custo_cadeira DESC NULLS LAST""", (ano_q1, cargo_q1, ano_q1, cargo_q1, uf_param, uf_param))
            if not mun.empty:
                top = st.slider("Quantos municípios mostrar", 5, 50, 15)
                lado1, lado2 = st.columns(2)
                lado1.markdown("**Mais caros**")
                lado1.dataframe(mun.head(top).assign(gasto=lambda x: x.gasto.map(brl),
                                                      custo_cadeira=lambda x: x.custo_cadeira.map(brl)),
                                width="stretch", hide_index=True)
                lado2.markdown("**Mais baratos**")
                lado2.dataframe(mun.dropna(subset=["custo_cadeira"]).tail(top).iloc[::-1].assign(
                    gasto=lambda x: x.gasto.map(brl), custo_cadeira=lambda x: x.custo_cadeira.map(brl)),
                    width="stretch", hide_index=True)

        # ---- A: vencedores x perdedores
        st.markdown("#### Vencedores x perdedores: quanto cada um gastou")
        vp = consulta("""
            WITH por_cand AS (
              SELECT c.id_candidatura,
                     CASE WHEN c.situacao_resultado LIKE 'ELEITO%%' THEN 'Eleitos'
                          WHEN c.situacao_resultado IN ('NÃO ELEITO', 'SUPLENTE') THEN 'Não eleitos' END AS grupo,
                     SUM(COALESCE(d.valor, 0)) AS gasto
              FROM candidatura c LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
              WHERE c.id_eleicao = %s AND UPPER(c.cargo) = %s AND (%s::text IS NULL OR c.sg_uf = %s)
              GROUP BY c.id_candidatura, c.situacao_resultado)
            SELECT grupo, COUNT(*) AS candidatos, SUM(gasto) AS total,
                   AVG(gasto) AS media, percentile_cont(0.5) WITHIN GROUP (ORDER BY gasto) AS mediana
            FROM por_cand WHERE grupo IS NOT NULL GROUP BY grupo ORDER BY grupo""",
                      (ano_q1, cargo_q1, uf_param, uf_param))
        if len(vp) == 2:
            e = vp[vp.grupo == "Eleitos"].iloc[0]
            n = vp[vp.grupo == "Não eleitos"].iloc[0]
            m1, m2, m3 = st.columns(3)
            m1.metric("Média dos eleitos", brl(e.media), f"{e.media / n.media:.1f}× a dos não eleitos" if n.media else None)
            m2.metric("Mediana dos eleitos", brl(e.mediana))
            m3.metric("Mediana dos não eleitos", brl(n.mediana))
            fig = px.bar(vp.melt(id_vars="grupo", value_vars=["media", "mediana"]), x="grupo", y="value",
                         color="variable", barmode="group", color_discrete_sequence=["#5b8def", "#9bb8f5"])
            fig.update_layout(height=320, legend_title_text="", yaxis_title="R$ por candidato", xaxis_title=None)
            st.plotly_chart(fig, width="stretch")
            st.dataframe(vp.assign(total=vp.total.map(brl), media=vp.media.map(brl), mediana=vp.mediana.map(brl)),
                         width="stretch", hide_index=True)
            st.caption("Eleitos = qualquer resultado iniciado por ELEITO. Não eleitos = NÃO ELEITO e SUPLENTE. "
                       "Candidatos sem despesa declarada contam como R$ 0.")
        else:
            st.info("Não há eleitos e não eleitos suficientes nessa combinação.")
