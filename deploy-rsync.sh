#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="ubuntu@api.emphasys.cloud"
REMOTE_PATH="/var/www/emphasys-backend"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PM2_CONFIG="$ROOT_DIR/ecosystem.config.js"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
RSYNC_SSH=("ssh" "${SSH_OPTS[@]}")
SKIP_FRONTEND="${SKIP_FRONTEND:-false}"
SKIP_LOCAL_INSTALL="${SKIP_LOCAL_INSTALL:-false}"
SKIP_REMOTE_INSTALL="${SKIP_REMOTE_INSTALL:-false}"

log() { echo "==> $*"; }

command -v rsync >/dev/null 2>&1 || { echo "rsync no está instalado. Instálalo (brew/apt/yum) o usa el deploy original."; exit 1; }

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
ssh "${RSYNC_SSH[@]}" "$SERVER" "mkdir -p $REMOTE_PATH $REMOTE_PATH/dist $REMOTE_PATH/frontend-dist"

log "Sincronizando backend dist (rsync incremental)..."
rsync -az --delete -e "${RSYNC_SSH[*]}" "$BACKEND_DIR/dist/" "$SERVER:$REMOTE_PATH/dist/"

log "Sincronizando frontend dist (rsync incremental)..."
rsync -az --delete -e "${RSYNC_SSH[*]}" "$FRONTEND_DIR/dist/" "$SERVER:$REMOTE_PATH/frontend-dist/"

log "Sincronizando package.json y lock..."
rsync -az -e "${RSYNC_SSH[*]}" "$BACKEND_DIR/package.json" "$BACKEND_DIR/package-lock.json" "$SERVER:$REMOTE_PATH/"

if [[ -f "$BACKEND_DIR/.env" ]]; then
  log "Sincronizando .env..."
  rsync -az -e "${RSYNC_SSH[*]}" "$BACKEND_DIR/.env" "$SERVER:$REMOTE_PATH/.env"
fi

log "Sincronizando ecosystem.config.js..."
rsync -az -e "${RSYNC_SSH[*]}" "$PM2_CONFIG" "$SERVER:$REMOTE_PATH/"

log "Chequeando cambios de lockfile para decidir npm install..."
local_lock=$(sha256sum "$BACKEND_DIR/package-lock.json" | awk '{print $1}')
remote_lock=$(ssh "${RSYNC_SSH[@]}" "$SERVER" "cd $REMOTE_PATH && sha256sum package-lock.json 2>/dev/null | awk '{print $1}'" || true)

ssh "${RSYNC_SSH[@]}" "$SERVER" <<REMOTE
set -e
cd $REMOTE_PATH
if [ "$SKIP_REMOTE_INSTALL" != "true" ]; then
  if [ "$local_lock" != "$remote_lock" ]; then
    echo "Lockfile cambió: ejecutando npm install --omit=dev"
    npm install --omit=dev
  else
    echo "Lockfile sin cambios: saltando npm install"
  fi
else
  echo "Skipping remote npm install (SKIP_REMOTE_INSTALL=true)..."
fi
pm2 delete emphasys-api >/dev/null 2>&1 || true
pm2 startOrReload ecosystem.config.js --env production
REMOTE

log "Deploy rsync finalizado correctamente."