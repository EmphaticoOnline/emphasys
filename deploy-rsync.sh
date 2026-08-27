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
PREPARE_ONLY="${PREPARE_ONLY:-false}"
FRONTEND_TARGET="${FRONTEND_TARGET:-all}"
BUILD_ID="${BUILD_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
RELEASES_PATH="$REMOTE_PATH/releases"
RELEASE_PATH="$RELEASES_PATH/$BUILD_ID"

log() { echo "==> $*"; }

command -v rsync >/dev/null 2>&1 || { echo "rsync no está instalado. Instálalo (brew/apt/yum) o usa el deploy original."; exit 1; }

case "$FRONTEND_TARGET" in
  erp|compass|all) ;;
  *) echo "FRONTEND_TARGET debe ser erp, compass o all."; exit 1 ;;
esac

if [[ "$SKIP_FRONTEND" != "true" ]]; then
  log "Building frontend target: $FRONTEND_TARGET..."
  (
    cd "$FRONTEND_DIR"
    if [[ "$SKIP_LOCAL_INSTALL" != "true" ]]; then
      npm install
    else
      log "Skipping frontend npm install (SKIP_LOCAL_INSTALL=true)..."
    fi
    if [[ "$FRONTEND_TARGET" == "all" ]]; then
      rm -rf dist
      npm run build:erp
      npm run build:compass
    else
      rm -rf "dist/$FRONTEND_TARGET"
      npm run "build:$FRONTEND_TARGET"
    fi
  )
else
  log "Skipping frontend build (SKIP_FRONTEND=true)..."
fi

log "Building backend..."
(
  cd "$BACKEND_DIR"
  rm -rf dist
  if [[ "$SKIP_LOCAL_INSTALL" != "true" ]]; then
    npm install
  else
    log "Skipping backend npm install (SKIP_LOCAL_INSTALL=true)..."
  fi
  npm run build
)

log "Escribiendo marca de build..."
printf '%s\n' "$BUILD_ID" > "$BACKEND_DIR/dist/.build-id"

log "Preparando release remoto aislado..."
ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p '$RELEASE_PATH/dist' '$RELEASE_PATH/frontend-erp-dist' '$RELEASE_PATH/frontend-compass-dist'"

log "Sincronizando backend dist al release inactivo..."
rsync -az --delete -e "${RSYNC_SSH[*]}" "$BACKEND_DIR/dist/" "$SERVER:$RELEASE_PATH/dist/"

log "Verificando build desplegado en remoto..."
remote_build_id=$(ssh "${SSH_OPTS[@]}" "$SERVER" "cat '$RELEASE_PATH/dist/.build-id' 2>/dev/null" || true)
if [[ "$remote_build_id" != "$BUILD_ID" ]]; then
  echo "Build remoto no coincide con el build local esperado. local=$BUILD_ID remote=$remote_build_id"
  exit 1
fi

log "Preparando los dos artefactos frontend en el release inactivo..."
if [[ "$FRONTEND_TARGET" != "all" ]]; then
  other_frontend="erp"
  if [[ "$FRONTEND_TARGET" == "erp" ]]; then
    other_frontend="compass"
  fi
  ssh "${SSH_OPTS[@]}" "$SERVER" "test -d '$REMOTE_PATH/current/frontend-$other_frontend-dist' && cp -a '$REMOTE_PATH/current/frontend-$other_frontend-dist/.' '$RELEASE_PATH/frontend-$other_frontend-dist/'"
fi

if [[ "$FRONTEND_TARGET" == "erp" || "$FRONTEND_TARGET" == "all" ]]; then
  log "Sincronizando frontend ERP..."
  rsync -az --delete -e "${RSYNC_SSH[*]}" "$FRONTEND_DIR/dist/erp/" "$SERVER:$RELEASE_PATH/frontend-erp-dist/"
fi

if [[ "$FRONTEND_TARGET" == "compass" || "$FRONTEND_TARGET" == "all" ]]; then
  log "Sincronizando frontend Compass..."
  rsync -az --delete -e "${RSYNC_SSH[*]}" "$FRONTEND_DIR/dist/compass/" "$SERVER:$RELEASE_PATH/frontend-compass-dist/"
fi

# Compatibilidad durante la migración de Nginx: Express conserva su ruta
# frontend-dist habitual, apuntando al frontend ERP del mismo release.
ssh "${SSH_OPTS[@]}" "$SERVER" "ln -sfn frontend-erp-dist '$RELEASE_PATH/frontend-dist'"

