#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_PORT="${DB_TUNNEL_PORT:-15432}"
SSH_SERVER="${SSH_SERVER:-ubuntu@api.emphasys.cloud}"
SSH_OPTS=(-o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3)

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "El puerto local $LOCAL_PORT ya está ocupado; no se abrirá un túnel ambiguo." >&2
  exit 1
fi

echo "==> Abriendo túnel PostgreSQL: 127.0.0.1:$LOCAL_PORT → $SSH_SERVER:127.0.0.1:5432"
ssh "${SSH_OPTS[@]}" -N -L "${LOCAL_PORT}:127.0.0.1:5432" "$SSH_SERVER" &
TUNNEL_PID=$!
cleanup() {
  trap - EXIT INT TERM
  kill "$TUNNEL_PID" 2>/dev/null || true
  wait "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in {1..20}; do
  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "No se pudo abrir el túnel SSH." >&2
    exit 1
  fi
  if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 "$LOCAL_PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if command -v nc >/dev/null 2>&1 && ! nc -z 127.0.0.1 "$LOCAL_PORT" >/dev/null 2>&1; then
  echo "El túnel SSH no quedó escuchando en 127.0.0.1:$LOCAL_PORT." >&2
  exit 1
fi

echo "==> Túnel activo; iniciando Emphasys contra DB_TARGET=server"
cd "$ROOT_DIR"
exec npm run dev
