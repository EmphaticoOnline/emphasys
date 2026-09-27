BEGIN;

ALTER TABLE public.cfdi_intentos_timbrado
  ALTER COLUMN proveedor_cfdi_id DROP NOT NULL;

ALTER TABLE public.cfdi_intentos_timbrado
  DROP CONSTRAINT IF EXISTS cfdi_intentos_timbrado_estado_check;

ALTER TABLE public.cfdi_intentos_timbrado
  ADD CONSTRAINT cfdi_intentos_timbrado_estado_check
  CHECK (estado IN (
    'aceptado_pendiente_descarga',
    'xml_recuperado',
    'persistido',
    'error_descarga',
    'error_validacion',
    'error_previo_pac',
    'reconciliado'
  ));

COMMIT;
