#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
TARGET_DIR="$ROOT_DIR/.local-deploy"

echo "==> Deploy de pruebas local (sin SSH)"
echo "Raíz del proyecto: $ROOT_DIR"

# =============================
# 1) Build frontend
# =============================
echo "[1/5] Construyendo frontend..."
cd "$FRONTEND_DIR"

echo "   Instalando dependencias frontend..."
npm install --no-audit --no-fund --silent

echo "   Ejecutando build frontend..."
npm run build

cd "$ROOT_DIR"

# =============================
# 2) Build backend
# =============================
echo "[2/5] Construyendo backend..."
cd "$BACKEND_DIR"

echo "   Instalando dependencias backend..."
npm install --no-audit --no-fund --silent

echo "   Ejecutando build backend..."
npm run build

cd "$ROOT_DIR"

# =============================
# 3) Preparar bundle local
# =============================
echo "[3/5] Preparando bundle en $TARGET_DIR..."

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

cp -r "$BACKEND_DIR/dist" "$TARGET_DIR/"
cp -r "$FRONTEND_DIR/dist" "$TARGET_DIR/frontend-dist"
cp "$BACKEND_DIR/package.json" "$BACKEND_DIR/package-lock.json" "$TARGET_DIR/" 2>/dev/null || true

if [ -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env" "$TARGET_DIR/.env"
else
  echo "⚠️  No se encontró backend/.env"
fi

# =============================
# 4) Instalar dependencias de producción
# =============================
echo "[4/5] Instalando dependencias producción en bundle..."
cd "$TARGET_DIR"
npm install --omit=dev --no-audit --no-fund --silent
cd "$ROOT_DIR"

# =============================
# 5) Levantar backend
# =============================
echo "[5/5] Levantando backend..."

cd "$TARGET_DIR"
NODE_ENV=production node dist/server.js > backend-local.log 2>&1 &
BACKEND_PID=$!

cd "$ROOT_DIR"

echo ""
echo "✅ Backend corriendo con PID $BACKEND_PID"
echo "Logs en: .local-deploy/backend-local.log"
echo "Para detenerlo:"
echo "kill $BACKEND_PID"