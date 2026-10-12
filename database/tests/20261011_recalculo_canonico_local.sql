-- Fixture autocontenido para PostgreSQL temporal local.
-- Se ejecuta exclusivamente en una base efímera y termina con ROLLBACK.
CREATE SCHEMA core;
CREATE SCHEMA inventario;
CREATE TABLE core.parametros(parametro_id integer PRIMARY KEY, clave text, valor_default text);
CREATE TABLE core.parametros_empresa(empresa_id integer, parametro_id integer, valor text);
CREATE TABLE public.productos(id integer PRIMARY KEY, descripcion text);
CREATE TABLE inventario.almacenes(id integer PRIMARY KEY, empresa_id integer, nombre text);
CREATE TABLE inventario.movimientos(
  id bigint PRIMARY KEY, empresa_id bigint, fecha date NOT NULL,
  estatus_afectacion smallint NOT NULL DEFAULT 1
);
CREATE TABLE inventario.movimientos_partidas(
  id bigint PRIMARY KEY, empresa_id integer NOT NULL, movimiento_id bigint NOT NULL,
  producto_id integer NOT NULL, almacen_id integer NOT NULL, almacen_destino_id integer,
  cantidad numeric(18,6) NOT NULL, signo smallint NOT NULL, tipo_partida varchar(30) NOT NULL,
  costo_unitario numeric(18,6), existencia_resultante numeric(18,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), valor_movimiento numeric(24,6),
  costo_promedio_resultante numeric(24,6), secuencia_operativa bigint,
  precision_cantidad smallint, precision_costo smallint
);
CREATE TABLE inventario.existencias(
  id bigserial PRIMARY KEY, empresa_id integer NOT NULL, producto_id integer NOT NULL,
  almacen_id integer NOT NULL, existencia numeric(18,6) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id,producto_id,almacen_id)
);

INSERT INTO core.parametros VALUES (1,'inventario.permite_negativos','false');
INSERT INTO public.productos VALUES (1001,'Producto promedio'),(1002,'Producto transferencia'),(1003,'Producto retroactivo');
INSERT INTO inventario.almacenes VALUES (1,99,'Origen'),(2,99,'Destino'),(3,99,'Tercero');

\ir ../migrations/20261011_inventario_recalculo_canonico.sql

BEGIN;
INSERT INTO inventario.movimientos VALUES (1,99,'2026-01-01',1),(2,99,'2026-01-02',1),(3,99,'2026-01-03',1),(4,99,'2026-01-04',0),(5,99,'2025-12-31',1);
INSERT INTO inventario.movimientos_partidas( id,empresa_id,movimiento_id,producto_id,almacen_id,cantidad,signo,tipo_partida,costo_unitario)
VALUES
 (1,99,1,1001,1,10,1,'normal',10),
 (2,99,2,1001,1,10,1,'normal',20),
 (3,99,3,1001,1,5,-1,'normal',NULL),
 (4,99,4,1001,1,100,1,'normal',100), -- desafectado: debe ignorarse
 (5,99,5,1003,1,7,1,'normal',7); -- fecha retroactiva

-- Entradas, salida, promedio y movimiento desafectado.
SELECT inventario.reconstruir_producto(99,1001);
DO $$ DECLARE q numeric; c numeric; v numeric; BEGIN
  SELECT existencia INTO q FROM inventario.existencias WHERE empresa_id=99 AND producto_id=1001 AND almacen_id=1;
  SELECT costo_promedio_resultante,valor_movimiento INTO c,v FROM inventario.movimientos_partidas WHERE id=3;
  IF q<>15 OR c<>10 OR v<>-50 THEN RAISE EXCEPTION 'Fallo promedio/salida/desafectado: q=%, c=%, v=%',q,c,v; END IF;
END $$;

-- Transferencia: salida origen y entrada destino conservando costo.
INSERT INTO inventario.movimientos VALUES (6,99,'2026-01-05',1);
INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,almacen_destino_id,cantidad,signo,tipo_partida,costo_unitario)
VALUES (6,99,6,1002,1,2,4,-1,'salida_transferencia',NULL),(7,99,6,1002,2,1,4,1,'entrada_transferencia',NULL);
INSERT INTO inventario.movimientos VALUES (7,99,'2026-01-01',1);
INSERT INTO inventario.movimientos_partidas(id,empresa_id,movimiento_id,producto_id,almacen_id,cantidad,signo,tipo_partida,costo_unitario)
VALUES (8,99,7,1002,1,10,1,'normal',5);
SELECT inventario.reconstruir_producto(99,1002);
DO $$ DECLARE a numeric; b numeric; ca numeric; cb numeric; BEGIN
  SELECT existencia INTO a FROM inventario.existencias WHERE empresa_id=99 AND producto_id=1002 AND almacen_id=1;
  SELECT existencia INTO b FROM inventario.existencias WHERE empresa_id=99 AND producto_id=1002 AND almacen_id=2;
  SELECT costo_unitario INTO ca FROM inventario.movimientos_partidas WHERE id=6;
  SELECT costo_unitario INTO cb FROM inventario.movimientos_partidas WHERE id=7;
  IF a<>6 OR b<>4 OR ca<>5 OR cb<>5 THEN RAISE EXCEPTION 'Fallo transferencia: origen=%, destino=%, costos=%/%',a,b,ca,cb; END IF;
END $$;

-- Fecha retroactiva y combinación producto-almacén nueva.
SELECT inventario.reconstruir_producto(99,1003);
DO $$ DECLARE q numeric; BEGIN
  SELECT existencia INTO q FROM inventario.existencias WHERE empresa_id=99 AND producto_id=1003 AND almacen_id=1;
  IF q<>7 THEN RAISE EXCEPTION 'Fallo fecha retroactiva: %',q; END IF;
END $$;

-- Idempotencia: segunda reconstrucción conserva exactamente los resultados.
CREATE TEMP TABLE snapshot_recalc AS SELECT * FROM inventario.movimientos_partidas WHERE empresa_id=99;
SELECT inventario.reconstruir_producto(99,1001);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM snapshot_recalc s JOIN inventario.movimientos_partidas p ON p.id=s.id
   WHERE (s.existencia_resultante,s.valor_movimiento,s.costo_promedio_resultante) IS DISTINCT FROM
         (p.existencia_resultante,p.valor_movimiento,p.costo_promedio_resultante);
  IF n<>0 THEN RAISE EXCEPTION 'Fallo idempotencia'; END IF;
END $$;
ROLLBACK;
