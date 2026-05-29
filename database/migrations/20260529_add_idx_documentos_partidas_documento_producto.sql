CREATE INDEX IF NOT EXISTS idx_documentos_partidas_documento_id
ON public.documentos_partidas (documento_id);

CREATE INDEX IF NOT EXISTS idx_documentos_partidas_producto_id
ON public.documentos_partidas (producto_id);

COMMENT ON INDEX idx_documentos_partidas_documento_id IS
'Optimiza filtros relacionales por documento, incluyendo EXISTS correlacionados desde listados de documentos.';

COMMENT ON INDEX idx_documentos_partidas_producto_id IS
'Optimiza joins y filtros relacionales entre partidas de documentos y productos.';