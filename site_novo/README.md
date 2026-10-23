# Confirma (site de apresentação)

Quanto custa uma cadeira: eleições de 2002 a 2024 em seis estados.

Site estático, sem build. Lê as respostas gravadas em `dados/` (cópia de `site_eleicoes/estatico/dados`).

Para abrir localmente (precisa de servidor, porque o navegador baixa os JSON):

    cd site_novo
    python3 -m http.server 8000
    # abra http://localhost:8000

Páginas: `index.html` (o relatório) e `consultas.html` (as nove perguntas, com filtros, gráficos e o SQL das views).

Arquivos: `index.html` (conteúdo), `styles.css`, `app.js` (busca da cidade, carreiras, gráficos),
`assets/` (fotos de acervos abertos; créditos em `assets/credits.json` e no rodapé).
Quando os dados forem regravados no site_eleicoes, copie de novo `site_eleicoes/estatico/dados/*.json` para `dados/`.

`consultas.js` monta uma tela por pergunta; `hemiciclo.js` desenha o semicírculo de cadeiras (qualquer total,
partidos e cores: `Hemiciclo.desenha(el, { partidos: [{ nome, cadeiras, cor }], forma })`); `dados.js` lê os shards.

Dados gerados a partir do banco (rodam no WSL chamando o psql.exe do Windows; ver scripts/pg.sh):

    python3 scripts/exporta_cadeiras.py   # vw_site_cadeira  -> dados/site/cadeiras_*.json (hemiciclo, Q5)
    cd scripts && python3 exporta_mapa.py # vw_site_municipio -> dados/site/municipios.json e mapa_*.json (mapa, Q3/Q4/Q6)
    python3 scripts/exporta_fotos.py      # escolhe as fotos usadas (eleitos, prefeitos 2024, Q10, listas da Q5)
    cd scripts/miniaturas && npm install && node gera.js   # miniaturas WebP em fotos/<id_candidatura>.webp

As fotos originais ficam em dados/tse/fotos_candidatos (índice em indice.csv, fora do git); o site só usa as miniaturas.
As views do site estão em dados/questoes/carga_v2/views_site.sql. As malhas do IBGE ficam em scripts/cache_ibge/.
