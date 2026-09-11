BEGIN;

ALTER TABLE IF EXISTS documentacion.documentos_empresa
  RENAME TO adjuntos;

ALTER INDEX IF EXISTS documentacion.documentos_empresa_empresa_fecha_idx
  RENAME TO adjuntos_empresa_fecha_idx;
ALTER INDEX IF EXISTS documentacion.documentos_empresa_empresa_tipo_idx
  RENAME TO adjuntos_empresa_tipo_idx;
ALTER INDEX IF EXISTS documentacion.documentos_empresa_empresa_vigente_idx
  RENAME TO adjuntos_empresa_vigente_idx;

ALTER SEQUENCE IF EXISTS documentacion.documentos_empresa_id_seq
  RENAME TO adjuntos_id_seq;

ALTER TABLE IF EXISTS documentacion.adjuntos
  RENAME CONSTRAINT documentos_empresa_pkey TO adjuntos_pkey;
ALTER TABLE IF EXISTS documentacion.adjuntos
  RENAME CONSTRAINT documentos_empresa_empresa_id_fkey TO adjuntos_empresa_id_fkey;
ALTER TABLE IF EXISTS documentacion.adjuntos
  RENAME CONSTRAINT documentos_empresa_tipo_id_fkey TO adjuntos_tipo_id_fkey;
ALTER TABLE IF EXISTS documentacion.adjuntos
  RENAME CONSTRAINT documentos_empresa_usuario_subio_id_fkey TO adjuntos_usuario_subio_id_fkey;

ALTER TABLE IF EXISTS documentacion.adjuntos
  ADD COLUMN IF NOT EXISTS documento_id integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'adjuntos_documento_id_fkey'
       AND conrelid = 'documentacion.adjuntos'::regclass
  ) THEN
    ALTER TABLE documentacion.adjuntos
      ADD CONSTRAINT adjuntos_documento_id_fkey
      FOREIGN KEY (documento_id)
      REFERENCES public.documentos(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS adjuntos_empresa_documento_idx
  ON documentacion.adjuntos (empresa_id, documento_id);

ALTER SEQUENCE IF EXISTS documentacion.adjuntos_id_seq
  OWNED BY documentacion.adjuntos.id;

COMMIT;
