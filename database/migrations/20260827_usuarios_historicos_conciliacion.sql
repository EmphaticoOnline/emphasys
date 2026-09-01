ALTER TABLE public.finanzas_conciliaciones
  ADD COLUMN IF NOT EXISTS metadatos jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.finanzas_conciliaciones.metadatos IS
  'Identidad histórica de usuarios de sistemas origen sin FK Emphasys equivalente.';
