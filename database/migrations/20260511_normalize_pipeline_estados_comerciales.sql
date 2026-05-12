UPDATE public.documentos
SET estado_seguimiento = 'abierta'
WHERE LOWER(COALESCE(tipo_documento, '')) = 'cotizacion'
  AND LOWER(TRIM(COALESCE(estado_seguimiento, ''))) IN (
    'borrador',
    'enviado',
    'en negociacion',
    'negociacion',
    'cotizado'
  );

UPDATE public.documentos
SET estado_seguimiento = 'convertida'
WHERE LOWER(TRIM(COALESCE(estado_seguimiento, ''))) IN ('ganada', 'ganado');

UPDATE public.documentos
SET estado_seguimiento = 'perdida'
WHERE LOWER(TRIM(COALESCE(estado_seguimiento, ''))) = 'perdido';

UPDATE public.documentos
SET estado_seguimiento = 'no seleccionada'
WHERE LOWER(TRIM(COALESCE(estado_seguimiento, ''))) IN ('no_seleccionada', 'no-seleccionada');

ALTER TABLE public.documentos
  ALTER COLUMN estado_seguimiento SET DEFAULT 'abierta';

UPDATE crm.oportunidades_venta
SET estatus = 'convertida',
    updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(estatus, ''))) IN ('ganada', 'ganado');

UPDATE crm.oportunidades_venta
SET estatus = 'perdida',
    updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(estatus, ''))) = 'perdido';

UPDATE crm.conversaciones
SET etapa_oportunidad = 'convertida'
WHERE LOWER(TRIM(COALESCE(etapa_oportunidad, ''))) IN ('ganada', 'ganado');

UPDATE crm.conversaciones
SET etapa_oportunidad = 'perdida'
WHERE LOWER(TRIM(COALESCE(etapa_oportunidad, ''))) = 'perdido';

ALTER TABLE crm.conversaciones
  DROP CONSTRAINT IF EXISTS chk_etapa_oportunidad;

ALTER TABLE crm.conversaciones
  ADD CONSTRAINT chk_etapa_oportunidad
  CHECK (
    etapa_oportunidad IN (
      'nuevo',
      'contactado',
      'interesado',
      'cotizado',
      'negociacion',
      'convertida',
      'perdida'
    )
  );

COMMENT ON COLUMN crm.oportunidades_venta.estatus IS
'Estatus comercial: abierta, pausada, convertida, perdida o cancelada.';

COMMENT ON COLUMN crm.conversaciones.etapa_oportunidad IS
'Etapa comercial del lead: nuevo, contactado, interesado, cotizado, negociacion, convertida o perdida.';