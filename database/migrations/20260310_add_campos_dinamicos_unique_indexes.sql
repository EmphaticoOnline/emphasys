-- Índices únicos para soportar UPSERT en campos dinámicos de documentos y partidas
-- Fecha: 2026-03-10

-- Documento (encabezado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_campos_empresa_documento_campo
  ON public.documentos_campos (empresa_id, documento_id, campo_id);

COMMENT ON INDEX idx_documentos_campos_empresa_documento_campo IS
  'Índice único que soporta el UPSERT del motor de campos dinámicos sobre documentos (empresa_id, documento_id, campo_id).';

-- Partidas
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_partidas_campos_empresa_partida_campo
  ON public.documentos_partidas_campos (empresa_id, partida_id, campo_id);

COMMENT ON INDEX idx_documentos_partidas_campos_empresa_partida_campo IS
  'Índice único que soporta el UPSERT del motor de campos dinámicos sobre partidas (empresa_id, partida_id, campo_id).';
