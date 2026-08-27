-- El hash identifica contenido del archivo, no identidad histórica de importación.
ALTER TABLE public.finanzas_importaciones_bancarias
  DROP CONSTRAINT IF EXISTS uq_finanzas_importaciones_empresa_hash;
