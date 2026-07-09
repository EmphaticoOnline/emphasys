-- =========================================================
-- SCRIPT:
-- 20260711_contabilidad_recalcular_afectable.sql
--
-- Corrige contabilidad.cuentas.afectable para que refleje la regla
-- correcta: afectable = true únicamente si la cuenta NO tiene
-- subcuentas, sin importar el nivel de estructura alcanzado.
--
-- Antes de corregir, reporta (RAISE WARNING, no bloquea la migración)
-- cualquier cuenta que tenga movimientos en polizas_detalle Y
-- subcuentas al mismo tiempo: es una inconsistencia contable previa
-- que debe revisarse manualmente, ya que implica que en algún momento
-- se creó una subcuenta bajo una cuenta que ya tenía movimientos.
-- =========================================================

BEGIN;

DO $$
DECLARE
  fila RECORD;
  total_inconsistencias integer := 0;
BEGIN
  FOR fila IN
    SELECT c.id, c.cuenta, c.descripcion
    FROM contabilidad.cuentas c
    WHERE EXISTS (
      SELECT 1 FROM contabilidad.polizas_detalle pd WHERE pd.cuenta_id = c.id
    )
    AND EXISTS (
      SELECT 1 FROM contabilidad.cuentas h WHERE h.cuenta_padre_id = c.id
    )
  LOOP
    total_inconsistencias := total_inconsistencias + 1;
    RAISE WARNING 'Cuenta inconsistente: id=%, cuenta=%, descripcion=% (tiene movimientos y subcuentas a la vez)',
      fila.id, fila.cuenta, fila.descripcion;
  END LOOP;

  IF total_inconsistencias > 0 THEN
    RAISE WARNING 'Se encontraron % cuenta(s) con movimientos y subcuentas simultáneamente. Revisar manualmente antes de confiar en la corrección automática de afectable para esas cuentas.', total_inconsistencias;
  END IF;
END $$;

UPDATE contabilidad.cuentas c
SET afectable = NOT EXISTS (
  SELECT 1
  FROM contabilidad.cuentas h
  WHERE h.cuenta_padre_id = c.id
),
actualizado_en = now()
WHERE afectable <> NOT EXISTS (
  SELECT 1
  FROM contabilidad.cuentas h
  WHERE h.cuenta_padre_id = c.id
);

COMMIT;
