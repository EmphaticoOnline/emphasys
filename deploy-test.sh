#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
TARGET_DIR="$ROOT_DIR/.local-deploy"
PM2_CONFIG="$ROOT_DIR/ecosystem.config.js"

echo "==> Deploy de pruebas local (sin SSH)"
echo "Raíz del proyecto: $ROOT_DIR"

# =============================
# 1) Build frontend
# =============================
echo "[1/5] Construyendo frontend..."
pushd "$FRONTEND_DIR" >/dev/null
npm ci
npm run build
popd >/dev/null

# =============================
# 2) Build backend
# =============================
echo "[2/5] Construyendo backend..."
pushd "$BACKEND_DIR" >/dev/null
npm ci
npm run build
popd >/dev/null

# =============================
# 3) Preparar bundle local
# =============================
echo "[3/5] Preparando bundle en $TARGET_DIR..."
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR/dist" "$TARGET_DIR/frontend-dist"

cp -r "$BACKEND_DIR/dist/." "$TARGET_DIR/dist/"
cp -r "$FRONTEND_DIR/dist/." "$TARGET_DIR/frontend-dist/"
cp "$BACKEND_DIR/package.json" "$BACKEND_DIR/package-lock.json" "$TARGET_DIR/"

if [ -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env" "$TARGET_DIR/.env"
else
  echo "⚠️  No se encontró backend/.env; recuerda configurar variables de entorno al arrancar."
fi

if [ -f "$PM2_CONFIG" ]; then
  cp "$PM2_CONFIG" "$TARGET_DIR/"
fi

# =============================
# 4) Instalar dependencias de prod del bundle
# =============================
echo "[4/5] Instalando dependencias de producción en el bundle..."
pushd "$TARGET_DIR" >/dev/null
npm ci --omit=dev
popd >/dev/null

# =============================
# 5) Arrancar backend y preview frontend
# =============================
echo "[5/5] Levantando backend y preview de frontend..."

pushd "$TARGET_DIR" >/dev/null
NODE_ENV=production node dist/server.js > ../backend-local.log 2>&1 &
BACKEND_PID=$!
popd >/dev/null

pushd "$FRONTEND_DIR" >/dev/null
npm run preview -- --host 0.0.0.0 --port 4173 > ../frontend-preview.log 2>&1 &
FRONTEND_PID=$!
popd >/dev/null

echo "\n✅ Bundle local listo en $TARGET_DIR"
echo "Backend (PID $BACKEND_PID) corriendo desde .local-deploy/dist -> log: backend-local.log"
echo "Frontend preview (PID $FRONTEND_PID) en http://localhost:4173 -> log: frontend-preview.log"
echo "Para detenerlos: kill $BACKEND_PID $FRONTEND_PID"
