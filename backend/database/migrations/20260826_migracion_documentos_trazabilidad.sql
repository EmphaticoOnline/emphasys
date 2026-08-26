-- Trazabilidad incremental de entidades DICOR. No contiene datos de negocio.
ALTER TABLE migrate.entidades_correspondencias
  ADD COLUMN IF NOT EXISTS hash_origen text,
  ADD COLUMN IF NOT EXISTS snapshot_origen jsonb,
  ADD COLUMN IF NOT EXISTS fecha_ultima_sincronizacion timestamptz,
  ADD COLUMN IF NOT EXISTS version_transformacion text,
  ADD COLUMN IF NOT EXISTS estado_sincronizacion text NOT NULL DEFAULT 'nuevo',
  ADD COLUMN IF NOT EXISTS ultimo_error text;

ALTER TABLE migrate.entidades_correspondencias
  DROP CONSTRAINT IF EXISTS ck_entidades_correspondencias_estado_sync;
ALTER TABLE migrate.entidades_correspondencias
  ADD CONSTRAINT ck_entidades_correspondencias_estado_sync
  CHECK (estado_sincronizacion IN ('nuevo','sin_cambios','modificado','excepcion','bloqueado'));

CREATE INDEX IF NOT EXISTS idx_entidades_correspondencias_sync
  ON migrate.entidades_correspondencias (sistema_origen, empresa_destino_id, tipo_entidad, estado_sincronizacion);

COMMENT ON COLUMN migrate.entidades_correspondencias.hash_origen IS 'Hash SHA-256 determinista de los campos que afectan la transformación.';
COMMENT ON COLUMN migrate.entidades_correspondencias.snapshot_origen IS 'Snapshot normalizado y acotado; no almacena XML completo.';
COMMENT ON COLUMN migrate.entidades_correspondencias.estado_sincronizacion IS 'Estado incremental de sincronización del origen.';
