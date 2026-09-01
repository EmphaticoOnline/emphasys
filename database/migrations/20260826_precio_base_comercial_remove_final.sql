-- Ajuste semántico: el precio fiscal/documental ya vive en la partida.
-- El precio comercial final no tiene fuente independiente aprobada.
ALTER TABLE public.documentos_partidas_condiciones_comerciales
  DROP COLUMN IF EXISTS precio_comercial_final;
