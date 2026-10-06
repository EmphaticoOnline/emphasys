-- DATOS DE PRUEBA CONTROLADOS - NO EJECUTAR SIN REVISIÓN.
-- Producción: ESCUELA KEMPER URGATE / Cuenta de Prueba.
-- IDs verificados mediante npm run db:query:
-- empresa_id = 8, cuenta_id = 10, moneda = MXN.
-- Este script no modifica saldos de cuentas ni crea importaciones.

BEGIN;

DO $$
DECLARE
  v_empresa_id integer;
  v_cuenta_id integer;
BEGIN
  SELECT e.id, c.id INTO v_empresa_id, v_cuenta_id
  FROM core.empresas e
  JOIN public.finanzas_cuentas c ON c.empresa_id = e.id
  WHERE e.nombre = 'ESCUELA KEMPER URGATE'
    AND c.identificador = 'Cuenta de Prueba';

  IF v_empresa_id IS DISTINCT FROM 8 OR v_cuenta_id IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'La empresa/cuenta de prueba no coincide con la fotografía verificada: empresa %, cuenta %', v_empresa_id, v_cuenta_id;
  END IF;

  INSERT INTO public.finanzas_operaciones
    (empresa_id, cuenta_id, fecha, tipo_movimiento, monto, referencia, observaciones, naturaleza_operacion, estado_conciliacion)
  VALUES
    (v_empresa_id, v_cuenta_id, '2026-10-01', 'Deposito', 15000, 'TEST-CONC-001', 'Escenario Fase 2 caso 1 - coincidencia exacta', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-02', 'Deposito', 15000, 'TEST-CONC-002', 'Escenario Fase 2 caso 2 - diferencia de un día', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-03', 'Deposito', 15000, 'TEST-CONC-003', 'Escenario Fase 2 caso 3 - diferencia de dos días', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-04', 'Deposito', 15000, 'TEST-CONC-004', 'Escenario Fase 2 caso 4 - diferencia de tres días', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-05', 'Deposito', 15000, 'TEST-CONC-005', 'Escenario Fase 2 caso 5 - diferencia de cuatro días', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-11', 'Retiro',   3000,  'TEST-CONC-006', 'Escenario Fase 2 caso 6 - tipo contrario', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-12', 'Deposito', 12000, 'TEST-CONC-007A', 'Escenario Fase 2 caso 7 - candidato cercano', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-10', 'Deposito', 12000, 'TEST-CONC-007B', 'Escenario Fase 2 caso 7 - candidato lejano', 'movimiento_general', 'pendiente'),
    (v_empresa_id, v_cuenta_id, '2026-10-15', 'Deposito', 7500,  'TEST-CONC-008', 'Escenario Fase 2 caso 8 - referencia', 'movimiento_general', 'pendiente');
END $$;

COMMIT;

-- No incluye el movimiento TEST-BANK-009 porque deliberadamente no tiene operación contraparte.
-- Después de ejecutar este bloque, importar manualmente:
-- test/fixtures/finanzas/estado-cuenta-conciliacion-test.csv
