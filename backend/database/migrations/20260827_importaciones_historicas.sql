ALTER TABLE public.finanzas_importaciones_bancarias
  ADD COLUMN IF NOT EXISTS es_historica boolean NOT NULL DEFAULT false;
ALTER TABLE public.finanzas_importaciones_bancarias
  DROP CONSTRAINT IF EXISTS uq_finanzas_importaciones_empresa_hash;
UPDATE public.finanzas_importaciones_bancarias i
SET es_historica = true
WHERE EXISTS (
  SELECT 1 FROM migrate.entidades_correspondencias c
  WHERE c.sistema_origen = 'DICOR'
    AND c.tipo_entidad = 'importacion_bancaria'
    AND c.empresa_destino_id = i.empresa_id
    AND c.id_destino = i.id
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finanzas_importaciones_empresa_hash_normal
  ON public.finanzas_importaciones_bancarias (empresa_id, hash_archivo)
  WHERE es_historica = false;
COMMENT ON COLUMN public.finanzas_importaciones_bancarias.es_historica IS 'Importación histórica; permite repetir hash sólo cuando es true.';
