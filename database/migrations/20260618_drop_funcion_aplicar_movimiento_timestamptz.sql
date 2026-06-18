-- Elimina la sobrecarga TIMESTAMPTZ de inventario.aplicar_movimiento.
-- La sobrecarga DATE (20260618_movimientos_fecha_date.sql) es la versión correcta.
-- Tener dos sobrecargas causa que PostgreSQL resuelva la ambigüedad eligiendo
-- TIMESTAMPTZ (tipo preferido de la categoría datetime), lo que impide que
-- la emisión y la reversión llamen a la versión DATE.

DROP FUNCTION IF EXISTS inventario.aplicar_movimiento(
  INTEGER,
  VARCHAR(30),
  TIMESTAMPTZ,
  INTEGER,
  INTEGER,
  TEXT,
  JSONB
);
