ALTER TABLE public.contactos_documentacion_tipos
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.contactos_documentacion_tipos
SET orden = CASE nombre
  WHEN 'Licencia de conducir' THEN 10
  WHEN 'Identificación' THEN 20
  WHEN 'Constancia fiscal' THEN 30
  WHEN 'Contrato' THEN 40
  WHEN 'Otro' THEN 90
  ELSE 100
END
WHERE orden = 100;

CREATE INDEX IF NOT EXISTS idx_contactos_documentacion_tipos_orden
  ON public.contactos_documentacion_tipos (activo, orden, nombre);
