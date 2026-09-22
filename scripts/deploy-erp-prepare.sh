#!/usr/bin/env bash
set -e
REMOTE_PATH=$1
BUILD_ID=$2
FRONTEND_TARGET=$3
PACKAGE_DIR=$(cd "$(dirname "$0")" && pwd)
RELEASE_PATH="$REMOTE_PATH/releases/$BUILD_ID"

step() {
  local label=$1 seconds=$2 status=0
  shift 2
  printf '==> REMOTO INICIO: %s (limite %ss)\n' "$label" "$seconds" >&2
  timeout --kill-after=5s "${seconds}s" "$@" || status=$?
  if [ "$status" -eq 0 ]; then
    printf '==> REMOTO FIN: %s\n' "$label" >&2
  else
    printf '==> REMOTO ERROR: %s (codigo %s)\n' "$label" "$status" >&2
  fi
  return "$status"
}

test "$FRONTEND_TARGET" = erp
test "$(cat "$PACKAGE_DIR/backend/dist/.build-id")" = "$BUILD_ID"
step 'Verificar assets del paquete' 120 bash -c 'cd "$1"; sha256sum --strict -c "$2"' _ \
  "$PACKAGE_DIR/backend" "$PACKAGE_DIR/deploy-assets.sha256"
step 'Crear release inactivo' 30 mkdir -p "$RELEASE_PATH/dist" "$RELEASE_PATH/assets" \
  "$RELEASE_PATH/frontend-erp-dist" "$RELEASE_PATH/frontend-compass-dist"
step 'Invalidar marca de preparación' 30 rm -f "$RELEASE_PATH/.deploy-prepared"

replace_directory() {
  local source=$1 destination=$2
  test -d "$destination"
  test ! -L "$destination"
  step "Vaciar $destination" 120 find "$destination" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  step "Copiar $source" 120 cp -a "$source/." "$destination/"
}
replace_directory "$PACKAGE_DIR/backend/dist" "$RELEASE_PATH/dist"
replace_directory "$PACKAGE_DIR/backend/assets" "$RELEASE_PATH/assets"
step 'Verificar assets en su ubicación de runtime' 120 bash -c 'cd "$1"; sha256sum --strict -c "$2"' _ \
  "$RELEASE_PATH" "$PACKAGE_DIR/deploy-assets.sha256"
step 'Guardar manifiesto de assets' 30 cp "$PACKAGE_DIR/deploy-assets.sha256" "$RELEASE_PATH/.deploy-assets.sha256"
replace_directory "$PACKAGE_DIR/frontend/dist/erp" "$RELEASE_PATH/frontend-erp-dist"

test -d "$REMOTE_PATH/current/frontend-compass-dist"
step 'Preservar frontend Compass' 120 cp -a "$REMOTE_PATH/current/frontend-compass-dist/." "$RELEASE_PATH/frontend-compass-dist/"
step 'Crear frontend-dist' 30 ln -sfn frontend-erp-dist "$RELEASE_PATH/frontend-dist"
step 'Copiar manifests backend' 30 cp -a "$PACKAGE_DIR/backend/package.json" "$PACKAGE_DIR/backend/package-lock.json" "$RELEASE_PATH/"
step 'Copiar configuración PM2' 30 cp -a "$PACKAGE_DIR/ecosystem.config.js" "$REMOTE_PATH/"
if [ -f "$REMOTE_PATH/.env" ] && [ ! -e "$RELEASE_PATH/.env" ]; then
  step 'Enlazar .env remoto' 30 ln -s ../../.env "$RELEASE_PATH/.env"
fi
printf '==> REMOTO INICIO: validar build del release\n' >&2
test "$(cat "$RELEASE_PATH/dist/.build-id")" = "$BUILD_ID"
printf '%s\n' "$BUILD_ID" > "$RELEASE_PATH/.deploy-prepared"
printf '==> REMOTO FIN: validar build del release\n' >&2
step 'Limpiar artefactos temporales' 120 rm -rf -- "$PACKAGE_DIR/backend" "$PACKAGE_DIR/frontend" "$PACKAGE_DIR/ecosystem.config.js"
printf '==> REMOTO FIN: release preparado, current sin modificar\n' >&2
