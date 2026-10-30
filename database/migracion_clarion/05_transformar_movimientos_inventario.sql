-- database/migracion_clarion/05_transformar_movimientos_inventario.sql
-- Transforma el kárdex de Clarion (Transacciones + PartidasTransacciones, _empresa = '7') a movimientos de
-- inventario de la empresa 7 en dev_emphasys y reconstruye existencias y costos con la función del ERP.
-- NO es una migración del ERP. Corre después de 02 (clientes), 03 (productos) y 04 (proveedores).
--
-- Requiere: migración 20261030_01_inventario_movimientos_referencia.sql y el parámetro
-- inventario.permite_negativos = true para la empresa 7 (Clarion permitía negativos en ALMACEN 1).
--
-- Decisiones de Toño (2026-10-30):
--   - Se migran TODAS las transacciones. Estatus 3 = afectada (estatus_afectacion = 1). Estatus 0 = inactiva y
--     2 = cancelada no afectan existencias (estatus_afectacion = 0, con el motivo en motivo_desafectacion).
--   - Movimientos primero, sin documento: documento_id queda vacío y el vínculo de Clarion (VinculosInventarios)
--     se guarda en migrate.clarion_movimientos_inventario para ligar los documentos cuando se migren.
--   - Referencia de Clarion -> columna nueva inventario.movimientos.referencia.
--   - usuario_id queda vacío; el usuario de Clarion se guarda en migrate.clarion_movimientos_inventario para
--     asociarlo después con core.usuarios.
--   - Tipo de movimiento con el vocabulario actual del ERP (entrada, salida, mixto): lo define el signo de sus
--     partidas, igual que un movimiento capturado en el ERP. Las reversiones del ERP invierten entrada/salida.
--
-- Cantidades: Clarion guarda las salidas en negativo; aquí cantidad = valor absoluto y signo = signo de Clarion.
-- Apertura de costo: si el primer movimiento de un producto-almacén es una salida (sin costo previo), se agrega
-- un movimiento técnico justo antes (entrada 1 a $0 y salida 1) para que la función del ERP pueda reconstruirlo,
-- hoy y en la operación diaria, sin cambiar el ERP. Ver Notion, sección 7D.3.
-- Costos: las entradas llevan el costo de Clarion; el costo de las salidas y el costo promedio los calcula
-- inventario.reconstruir_producto. Los valores de Clarion quedan en migrate.clarion_partidas_inventario para
-- compararlos.
--
-- Termina en ROLLBACK. Para guardar, cambiar ROLLBACK por COMMIT al final.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Candados
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF current_database() <> 'dev_emphasys' THEN
    RAISE EXCEPTION 'Este script solo corre en dev_emphasys (estás en %)', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.productos WHERE empresa_id = 7) THEN
    RAISE EXCEPTION 'La empresa 7 no tiene productos; correr antes 03_transformar_productos.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Proveedor') THEN
    RAISE EXCEPTION 'La empresa 7 no tiene proveedores; correr antes 04_transformar_proveedores.sql';
  END IF;
  IF EXISTS (SELECT 1 FROM inventario.movimientos WHERE empresa_id = 7)
     OR EXISTS (SELECT 1 FROM inventario.existencias WHERE empresa_id = 7) THEN
    RAISE EXCEPTION 'La empresa 7 ya tiene movimientos o existencias; correr antes 01_limpiar_empresa_7.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'inventario' AND table_name = 'movimientos' AND column_name = 'referencia') THEN
    RAISE EXCEPTION 'Falta la columna inventario.movimientos.referencia (migración 20261030_01)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.parametros p JOIN core.parametros_empresa pe ON pe.parametro_id = p.parametro_id
                  WHERE pe.empresa_id = 7 AND p.clave = 'inventario.permite_negativos'
                    AND lower(pe.valor) IN ('1', 'true', 't', 'yes', 'si', 'sí', 'on')) THEN
    RAISE EXCEPTION 'inventario.permite_negativos debe estar activo para la empresa 7';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staging.transacciones WHERE _empresa = '7')
     OR NOT EXISTS (SELECT 1 FROM staging.partidastransacciones WHERE _empresa = '7')
     OR NOT EXISTS (SELECT 1 FROM staging.vinculosinventarios WHERE _empresa = '7') THEN
    RAISE EXCEPTION 'Faltan Transacciones, PartidasTransacciones o VinculosInventarios en staging';
  END IF;
