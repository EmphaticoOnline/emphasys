BEGIN;

ALTER TABLE transporte.viaje_mercancias
  ALTER COLUMN peso_kg DROP NOT NULL;

ALTER TABLE transporte.viaje_mercancias
  DROP CONSTRAINT IF EXISTS ck_transporte_viaje_mercancias_peso;

ALTER TABLE transporte.viaje_mercancias
  ADD CONSTRAINT ck_transporte_viaje_mercancias_peso
  CHECK (peso_kg IS NULL OR peso_kg > 0);

COMMIT;
