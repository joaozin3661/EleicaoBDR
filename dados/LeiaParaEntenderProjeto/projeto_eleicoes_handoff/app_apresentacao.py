# -*- coding: utf-8 -*-
"""
Interface de apresentação: Questão 1 (custo de uma cadeira) e Questão 10 (trajetória do político)

Instalar (uma vez):   pip install streamlit psycopg2-binary pandas plotly
Rodar:                streamlit run app_apresentacao.py
"""
import os
import pandas as pd
import plotly.express as px
import psycopg2
import streamlit as st

st.set_page_config(page_title="Eleições · Q1 e Q10", layout="wide")

# ----------------------------------------------------------------------------
# Conexão (barra lateral)
# ----------------------------------------------------------------------------
with st.sidebar:
    st.header("Banco de dados")
    host = st.text_input("Servidor", os.getenv("PGHOST", "localhost"))
    port = st.text_input("Porta", os.getenv("PGPORT", "5432"))
    dbname = st.text_input("Banco", os.getenv("PGDATABASE", "eleicoes"))
    user = st.text_input("Usuário", os.getenv("PGUSER", "postgres"))
    senha = st.text_input("Senha", os.getenv("PGPASSWORD", ""), type="password")
    st.caption("Escopo: AL, PA, PB, PR, SC e SE (1.238 municípios).")
    mostrar_sql = st.checkbox("Mostrar o SQL de cada consulta", value=True)


@st.cache_resource(show_spinner=False)
def conectar(host, port, dbname, user, senha):
    con = psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=senha)
    con.autocommit = True
    return con


def consulta(sql, params=None):
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
    return "R$ " + f"{float(x):,.0f}".replace(",", ".")


def num(x):
    return f"{int(x):,}".replace(",", ".")


def ver_sql(sql, params=None):
    if mostrar_sql:
        with st.expander("Ver o SQL desta consulta"):
            st.code(sql.strip(), language="sql")
            if params:
                st.caption(f"Parâmetros: {params}")


try:
    consulta("SELECT 1")
except Exception as e:  # noqa
    st.title("Eleições")
    st.error(f"Não consegui conectar ao PostgreSQL: {e}")
    st.info("Confira servidor, porta, banco, usuário e senha na barra lateral.")
    st.stop()

st.title("Eleições: custo de uma cadeira e trajetória de um político")
aba_q1, aba_q10 = st.tabs(["Questão 1 · Custo de uma cadeira", "Questão 10 · Trajetória do político"])

# ============================================================================
# QUESTÃO 1
# ============================================================================
SQL_Q1_TOTAL = """
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
"""

SQL_Q1_MUNICIPIO = """
SELECT e.ano, m.nome AS municipio, m.uf,
       SUM(COALESCE(d.valor, 0))                        AS gasto_total,
       v.cadeiras,
       ROUND(SUM(COALESCE(d.valor, 0)) / v.cadeiras, 2) AS custo_por_cadeira
FROM candidatura c
JOIN eleicao e   ON e.id_eleicao = c.id_eleicao
JOIN municipio m ON m.cod_ibge = c.cod_ibge
LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
JOIN (SELECT id_eleicao, cod_ibge, SUM(qt_vaga) AS cadeiras
      FROM vaga WHERE cargo = %s GROUP BY 1, 2) v
  ON v.id_eleicao = c.id_eleicao AND v.cod_ibge = c.cod_ibge
WHERE c.cargo = %s AND m.nome ILIKE %s
GROUP BY e.ano, m.nome, m.uf, v.cadeiras
ORDER BY m.nome, m.uf, e.ano;
"""

