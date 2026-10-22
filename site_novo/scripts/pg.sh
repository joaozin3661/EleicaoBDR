#!/bin/bash
# Roda SQL no Postgres do Windows (eleicoes_v2) a partir do WSL, pelo psql.exe do Windows
# (o Postgres não aceita conexão de rede vinda do WSL). A senha vem de site_eleicoes/.env.
#   scripts/pg.sh "SELECT ..."        saída sem alinhamento, campos separados por |
#   scripts/pg.sh -f arquivo.sql      executa um arquivo
ENV="$(dirname "$(readlink -f "$0")")/../../site_eleicoes/.env"
PW=$(grep PGPASSWORD "$ENV" | cut -d= -f2- | tr -d '\r"'"'")
export PGPASSWORD="$PW" PGCONNECT_TIMEOUT=5 PGCLIENTENCODING=UTF8
export WSLENV=PGPASSWORD:PGCONNECT_TIMEOUT:PGCLIENTENCODING
if [ "$1" = "-f" ]; then f=$(wslpath -w "$(readlink -f "$2")"); shift 2; cd "/mnt/c/Program Files/PostgreSQL/18/bin" || exit 1
  exec ./psql.exe -w -h localhost -U postgres -d eleicoes_v2 -v ON_ERROR_STOP=1 -f "$f" "$@" </dev/null; fi
q="$1"; shift
cd "/mnt/c/Program Files/PostgreSQL/18/bin" || exit 1
exec ./psql.exe -w -h localhost -U postgres -d eleicoes_v2 -v ON_ERROR_STOP=1 -At -F '|' -c "$q" "$@" </dev/null
