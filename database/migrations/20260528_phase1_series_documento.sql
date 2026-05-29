BEGIN;

CREATE TABLE IF NOT EXISTS public.series_documento (
  id serial PRIMARY KEY,
  empresa_id integer NOT NULL,
  tipo_documento text NOT NULL,
  serie varchar(20),
  descripcion text,
  es_fiscal boolean NOT NULL DEFAULT false,
  activa boolean NOT NULL DEFAULT true,
  ultimo_numero integer NOT NULL DEFAULT 0,
  layout_id integer NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.series_documento ADD COLUMN IF NOT EXISTS serie varchar(20);
ALTER TABLE public.series_documento ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE public.series_documento ADD COLUMN IF NOT EXISTS es_fiscal boolean NOT NULL DEFAULT false;
ALTER TABLE public.series_documento ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;
ALTER TABLE public.series_documento ADD COLUMN IF NOT EXISTS ultimo_numero integer NOT NULL DEFAULT 0;
ALTER TABLE public.series_documento ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW();
ALTER TABLE public.series_documento ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'series_documento'
       AND column_name = 'nombre'
  ) THEN
    EXECUTE $sql$
      UPDATE public.series_documento
         SET serie = COALESCE(NULLIF(TRIM(serie), ''), NULLIF(TRIM(nombre), ''))
       WHERE COALESCE(NULLIF(TRIM(serie), ''), '') = ''
    $sql$;
  END IF;
END $$;

UPDATE public.series_documento
   SET serie = COALESCE(NULLIF(TRIM(serie), ''), 'DOC')
 WHERE COALESCE(NULLIF(TRIM(serie), ''), '') = '';

UPDATE public.series_documento
   SET tipo_documento = LOWER(TRIM(tipo_documento))
 WHERE tipo_documento IS NOT NULL;

ALTER TABLE public.series_documento ALTER COLUMN serie SET NOT NULL;
ALTER TABLE public.series_documento ALTER COLUMN tipo_documento SET NOT NULL;

ALTER TABLE public.series_documento DROP CONSTRAINT IF EXISTS uq_series_documento_empresa_tipo_nombre;
ALTER TABLE public.series_documento DROP CONSTRAINT IF EXISTS uq_series_documento_empresa_nombre;
ALTER TABLE public.series_documento DROP CONSTRAINT IF EXISTS uq_series_documento_empresa_tipo_serie;
ALTER TABLE public.series_documento DROP CONSTRAINT IF EXISTS chk_series_tipo_lower;

ALTER TABLE public.series_documento
  ADD CONSTRAINT uq_series_documento_empresa_tipo_serie UNIQUE (empresa_id, tipo_documento, serie);

ALTER TABLE public.series_documento
  ADD CONSTRAINT chk_series_tipo_lower CHECK (tipo_documento = LOWER(tipo_documento));

CREATE INDEX IF NOT EXISTS idx_series_documento_empresa_tipo_activa
  ON public.series_documento (empresa_id, tipo_documento, activa);