with aba_q1:
    parte = st.radio("O que mostrar", ["Cadeiras e custo por cadeira", "Eleitos x não eleitos"], horizontal=True)

    # ------------------------------------------------------------------ custo por cadeira
    if parte == "Cadeiras e custo por cadeira":
        st.subheader("Quanto custou uma cadeira?")
        st.caption("Custo por cadeira = gasto total de campanha do cargo ÷ número de vagas em disputa (despesas contratadas). Vices ficam de fora.")
        modo = st.radio("Nível", ["Estado e cargo (todas as eleições)", "Um município"], horizontal=True)

        if modo.startswith("Estado"):
            df = consulta(SQL_Q1_TOTAL)
            ver_sql(SQL_Q1_TOTAL)
            if df.empty:
                st.warning("Sem dados de vagas e despesas carregados.")
            else:
                a, b, c = st.columns(3)
                anos = a.multiselect("Ano", sorted(df.ano.unique()), default=sorted(df.ano.unique()))
                cargos = b.multiselect("Cargo", sorted(df.cargo.unique()), default=sorted(df.cargo.unique()))
                ufs = c.multiselect("Estado", sorted(df.uf.unique()), default=sorted(df.uf.unique()))
                f = df[df.ano.isin(anos) & df.cargo.isin(cargos) & df.uf.isin(ufs)].copy()
                for col in ["gasto_total", "custo_por_cadeira", "cadeiras", "candidatos"]:
                    f[col] = pd.to_numeric(f[col])
                if f.empty:
                    st.info("Nada para essa seleção.")
                else:
                    tot_g, tot_v = f.gasto_total.sum(), f.cadeiras.sum()
                    m1, m2, m3, m4 = st.columns(4)
                    m1.metric("Candidatos", num(f.candidatos.sum()))
                    m2.metric("Cadeiras (vagas)", num(tot_v))
                    m3.metric("Gasto total", brl(tot_g))
                    m4.metric("Custo por cadeira", brl(tot_g / tot_v if tot_v else None))
                    f["rotulo"] = f.ano.astype(str) + " · " + f.cargo
                    fig = px.bar(f, x="uf", y="custo_por_cadeira", color="rotulo", barmode="group",
                                 labels={"uf": "Estado", "custo_por_cadeira": "R$ por cadeira", "rotulo": ""})
                    fig.update_layout(height=380)
                    st.plotly_chart(fig, width="stretch")
                    mostrar = f.drop(columns="rotulo").rename(columns={
                        "ano": "Ano", "cargo": "Cargo", "uf": "UF", "candidatos": "Candidatos", "cadeiras": "Cadeiras",
                        "gasto_total": "Gasto total (R$)", "custo_por_cadeira": "Custo por cadeira (R$)"})
                    st.dataframe(mostrar, width="stretch", hide_index=True)
        else:
            a, b = st.columns(2)
            nome_mun = a.text_input("Município (parte do nome)", "Belém")
            cargo_mun = b.selectbox("Cargo", ["VEREADOR", "PREFEITO"])
            if len(nome_mun.strip()) >= 3:
                params = (cargo_mun, cargo_mun, f"%{nome_mun.strip()}%")
                dfm = consulta(SQL_Q1_MUNICIPIO, params)
                ver_sql(SQL_Q1_MUNICIPIO, params)
                if dfm.empty:
                    st.warning("Nenhum município encontrado (a busca não ignora acentos).")
                else:
                    dfm["custo_por_cadeira"] = pd.to_numeric(dfm["custo_por_cadeira"])
                    dfm["local"] = dfm.municipio + " / " + dfm.uf
                    fig = px.bar(dfm, x="ano", y="custo_por_cadeira", color="local", barmode="group",
                                 labels={"custo_por_cadeira": "R$ por cadeira", "ano": "Eleição", "local": ""})
                    fig.update_xaxes(type="category")
                    fig.update_layout(height=360)
                    st.plotly_chart(fig, width="stretch")
                    st.dataframe(dfm.drop(columns="local"), width="stretch", hide_index=True)

    # ------------------------------------------------------------------ eleitos x não eleitos
    else:
        st.subheader("Quem ganhou gastou mais do que quem perdeu?")
        opc = consulta("SELECT DISTINCT id_eleicao AS ano, UPPER(cargo) AS cargo FROM vaga "
                       "WHERE id_eleicao >= 2018 AND UPPER(cargo) NOT LIKE 'VICE%' ORDER BY 1, 2")
        if opc.empty:
            st.warning("Sem dados de vagas carregados.")
        else:
            a, b, c = st.columns(3)
            ano = a.selectbox("Eleição", sorted(int(x) for x in opc.ano.unique()), key="ev_ano")
            cargos_ano = opc[opc.ano == ano].cargo.tolist()
            cargo = b.selectbox("Cargo", cargos_ano, key="ev_cargo")
            uf_sel = c.selectbox("Estado", ["Todos (6 estados)", "AL", "PA", "PB", "PR", "SC", "SE"], key="ev_uf")
            uf = None if uf_sel.startswith("Todos") else uf_sel
            o1, o2 = st.columns(2)
            incl_sup = o1.checkbox("Contar suplentes como não eleitos", value=True)
            incl_zero = o2.checkbox("Incluir candidatos que gastaram R$ 0", value=True)

            perdedores = ["NÃO ELEITO", "SUPLENTE"] if incl_sup else ["NÃO ELEITO"]
            having = "" if incl_zero else "HAVING SUM(COALESCE(d.valor, 0)) > 0"
            SQL_EV = f"""
WITH p AS (SELECT %s::int AS ano, %s::text AS cargo, %s::text AS uf),
por_cand AS (
  SELECT c.id_candidatura,
         CASE WHEN c.situacao_resultado LIKE 'ELEITO%%' THEN 'Eleitos'
              WHEN c.situacao_resultado = ANY(%s) THEN 'Não eleitos' END AS grupo,
         SUM(COALESCE(d.valor, 0)) AS gasto
  FROM candidatura c CROSS JOIN p
  LEFT JOIN despesa d ON d.id_candidatura = c.id_candidatura
  WHERE c.id_eleicao = p.ano AND UPPER(c.cargo) = p.cargo AND (p.uf IS NULL OR c.sg_uf = p.uf)
  GROUP BY c.id_candidatura, c.situacao_resultado
  {having}),
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
"""
            params = (ano, cargo, uf, perdedores)
            ev = consulta(SQL_EV, params)
            ver_sql(SQL_EV, params)
            if len(ev) < 2:
                st.info("Não há eleitos e não eleitos suficientes nessa combinação.")
            else:
                for col in ["candidatos", "pct_dos_candidatos", "gasto_total", "pct_do_gasto_total",
                            "media_por_candidato", "mediana_por_candidato"]:
                    ev[col] = pd.to_numeric(ev[col])
                e = ev[ev.grupo == "Eleitos"].iloc[0]
                n = ev[ev.grupo == "Não eleitos"].iloc[0]
                razao_media = e.media_por_candidato / n.media_por_candidato if n.media_por_candidato else None
                razao_med = e.mediana_por_candidato / n.mediana_por_candidato if n.mediana_por_candidato else None
                m1, m2, m3, m4 = st.columns(4)
                m1.metric("Eleitos x não eleitos", f"{num(e.candidatos)} x {num(n.candidatos)}")
                m2.metric("Gasto total", f"{e.pct_do_gasto_total:.0f}% x {n.pct_do_gasto_total:.0f}%",
                          help="Participação de cada grupo no gasto total")
                m3.metric("Média: eleito gasta", f"{razao_media:.1f}× mais" if razao_media else "—")
                m4.metric("Mediana: eleito gasta", f"{razao_med:.1f}× mais" if razao_med else "—")

                g1, g2 = st.columns(2)
                longo = ev.melt(id_vars="grupo", value_vars=["media_por_candidato", "mediana_por_candidato"])
                longo["medida"] = longo.variable.map({"media_por_candidato": "Média", "mediana_por_candidato": "Mediana"})
                fig = px.bar(longo, x="medida", y="value", color="grupo", barmode="group", log_y=True,
                             labels={"value": "R$ por candidato (escala log)", "medida": "", "grupo": ""},
                             color_discrete_map={"Eleitos": "#2e9e5b", "Não eleitos": "#d64545"})
                fig.update_layout(height=360, title="Gasto por candidato")
                g1.plotly_chart(fig, width="stretch")
                part = ev.melt(id_vars="grupo", value_vars=["pct_dos_candidatos", "pct_do_gasto_total"])
                part["medida"] = part.variable.map({"pct_dos_candidatos": "% dos candidatos", "pct_do_gasto_total": "% do gasto total"})
                fig2 = px.bar(part, x="medida", y="value", color="grupo", barmode="stack",
                              labels={"value": "%", "medida": "", "grupo": ""},
                              color_discrete_map={"Eleitos": "#2e9e5b", "Não eleitos": "#d64545"})
                fig2.update_layout(height=360, title="Quem concentra o gasto")
                g2.plotly_chart(fig2, width="stretch")

                st.dataframe(ev.rename(columns={
                    "grupo": "Grupo", "candidatos": "Candidatos", "pct_dos_candidatos": "% dos candidatos",
                    "gasto_total": "Gasto total (R$)", "pct_do_gasto_total": "% do gasto total",
                    "media_por_candidato": "Média por candidato (R$)", "mediana_por_candidato": "Mediana por candidato (R$)"}),
                    width="stretch", hide_index=True)
                st.caption("Eleitos = todo resultado que começa com ELEITO (QP e média incluídos). "
                           "Os totais isolados enganam porque os grupos têm tamanhos muito diferentes: compare por candidato.")

