/* As 27 unidades da federação: sigla, nome, as preposições ("do Pará", "no Pará"), região e o código IBGE da capital.
   Fonte única para o site; o gravador (api/exportacao/grava.ts) e as exportações em Python tiram a lista do banco. */
(() => {
  const T = [
    ["AC", "Acre", "do", "no", "Norte", 1200401],
    ["AL", "Alagoas", "de", "em", "Nordeste", 2704302],
    ["AM", "Amazonas", "do", "no", "Norte", 1302603],
    ["AP", "Amapá", "do", "no", "Norte", 1600303],
    ["BA", "Bahia", "da", "na", "Nordeste", 2927408],
    ["CE", "Ceará", "do", "no", "Nordeste", 2304400],
    ["DF", "Distrito Federal", "do", "no", "Centro-Oeste", 5300108],
    ["ES", "Espírito Santo", "do", "no", "Sudeste", 3205309],
    ["GO", "Goiás", "de", "em", "Centro-Oeste", 5208707],
    ["MA", "Maranhão", "do", "no", "Nordeste", 2111300],
    ["MG", "Minas Gerais", "de", "em", "Sudeste", 3106200],
    ["MS", "Mato Grosso do Sul", "de", "em", "Centro-Oeste", 5002704],
    ["MT", "Mato Grosso", "de", "em", "Centro-Oeste", 5103403],
    ["PA", "Pará", "do", "no", "Norte", 1501402],
    ["PB", "Paraíba", "da", "na", "Nordeste", 2507507],
    ["PE", "Pernambuco", "de", "em", "Nordeste", 2611606],
    ["PI", "Piauí", "do", "no", "Nordeste", 2211001],
    ["PR", "Paraná", "do", "no", "Sul", 4106902],
    ["RJ", "Rio de Janeiro", "do", "no", "Sudeste", 3304557],
    ["RN", "Rio Grande do Norte", "do", "no", "Nordeste", 2408102],
    ["RO", "Rondônia", "de", "em", "Norte", 1100205],
    ["RR", "Roraima", "de", "em", "Norte", 1400100],
    ["RS", "Rio Grande do Sul", "do", "no", "Sul", 4314902],
    ["SC", "Santa Catarina", "de", "em", "Sul", 4205407],
    ["SE", "Sergipe", "de", "em", "Nordeste", 2800308],
    ["SP", "São Paulo", "de", "em", "Sudeste", 3550308],
    ["TO", "Tocantins", "do", "no", "Norte", 1721000],
  ];
  const mapa = (i) => Object.fromEntries(T.map((t) => [t[0], typeof i === "function" ? i(t) : t[i]]));
  globalThis.UFs = {
    LISTA: T.map((t) => t[0]),
    NOME: mapa(1),
    DO: mapa((t) => `${t[2]} ${t[1]}`),
    EM: mapa((t) => `${t[3]} ${t[1]}`),
    REGIAO: mapa(4),
    CAPITAL: mapa(5),
    /* sem municípios (sem prefeito nem vereador): o DF */
    SEM_MUNICIPAL: ["DF"],
    TODAS: "Brasil",
    EM_TODAS: "no Brasil",
    DO_TODAS: "do Brasil",
  };
})();
