-- Índice para acelerar consultas por partida en documentos_partidas_impuestos
CREATE INDEX idx_documentos_partidas_impuestos_partida_id
  ON public.documentos_partidas_impuestos (partida_id);

COMMENT ON INDEX idx_documentos_partidas_impuestos_partida_id IS 'Optimiza consultas que filtran por partida_id (cálculo y lectura de impuestos por partida).';
