-- EMPHASYS ERP - NORMALIZACIÓN DEL ALMACÉN GENERAL DE EMPRESA 8
-- Canonical: 40 / GRAL / Almacén General
-- Duplicado candidato: 49 / GENERAL / Almacén General
-- Ejecutar manualmente en DBeaver después de respaldo.
-- No modifica movimientos, partidas, existencias ni costos.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';
SET LOCAL client_min_messages = 'notice';

SELECT pg_advisory_xact_lock(hashtextextended('empresa-operaciones:8', 0));
SELECT pg_advisory_xact_lock(hashtextextended('inventario:8', 0));

DO $$
DECLARE
  r record;
  n bigint;
  v_parametro_id integer;
  v_updated integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM core.empresas
     WHERE id=8 AND activo=true
       AND lower(nombre) LIKE '%escuela%kemper%urgate%'
  ) THEN
    RAISE EXCEPTION 'Empresa 8 no confirmada como ESCUELA KEMPER URGATE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM inventario.almacenes
     WHERE id=40 AND empresa_id=8 AND activo=true
       AND upper(trim(clave))='GRAL'
       AND lower(trim(nombre))='almacén general'
  ) THEN
    RAISE EXCEPTION 'El almacén canónico 40/GRAL no está disponible';
  END IF;

  -- Definición idempotente usando el esquema estándar de parámetros.
  SELECT parametro_id INTO v_parametro_id
    FROM core.parametros
   WHERE clave='inventario.almacen_default'
   LIMIT 1;
  IF v_parametro_id IS NULL THEN
    INSERT INTO core.parametros (clave,nombre,tipo_dato,tipo_control,valor_default)
    VALUES ('inventario.almacen_default','Almacén predeterminado de inventario','int','dropdown',NULL)
    RETURNING parametro_id INTO v_parametro_id;
    RAISE NOTICE 'Definición de parámetro creada: id=%', v_parametro_id;
  ELSE
    RAISE NOTICE 'Definición de parámetro reutilizada: id=%', v_parametro_id;
  END IF;

  -- Mantiene disponible la opción del almacén canónico para el control dropdown.
  INSERT INTO core.parametros_opciones (parametro_id,valor,etiqueta,orden)
  SELECT v_parametro_id,'40',a.nombre,1
    FROM inventario.almacenes a
   WHERE a.id=40 AND a.empresa_id=8
     AND NOT EXISTS (
       SELECT 1 FROM core.parametros_opciones po
        WHERE po.parametro_id=v_parametro_id AND po.valor='40'
     );

  RAISE NOTICE 'Almacenes de empresa 8 antes de la normalización:';
  FOR r IN SELECT id,clave,nombre,activo FROM inventario.almacenes WHERE empresa_id=8 ORDER BY id LOOP
    RAISE NOTICE '  id=% clave=% nombre=% activo=%',r.id,r.clave,r.nombre,r.activo;
  END LOOP;

  SELECT count(*) INTO n FROM inventario.movimientos_partidas
   WHERE empresa_id=8 AND (almacen_id=49 OR almacen_destino_id=49);
  RAISE NOTICE 'Partidas de inventario que referencian 49: %', n;
  SELECT count(*) INTO n FROM public.documentos
   WHERE empresa_id=8 AND almacen_id=49;
  RAISE NOTICE 'Documentos que referencian 49: %', n;
  SELECT count(*) INTO n
    FROM public.documentos_partidas dp
    JOIN public.documentos d ON d.id=dp.documento_id
   WHERE d.empresa_id=8 AND dp.almacen_id=49;
  RAISE NOTICE 'Partidas documentales que referencian 49: %', n;
  SELECT count(*) INTO n FROM inventario.existencias
   WHERE empresa_id=8 AND almacen_id=49;
  RAISE NOTICE 'Existencias que referencian 49: %', n;

  -- Inspección genérica de todas las claves foráneas hacia almacenes.
  -- No se desactivan restricciones ni se usa CASCADE.
  FOR r IN
    SELECT c.conrelid::regclass AS tabla,
           ns.nspname AS esquema,
           cl.relname AS nombre_tabla,
           a.attname AS columna
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid=c.conrelid
      JOIN pg_namespace ns ON ns.oid=cl.relnamespace
      JOIN unnest(c.conkey) WITH ORDINALITY k(attnum,ord) ON true
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
      JOIN unnest(c.confkey) WITH ORDINALITY fk(attnum,ord) ON fk.ord=k.ord
     WHERE c.contype='f'
       AND c.confrelid='inventario.almacenes'::regclass
       AND lower(a.attname) IN ('almacen_id','almacen_destino_id')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I=$1', r.esquema, r.nombre_tabla, r.columna)
      INTO n USING 49;
    RAISE NOTICE 'FK %.% %. referencias a 49: %', r.esquema, r.nombre_tabla, r.columna, n;
    IF n > 0 THEN
      RAISE EXCEPTION 'LIMPIEZA DETENIDA: esquema %, tabla %, columna % conserva % referencias al almacén 49',
        r.esquema, r.nombre_tabla, r.columna, n;
    END IF;
  END LOOP;

  -- Configuración explícita del almacén canónico.
  UPDATE core.parametros_empresa
     SET valor='40'
   WHERE empresa_id=8 AND parametro_id=v_parametro_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated=0 THEN
    INSERT INTO core.parametros_empresa(empresa_id,parametro_id,valor)
    VALUES (8,v_parametro_id,'40');
  END IF;

  DELETE FROM inventario.almacenes
   WHERE id=49 AND empresa_id=8;
  IF NOT FOUND THEN
    RAISE NOTICE 'El almacén 49 ya no existe; operación idempotente.';
  ELSE
    RAISE NOTICE 'Almacén duplicado 49 eliminado.';
  END IF;
END $$;

DO $$
DECLARE n bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM inventario.almacenes WHERE id=40 AND empresa_id=8) THEN
    RAISE EXCEPTION 'Verificación fallida: falta el almacén canónico 40';
  END IF;
  IF EXISTS (SELECT 1 FROM inventario.almacenes WHERE id=49 AND empresa_id=8) THEN
    RAISE EXCEPTION 'Verificación fallida: el almacén 49 todavía existe';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM core.parametros p JOIN core.parametros_empresa pe ON pe.parametro_id=p.parametro_id
     WHERE p.clave='inventario.almacen_default' AND pe.empresa_id=8 AND trim(pe.valor)='40'
  ) THEN
    RAISE EXCEPTION 'Verificación fallida: inventario.almacen_default no es 40';
  END IF;
  SELECT count(*) INTO n FROM inventario.almacenes WHERE id IN (40,41,42) AND empresa_id=8;
  IF n<>3 THEN RAISE EXCEPTION 'Verificación fallida: no se conservaron 40, 41 y 42'; END IF;
  RAISE NOTICE 'Normalización verificada: 40 canónico, 49 ausente, 41/42 conservados, default=40.';
END $$;

-- Consultas finales de control.
SELECT id, empresa_id, clave, nombre, activo
  FROM inventario.almacenes
 WHERE empresa_id=8 AND id IN (40,41,42,49)
 ORDER BY id;

SELECT p.clave, pe.empresa_id, pe.valor
  FROM core.parametros p
  JOIN core.parametros_empresa pe ON pe.parametro_id=p.parametro_id
 WHERE p.clave='inventario.almacen_default' AND pe.empresa_id=8;

COMMIT;

-- Si alguna validación falla, PostgreSQL aborta la transacción completa.
-- En DBeaver puede cancelarse antes de COMMIT con ROLLBACK.
