# Notas de direção

## Leitura do pedido
Site novo (site_novo/), estático, que apresenta o projeto de BD de eleições como narrativa:
o que foi feito, o que as 9 perguntas respondidas revelam, com uma coisa viva para o visitante mexer.
Público: professor, colegas, quem receber o link. Ação principal: explorar as respostas (buscar sua cidade / um político).

## Inventário do assunto
1. A urna eletrônica: teclado numérico, teclas BRANCO (branca), CORRIGE (laranja), CONFIRMA (verde), o "fim" sonoro.
2. O santinho: papel do candidato com nome e número; "colinha" e "praguinha" (palavras reais da Q9).
3. Palavras reais das despesas 2024: ADESIVO, SANTINHO, MILITÂNCIA, PERFURADO, RUA, BANDEIRA, JINGLE.
4. Seis UFs: AL, PA, PB, PR, SC, SE; 1.238 municípios; Norte, Nordeste e Sul.
5. 569.184 candidaturas, 359.408 pessoas; 12 pleitos de 2002 a 2024.
6. Marcadores do TSE: #NULO, #NE, -1, -3, -4 (CPF oculto em 2024).
7. A identidade: 486 pessoas com mais de um título, 166 títulos de pessoas diferentes.
8. O quociente eleitoral: 87 de 92 deputados federais (2022) abaixo dele.
9. A cadeira: deputado federal eleito 2022 gastou mediana R$ 1,93 mi; não eleito R$ 50 mil.
10. Carreiras longas: Tarcizo Sampaio Freire, 12 candidaturas, 2002–2024, 5 vitórias, 6 partidos.
11. O boletim de urna, impresso ao fim da votação.
12. Q7 pendente: o espectro político dos partidos ainda vazio.

## Argumento (uma afirmação por seção, com prova)
0. Hero: 22 anos de eleições em seis estados, num banco só → busca "sua cidade" com custo da cadeira de vereador.
1. O que é: 569 mil candidaturas viraram 359 mil pessoas → números do banco, pleitos por ano.
2. Dinheiro: uma cadeira tem preço → Q1 (custo por cadeira por UF e cargo; eleito × não eleito).
3. Patrimônio: o quinto mais rico se elege 33× mais → Q2 faixas.
4. Fundo público: a relação não é linear → Q8 faixas.
5. Propaganda: o papel ainda manda → Q9 categorias + palavras.
6. Regras: quase ninguém se elege sozinho → Q5 quociente.
7. Território: IDHM e isentos (Q3), escolaridade (Q4), idade (Q6).
8. Pessoas: a carreira de um político → Q10 busca.
9. Método: como os dados foram limpos → problemas e soluções.
10. Rodapé: autores, UFPI, fontes, créditos.

## Direção
editorial-report, seed 1315116090. Redraw: work → work-oversized-visual-small-cluster (território tem 3 achados com um gráfico cada; não há fotos para tiras).
Fotos: acervos abertos (Senado/TSE), todas em tons de cinza.

## Ideia
Nesta página, o preço de uma cadeira (resposta da Q1, produto do próprio banco) vira o número-guia do relatório: bloco cobalto do hero, a busca da sua cidade, o fecho.
Coisa viva: "Digite sua cidade" → custo por cadeira de vereador e prefeito em 2020 e 2024 naquela cidade.

## Crítica, rodada 2 (final)
ROUND 2
Seen in one second: um relatório impresso que pergunta "Quanto custa uma cadeira", com o preço R$ 5,8 mi em cobalto sobre a rua coberta de santinhos.
Idea (one sentence): o preço da cadeira (Q1) é o número-guia: hero, busca da cidade, capítulo do dinheiro.
Live thing: busca de município (vereador/prefeito, 2020 e 2024) + carreira de político por nome.
Layout words by section: hero=fala estreita, título largo / intro=lead sobre 4 colunas / cidade=placa quadrada / dinheiro=campo cobalto, título à esquerda, foto+lista à direita / quociente=um número na tela / território=gráfico grande, cluster pequeno / carreiras=abas e faixas / método=muitos em um / prova=tabela sem linhas / rodapé=colunas e marca.
Scores: design 7 · usability 7.5 · creativity 6.5 · content 8 → overall 7.2.
Caps applied: nenhum.
Top three problems:
1. Sem vídeo: os clipes abertos têm de 45 s a 12 min e não há ffmpeg para recortar; o movimento fica na deriva da foto do hero.
2. As 4 colunas da intro estão em 15px cinza: corretas pelo blueprint, mas leves demais ao lado do resto.
3. O rótulo final do gráfico de idade (48,5 anos) encosta na linha laranja.
