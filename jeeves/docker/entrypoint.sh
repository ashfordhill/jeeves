#!/usr/bin/env bash
set -Eeuo pipefail

# A single-container local installation. Only nginx is reachable through Docker;
# the API and bundled database keep their loopback-only listeners.
pg_pid=""
api_pid=""
web_pid=""

shutdown() {
  trap - EXIT TERM INT
  # Finish API work while Postgres is still available.
  if [[ -n "$web_pid" ]]; then kill -QUIT "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then
    kill -TERM "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  if [[ -n "$pg_pid" ]]; then
    kill -INT "$pg_pid" 2>/dev/null || true
    wait "$pg_pid" 2>/dev/null || true
  fi
  if [[ -n "$web_pid" ]]; then wait "$web_pid" 2>/dev/null || true; fi
}
trap shutdown EXIT
trap 'exit 0' TERM INT

mkdir -p "$JEEVES_HOME"
chown node:node "$JEEVES_HOME"

if [[ -z "${DATABASE_URL:-}" ]]; then
  mkdir -p "$PGDATA" /run/postgresql
  chown postgres:postgres "$PGDATA" /run/postgresql
  chmod 700 "$PGDATA"
  if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
    su-exec postgres initdb -D "$PGDATA" --username=jeeves --encoding=UTF8 \
      --locale=C --auth-local=trust --auth-host=trust
  fi
  # Trust is confined to this container's loopback; no database port is published.
  su-exec postgres postgres -D "$PGDATA" -c listen_addresses=127.0.0.1 &
  pg_pid=$!
  ready=0
  for ((attempt = 0; attempt < 60; attempt++)); do
    if pg_isready -q -h 127.0.0.1 -U jeeves -d postgres; then ready=1; break; fi
    if ! kill -0 "$pg_pid" 2>/dev/null; then break; fi
    sleep 1
  done
  if [[ "$ready" != 1 ]]; then
    echo "Jeeves: Postgres did not become ready." >&2
    exit 1
  fi
  export DATABASE_URL=postgres://jeeves@127.0.0.1:5432/jeeves
fi

su-exec node node --import ./jeeves/apps/server/node_modules/tsx/dist/loader.mjs \
  jeeves/apps/server/src/main.ts &
api_pid=$!
su-exec node nginx -e stderr -g 'daemon off;' &
web_pid=$!

# Any failed service stops the container so Docker's restart policy can recover it.
set +e
wait -n "$api_pid" "$web_pid" ${pg_pid:+"$pg_pid"}
status=$?
set -e
echo "Jeeves: a service exited (status $status); shutting down." >&2
if [[ "$status" == 0 ]]; then status=1; fi
exit "$status"
