ALTER TABLE documentos
  ALTER COLUMN estado_seguimiento SET DEFAULT 'borrador';

UPDATE documentos
SET estado_seguimiento = 'borrador'
WHERE tipo_documento = 'cotizacion'
  AND COALESCE(LOWER(TRIM(estado_seguimiento)), '') = 'cotizado'
  AND COALESCE(LOWER(TRIM(estatus_documento)), '') = 'borrador';