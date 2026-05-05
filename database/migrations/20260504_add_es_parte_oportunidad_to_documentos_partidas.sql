ALTER TABLE public.documentos_partidas
  ADD COLUMN IF NOT EXISTS es_parte_oportunidad BOOLEAN;

ALTER TABLE public.documentos_partidas
  ALTER COLUMN es_parte_oportunidad SET DEFAULT TRUE;

UPDATE public.documentos_partidas
   SET es_parte_oportunidad = TRUE
 WHERE es_parte_oportunidad IS NULL;

COMMENT ON COLUMN public.documentos_partidas.es_parte_oportunidad IS
'Indica si la partida de la cotizacion debe considerarse dentro del monto real de la oportunidad comercial. Permite distinguir entre el total completo cotizado y las partidas que efectivamente cuentan para pipeline, forecast y valor comercial de la oportunidad.';