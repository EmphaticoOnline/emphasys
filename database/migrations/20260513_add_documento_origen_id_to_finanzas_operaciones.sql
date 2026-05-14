BEGIN;

-- Agregar columna
ALTER TABLE public.finanzas_operaciones
ADD COLUMN IF NOT EXISTS documento_origen_id integer NULL;

-- Agregar FK
ALTER TABLE public.finanzas_operaciones
ADD CONSTRAINT fk_finanzas_operaciones_documento_origen
FOREIGN KEY (documento_origen_id)
REFERENCES public.documentos(id)
ON DELETE SET NULL;

-- Índice
CREATE INDEX IF NOT EXISTS idx_finanzas_operaciones_documento_origen
ON public.finanzas_operaciones (documento_origen_id);

COMMIT;