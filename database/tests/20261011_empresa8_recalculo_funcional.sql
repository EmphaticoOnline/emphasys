-- Batería funcional del motor de recálculo para empresa 8 / producto 6213.
-- NO ejecutar contra producción. Cada caso es una transacción independiente
-- que termina en ROLLBACK. No aplica migraciones ni usa db:query.
-- Requiere que la migración canónica del motor ya esté instalada en la base
-- de pruebas. Los movimientos de prueba usan IDs negativos ficticios.

-- Baseline conocido antes de cada caso:
-- entrada afectada: 150 @ 120 a almacén 40
-- transferencia afectada: 50 de 40 a 41 @ 120
-- estado esperado: 40=100 unidades/$12,000; 41=50 unidades/$6,000.

-- 1. Entrada adicional con costo diferente.
BEGIN;
INSERT INTO inventario.movimientos(id,empresa_id,tipo_movimiento,fecha,estatus_afectacion)
VALUES (-101,8,'entrada','2026-10-11',1);
INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
VALUES (-101,8,-101,6213,40,'2026-10-11',50,1,'normal',180,0);
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE q numeric; v numeric; c numeric; BEGIN
  SELECT existencia INTO q FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
  SELECT sum(valor_movimiento), max(costo_promedio_resultante) INTO v,c FROM inventario.movimientos_partidas WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40 AND tipo_partida='normal' AND existencia_resultante<>0;
  IF q<>150 OR v<>27000 OR c<>180 THEN RAISE EXCEPTION 'Caso 1: esperado 150/$27000/$180, obtenido %/%/%',q,v,c; END IF;
END $$;
ROLLBACK;

-- 2. Salida normal con costo promedio.
BEGIN;
INSERT INTO inventario.movimientos(id,empresa_id,tipo_movimiento,fecha,estatus_afectacion) VALUES (-102,8,'salida','2026-10-11',1);
INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
VALUES (-102,8,-102,6213,40,'2026-10-11',30,-1,'normal',NULL,0);
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE q numeric; v numeric; c numeric; BEGIN
  SELECT existencia INTO q FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
  SELECT sum(valor_movimiento), costo_promedio_resultante INTO v,c FROM inventario.movimientos_partidas WHERE id=-102;
  IF q<>70 OR v<>-3600 OR c<>120 THEN RAISE EXCEPTION 'Caso 2: esperado 70/-3600/120, obtenido %/%/%',q,v,c; END IF;
END $$;
ROLLBACK;

-- 3. Entrada retroactiva que cambia costos posteriores.
BEGIN;
INSERT INTO inventario.movimientos(id,empresa_id,tipo_movimiento,fecha,estatus_afectacion) VALUES (-103,8,'entrada','2026-10-09',1);
INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
VALUES (-103,8,-103,6213,40,'2026-10-09',100,1,'normal',60,0);
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE q40 numeric; v40 numeric; c40 numeric; q41 numeric; c41 numeric; BEGIN
  SELECT existencia INTO q40 FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
  SELECT existencia INTO q41 FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=41;
  SELECT valor_movimiento,costo_promedio_resultante INTO v40,c40 FROM inventario.movimientos_partidas WHERE id=-103;
  SELECT costo_promedio_resultante INTO c41 FROM inventario.movimientos_partidas WHERE id=2860;
  IF q40<>200 OR q41<>50 OR v40<>6000 OR c40<>60 OR c41<>96 THEN RAISE EXCEPTION 'Caso 3: resultados retroactivos inesperados 40=%/%/% 41=%/%',q40,v40,c40,q41,c41; END IF;
END $$;
ROLLBACK;

-- 4. Transferencia hacia almacén 42.
BEGIN;
INSERT INTO inventario.movimientos(id,empresa_id,tipo_movimiento,fecha,estatus_afectacion) VALUES (-104,8,'transferencia','2026-10-11',1);
INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,almacen_destino_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
VALUES (-104,8,-104,6213,40,42,'2026-10-11',20,-1,'salida_transferencia',NULL,0),
       (-105,8,-104,6213,42,40,'2026-10-11',20,1,'entrada_transferencia',NULL,0);
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE q40 numeric; q42 numeric; c42 numeric; BEGIN
  SELECT existencia INTO q40 FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
  SELECT existencia INTO q42 FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=42;
  SELECT costo_unitario INTO c42 FROM inventario.movimientos_partidas WHERE id=-105;
  IF q40<>80 OR q42<>20 OR c42<>120 THEN RAISE EXCEPTION 'Caso 4: transferencia 40/42/costo incorrecta: %/%/%',q40,q42,c42; END IF;
