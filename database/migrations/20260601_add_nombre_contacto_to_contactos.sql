ALTER TABLE public.contactos
	ADD COLUMN IF NOT EXISTS nombre_contacto VARCHAR(150) NULL;

COMMENT ON COLUMN public.contactos.nombre_contacto IS 'Nombre de la persona de contacto asociado a la empresa del contacto';

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA sat;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contactos_nombre_contacto_trgm
ON public.contactos
USING gin (nombre_contacto sat.gin_trgm_ops)
WHERE nombre_contacto IS NOT NULL;

-- Rollback manual:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_contactos_nombre_contacto_trgm;
-- ALTER TABLE public.contactos DROP COLUMN IF EXISTS nombre_contacto;