END $$;

-- Texto limpio: recorta y convierte '' en NULL.
CREATE FUNCTION pg_temp.t(v text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT NULLIF(btrim(v), '') $$;

-- ---------------------------------------------------------------------------
-- 1. Equivalencias: productos, almacenes y contactos
-- ---------------------------------------------------------------------------
-- Producto por clave sin distinguir mayúsculas (en el kárdex hay "sp-9002B" para "SP-9002B").
CREATE TEMP TABLE _prod ON COMMIT DROP AS
SELECT upper(btrim(clave)) AS llave, id AS producto_id FROM public.productos WHERE empresa_id = 7;
CREATE UNIQUE INDEX ON _prod (llave);

CREATE TEMP TABLE _alm ON COMMIT DROP AS
SELECT upper(btrim(clave)) AS llave, id AS almacen_id FROM inventario.almacenes WHERE empresa_id = 7;
CREATE UNIQUE INDEX ON _alm (llave);

-- Código de Clarion -> contacto: clientes y proveedores por codigo_legacy; proveedores que ya eran cliente por
-- el campo codigo_proveedor_clarion.
CREATE TEMP TABLE _cont ON COMMIT DROP AS
SELECT c.codigo_legacy AS codigo, c.id AS contacto_id
  FROM public.contactos c
 WHERE c.empresa_id = 7 AND c.codigo_legacy IS NOT NULL AND c.tipo_contacto IN ('Cliente', 'Proveedor')
UNION
SELECT v.valor_texto, v.contacto_id
  FROM public.contactos_campos v
  JOIN core.campos_configuracion cc ON cc.id = v.campo_id AND cc.clave = 'codigo_proveedor_clarion'
 WHERE v.empresa_id = 7;
CREATE UNIQUE INDEX ON _cont (codigo);

-- ---------------------------------------------------------------------------
-- 2. Transacciones -> encabezados (con id asignado en orden cronológico)
-- ---------------------------------------------------------------------------
-- El recálculo del ERP ordena por fecha e id del movimiento: los id se asignan por fecha y código de Clarion
-- para respetar el orden en que Clarion aplicó las transacciones.
CREATE TEMP TABLE _trans ON COMMIT DROP AS
SELECT t.codigo, pg_temp.t(t.serie) AS serie, t.numero, t.estatus, t.fecha,
       pg_temp.t(t.referencia) AS referencia, pg_temp.t(t.usuario) AS usuario,
       pg_temp.t(t.tiposujeto) AS tipo_sujeto, pg_temp.t(t.codigosujeto) AS codigo_sujeto,
       pg_temp.t(t.observaciones) AS observaciones
  FROM staging_tipado.transacciones t
 WHERE t._empresa = '7';

ALTER TABLE _trans ADD COLUMN movimiento_id bigint, ADD COLUMN contacto_id integer, ADD COLUMN tipo_movimiento text;

UPDATE _trans x SET contacto_id = c.contacto_id
  FROM _cont c
 WHERE x.tipo_sujeto IN ('C', 'P') AND c.codigo = x.codigo_sujeto;

-- ---------------------------------------------------------------------------
-- 3. PartidasTransacciones -> partidas
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _part ON COMMIT DROP AS
SELECT p._ptr, p.codigo, p.numero, pg_temp.t(p.producto) AS producto, pg_temp.t(p.almacen) AS almacen,
       p.tipo, p.cantidad, p.costo, p.costopromedio, p.existencia, pg_temp.t(p.inicial) AS inicial,
       pr.producto_id, al.almacen_id
  FROM staging_tipado.partidastransacciones p
  LEFT JOIN _prod pr ON pr.llave = upper(pg_temp.t(p.producto))
  LEFT JOIN _alm al ON al.llave = upper(pg_temp.t(p.almacen))
 WHERE p._empresa = '7';

-- Se migran las partidas con producto, almacén y cantidad distinta de cero (el ERP exige cantidad > 0).
ALTER TABLE _part ADD COLUMN migra boolean, ADD COLUMN partida_id bigint;
UPDATE _part SET migra = producto_id IS NOT NULL AND almacen_id IS NOT NULL AND coalesce(cantidad, 0) <> 0;

-- Apertura de costo (decisión de Toño, 2026-10-30). Si la primera partida afectada de un producto en un almacén
-- es una salida, inventario.reconstruir_producto no tiene costo previo y aborta (COSTO_NO_DISPONIBLE); y la
-- operación diaria la vuelve a llamar sobre todo el historial en cada movimiento. Por eso, en vez de cambiar la
-- función, se agrega un movimiento técnico el mismo día y justo antes: entrada de 1 a $0 y salida de 1. Efecto
-- neto cero en existencia y valor; deja costo previo $0, el mismo que Clarion usó en esas salidas.
CREATE TEMP TABLE _apertura ON COMMIT DROP AS
SELECT producto_id, almacen_id, fecha, codigo AS codigo_primera, producto
  FROM (SELECT p.producto_id, p.almacen_id, t.fecha, t.codigo, p.cantidad, p.producto,
               row_number() OVER (PARTITION BY p.producto_id, p.almacen_id ORDER BY t.fecha, t.codigo, p._ptr) AS rn
          FROM _part p JOIN _trans t ON t.codigo = p.codigo
         WHERE p.migra AND t.estatus = 3) x
 WHERE rn = 1 AND cantidad < 0;
ALTER TABLE _apertura ADD COLUMN movimiento_id bigint;

-- Id de movimiento en orden cronológico; la apertura va justo antes de la transacción de su primera salida.
CREATE TEMP TABLE _orden ON COMMIT DROP AS
SELECT fecha, codigo, 0 AS clase, producto_id, almacen_id FROM _apertura a(producto_id, almacen_id, fecha, codigo)
UNION ALL
SELECT fecha, codigo, 1, NULL, NULL FROM _trans;
ALTER TABLE _orden ADD COLUMN id bigint;
UPDATE _orden x SET id = y.id
  FROM (SELECT ctid AS c, nextval('inventario.movimientos_id_seq') AS id
          FROM (SELECT ctid FROM _orden ORDER BY fecha, codigo, clase, producto_id, almacen_id) o) y
 WHERE y.c = x.ctid;

UPDATE _trans t SET movimiento_id = o.id FROM _orden o WHERE o.clase = 1 AND o.codigo = t.codigo;
UPDATE _apertura a SET movimiento_id = o.id
  FROM _orden o
 WHERE o.clase = 0 AND o.producto_id = a.producto_id AND o.almacen_id = a.almacen_id;

UPDATE _part x SET partida_id = y.id
  FROM (SELECT _ptr, nextval('inventario.movimientos_partidas_id_seq') AS id
          FROM (SELECT p._ptr FROM _part p JOIN _trans t ON t.codigo = p.codigo
                 WHERE p.migra ORDER BY t.fecha, t.codigo, p._ptr) o) y
 WHERE y._ptr = x._ptr;

-- Tipo del encabezado según el signo de sus partidas: entrada, salida o mixto (sin partidas: mixto).
UPDATE _trans t SET tipo_movimiento = coalesce(s.tipo, 'mixto')
  FROM (SELECT t2.codigo,
               CASE WHEN bool_and(p.cantidad > 0) THEN 'entrada'
                    WHEN bool_and(p.cantidad < 0) THEN 'salida'
                    WHEN count(p._ptr) > 0 THEN 'mixto' END AS tipo
          FROM _trans t2 LEFT JOIN _part p ON p.codigo = t2.codigo AND p.migra
         GROUP BY t2.codigo) s
 WHERE s.codigo = t.codigo;

-- ---------------------------------------------------------------------------
-- 4. Inserción
-- ---------------------------------------------------------------------------
INSERT INTO inventario.movimientos (
  id, empresa_id, documento_id, usuario_id, tipo_movimiento, fecha, observaciones, contacto_id, serie, numero,
  estatus_afectacion, motivo_desafectacion, referencia)
SELECT t.movimiento_id, 7, NULL, NULL, t.tipo_movimiento, t.fecha, t.observaciones, t.contacto_id, t.serie, t.numero,
       CASE WHEN t.estatus = 3 THEN 1 ELSE 0 END,
       CASE t.estatus WHEN 3 THEN NULL
                      WHEN 2 THEN 'Cancelada en Clarion (estatus 2)'
                      WHEN 0 THEN 'Inactiva en Clarion (estatus 0)'
                      ELSE 'Estatus ' || coalesce(t.estatus::text, 'vacío') || ' en Clarion' END,
       t.referencia
  FROM _trans t
 ORDER BY t.movimiento_id;

-- existencia_resultante, valor y costo promedio los llena la reconstrucción del paso 6.
INSERT INTO inventario.movimientos_partidas (
  id, empresa_id, movimiento_id, producto_id, almacen_id, fecha_movimiento, cantidad, signo, tipo_partida,
  costo_unitario, existencia_resultante)
SELECT p.partida_id, 7, t.movimiento_id, p.producto_id, p.almacen_id, t.fecha, abs(p.cantidad), sign(p.cantidad),
       'normal', CASE WHEN p.cantidad > 0 THEN greatest(p.costo, 0) END, 0
  FROM _part p
  JOIN _trans t ON t.codigo = p.codigo
 WHERE p.migra
 ORDER BY p.partida_id;

-- Aperturas de costo: un movimiento por producto-almacén con entrada 1 a $0 y después salida 1.
INSERT INTO inventario.movimientos (
  id, empresa_id, tipo_movimiento, fecha, observaciones, estatus_afectacion, referencia)
SELECT a.movimiento_id, 7, 'mixto', a.fecha,
       'Movimiento técnico de la migración Clarion: el primer movimiento de ' || a.producto ||
       ' en Clarion es una salida con costo 0 (transacción ' || a.codigo_primera || '). Entrada y salida de 1 a $0 ' ||
       'para dejar costo previo; efecto neto cero en existencia y valor.',
       1, 'Apertura de costo – migración Clarion'
  FROM _apertura a
 ORDER BY a.movimiento_id;

INSERT INTO inventario.movimientos_partidas (
  empresa_id, movimiento_id, producto_id, almacen_id, fecha_movimiento, cantidad, signo, tipo_partida,
  costo_unitario, existencia_resultante)
SELECT 7, a.movimiento_id, a.producto_id, a.almacen_id, a.fecha, 1, x.signo, 'normal', x.costo, 0
  FROM _apertura a
  CROSS JOIN (VALUES (1, 1::smallint, 0::numeric), (2, -1::smallint, NULL::numeric)) x(orden, signo, costo)
 ORDER BY a.movimiento_id, x.orden;

-- Estadísticas al día para que la reconstrucción use los índices sobre lo recién insertado.
ANALYZE inventario.movimientos;
ANALYZE inventario.movimientos_partidas;

-- ---------------------------------------------------------------------------
-- 5. Equivalencias de Clarion (para ligar documentos y usuarios después, y para comparar costos)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS migrate.clarion_partidas_inventario;
DROP TABLE IF EXISTS migrate.clarion_movimientos_inventario;

CREATE TABLE migrate.clarion_movimientos_inventario AS
SELECT t.movimiento_id, t.codigo AS codigo_clarion, t.serie, t.numero, t.estatus AS estatus_clarion,
       t.usuario AS usuario_clarion, t.tipo_sujeto, t.codigo_sujeto,
       v.tipodocumento AS vinculo_tipo_documento, v.codigodocumento AS vinculo_codigo_documento,
       pg_temp.t(v.serie) AS vinculo_serie, v.numero AS vinculo_numero
  FROM _trans t
  LEFT JOIN staging_tipado.vinculosinventarios v ON v._empresa = '7' AND v.codigotransaccion = t.codigo;
ALTER TABLE migrate.clarion_movimientos_inventario ADD PRIMARY KEY (movimiento_id);
COMMENT ON TABLE migrate.clarion_movimientos_inventario IS
  'Migración Clarion: movimiento del ERP <- transacción de Clarion, con su usuario y su vínculo a documento (F factura, C nota de crédito, S proveedor).';

CREATE TABLE migrate.clarion_partidas_inventario AS
SELECT p.partida_id, p._ptr AS ptr_clarion, p.codigo AS codigo_clarion, p.tipo AS tipo_clarion,
       p.inicial AS inicial_clarion, p.costo AS costo_clarion, p.costopromedio AS costo_promedio_clarion,
       p.existencia AS existencia_clarion
  FROM _part p
 WHERE p.migra;
ALTER TABLE migrate.clarion_partidas_inventario ADD PRIMARY KEY (partida_id);
COMMENT ON TABLE migrate.clarion_partidas_inventario IS
  'Migración Clarion: partida del ERP <- partida de Clarion, con el costo, costo promedio y existencia que calculó Clarion.';

-- ---------------------------------------------------------------------------
-- 6. Reconstrucción de existencias y costos (función del ERP, producto por producto)
-- ---------------------------------------------------------------------------
-- Si un producto no se puede reconstruir (ej. su primer movimiento es una salida y no hay costo previo), se
-- deshace solo ese producto y queda anotado; los demás siguen.
CREATE TEMP TABLE _recalculo (producto_id integer, error text) ON COMMIT DROP;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT producto_id FROM inventario.movimientos_partidas WHERE empresa_id = 7 ORDER BY 1 LOOP
    BEGIN
      PERFORM inventario.reconstruir_producto(7, r.producto_id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _recalculo VALUES (r.producto_id, SQLERRM);
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Conteos de control: si algo no cuadra, se aborta todo
-- ---------------------------------------------------------------------------
-- Saldo de Clarion por producto y almacén: suma firmada de las transacciones afectadas (estatus 3).
CREATE TEMP TABLE _saldo_clarion ON COMMIT DROP AS
SELECT p.producto_id, p.almacen_id, sum(p.cantidad) AS existencia
  FROM _part p JOIN _trans t ON t.codigo = p.codigo
 WHERE p.migra AND t.estatus = 3
 GROUP BY 1, 2;

CREATE TEMP TABLE _control (concepto text, esperado bigint, obtenido bigint) ON COMMIT DROP;

INSERT INTO _control VALUES
  ('Movimientos (todas las transacciones)',
     (SELECT count(*) FROM _trans),
     (SELECT count(*) FROM inventario.movimientos
       WHERE empresa_id = 7 AND id NOT IN (SELECT movimiento_id FROM _apertura))),
  ('Movimientos afectados (estatus 3)',
     (SELECT count(*) FROM _trans WHERE estatus = 3),
     (SELECT count(*) FROM inventario.movimientos
       WHERE empresa_id = 7 AND estatus_afectacion = 1 AND id NOT IN (SELECT movimiento_id FROM _apertura))),
  ('Partidas migradas',
     (SELECT count(*) FROM _part WHERE migra),
     (SELECT count(*) FROM inventario.movimientos_partidas
       WHERE empresa_id = 7 AND movimiento_id NOT IN (SELECT movimiento_id FROM _apertura))),
  ('Aperturas de costo (2 partidas cada una)',
     (SELECT count(*) * 2 FROM _apertura),
     (SELECT count(*) FROM inventario.movimientos_partidas mp JOIN inventario.movimientos m ON m.id = mp.movimiento_id
       WHERE m.empresa_id = 7 AND m.referencia = 'Apertura de costo – migración Clarion')),
  ('Productos que no se pudieron reconstruir',
     0,
     (SELECT count(*) FROM _recalculo)),
  ('Partidas de Clarion = migradas + omitidas',
     (SELECT count(*) FROM staging.partidastransacciones WHERE _empresa = '7'),
     (SELECT count(*) FROM _part)),
  ('Movimientos con vínculo a documento en Clarion',
     (SELECT count(*) FROM staging.vinculosinventarios WHERE _empresa = '7'),
     (SELECT count(*) FROM migrate.clarion_movimientos_inventario WHERE vinculo_tipo_documento IS NOT NULL)),
  ('Existencia = saldo de Clarion (producto-almacén, productos reconstruidos)',
     (SELECT count(*) FROM _saldo_clarion s WHERE s.producto_id NOT IN (SELECT producto_id FROM _recalculo)),
     (SELECT count(*) FROM _saldo_clarion s
        JOIN inventario.existencias e ON e.empresa_id = 7 AND e.producto_id = s.producto_id AND e.almacen_id = s.almacen_id
       WHERE s.producto_id NOT IN (SELECT producto_id FROM _recalculo) AND e.existencia = s.existencia));

SELECT concepto, esperado, obtenido, CASE WHEN esperado = obtenido THEN 'OK' ELSE '*** NO CUADRA ***' END AS estado
  FROM _control ORDER BY concepto;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _control WHERE esperado IS DISTINCT FROM obtenido) THEN
    RAISE EXCEPTION 'Conteos de control no cuadran; se cancela la transformación (ver tabla de control arriba)';
  END IF;
END $$;

-- Resumen informativo
SELECT 'Movimientos por tipo: ' || tipo_movimiento AS concepto, count(*) AS filas
  FROM inventario.movimientos WHERE empresa_id = 7 GROUP BY tipo_movimiento
UNION ALL SELECT 'Movimientos sin afectar (estatus 0 y 2)', count(*)
  FROM inventario.movimientos WHERE empresa_id = 7 AND estatus_afectacion = 0
UNION ALL SELECT 'Movimientos con contacto', count(*)
  FROM inventario.movimientos WHERE empresa_id = 7 AND contacto_id IS NOT NULL
UNION ALL SELECT 'Existencias (producto-almacén)', count(*)
  FROM inventario.existencias WHERE empresa_id = 7
UNION ALL SELECT 'Existencias negativas', count(*)
  FROM inventario.existencias WHERE empresa_id = 7 AND existencia < 0
UNION ALL SELECT 'Productos que no se pudieron reconstruir', count(*) FROM _recalculo
UNION ALL SELECT 'Partidas afectadas con la misma existencia que Clarion', count(*)
  FROM inventario.movimientos_partidas mp
  JOIN inventario.movimientos m ON m.id = mp.movimiento_id AND m.estatus_afectacion = 1
  JOIN migrate.clarion_partidas_inventario c ON c.partida_id = mp.id
 WHERE mp.empresa_id = 7 AND mp.existencia_resultante = c.existencia_clarion
UNION ALL SELECT 'Partidas afectadas', count(*)
  FROM inventario.movimientos_partidas mp
  JOIN inventario.movimientos m ON m.id = mp.movimiento_id AND m.estatus_afectacion = 1
 WHERE mp.empresa_id = 7
UNION ALL SELECT 'Partidas afectadas con costo promedio a +-1 centavo de Clarion', count(*)
  FROM inventario.movimientos_partidas mp
  JOIN inventario.movimientos m ON m.id = mp.movimiento_id AND m.estatus_afectacion = 1
  JOIN migrate.clarion_partidas_inventario c ON c.partida_id = mp.id
 WHERE mp.empresa_id = 7 AND abs(mp.costo_promedio_resultante - c.costo_promedio_clarion) <= 0.01;

SELECT p.clave, r.error FROM _recalculo r JOIN public.productos p ON p.id = r.producto_id ORDER BY 1;

-- ---------------------------------------------------------------------------
-- 8. Lista de casos a revisar
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS migrate.clarion_revision_movimientos;
CREATE TABLE migrate.clarion_revision_movimientos (tipo text, codigo text, folio text, detalle text);

INSERT INTO migrate.clarion_revision_movimientos
SELECT 'Producto que no se pudo reconstruir (sin existencias)', p.clave, NULL, r.error
  FROM _recalculo r JOIN public.productos p ON p.id = r.producto_id
UNION ALL
SELECT 'Apertura de costo agregada (primer movimiento es salida a costo 0)', a.producto, concat_ws('-', t.serie, t.numero),
       'movimiento ' || a.movimiento_id || ', fecha ' || a.fecha
  FROM _apertura a JOIN _trans t ON t.codigo = a.codigo_primera
UNION ALL
SELECT 'Partida omitida (sin producto, sin almacén o cantidad cero)', p.codigo::text,
       concat_ws('-', t.serie, t.numero), concat_ws(' | ', 'producto ' || p.producto, 'almacén ' || p.almacen,
                                                    'cantidad ' || p.cantidad, 'estatus ' || t.estatus)
  FROM _part p JOIN _trans t ON t.codigo = p.codigo WHERE NOT p.migra
UNION ALL
SELECT 'Contacto de Clarion no encontrado', t.codigo::text, concat_ws('-', t.serie, t.numero),
       t.tipo_sujeto || ' ' || t.codigo_sujeto
  FROM _trans t WHERE t.tipo_sujeto IN ('C', 'P') AND t.codigo_sujeto IS NOT NULL AND t.contacto_id IS NULL
UNION ALL
SELECT 'Transacción sin partidas', t.codigo::text, concat_ws('-', t.serie, t.numero), 'estatus ' || t.estatus
  FROM _trans t WHERE NOT EXISTS (SELECT 1 FROM _part p WHERE p.codigo = t.codigo AND p.migra)
UNION ALL
SELECT 'Existencia final negativa', p.clave, a.clave, e.existencia::text
  FROM inventario.existencias e
  JOIN public.productos p ON p.id = e.producto_id
  JOIN inventario.almacenes a ON a.id = e.almacen_id
 WHERE e.empresa_id = 7 AND e.existencia < 0;

SELECT tipo, count(*) AS casos FROM migrate.clarion_revision_movimientos GROUP BY tipo ORDER BY tipo;

ROLLBACK;
