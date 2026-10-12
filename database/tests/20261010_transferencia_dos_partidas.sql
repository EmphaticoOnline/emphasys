-- Prueba transaccional de la corrección de transferencias.
-- Ejecutar únicamente en una base de pruebas con ROLLBACK al final.
-- No forma parte de la migración y no debe ejecutarse contra producción.

BEGIN;

DO $$
DECLARE
  v_movimiento bigint;
  v_partidas integer;
  v_salida record;
  v_entrada record;
BEGIN
  SELECT inventario.aplicar_movimiento(
    8, 'transferencia', current_date, NULL, NULL,
    'TEST TRANSFERENCIA ATOMICA',
    jsonb_build_array(jsonb_build_object(
      'producto_id', 6213,
      'almacen_id', 40,
      'almacen_destino_id', 41,
      'cantidad', '50',
      'sentido', 'transferencia'
    )),
    NULL
  ) INTO v_movimiento;

  SELECT count(*) INTO v_partidas
    FROM inventario.movimientos_partidas
   WHERE movimiento_id = v_movimiento;
  IF v_partidas <> 2 THEN
    RAISE EXCEPTION 'Se esperaban 2 partidas y se encontraron %', v_partidas;
  END IF;

  SELECT cantidad, almacen_id, almacen_destino_id, signo, tipo_partida,
         valor_movimiento
    INTO v_salida
    FROM inventario.movimientos_partidas
   WHERE movimiento_id = v_movimiento
     AND tipo_partida = 'salida_transferencia';

  SELECT cantidad, almacen_id, almacen_destino_id, signo, tipo_partida,
         valor_movimiento
    INTO v_entrada
    FROM inventario.movimientos_partidas
   WHERE movimiento_id = v_movimiento
     AND tipo_partida = 'entrada_transferencia';

  IF v_salida.cantidad <> 50 OR v_entrada.cantidad <> 50
     OR v_salida.almacen_id <> 40 OR v_salida.almacen_destino_id <> 41
     OR v_entrada.almacen_id <> 41 OR v_entrada.almacen_destino_id <> 40
     OR v_salida.signo <> -1 OR v_entrada.signo <> 1 THEN
    RAISE EXCEPTION 'Origen, destino, cantidad o signos incorrectos';
  END IF;

  IF v_salida.valor_movimiento IS NULL OR v_entrada.valor_movimiento IS NULL
     OR v_salida.valor_movimiento + v_entrada.valor_movimiento <> 0 THEN
    RAISE EXCEPTION 'La valoración transferida no se conserva';
  END IF;
END;
$$;

ROLLBACK;
