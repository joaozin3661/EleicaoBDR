import { useEffect, useState } from "react";

/** Os gráficos (SVG) recebem cores em hex: lê os tokens do CSS e relê quando o tema muda. */
const NOMES = ["surface", "text-primary", "text-secondary", "text-muted", "grid", "axis",
  "series-1", "series-2", "series-3", "series-4", "good", "warning", "critical", "neutral"] as const;
export type Tokens = Record<(typeof NOMES)[number], string>;

function ler(): Tokens {
  const s = getComputedStyle(document.documentElement);
  return Object.fromEntries(NOMES.map((n) => [n, s.getPropertyValue(`--${n}`).trim()])) as Tokens;
}

export function useTokens(): Tokens {
  const [t, setT] = useState<Tokens>(ler);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const atualiza = () => setT(ler());
    mq.addEventListener("change", atualiza);
    const obs = new MutationObserver(atualiza);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", atualiza);
      obs.disconnect();
    };
  }, []);
  return t;
}

/** Cor fixa por ano: a cor segue a eleição, nunca a posição no gráfico. */
export const COR_ANO: Record<number, keyof Tokens> = {
  2018: "series-1", 2020: "series-2", 2022: "series-3", 2024: "series-4",
};
