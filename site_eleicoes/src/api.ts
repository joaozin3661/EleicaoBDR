import { useEffect, useState } from "react";
import { ESTATICO, respostaEstatica } from "./estatico";

export type Resposta<T> = { sql: string; dados: T };

/** Busca na API. url = null não busca nada (útil enquanto o usuário ainda não escolheu um filtro). */
export function useApi<T>(url: string | null) {
  const [estado, setEstado] = useState<{ dados?: T; sql?: string; erro?: string; carregando: boolean }>({
    carregando: !!url,
  });
  useEffect(() => {
    if (!url) {
      setEstado({ carregando: false });
      return;
    }
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: undefined }));
    (ESTATICO
      ? (respostaEstatica(url) as Promise<Resposta<T>>)
      : fetch(url).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.erro ?? r.statusText);
          return j as Resposta<T>;
        })
    )
      .then((j) => vivo && setEstado({ dados: j.dados, sql: j.sql, carregando: false }))
      .catch((e: Error) => vivo && setEstado({ erro: e.message, carregando: false }));
    return () => {
      vivo = false;
    };
  }, [url]);
  return estado;
}

export const qs = (p: Record<string, string | number | boolean>) =>
  new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)])).toString();
