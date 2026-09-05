-- ============================================================================
-- Corrige el alcance del UNIQUE de figuras de transporte.
-- ----------------------------------------------------------------------------
-- 20260901_figuras_transporte.sql creó, por error, un UNIQUE global por
-- empresa+contacto en transporte.viaje_figuras. Eso impide que un mismo
-- operador (figura SAT 01) participe en más de un Viaje por empresa: al
-- guardar un segundo Viaje con ese operador PostgreSQL lanza 23505 y el
-- endpoint responde 409 "clave o secuencia duplicada".
--
-- El alcance correcto es por Viaje: un contacto/figura no puede repetirse
-- dentro del mismo Viaje, pero sí entre Viajes distintos.
-- (La unicidad de secuencia dentro del Viaje ya la cubre
--  uq_transporte_viaje_figuras_secuencia.)
--
-- Idempotente.
-- ============================================================================

BEGIN;

ALTER TABLE transporte.viaje_figuras
  DROP CONSTRAINT IF EXISTS uq_viaje_figuras_empresa_contacto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_viaje_figuras_viaje_contacto'
  ) THEN
    ALTER TABLE transporte.viaje_figuras
      ADD CONSTRAINT uq_viaje_figuras_viaje_contacto
      UNIQUE (empresa_id, viaje_id, contacto_id);
  END IF;
END $$;

COMMIT;
