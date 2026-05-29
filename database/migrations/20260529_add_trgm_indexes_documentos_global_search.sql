-- Migracion de rendimiento para la busqueda global de documentos.
-- IMPORTANTE: CREATE INDEX CONCURRENTLY no puede ejecutarse dentro de una transaccion.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA sat;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_clave_trgm
ON public.productos
USING gin (clave sat.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_descripcion_trgm
ON public.productos
USING gin (descripcion sat.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documentos_partidas_descripcion_alterna_trgm
ON public.documentos_partidas
USING gin (descripcion_alterna sat.gin_trgm_ops)
WHERE descripcion_alterna IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documentos_partidas_observaciones_trgm
ON public.documentos_partidas
USING gin (observaciones sat.gin_trgm_ops)
WHERE observaciones IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documentos_partidas_comentarios_internos_trgm
ON public.documentos_partidas
USING gin (comentarios_internos sat.gin_trgm_ops)
WHERE comentarios_internos IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contactos_nombre_trgm
ON public.contactos
USING gin (nombre sat.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contactos_email_trgm
ON public.contactos
USING gin (email sat.gin_trgm_ops)
WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contactos_telefono_trgm
ON public.contactos
USING gin (telefono sat.gin_trgm_ops)
WHERE telefono IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contactos_telefono_secundario_trgm
ON public.contactos
USING gin (telefono_secundario sat.gin_trgm_ops)
WHERE telefono_secundario IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conceptos_nombre_concepto_trgm
ON public.conceptos
USING gin (nombre_concepto sat.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documentos_nombre_receptor_trgm
ON public.documentos
USING gin (nombre_receptor sat.gin_trgm_ops)
WHERE nombre_receptor IS NOT NULL;