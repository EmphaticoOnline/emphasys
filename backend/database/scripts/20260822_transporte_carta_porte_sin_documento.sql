BEGIN;

ALTER TABLE transporte.cartas_porte
  ALTER COLUMN documento_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_transporte_cartas_porte_viaje_sin_documento
  ON transporte.cartas_porte (viaje_id)
  WHERE documento_id IS NULL;

COMMIT;
