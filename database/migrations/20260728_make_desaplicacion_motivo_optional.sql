BEGIN;

ALTER TABLE public.finanzas_desaplicaciones_pago
  ALTER COLUMN motivo DROP NOT NULL;

ALTER TABLE public.finanzas_desaplicaciones_pago
  DROP CONSTRAINT IF EXISTS chk_finanzas_desaplicaciones_motivo;

ALTER TABLE public.finanzas_desaplicaciones_pago
  ADD CONSTRAINT chk_finanzas_desaplicaciones_motivo
  CHECK (motivo IS NULL OR char_length(btrim(motivo)) BETWEEN 1 AND 500);

COMMENT ON COLUMN public.finanzas_desaplicaciones_pago.motivo IS
  'Motivo funcional opcional capturado al desaplicar el pago.';

COMMIT;
