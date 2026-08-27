-- Permite representar crédito DICOR aplicado directamente a un documento,
-- sin convertirlo en una segunda disponibilidad financiera.
ALTER TABLE public.aplicaciones_saldo
  ADD COLUMN IF NOT EXISTS credito_operacion_id integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_aplicaciones_credito_operacion') THEN
    ALTER TABLE public.aplicaciones_saldo
      ADD CONSTRAINT fk_aplicaciones_credito_operacion
      FOREIGN KEY (credito_operacion_id) REFERENCES public.credito_operaciones(id) ON DELETE RESTRICT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_aplicacion_origen') THEN
    ALTER TABLE public.aplicaciones_saldo DROP CONSTRAINT chk_aplicacion_origen;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_aplicacion_origen') THEN
    ALTER TABLE public.aplicaciones_saldo ADD CONSTRAINT chk_aplicacion_origen CHECK (
      (CASE WHEN finanzas_operacion_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN documento_origen_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN credito_operacion_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_aplicaciones_saldo_credito_operacion ON public.aplicaciones_saldo(credito_operacion_id);
COMMENT ON COLUMN public.aplicaciones_saldo.credito_operacion_id IS 'Crédito origen aplicado directamente al documento; no representa una disponibilidad de caja.';
