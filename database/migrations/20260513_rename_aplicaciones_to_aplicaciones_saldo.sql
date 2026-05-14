BEGIN;

LOCK TABLE public.aplicaciones IN ACCESS EXCLUSIVE MODE;

-- Renombrar tabla
ALTER TABLE public.aplicaciones
	RENAME TO aplicaciones_saldo;

-- Renombrar secuencia
ALTER SEQUENCE public.aplicaciones_id_seq
	RENAME TO aplicaciones_saldo_id_seq;

-- Ajustar default del ID
ALTER TABLE public.aplicaciones_saldo
	ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_saldo_id_seq'::regclass);

-- Reasignar ownership de secuencia
ALTER SEQUENCE public.aplicaciones_saldo_id_seq
	OWNED BY public.aplicaciones_saldo.id;

-- Renombrar PK
ALTER TABLE public.aplicaciones_saldo
	RENAME CONSTRAINT aplicaciones_pkey TO aplicaciones_saldo_pkey;

-- Renombrar CHECK
ALTER TABLE public.aplicaciones_saldo
	RENAME CONSTRAINT chk_aplicacion_origen TO chk_aplicaciones_saldo_origen;

-- Renombrar FKs
ALTER TABLE public.aplicaciones_saldo
	RENAME CONSTRAINT fk_aplicaciones_empresa TO fk_aplicaciones_saldo_empresa;

ALTER TABLE public.aplicaciones_saldo
	RENAME CONSTRAINT fk_aplicaciones_operacion TO fk_aplicaciones_saldo_operacion;

ALTER TABLE public.aplicaciones_saldo
	RENAME CONSTRAINT fk_aplicaciones_doc_origen TO fk_aplicaciones_saldo_doc_origen;

ALTER TABLE public.aplicaciones_saldo
	RENAME CONSTRAINT fk_aplicaciones_doc_destino TO fk_aplicaciones_saldo_doc_destino;

-- Renombrar índices
ALTER INDEX public.idx_aplicaciones_empresa
	RENAME TO idx_aplicaciones_saldo_empresa;

ALTER INDEX public.idx_aplicaciones_operacion
	RENAME TO idx_aplicaciones_saldo_operacion;

ALTER INDEX public.idx_aplicaciones_doc_origen
	RENAME TO idx_aplicaciones_saldo_doc_origen;

ALTER INDEX public.idx_aplicaciones_doc_destino
	RENAME TO idx_aplicaciones_saldo_doc_destino;

ALTER INDEX public.idx_aplicaciones_operacion_empresa
	RENAME TO idx_aplicaciones_saldo_operacion_empresa;

-- IMPORTANTE:
-- Primero eliminar la vista anterior
DROP VIEW IF EXISTS public.documentos_saldo;

-- Recrear vista apuntando a aplicaciones_saldo
CREATE VIEW public.documentos_saldo AS
SELECT
	d.id,
	d.empresa_id,
	d.tipo_documento,
	d.moneda,
	d.tipo_cambio,
	d.total,
	d.total - COALESCE(SUM(a.monto), 0) AS saldo
FROM public.documentos d
LEFT JOIN public.aplicaciones_saldo a
	ON a.documento_destino_id = d.id
	AND a.empresa_id = d.empresa_id
GROUP BY
	d.id,
	d.empresa_id,
	d.tipo_documento,
	d.moneda,
	d.tipo_cambio,
	d.total;

COMMENT ON VIEW public.documentos_saldo IS
'Vista de compatibilidad: saldo = total - aplicaciones_saldo.';

COMMIT;