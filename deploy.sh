#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="ubuntu@api.emphasys.cloud"
REMOTE_PATH="/var/www/emphasys-backend"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PM2_CONFIG="$ROOT_DIR/ecosystem.config.js"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
SKIP_FRONTEND="${SKIP_FRONTEND:-false}"
SKIP_LOCAL_INSTALL="${SKIP_LOCAL_INSTALL:-false}"
SKIP_REMOTE_INSTALL="${SKIP_REMOTE_INSTALL:-false}"

log() { echo "==> $*"; }

if [[ "$SKIP_FRONTEND" != "true" ]]; then
  log "Building frontend..."
  (
    cd "$FRONTEND_DIR"
    if [[ "$SKIP_LOCAL_INSTALL" != "true" ]]; then
      npm install
    else
      log "Skipping frontend npm install (SKIP_LOCAL_INSTALL=true)..."
    fi
    npm run build
  )
else
  log "Skipping frontend build (SKIP_FRONTEND=true)..."
fi

log "Building backend..."
(
  cd "$BACKEND_DIR"
  if [[ "$SKIP_LOCAL_INSTALL" != "true" ]]; then
    npm install
  else
    log "Skipping backend npm install (SKIP_LOCAL_INSTALL=true)..."
  fi
  npm run build
)

log "Preparando servidor remoto..."
ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p $REMOTE_PATH $REMOTE_PATH/dist $REMOTE_PATH/frontend-dist"
ssh "${SSH_OPTS[@]}" "$SERVER" "rm -rf $REMOTE_PATH/dist/*"
ssh "${SSH_OPTS[@]}" "$SERVER" "rm -rf $REMOTE_PATH/frontend-dist/*"

log "Copiando backend dist..."
scp "${SCP_OPTS[@]}" -r "$BACKEND_DIR"/dist/* "${SERVER}:${REMOTE_PATH}/dist/"

log "Copiando frontend dist..."
scp "${SCP_OPTS[@]}" -r "$FRONTEND_DIR"/dist/* "${SERVER}:${REMOTE_PATH}/frontend-dist/"

log "Copiando package.json y lock..."
scp "${SCP_OPTS[@]}" "$BACKEND_DIR/package.json" "$BACKEND_DIR/package-lock.json" "${SERVER}:${REMOTE_PATH}/"

if [ -f "$BACKEND_DIR/.env" ]; then
  log "Copiando .env..."
  scp "${SCP_OPTS[@]}" "$BACKEND_DIR/.env" "${SERVER}:${REMOTE_PATH}/.env"
fi

log "Copiando ecosystem.config.js..."
scp "${SCP_OPTS[@]}" "$PM2_CONFIG" "${SERVER}:${REMOTE_PATH}/"

log "Instalando dependencias y reiniciando PM2..."
ssh "${SSH_OPTS[@]}" "$SERVER" <<REMOTE
cd $REMOTE_PATH
if [ "$SKIP_REMOTE_INSTALL" != "true" ]; then
  npm install --omit=dev
else
  echo "Skipping remote npm install (SKIP_REMOTE_INSTALL=true)..."
fi
pm2 delete emphasys-api >/dev/null 2>&1 || true
pm2 startOrReload ecosystem.config.js --env production
REMOTE

log "Deploy finalizado correctamente."
