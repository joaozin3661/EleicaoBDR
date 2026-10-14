const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const num = (v: number | null | undefined) => (v == null ? "—" : inteiro.format(v));
export const brl = (v: number | null | undefined) => (v == null ? "—" : "R$ " + inteiro.format(v));
export const pct = (v: number) => decimal1.format(v) + "%";
export const vezes = (v: number) => decimal1.format(v) + "×";

/** Valor compacto para eixos e números grandes: R$ 1,2 mi, R$ 950 mil. */
export function brlCurto(v: number) {
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${decimal1.format(v / 1e9)} bi`;
  if (a >= 1e6) return `R$ ${decimal1.format(v / 1e6)} mi`;
  if (a >= 1e3) return `R$ ${inteiro.format(v / 1e3)} mil`;
  return `R$ ${inteiro.format(v)}`;
}

export function numCurto(v: number) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${decimal1.format(v / 1e6)} mi`;
  if (a >= 1e3) return `${inteiro.format(v / 1e3)} mil`;
  return inteiro.format(v);
}

export const dataBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "s/ data");
