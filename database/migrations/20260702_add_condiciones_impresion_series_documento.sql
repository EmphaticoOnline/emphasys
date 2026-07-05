BEGIN;

ALTER TABLE public.series_documento
  ADD COLUMN IF NOT EXISTS condiciones_impresion text NULL;

COMMENT ON COLUMN public.series_documento.condiciones_impresion IS
  'Texto enriquecido con condiciones, advertencias o notas que se imprimen al pie de los documentos generados con esta serie.';

COMMIT;