# ============================================================================
# QUESTÃO 10
# ============================================================================
SQL_Q10_BUSCA = """
SELECT p.titulo_eleitor, p.nome, p.data_nascimento,
       COUNT(*) AS candidaturas,
       MIN(c.id_eleicao) AS primeira, MAX(c.id_eleicao) AS ultima
FROM pessoa p
JOIN candidatura c ON c.titulo_eleitor = p.titulo_eleitor
WHERE p.nome ILIKE %s
GROUP BY p.titulo_eleitor, p.nome, p.data_nascimento
ORDER BY candidaturas DESC, p.nome
LIMIT 100;
"""

SQL_Q10_HISTORICO = """
SELECT c.id_eleicao AS ano,
       c.cargo,
       COALESCE(m.nome, c.sg_uf) AS local,
       c.sigla_partido AS partido,
       CASE WHEN c.situacao_resultado LIKE 'ELEITO%%' THEN 'GANHOU'
            WHEN c.situacao_resultado = 'NÃO ELEITO' THEN 'PERDEU'
            WHEN c.situacao_resultado = 'SUPLENTE' THEN 'SUPLENTE'
            ELSE 'OUTRO' END AS resultado,
       c.situacao_resultado AS detalhe_resultado
FROM candidatura c
LEFT JOIN municipio m ON m.cod_ibge = c.cod_ibge
WHERE c.titulo_eleitor = %s
ORDER BY c.id_eleicao, c.cargo;
"""