log "Sincronizando package.json y lock..."
rsync -az -e "${RSYNC_SSH[*]}" "$BACKEND_DIR/package.json" "$BACKEND_DIR/package-lock.json" "$SERVER:$RELEASE_PATH/"

log "Conservando el .env administrado exclusivamente en el servidor remoto."

log "Sincronizando ecosystem.config.js..."
rsync -az -e "${RSYNC_SSH[*]}" "$PM2_CONFIG" "$SERVER:$REMOTE_PATH/"

ssh "${SSH_OPTS[@]}" "$SERVER" <<REMOTE
set -e
cd $REMOTE_PATH
if [ "$SKIP_REMOTE_INSTALL" != "true" ]; then
  echo "Instalando dependencias dentro del release inactivo"
  cd "$RELEASE_PATH"
  npm ci --omit=dev
  cd "$REMOTE_PATH"
else
  echo "Reutilizando node_modules del release activo (SKIP_REMOTE_INSTALL=true)..."
  active_release=\$(readlink -f current 2>/dev/null || true)
  if [ -z "\$active_release" ] || [ ! -d "\$active_release/node_modules" ]; then
    echo "No existe un release activo con node_modules; no se puede omitir npm ci."
    exit 1
  fi
  ln -s "\$active_release/node_modules" "$RELEASE_PATH/node_modules"
fi

# Facilita la transición inicial sin caída mediante un proceso temporal en
# otro puerto; dotenv sigue leyendo el único archivo de secretos persistente.
if [ -f "$REMOTE_PATH/.env" ] && [ ! -e "$RELEASE_PATH/.env" ]; then
  ln -s ../../.env "$RELEASE_PATH/.env"
fi

if [ "$PREPARE_ONLY" = "true" ]; then
  echo "Release preparado sin activar: $RELEASE_PATH"
  exit 0
fi

# Publicación atómica: las peticiones existentes conservan el release anterior
# y los procesos nuevos resuelven current al release completo recién verificado.
previous_release=\$(readlink -f current 2>/dev/null || true)
next_link=".current-next-$BUILD_ID"
ln -s "$RELEASE_PATH" "\$next_link"
mv -Tf "\$next_link" current

# En cluster_mode, incluso con una sola instancia estable, PM2 levanta y espera
# al reemplazo antes de retirar el worker anterior.
if ! pm2 startOrReload ecosystem.config.js --only emphasys-api --env production --update-env; then
  echo "PM2 no activó el release; restaurando el enlace anterior."
  if [ -z "\$previous_release" ]; then
    echo "No existe un release anterior para restaurar."
    exit 1
  fi

  rollback_link=".current-rollback-$BUILD_ID"
  ln -s "\$previous_release" "\$rollback_link"
  mv -Tf "\$rollback_link" current

  rollback_reload_failed=false
  if ! pm2 startOrReload ecosystem.config.js --only emphasys-api --env production --update-env; then
    rollback_reload_failed=true
  fi

  rollback_health_failed=false
  if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:7001/health >/dev/null; then
    rollback_health_failed=true
  fi

  if [ "\$rollback_reload_failed" = "true" ]; then
    echo "PM2 no pudo recargar el release restaurado."
  fi
  if [ "\$rollback_health_failed" = "true" ]; then
    echo "El health check del release restaurado falló."
  fi
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:7001/health >/dev/null; then
  echo "Health check falló; restaurando el release anterior."
  if [ -z "\$previous_release" ]; then
    echo "No existe un release anterior para restaurar."
    exit 1
  fi

  rollback_link=".current-health-rollback-$BUILD_ID"
  ln -s "\$previous_release" "\$rollback_link"
  mv -Tf "\$rollback_link" current

  rollback_reload_failed=false
  if ! pm2 startOrReload ecosystem.config.js --only emphasys-api --env production --update-env; then
    rollback_reload_failed=true
  fi

  rollback_health_failed=false
  if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:7001/health >/dev/null; then
    rollback_health_failed=true
  fi

  if [ "\$rollback_reload_failed" = "true" ]; then
    echo "PM2 no pudo recargar el release restaurado."
  fi
  if [ "\$rollback_health_failed" = "true" ]; then
    echo "El health check del release restaurado también falló."
  fi
  exit 1
fi
pm2 save
REMOTE

log "Deploy rsync finalizado correctamente."
