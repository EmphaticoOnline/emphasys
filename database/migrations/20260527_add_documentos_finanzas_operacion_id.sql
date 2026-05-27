ALTER TABLE public.documentos
ADD COLUMN IF NOT EXISTS finanzas_operacion_id int4 NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documentos_finanzas_operacion_id_fkey'
      AND conrelid = 'public.documentos'::regclass
  ) THEN
    ALTER TABLE public.documentos
    ADD CONSTRAINT documentos_finanzas_operacion_id_fkey
    FOREIGN KEY (finanzas_operacion_id)
    REFERENCES public.finanzas_operaciones(id)
    ON DELETE NO ACTION;
  END IF;
END $$;