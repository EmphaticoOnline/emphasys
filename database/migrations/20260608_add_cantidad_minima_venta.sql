BEGIN;

ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS cantidad_minima_venta numeric(15,4);

-- Verificar resultado:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'productos' AND column_name = 'cantidad_minima_venta';

ROLLBACK;  -- Cambiar a COMMIT cuando estés listo para aplicar
