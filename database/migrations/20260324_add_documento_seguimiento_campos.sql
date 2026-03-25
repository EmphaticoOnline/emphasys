-- Agrega campos de seguimiento comercial para cotizaciones y otros documentos
-- Permiten vista tipo Excel y edición rápida de seguimiento
ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS estado_seguimiento TEXT DEFAULT 'cotizado';

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS comentario_seguimiento TEXT;

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS producto_resumen TEXT;

-- Índice simple para filtros rápidos por estado de seguimiento
CREATE INDEX IF NOT EXISTS idx_documentos_estado_seguimiento
  ON documentos USING btree (estado_seguimiento);
