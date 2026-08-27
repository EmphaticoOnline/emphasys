ALTER TABLE public.finanzas_movimientos_bancarios
  ADD COLUMN IF NOT EXISTS es_historico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.finanzas_movimientos_bancarios.es_historico IS
  'Indica que el movimiento proviene de un histórico migrado y no participa en la unicidad operativa por hash.';

ALTER TABLE public.finanzas_movimientos_bancarios
  DROP CONSTRAINT IF EXISTS uq_finanzas_movimientos_hash;

DROP INDEX IF EXISTS public.uq_finanzas_movimientos_hash;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finanzas_movimientos_hash_normal
  ON public.finanzas_movimientos_bancarios (empresa_id, cuenta_id, hash_movimiento)
  WHERE es_historico = false;

UPDATE public.finanzas_movimientos_bancarios AS m
SET es_historico = true
WHERE EXISTS (
  SELECT 1
  FROM migrate.entidades_correspondencias AS c
  WHERE c.sistema_origen = 'DICOR'
    AND c.tipo_entidad = 'movimiento_bancario'
    AND c.empresa_destino_id = m.empresa_id
    AND c.id_destino = m.id
);