END $$;
ROLLBACK;

-- 5. Movimiento desafectado: no altera existencias ni resultados derivados.
BEGIN;
INSERT INTO inventario.movimientos(id,empresa_id,tipo_movimiento,fecha,estatus_afectacion) VALUES (-106,8,'salida','2026-10-11',0);
INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
VALUES (-106,8,-106,6213,40,'2026-10-11',999,-1,'normal',NULL,0);
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE q numeric; BEGIN
  SELECT existencia INTO q FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
  IF q<>100 THEN RAISE EXCEPTION 'Caso 5: partida desafectada alteró existencia: %',q; END IF;
END $$;
ROLLBACK;

-- 6. Diferencia únicamente de costo/valor: se corrompen columnas derivadas,
-- sin tocar cantidad ni existencia; la reconstrucción debe corregirlas.
BEGIN;
UPDATE inventario.movimientos_partidas SET valor_movimiento=999999,costo_promedio_resultante=999999 WHERE id=2847;
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE q numeric; v numeric; c numeric; BEGIN
  SELECT existencia INTO q FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
  SELECT valor_movimiento,costo_promedio_resultante INTO v,c FROM inventario.movimientos_partidas WHERE id=2847;
  IF q<>100 OR v<>18000 OR c<>120 THEN RAISE EXCEPTION 'Caso 6: corrección de derivados fallida: %/%/%',q,v,c; END IF;
END $$;
ROLLBACK;

-- 7. Diferencia únicamente de existencia.
BEGIN;
UPDATE inventario.existencias SET existencia=999999 WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE q numeric; BEGIN
  SELECT existencia INTO q FROM inventario.existencias WHERE empresa_id=8 AND producto_id=6213 AND almacen_id=40;
  IF q<>100 THEN RAISE EXCEPTION 'Caso 7: existencia no reconstruida: %',q; END IF;
END $$;
ROLLBACK;

-- 8. Análisis obsoleto: ejecutar el endpoint de análisis, registrar su revision,
-- insertar un movimiento en otra sesión y ejecutar con la revision anterior.
-- Resultado esperado del endpoint: HTTP 409 y code=RECALCULO_OBSOLETO.
-- Este caso se ejecuta mediante el servicio HTTP, no como función SQL aislada.

-- 9. Idempotencia: dos reconstrucciones consecutivas conservan exactamente los
-- mismos resultados y cantidades originales.
BEGIN;
SELECT inventario.reconstruir_producto(8,6213);
CREATE TEMP TABLE recalc_snapshot AS SELECT id,cantidad,existencia_resultante,valor_movimiento,costo_promedio_resultante FROM inventario.movimientos_partidas WHERE empresa_id=8;
SELECT inventario.reconstruir_producto(8,6213);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM recalc_snapshot s JOIN inventario.movimientos_partidas p ON p.id=s.id
   WHERE (s.cantidad,s.existencia_resultante,s.valor_movimiento,s.costo_promedio_resultante) IS DISTINCT FROM
         (p.cantidad,p.existencia_resultante,p.valor_movimiento,p.costo_promedio_resultante);
  IF n<>0 THEN RAISE EXCEPTION 'Caso 9: reconstrucción no idempotente: % filas',n; END IF;
END $$;
ROLLBACK;

-- 10. Error de existencia insuficiente: el error debe revertir la operación.
BEGIN;
DO $$ BEGIN
  INSERT INTO inventario.movimientos(id,empresa_id,tipo_movimiento,fecha,estatus_afectacion) VALUES (-110,8,'salida','2026-10-11',1);
  INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
  VALUES (-110,8,-110,6213,40,'2026-10-11',10000,-1,'normal',NULL,0);
  PERFORM inventario.reconstruir_producto(8,6213);
  RAISE EXCEPTION 'Caso 10: se esperaba EXISTENCIA_INSUFICIENTE';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF NOT position('EXISTENCIA_INSUFICIENTE' IN SQLERRM)>0 THEN RAISE; END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM inventario.movimientos_partidas WHERE id=-110) THEN
    RAISE EXCEPTION 'Caso 10: la partida de error no fue revertida';
  END IF;
END $$;
ROLLBACK;
