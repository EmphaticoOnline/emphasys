-- =========================================================
-- reimport_sat_codigos_agrupadores.sql
--
-- Carga/actualiza el catálogo oficial de códigos agrupadores de cuentas
-- (Anexo 24, Contabilidad Electrónica) en sat.codigos_agrupadores, a
-- partir de database/catalogos/sat/codigos_agrupadores_sat.csv.
--
-- Fuente del CSV: "Código agrupador de cuentas del SAT" (PDF oficial),
-- publicado en:
--   - https://www.gob.mx/sat/documentos/codigo-agrupador-de-cuentas-del-sat
--   - http://omawww.sat.gob.mx/fichas_tematicas/buzon_tributario/Documents/codigo_agrupador.pdf
-- Extraído el 2026-07-08 (ambas URLs sirven el mismo archivo, verificado
-- por hash SHA-256 idéntico). El PDF fuente NO incluye una columna de
-- "naturaleza" (D/A) para los códigos agrupadores; por eso esa columna
-- viene vacía en el CSV y en la tabla. La columna "nivel" solo viene
-- explícita para las cuentas de nivel mayor (1) y subcuentas de primer
-- nivel (2); los encabezados de categoría (100 Activo, 200 Pasivo, 300
-- Capital contable, 400 Ingresos, 500 Costos, 600 Gastos, 700 Resultado
-- integral de financiamiento, 800 Cuentas de orden y sus subtotales de
-- corto/largo plazo) y el código especial "000" (sector financiero, cuyo
-- nivel depende del catálogo del contribuyente) no traen nivel fijo en
-- la fuente oficial: se dejan NULL, no se infieren.
--
-- A diferencia de reimport_sat_productos_servicios.sql, este script NO
-- trunca la tabla: hace INSERT ... ON CONFLICT (codigo) DO UPDATE, para
-- que una recarga con una versión más nueva del catálogo actualice
-- descripciones/nivel/naturaleza sin desvincular códigos que ya estén en
-- uso en contabilidad.cuentas.codigo_agrupador_sat.
--
-- Requiere un CSV con encabezado exacto:
--   codigo,descripcion,nivel,naturaleza
-- donde:
--   - codigo: texto tal como lo publica el SAT (ej. 102.01)
--   - descripcion: texto
--   - nivel: entero positivo o vacío
--   - naturaleza: 'D', 'A' o vacío
--
-- Uso (ejecutar con el directorio de trabajo en la raíz del repo, porque
-- \copy resuelve la ruta del CSV en el cliente psql, no en el servidor):
--   psql "$DATABASE_URL" -f database/scripts/reimport_sat_codigos_agrupadores.sql
-- =========================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE sat_codigos_agrupadores_stage (
	codigo text,
	descripcion text,
	nivel text,
	naturaleza text
) ON COMMIT DROP;

\copy sat_codigos_agrupadores_stage (codigo, descripcion, nivel, naturaleza) FROM 'database/catalogos/sat/codigos_agrupadores_sat.csv' WITH (FORMAT csv, HEADER true, QUOTE '"', NULL '');

INSERT INTO sat.codigos_agrupadores (codigo, descripcion, nivel, naturaleza, activo, actualizado_en)
SELECT
	BTRIM(codigo),
	BTRIM(descripcion),
	NULLIF(BTRIM(nivel), '')::smallint,
	NULLIF(UPPER(BTRIM(naturaleza)), ''),
	true,
	now()
FROM sat_codigos_agrupadores_stage
WHERE BTRIM(codigo) <> '' AND BTRIM(descripcion) <> ''
ON CONFLICT (codigo) DO UPDATE SET
	descripcion = EXCLUDED.descripcion,
	nivel = EXCLUDED.nivel,
	naturaleza = EXCLUDED.naturaleza,
	activo = true,
	actualizado_en = now();

-- Verificación: total cargado y muestra de las primeras filas.
SELECT COUNT(*) AS total_codigos_agrupadores FROM sat.codigos_agrupadores;

SELECT codigo, descripcion, nivel, naturaleza
FROM sat.codigos_agrupadores
ORDER BY codigo
LIMIT 20;

COMMIT;
