# frontend (Confirma)

Quanto custa uma cadeira: eleições de 2002 a 2026 no Brasil inteiro (27 UFs). HTML, CSS e JS sem build.

- `index.html`: a história. Um capítulo por pergunta, sempre com o mesmo molde: abertura com um número,
  gráfico com passos de scroll e fecho com o botão que leva às consultas. Sem filtros.
- `sobre.html`: fontes, método, limitações e autores.
- `consultas.html`: as perguntas uma a uma, com filtros, gráficos e o SQL das views, mais as telas do banco
  (as 14 tabelas e a identidade dos políticos). As perguntas 3, 4 e 6 têm o mapa dos municípios; a 5 mostra
  quem ocupa cada cadeira. Abre na pergunta do botão (`consultas.html#q8`) e o "voltar à história" leva ao
  fecho do mesmo capítulo (`index.html#q8-fim`).

Como abrir (veja o README da raiz):

- **Com o banco:** `npm start` em `api/` e http://localhost:3001. As telas perguntam à API ao vivo.
- **Sem o banco:** `python -m http.server 8000` nesta pasta e http://localhost:8000. As telas leem as respostas
  gravadas em `dados/`. Precisa de um servidor porque o navegador não lê os JSON com o arquivo aberto em dois cliques.

## Arquivos

| Arquivo | O quê |
|---|---|
| `js/chave.js` | O nome do arquivo (shard) de cada resposta gravada. O gravador (`api/exportacao/grava.ts`) usa o mesmo arquivo. |
| `js/dados.js` | De onde vêm as respostas: da API, quando `dados/modo.json` servido pela API diz `aoVivo: true`, ou de `dados/<shard>.json`. |
| `js/app.js` | Revelações e o desenho do método na história. |
| `js/consultas.js` | Uma tela por pergunta: os filtros e como montar a tela a partir das respostas. |
| `js/mapa.js` | O mapa dos municípios das consultas: `Mapa.monta(el, { camada: "q3" \| "q4" \| "q6", uf })`, em três níveis (Brasil, estado, município; abre no Brasil), com o prefeito e a Câmara do município. |
| `js/vies.js` | Viés político (pergunta 7): as cinco faixas, as cores, a legenda, as barras que saem do zero e a régua dos partidos. |
| `js/relevo.js` | O mapa "em pé" das consultas: `Relevo.monta(el, { uf, itens, emPe, aoClicar })`, com cada área subindo conforme o valor e o botão Plano / Em pé. |
| `js/hemiciclo.js` | O semicírculo de cadeiras: `Hemiciclo.desenha(el, { partidos: [{ nome, cadeiras, cor }], forma })`. |
| `js/scrolly.js` | O motor do scroll com passos. |
| `js/encaixe.js` | O encaixe por telas ao rolar. Expõe `Encaixe.ir` e `Encaixe.yDe` para o trilho. |
| `js/trilho.js` | Os números das perguntas na borda direita, as teclas 1 a 9 (0 vale 10) e os endereços `#q8` e `#q8-fim`. |
| `js/trilha.js` | A trilha de uma carreira (pergunta 10): uma linha por cargo, um ponto por candidatura, ligados na ordem das eleições. `Trilha.desenha(box, carreira, { soTrocas })`. |
| `js/historias.js` | As três histórias com scroll: o preço da cadeira, o hemiciclo e o patrimônio. |
| `js/desenhe.js` | Os desenhos do leitor (`data-desenhe`): a escada do patrimônio (pergunta 2) e a linha das vereadoras eleitas (pergunta 5). |
| `css/` | `styles.css` (base e blocos), `tema.css` (a fonte e os fundos do site inteiro, carrega por último), `narrativa.css` (histórias, desenhe, fonte, telas), `historia.css` (molde dos capítulos e trilho), `consultas.css`, `vies.css` (Q7) e `sobre.css` (página Sobre). |
| `assets/` | Fotos de acervos abertos; créditos em `assets/credits.json` e no rodapé. |
| `dados/` | Gerado por `npm run grava` em `api/`: os shards, `q1_municipio_*.json`, `q10_indice.json` e `site/` (hemiciclo, mapa, carreiras, índices das fotos). |
| `dados/extra/*.json` | Dados que a API ainda não serve, tirados das views do banco por `python api/exportacao/exporta_extra.py` (rodar da raiz). |
| `fotos/` | Miniaturas `<id_candidatura>.webp`, geradas por `npm run fotos` em `api/`. Fora do git. |
