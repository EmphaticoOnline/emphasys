BEGIN;

ALTER TABLE transporte.viaje_ubicaciones
  ALTER COLUMN remitente_destinatario_rfc DROP NOT NULL;

ALTER TABLE transporte.viaje_mercancias
  ALTER COLUMN clave_bienes_transportados_sat DROP NOT NULL,
  ALTER COLUMN clave_unidad_sat DROP NOT NULL,
  ALTER COLUMN unidad_descripcion DROP NOT NULL;

ALTER TABLE transporte.viaje_ubicaciones
  DROP CONSTRAINT IF EXISTS ck_transporte_viaje_ubicaciones_rfc,
  DROP CONSTRAINT IF EXISTS uq_transporte_viaje_ubicaciones_secuencia;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'uq_transporte_viaje_ubicaciones_secuencia'
       AND conrelid = 'transporte.viaje_ubicaciones'::regclass
  ) THEN
    ALTER TABLE transporte.viaje_ubicaciones
      ADD CONSTRAINT uq_transporte_viaje_ubicaciones_secuencia
      UNIQUE (viaje_id, secuencia);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_transporte_viaje_ubicaciones_origen
  ON transporte.viaje_ubicaciones (viaje_id)
  WHERE tipo = 'origen';

ALTER TABLE transporte.viaje_figuras
  DROP CONSTRAINT IF EXISTS ck_transporte_viaje_figuras_tipo;

COMMIT;
