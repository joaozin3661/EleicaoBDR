# -*- coding: utf-8 -*-
"""
Interface de apresentação (banco eleicoes_v2): Questão 1 (custo de uma cadeira) e Questão 10 (trajetória).
Toda regra de negócio está nas views do banco (views_v2.sql); o app só filtra e desenha.

Instalar (uma vez):   pip install streamlit psycopg2-binary pandas plotly
Rodar:                streamlit run app_v2.py
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
    dbname = st.text_input("Banco", os.getenv("PGDATABASE", "eleicoes_v2"))
    user = st.text_input("Usuário", os.getenv("PGUSER", "postgres"))
    senha = st.text_input("Senha", os.getenv("PGPASSWORD", ""), type="password")
    st.caption("Escopo: AL, PA, PB, PR, SC e SE (1.238 municípios), eleições de 2002 a 2024.")
    mostrar_sql = st.checkbox("Mostrar o SQL de cada consulta", value=True)


@st.cache_resource(show_spinner=False)
def conectar(host, port, dbname, user, senha):
    con = psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=senha)
    con.autocommit = True
    return con


def consulta(sql, params=None):
    """Executa e, se pedido, mostra o SQL com os valores já preenchidos (como o banco recebeu)."""
    for tentativa in range(2):
        try:
            con = conectar(host, port, dbname, user, senha)
            with con.cursor() as cur:
                if mostrar_sql:
                    with st.expander("Ver o SQL desta consulta"):
                        st.code(cur.mogrify(sql, params).decode("utf-8").strip(), language="sql")
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


def numerico(df, cols):
    for c in cols:
        df[c] = pd.to_numeric(df[c])
    return df


try:
    conectar(host, port, dbname, user, senha)
except Exception as e:  # noqa
    st.title("Eleições")
    st.error(f"Não consegui conectar ao PostgreSQL: {e}")
    st.info("Confira servidor, porta, banco, usuário e senha na barra lateral.")
    st.stop()

st.title("Eleições: custo de uma cadeira e trajetória de um político")
aba_q1, aba_q10 = st.tabs(["Questão 1 · Custo de uma cadeira", "Questão 10 · Trajetória do político"])

VERDE, VERMELHO, AMARELO, CINZA = "#2e9e5b", "#d64545", "#e0a030", "#9a9a9a"

# ============================================================================
# QUESTÃO 1
# ============================================================================
with aba_q1:
    parte = st.radio("O que mostrar", ["Custo por cadeira", "Eleitos x não eleitos"], horizontal=True)

    if parte == "Custo por cadeira":
        st.subheader("Quanto custou uma cadeira?")
        st.caption("Custo por cadeira = gasto total de campanha do cargo ÷ vagas em disputa "
                   "(despesas contratadas; quem não declarou despesa conta como R$ 0; vices ficam de fora).")
        modo = st.radio("Nível", ["Estado", "Município"], horizontal=True)

        if modo == "Estado":
            df = consulta("SELECT * FROM mv_q1_custo_cadeira ORDER BY cargo, ano, uf")
            numerico(df, ["candidatos", "cadeiras", "gasto_total", "custo_por_cadeira"])
            a, b, c = st.columns(3)
            cargo = a.selectbox("Cargo", sorted(df.cargo.unique()),
                                index=sorted(df.cargo.unique()).index("DEPUTADO FEDERAL"))
            f0 = df[df.cargo == cargo]
            anos = b.multiselect("Ano", sorted(f0.ano.unique()), default=sorted(f0.ano.unique()))
            ufs = c.multiselect("Estado", sorted(f0.uf.unique()), default=sorted(f0.uf.unique()))
            f = f0[f0.ano.isin(anos) & f0.uf.isin(ufs)]
            if f.empty:
                st.info("Nada para essa seleção.")
            else:
                tot_g, tot_v = f.gasto_total.sum(), f.cadeiras.sum()
                m1, m2, m3, m4 = st.columns(4)
                m1.metric("Candidatos", num(f.candidatos.sum()))
                m2.metric("Cadeiras", num(tot_v))
                m3.metric("Gasto total", brl(tot_g))
                m4.metric("Custo médio por cadeira", brl(tot_g / tot_v if tot_v else None))
                fig = px.bar(f.assign(ano=f.ano.astype(str)), x="uf", y="custo_por_cadeira", color="ano",
                             barmode="group",
                             labels={"uf": "Estado", "custo_por_cadeira": "R$ por cadeira", "ano": "Eleição"})
                fig.update_layout(height=380)
                st.plotly_chart(fig, width="stretch")
                st.dataframe(f.rename(columns={
                    "ano": "Ano", "cargo": "Cargo", "uf": "UF", "candidatos": "Candidatos", "cadeiras": "Cadeiras",
                    "gasto_total": "Gasto total (R$)", "custo_por_cadeira": "Custo por cadeira (R$)"}),
                    width="stretch", hide_index=True)
        else:
            a, b = st.columns(2)
            nome_mun = a.text_input("Município (parte do nome, com ou sem acento)", "belem")
            cargo_mun = b.selectbox("Cargo", ["VEREADOR", "PREFEITO"])
            if len(nome_mun.strip()) >= 3:
                dfm = consulta("SELECT ano, municipio, uf, candidatos, cadeiras, gasto_total, custo_por_cadeira "
                               "FROM mv_q1_custo_municipio "
                               "WHERE cargo = %s AND municipio_busca LIKE '%%' || UPPER(unaccent(%s)) || '%%' "
                               "ORDER BY municipio, uf, ano",
                               (cargo_mun, nome_mun.strip()))
                if dfm.empty:
                    st.warning("Nenhum município encontrado.")
                else:
                    numerico(dfm, ["custo_por_cadeira", "gasto_total"])
                    dfm["local"] = dfm.municipio + " / " + dfm.uf
                    fig = px.bar(dfm.assign(ano=dfm.ano.astype(str)), x="ano", y="custo_por_cadeira",
                                 color="local", barmode="group",
                                 labels={"custo_por_cadeira": "R$ por cadeira", "ano": "Eleição", "local": ""})
                    fig.update_layout(height=360)
                    st.plotly_chart(fig, width="stretch")
                    st.dataframe(dfm.drop(columns="local"), width="stretch", hide_index=True)

    else:
        st.subheader("Quem ganhou gastou mais do que quem perdeu?")
        opc = consulta("SELECT DISTINCT ano, cargo FROM mv_q1_eleitos_vs_nao ORDER BY 1, 2")
        a, b, c = st.columns(3)
        ano = a.selectbox("Eleição", sorted(int(x) for x in opc.ano.unique()), key="ev_ano")
        cargos = opc[opc.ano == ano].cargo.tolist()
        cargo = b.selectbox("Cargo", cargos, index=cargos.index("DEPUTADO FEDERAL") if "DEPUTADO FEDERAL" in cargos else 0,
                            key="ev_cargo")
        uf = c.selectbox("Estado", ["TODAS", "AL", "PA", "PB", "PR", "SC", "SE"], key="ev_uf",
                         format_func=lambda u: "Todos (6 estados)" if u == "TODAS" else u)
        o1, o2 = st.columns(2)
        incl_sup = o1.checkbox("Contar suplentes como não eleitos", value=True)
        incl_zero = o2.checkbox("Incluir candidatos que gastaram R$ 0", value=True)
        perdedor = "NÃO ELEITO + SUPLENTE" if incl_sup else "NÃO ELEITO"

        ev = consulta("SELECT resultado, candidatos, gasto_total, media, mediana FROM mv_q1_eleitos_vs_nao "
                      "WHERE ano = %s AND cargo = %s AND uf = %s AND com_gasto_zero = %s "
                      "AND resultado IN ('ELEITO', %s)",
                      (ano, cargo, uf, incl_zero, perdedor))
        if len(ev) < 2:
            st.info("Não há eleitos e não eleitos suficientes nessa combinação.")
        else:
            numerico(ev, ["candidatos", "gasto_total", "media", "mediana"])
            ev["grupo"] = ev.resultado.map({"ELEITO": "Eleitos"}).fillna("Não eleitos")
            ev["pct_candidatos"] = 100 * ev.candidatos / ev.candidatos.sum()
            ev["pct_gasto"] = 100 * ev.gasto_total / ev.gasto_total.sum()
            e = ev[ev.grupo == "Eleitos"].iloc[0]
            n = ev[ev.grupo == "Não eleitos"].iloc[0]
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Eleitos x não eleitos", f"{num(e.candidatos)} x {num(n.candidatos)}")
            m2.metric("Parte do gasto total", f"{e.pct_gasto:.0f}% x {n.pct_gasto:.0f}%")
            m3.metric("Média: eleito gasta", f"{e.media / n.media:.1f}× mais" if n.media else "—")
            m4.metric("Mediana: eleito gasta", f"{e.mediana / n.mediana:.1f}× mais" if n.mediana else "—")

            cores = {"Eleitos": VERDE, "Não eleitos": VERMELHO}
            g1, g2 = st.columns(2)
            longo = ev.melt(id_vars="grupo", value_vars=["media", "mediana"])
            longo["variable"] = longo.variable.map({"media": "Média", "mediana": "Mediana"})
            fig = px.bar(longo, x="variable", y="value", color="grupo", barmode="group", log_y=True,
                         color_discrete_map=cores,
                         labels={"value": "R$ por candidato (escala log)", "variable": "", "grupo": ""})
            fig.update_layout(height=360, title="Gasto por candidato")
            g1.plotly_chart(fig, width="stretch")
            part = ev.melt(id_vars="grupo", value_vars=["pct_candidatos", "pct_gasto"])
            part["variable"] = part.variable.map({"pct_candidatos": "% dos candidatos", "pct_gasto": "% do gasto total"})
            fig2 = px.bar(part, x="variable", y="value", color="grupo", barmode="stack", color_discrete_map=cores,
                          labels={"value": "%", "variable": "", "grupo": ""})
            fig2.update_layout(height=360, title="Quem concentra o gasto")
            g2.plotly_chart(fig2, width="stretch")
            st.dataframe(ev[["grupo", "candidatos", "gasto_total", "media", "mediana"]].rename(columns={
                "grupo": "Grupo", "candidatos": "Candidatos", "gasto_total": "Gasto total (R$)",
                "media": "Média por candidato (R$)", "mediana": "Mediana por candidato (R$)"}),
                width="stretch", hide_index=True)
            st.caption("Eleitos = todo resultado que começa com ELEITO (QP e média incluídos). "
                       "Os totais enganam porque os grupos têm tamanhos muito diferentes: compare por candidato.")

# ============================================================================
# QUESTÃO 10
# ============================================================================
ORDEM_CARGOS = ["VEREADOR", "VICE-PREFEITO", "PREFEITO", "DEPUTADO ESTADUAL", "DEPUTADO FEDERAL",
                "1º SUPLENTE", "2º SUPLENTE", "1º SUPLENTE SENADOR", "2º SUPLENTE SENADOR",
                "VICE-GOVERNADOR", "SENADOR", "GOVERNADOR"]
COR = {"VITÓRIA": VERDE, "DERROTA": VERMELHO, "SUPLENTE": AMARELO}

with aba_q10:
    st.subheader("Histórico de candidaturas de um político")
    st.caption("Busque por qualquer parte do nome, com ou sem acento. Quem mudou de nome é achado pelo nome antigo também. "
               "Presidente não faz parte do escopo (só existe no arquivo nacional).")
    nome = st.text_input("Nome", placeholder="ex.: helder barbalho")
    if len(nome.strip()) >= 3:
        # dois passos: o índice acha os ids pelo nome; a view agrega só essas pessoas
        ids = consulta("SELECT DISTINCT id_pessoa FROM mv_q10_nomes "
                       "WHERE nome_busca LIKE '%%' || UPPER(unaccent(%s)) || '%%' LIMIT 500",
                       (nome.strip(),)).id_pessoa.tolist()
        achados = consulta("SELECT * FROM vw_q10_busca WHERE id_pessoa = ANY(%s) "
                           "ORDER BY candidaturas DESC, nome LIMIT 100", ([int(i) for i in ids],))
        if achados.empty:
            st.warning("Nenhuma pessoa encontrada. Tente outra parte do nome.")
        else:
            achados["rotulo"] = achados.apply(
                lambda r: f"{r.nome} · nasc. {r.data_nascimento or 's/ data'} · {r.candidaturas} candidatura(s) "
                          f"· {r.primeira} a {r.ultima}", axis=1)
            escolhido = st.selectbox(f"{len(achados)} pessoa(s) encontrada(s)", achados.rotulo)
            pessoa = achados[achados.rotulo == escolhido].iloc[0]
            pid = int(pessoa.id_pessoa)

            nomes = consulta("SELECT nome FROM mv_q10_nomes WHERE id_pessoa = %s ORDER BY nome", (pid,))
            if len(nomes) > 1:
                st.caption("Também concorreu como: " + "; ".join(n for n in nomes.nome if n != pessoa.nome))

            hist = consulta("SELECT ano, cargo, local, partido, resultado, evento, troca_partido, mudanca_cargo, "
                            "detalhe_resultado FROM vw_q10_carreira WHERE id_pessoa = %s ORDER BY ano", (pid,))
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Eleições disputadas", hist.ano.nunique())
            m2.metric("Vitórias", int((hist.resultado == "VITÓRIA").sum()))
            m3.metric("Reeleições", int((hist.evento == "REELEIÇÃO").sum()))
            m4.metric("Partidos", hist.partido.nunique())

            cargos = [c for c in ORDEM_CARGOS if c in set(hist.cargo)] + sorted(set(hist.cargo) - set(ORDEM_CARGOS))
            fig = px.scatter(hist, x="ano", y="cargo", color="resultado", text="partido",
                             color_discrete_map=COR, category_orders={"cargo": cargos},
                             hover_data={"local": True, "evento": True, "detalhe_resultado": True})
            fig.update_traces(marker=dict(size=20, line=dict(width=1, color="white")), textposition="top center")
            fig.update_xaxes(dtick=2, title="Ano da eleição")
            fig.update_yaxes(title=None)
            fig.update_layout(height=150 + 70 * len(cargos), legend_title_text="")
            st.plotly_chart(fig, width="stretch")

            def pinta(v):
                return {"VITÓRIA": "background-color: #d7f0e0; color: #14532d",
                        "DERROTA": "background-color: #fbdcdc; color: #7f1d1d",
                        "SUPLENTE": "background-color: #fdf0cf; color: #713f12"}.get(v, "")

            tabela = hist.drop(columns="detalhe_resultado").rename(columns={
                "ano": "Ano", "cargo": "Cargo", "local": "Local", "partido": "Partido", "resultado": "Resultado",
                "evento": "Evento", "troca_partido": "Troca de partido", "mudanca_cargo": "Mudança de cargo"})
            st.dataframe(tabela.style.map(pinta, subset=["Resultado"]), width="stretch", hide_index=True)