CREATE TABLE IF NOT EXISTS public.usuarios_series_documento (
  id serial PRIMARY KEY,
  usuario_id integer NOT NULL,
  serie_documento_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_usuarios_series_documento_usuario
    FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_usuarios_series_documento_serie
    FOREIGN KEY (serie_documento_id) REFERENCES public.series_documento(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uq_usuarios_series_documento UNIQUE (usuario_id, serie_documento_id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_series_documento_usuario
  ON public.usuarios_series_documento (usuario_id);

INSERT INTO public.series_documento (
  empresa_id,
  tipo_documento,
  serie,
  descripcion,
  es_fiscal,
  activa,
  ultimo_numero,
  updated_at
)
SELECT
  d.empresa_id,
  LOWER(TRIM(d.tipo_documento)) AS tipo_documento,
  COALESCE(NULLIF(TRIM(d.serie), ''), 'DOC') AS serie,
  CONCAT('Serie ', COALESCE(NULLIF(TRIM(d.serie), ''), 'DOC'), ' de ', LOWER(TRIM(d.tipo_documento))) AS descripcion,
  CASE
    WHEN LOWER(TRIM(d.tipo_documento)) IN ('factura', 'nota_credito')
      AND LOWER(COALESCE(TRIM(d.tratamiento_impuestos), 'normal')) <> 'sin_iva' THEN true
    ELSE false
  END AS es_fiscal,
  true AS activa,
  MAX(COALESCE(d.numero, 0)) AS ultimo_numero,
  NOW() AS updated_at
FROM public.documentos d
WHERE COALESCE(NULLIF(TRIM(d.tipo_documento), ''), '') <> ''
GROUP BY 1, 2, 3, 4, 5, 6
ON CONFLICT (empresa_id, tipo_documento, serie) DO UPDATE
SET descripcion = COALESCE(public.series_documento.descripcion, EXCLUDED.descripcion),
    es_fiscal = public.series_documento.es_fiscal OR EXCLUDED.es_fiscal,
    ultimo_numero = GREATEST(public.series_documento.ultimo_numero, EXCLUDED.ultimo_numero),
    updated_at = NOW();

WITH defaults(tipo_documento, serie, descripcion, es_fiscal) AS (
  VALUES
    ('cotizacion', 'COT', 'Serie default de cotizaciones', false),
    ('factura', 'FAC', 'Serie fiscal de facturas', true),
    ('factura', 'N', 'Serie no fiscal de facturas', false),
    ('nota_credito', 'NCR', 'Serie fiscal de notas de credito', true),
    ('nota_credito', 'NCN', 'Serie no fiscal de notas de credito', false),
    ('pago_cliente', 'PCL', 'Serie default de pagos de cliente', false),
    ('orden_servicio', 'OS', 'Serie default de ordenes de servicio', false),
    ('pedido', 'PED', 'Serie default de pedidos', false),
    ('remision', 'REM', 'Serie default de remisiones', false),
    ('orden_entrega', 'ODE', 'Serie default de ordenes de entrega', false),
    ('requisicion', 'REQ', 'Serie default de requisiciones', false),
    ('orden_compra', 'OC', 'Serie default de ordenes de compra', false),
    ('recepcion', 'REC', 'Serie default de recepciones', false),
    ('nota_credito_compra', 'NCC', 'Serie default de notas de credito de compra', false),
    ('pago_proveedor', 'PPR', 'Serie default de pagos a proveedor', false),
    ('factura_compra', 'FCO', 'Serie default de facturas de compra', false)
)
INSERT INTO public.series_documento (
  empresa_id,
  tipo_documento,
  serie,
  descripcion,
  es_fiscal,
  activa,
  ultimo_numero,
  updated_at
)
SELECT
  e.id,
  d.tipo_documento,
  d.serie,
  d.descripcion,
  d.es_fiscal,
  true,
  0,
  NOW()
FROM core.empresas e
CROSS JOIN defaults d
ON CONFLICT (empresa_id, tipo_documento, serie) DO NOTHING;

UPDATE public.series_documento sd
   SET ultimo_numero = COALESCE(src.max_numero, 0),
       updated_at = NOW()
  FROM (
    SELECT empresa_id,
           LOWER(TRIM(tipo_documento)) AS tipo_documento,
           COALESCE(NULLIF(TRIM(serie), ''), 'DOC') AS serie,
           MAX(COALESCE(numero, 0)) AS max_numero
      FROM public.documentos
     GROUP BY empresa_id, LOWER(TRIM(tipo_documento)), COALESCE(NULLIF(TRIM(serie), ''), 'DOC')
  ) src
 WHERE sd.empresa_id = src.empresa_id
   AND sd.tipo_documento = src.tipo_documento
   AND sd.serie = src.serie
   AND COALESCE(sd.ultimo_numero, 0) <> COALESCE(src.max_numero, 0);

COMMIT;