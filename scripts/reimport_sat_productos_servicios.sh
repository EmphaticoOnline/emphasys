#!/usr/bin/env bash
set -euo pipefail

SOURCE_XLS="${SOURCE_XLS:-/Users/antoniodiaz/OneDrive/Emphasys/SAT/Catalogos/catCFDI_V_4_24082022.xls}"
SHEET_NAME="${SHEET_NAME:-c_ClaveProdServ}"
TMP_DIR="$(mktemp -d)"
CSV_PATH="${CSV_PATH:-$TMP_DIR/sat_productos_servicios.csv}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$ROOT_DIR/database/scripts/reimport_sat_productos_servicios.sql"

load_env_file() {
	local env_file="$1"
	if [[ -f "$env_file" ]]; then
		set -a
		# shellcheck disable=SC1090
		source "$env_file"
		set +a
	fi
}

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/backend/.env"

if [[ -z "${DATABASE_URL:-}${PGHOST:-}" ]]; then
	echo "Debes definir DATABASE_URL o PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE para conectar a PostgreSQL." >&2
	exit 1
fi

trap 'rm -rf "$TMP_DIR"' EXIT

echo "1/3 Exportando Excel a CSV..."
(cd "$ROOT_DIR/backend" && npx ts-node src/scripts/importSatProductosServiciosCsv.ts \
	--input "$SOURCE_XLS" \
	--sheet "$SHEET_NAME" \
	--output "$CSV_PATH")

echo "2/3 Recargando sat.productos_servicios con COPY..."
RUNTIME_SQL_FILE="$TMP_DIR/reimport_sat_productos_servicios.sql"
sed "s|__CSV_PATH__|$CSV_PATH|g" "$SQL_FILE" > "$RUNTIME_SQL_FILE"
if [[ -n "${DATABASE_URL:-}" ]]; then
	psql "$DATABASE_URL" \
		-v ON_ERROR_STOP=1 \
		-f "$RUNTIME_SQL_FILE"
else
	psql \
		-v ON_ERROR_STOP=1 \
		-f "$RUNTIME_SQL_FILE"
fi

echo "3/3 Importación finalizada. CSV temporal: $CSV_PATH"