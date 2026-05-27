\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE sat.productos_servicios IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE sat_productos_servicios_stage (
	id text,
	texto text,
	iva_trasladado text,
	ieps_trasladado text,
	complemento text,
	vigencia_desde text,
	vigencia_hasta text,
	estimulo_frontera text,
	similares text
) ON COMMIT DROP;

\copy sat_productos_servicios_stage (id, texto, iva_trasladado, ieps_trasladado, complemento, vigencia_desde, vigencia_hasta, estimulo_frontera, similares) FROM '__CSV_PATH__' WITH (FORMAT csv, HEADER true, QUOTE '"', NULL '');

TRUNCATE TABLE sat.productos_servicios;

INSERT INTO sat.productos_servicios (
	id,
	texto,
	iva_trasladado,
	ieps_trasladado,
	complemento,
	vigencia_desde,
	vigencia_hasta,
	estimulo_frontera,
	similares,
	search_vector
)
SELECT
	COALESCE(NULLIF(BTRIM(id), ''), ''),
	COALESCE(NULLIF(BTRIM(texto), ''), ''),
	COALESCE(NULLIF(BTRIM(iva_trasladado), ''), ''),
	COALESCE(NULLIF(BTRIM(ieps_trasladado), ''), ''),
	COALESCE(NULLIF(BTRIM(complemento), ''), ''),
	COALESCE(NULLIF(BTRIM(vigencia_desde), ''), ''),
	COALESCE(NULLIF(BTRIM(vigencia_hasta), ''), ''),
	COALESCE(NULLIF(BTRIM(estimulo_frontera), ''), ''),
	COALESCE(NULLIF(BTRIM(similares), ''), ''),
	to_tsvector(
		'spanish',
		concat_ws(' ',
			COALESCE(NULLIF(BTRIM(id), ''), ''),
			COALESCE(NULLIF(BTRIM(texto), ''), ''),
			COALESCE(NULLIF(BTRIM(complemento), ''), ''),
			COALESCE(NULLIF(BTRIM(similares), ''), '')
		)
	)
FROM sat_productos_servicios_stage;

ANALYZE sat.productos_servicios;

SELECT
	COUNT(*) AS total_registros,
	COUNT(*) FILTER (
		WHERE texto ILIKE '%' || 'consult' || '%'
		   OR complemento ILIKE '%' || 'consult' || '%'
		   OR similares ILIKE '%' || 'consult' || '%'
		   OR id ILIKE '%' || 'consult' || '%'
	) AS matches_consult,
	COUNT(*) FILTER (
		WHERE texto ILIKE '%' || 'servi' || '%'
		   OR complemento ILIKE '%' || 'servi' || '%'
		   OR similares ILIKE '%' || 'servi' || '%'
		   OR id ILIKE '%' || 'servi' || '%'
	) AS matches_servi
FROM sat.productos_servicios;

COMMIT;