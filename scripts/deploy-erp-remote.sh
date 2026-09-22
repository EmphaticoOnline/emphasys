#!/usr/bin/env bash
# Conserva el bloque remoto de deploy-rsync.sh; recibe valores sin interpolación local.
REMOTE_PATH=$1
BUILD_ID=$2
SKIP_REMOTE_INSTALL=$3
PREPARE_ONLY=$4
RELEASES_PATH="$REMOTE_PATH/releases"
RELEASE_PATH="$RELEASES_PATH/$BUILD_ID"

step() {
  local label=$1 seconds=$2 status=0
  shift 2
  printf '==> REMOTO INICIO: %s (limite %ss)\n' "$label" "$seconds" >&2
  timeout --kill-after=5s "${seconds}s" "$@" || status=$?
  if [ "$status" -eq 0 ]; then
    printf '==> REMOTO FIN: %s\n' "$label" >&2
  else
    printf '==> REMOTO ERROR: %s (codigo %s; 124/137 indica timeout)\n' "$label" "$status" >&2
  fi
  return "$status"
}

set -e
# Preparation must complete in its entirety before installing or publishing.
test "$(cat "$RELEASE_PATH/.deploy-prepared")" = "$BUILD_ID"
test "$(cat "$RELEASE_PATH/dist/.build-id")" = "$BUILD_ID"
# BEGIN asset validation
step 'Verificar assets antes de activar' 120 bash -c 'cd "$1"; sha256sum --strict -c "$2"' _ \
  "$RELEASE_PATH" "$RELEASE_PATH/.deploy-assets.sha256"
# END asset validation
cd "$REMOTE_PATH"
if [ "$SKIP_REMOTE_INSTALL" != "true" ]; then
  echo "Instalando dependencias dentro del release inactivo"
  cd "$RELEASE_PATH"
  step 'Instalar dependencias' 1200 npm ci --omit=dev
  cd "$REMOTE_PATH"
else
  echo "Reutilizando node_modules del release activo (SKIP_REMOTE_INSTALL=true)..."
  active_release=$(step 'Resolver release' 30 readlink -f current 2>/dev/null || true)
  if [ -z "$active_release" ] || [ ! -d "$active_release/node_modules" ]; then
    echo "No existe un release activo con node_modules; no se puede omitir npm ci."
    exit 1
  fi
  step 'Crear enlace' 30 ln -s "$active_release/node_modules" "$RELEASE_PATH/node_modules"
fi

# Facilita la transición inicial sin caída mediante un proceso temporal en
# otro puerto; dotenv sigue leyendo el único archivo de secretos persistente.
if [ -f "$REMOTE_PATH/.env" ] && [ ! -e "$RELEASE_PATH/.env" ]; then
  step 'Crear enlace' 30 ln -s ../../.env "$RELEASE_PATH/.env"
fi

if [ "$PREPARE_ONLY" = "true" ]; then
  echo "Release preparado sin activar: $RELEASE_PATH"
  exit 0
fi

# Publicación atómica: las peticiones existentes conservan el release anterior
# y los procesos nuevos resuelven current al release completo recién verificado.
previous_release=$(step 'Resolver release' 30 readlink -f current 2>/dev/null || true)
next_link=".current-next-$BUILD_ID"
step 'Crear enlace' 30 ln -s "$RELEASE_PATH" "$next_link"
step 'Publicar enlace' 30 mv -Tf "$next_link" current

# En cluster_mode, incluso con una sola instancia estable, PM2 levanta y espera
# al reemplazo antes de retirar el worker anterior.
if ! step 'PM2 recarga' 180 pm2 startOrReload ecosystem.config.js --only emphasys-api --env production --update-env; then
  echo "PM2 no activó el release; restaurando el enlace anterior."
  if [ -z "$previous_release" ]; then
    echo "No existe un release anterior para restaurar."
    exit 1
  fi

  rollback_link=".current-rollback-$BUILD_ID"
  step 'Crear enlace' 30 ln -s "$previous_release" "$rollback_link"
  step 'Publicar enlace' 30 mv -Tf "$rollback_link" current

  rollback_reload_failed=false
  if ! step 'PM2 recarga' 180 pm2 startOrReload ecosystem.config.js --only emphasys-api --env production --update-env; then
    rollback_reload_failed=true
  fi

  rollback_health_failed=false
  if ! step 'Health check' 15 curl --fail --silent --show-error --max-time 10 http://127.0.0.1:7001/health >/dev/null; then
    rollback_health_failed=true
  fi

  if [ "$rollback_reload_failed" = "true" ]; then
    echo "PM2 no pudo recargar el release restaurado."
  fi
  if [ "$rollback_health_failed" = "true" ]; then
    echo "El health check del release restaurado falló."
  fi
  exit 1
fi

if ! step 'Health check' 15 curl --fail --silent --show-error --max-time 10 http://127.0.0.1:7001/health >/dev/null; then
  echo "Health check falló; restaurando el release anterior."
  if [ -z "$previous_release" ]; then
    echo "No existe un release anterior para restaurar."
    exit 1
  fi

  rollback_link=".current-health-rollback-$BUILD_ID"
  step 'Crear enlace' 30 ln -s "$previous_release" "$rollback_link"
  step 'Publicar enlace' 30 mv -Tf "$rollback_link" current

  rollback_reload_failed=false
  if ! step 'PM2 recarga' 180 pm2 startOrReload ecosystem.config.js --only emphasys-api --env production --update-env; then
    rollback_reload_failed=true
  fi

  rollback_health_failed=false
  if ! step 'Health check' 15 curl --fail --silent --show-error --max-time 10 http://127.0.0.1:7001/health >/dev/null; then
    rollback_health_failed=true
  fi

  if [ "$rollback_reload_failed" = "true" ]; then
    echo "PM2 no pudo recargar el release restaurado."
  fi
  if [ "$rollback_health_failed" = "true" ]; then
    echo "El health check del release restaurado también falló."
  fi
  exit 1
fi
step 'PM2 save' 60 pm2 save

echo "==> Limpiando releases antiguos..."
active_release=$(step 'Resolver release' 30 readlink -f "$REMOTE_PATH/current" 2>/dev/null || true)
release_count=0

# Solo considera directorios hijos directos de releases, ordenados del más
# reciente al más antiguo. La salida NUL-safe tolera espacios en los nombres.
while IFS= read -r -d '' release_entry; do
  release_path=${release_entry#*	}
  if [ "$release_count" -lt 5 ]; then
    release_count=$((release_count + 1))
    continue
  fi

  # current se compara con step 'Resolver release' 30 readlink -f y nunca se elimina, aunque sea antiguo.
  if [ -n "$active_release" ] && [ "$release_path" = "$active_release" ]; then
    continue
  fi

  # release_path proviene de find con maxdepth 1; -- y las comillas evitan
  # expansiones inseguras y mantienen la operación dentro de releases.
  step 'Eliminar release antiguo' 60 rm -rf -- "$release_path"
done < <(step 'Enumerar releases' 60 find "$RELEASES_PATH" -mindepth 1 -maxdepth 1 -type d -printf '%T@\t%p\0' | step 'Ordenar releases' 60 sort -z -rn)
printf '==> REMOTO FIN: limpieza de releases\n' >&2