ORDEM_CARGOS = ["VEREADOR", "VICE-PREFEITO", "PREFEITO", "DEPUTADO ESTADUAL", "DEPUTADO FEDERAL",
                "1º SUPLENTE SENADOR", "2º SUPLENTE SENADOR", "1º SUPLENTE", "2º SUPLENTE",
                "VICE-GOVERNADOR", "SENADOR", "GOVERNADOR"]
COR = {"GANHOU": "#2e9e5b", "PERDEU": "#d64545", "SUPLENTE": "#e0a030", "OUTRO": "#9a9a9a"}

with aba_q10:
    st.subheader("Histórico de candidaturas de um político")
    st.caption("Busque pelo nome como está no registro do TSE (maiúsculas e acentos). A base cobre 2002 a 2024 nos 6 estados; presidente não faz parte do escopo.")
    nome = st.text_input("Nome (qualquer parte)", placeholder="ex.: HELDER BARBALHO")
    if len(nome.strip()) >= 3:
        params = (f"%{nome.strip()}%",)
        achados = consulta(SQL_Q10_BUSCA, params)
        ver_sql(SQL_Q10_BUSCA, params)
        if achados.empty:
            st.warning("Nenhuma pessoa encontrada. Tente outra parte do nome.")
        else:
            achados["rotulo"] = achados.apply(
                lambda r: f"{r.nome} · nasc. {r.data_nascimento or 's/ data'} · {r.candidaturas} candidatura(s) · {r.primeira} a {r.ultima}", axis=1)
            escolhido = st.selectbox(f"{len(achados)} pessoa(s) encontrada(s)", achados["rotulo"])
            pessoa = achados[achados["rotulo"] == escolhido].iloc[0]
            if str(pessoa.titulo_eleitor).startswith("S"):
                st.caption("Esta pessoa não tem título de eleitor na base, então só aparece uma eleição.")
            hist = consulta(SQL_Q10_HISTORICO, (pessoa.titulo_eleitor,))
            ver_sql(SQL_Q10_HISTORICO, (pessoa.titulo_eleitor,))

            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Eleições disputadas", len(hist))
            m2.metric("Vitórias", int((hist.resultado == "GANHOU").sum()))
            m3.metric("Derrotas", int((hist.resultado == "PERDEU").sum()))
            m4.metric("Cargos diferentes", hist.cargo.nunique())

            cargos = [c for c in ORDEM_CARGOS if c in set(hist.cargo)] + sorted(set(hist.cargo) - set(ORDEM_CARGOS))
            fig = px.scatter(hist, x="ano", y="cargo", color="resultado", text="partido",
                             color_discrete_map=COR, category_orders={"cargo": cargos},
                             hover_data={"local": True, "detalhe_resultado": True})
            fig.update_traces(marker=dict(size=20, line=dict(width=1, color="white")), textposition="top center")
            fig.update_xaxes(dtick=2, title="Ano da eleição")
            fig.update_yaxes(title=None)
            fig.update_layout(height=150 + 70 * len(cargos), legend_title_text="")
            st.plotly_chart(fig, width="stretch")

            def pinta(v):
                return {"GANHOU": "background-color: #d7f0e0; color: #14532d",
                        "PERDEU": "background-color: #fbdcdc; color: #7f1d1d",
                        "SUPLENTE": "background-color: #fdf0cf; color: #713f12"}.get(v, "")
            tabela = hist.rename(columns={"ano": "Ano", "cargo": "Cargo", "local": "Local", "partido": "Partido",
                                          "resultado": "Resultado", "detalhe_resultado": "Detalhe do resultado"})
            try:
                st.dataframe(tabela.style.map(pinta, subset=["Resultado"]), width="stretch", hide_index=True)
            except Exception:  # noqa
                st.dataframe(tabela, width="stretch", hide_index=True)
