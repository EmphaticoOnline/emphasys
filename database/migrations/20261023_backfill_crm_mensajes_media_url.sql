-- Backfill idempotente de URLs multimedia históricas.
-- No ejecutar automáticamente: aplicar explícitamente tras validar el conteo.
-- Solo considera URLs HTTP(S) no vacías y no toca texto ni mensajes entrantes.

BEGIN;

UPDATE crm.mensajes
SET media_url = contenido
WHERE tipo_mensaje = 'saliente'
  AND tipo_contenido IN ('image', 'audio', 'document', 'video')
  AND NULLIF(BTRIM(media_url), '') IS NULL
  AND contenido ~* '^https?://[^[:space:]]+$';

COMMIT;
