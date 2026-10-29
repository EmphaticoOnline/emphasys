-- database/migracion_clarion/01_limpiar_empresa_7.sql
-- Reinicio repetible: borra los contactos y productos de la empresa 7 en dev_emphasys para volver a correr
-- 02_transformar_clientes.sql y 03_transformar_productos.sql. Se puede ejecutar cuantas veces haga falta.
-- NO es una migración: solo para la BD local de la migración Clarion.
--
-- Borra TODOS los contactos y productos de la empresa 7 (migrados o dados de alta a mano) y lo que cuelga
-- de ellos: roles, datos fiscales, domicilios, personal, documentación, impuestos de producto, archivos y
-- valores de campos configurables (por cascada), precios, historial de responsabilidad y catálogos asignados.
--
-- Conserva la configuración de la empresa y lo que las transformaciones reutilizan: tipos y valores de
-- catálogo, campos configurables (core.campos_configuracion), unidades, almacenes, listas de precios,
-- parámetros, tipos de documento, series, roles, usuarios, etc.
--
-- Termina en ROLLBACK. Para borrar de verdad, cambiar ROLLBACK por COMMIT al final.
-- Respaldo de referencia: ~/respaldos/dev_emphasys_20261028_antes_limpieza_e7.dump

BEGIN;

-- Candados: base correcta y ningún registro operativo (documentos, movimientos, existencias, CRM...) que
-- apunte a contactos o productos de la empresa 7. Si los hay, el borrado no es solo de la migración.
DO $$
DECLARE
  r record;
  n bigint;
BEGIN
  IF current_database() <> 'dev_emphasys' THEN
    RAISE EXCEPTION 'Este script solo corre en dev_emphasys (estás en %)', current_database();
  END IF;

  FOR r IN
    SELECT con.conrelid::regclass AS tabla, a.attname AS columna, con.confrelid::regclass AS padre
      FROM pg_constraint con
      JOIN LATERAL unnest(con.conkey, con.confkey) AS k(col_hija, col_padre) ON true
      JOIN pg_attribute ap ON ap.attrelid = con.confrelid AND ap.attnum = k.col_padre AND ap.attname = 'id'
      JOIN pg_attribute a  ON a.attrelid  = con.conrelid  AND a.attnum  = k.col_hija
     WHERE con.contype = 'f'
       AND con.confrelid IN ('public.contactos'::regclass, 'public.productos'::regclass)
       AND con.confdeltype IN ('r', 'a')                       -- RESTRICT / NO ACTION
       AND con.conrelid NOT IN ('crm.contacto_responsabilidades'::regclass,  -- se borran abajo
                                'public.precios'::regclass)
  LOOP
    EXECUTE format('SELECT count(*) FROM %s t JOIN %s x ON x.id = t.%I WHERE x.empresa_id = 7',
                   r.tabla, r.padre, r.columna) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION '%.% tiene % filas que apuntan a % de la empresa 7; revisar antes de borrar',
                      r.tabla, r.columna, n, r.padre;
    END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE _conteos (momento text, tabla text, filas bigint) ON COMMIT DROP;

CREATE TEMP VIEW _v_conteos AS
SELECT t, n FROM (VALUES
  ('public.contactos',                     (SELECT count(*) FROM public.contactos WHERE empresa_id = 7)),
  ('public.contactos_roles',               (SELECT count(*) FROM public.contactos_roles r JOIN public.contactos c ON c.id = r.contacto_id WHERE c.empresa_id = 7)),
  ('public.contactos_datos_fiscales',      (SELECT count(*) FROM public.contactos_datos_fiscales f JOIN public.contactos c ON c.id = f.contacto_id WHERE c.empresa_id = 7)),
  ('public.contactos_domicilios',          (SELECT count(*) FROM public.contactos_domicilios d JOIN public.contactos c ON c.id = d.contacto_id WHERE c.empresa_id = 7)),
  ('public.contactos_adicionales',         (SELECT count(*) FROM public.contactos_adicionales WHERE empresa_id = 7)),
  ('public.contactos_campos',              (SELECT count(*) FROM public.contactos_campos WHERE empresa_id = 7)),
  ('crm.contacto_responsabilidades',       (SELECT count(*) FROM crm.contacto_responsabilidades WHERE empresa_id = 7)),
  ('core.entidades_catalogos (contactos)', (SELECT count(*) FROM core.entidades_catalogos WHERE empresa_id = 7 AND entidad_tipo_id = 1)),
  ('core.usuarios ligados a un vendedor (se desligan)',
     (SELECT count(*) FROM core.usuarios u JOIN public.contactos c ON c.id = u.vendedor_contacto_id WHERE c.empresa_id = 7)),
  ('public.productos',                     (SELECT count(*) FROM public.productos WHERE empresa_id = 7)),
  ('public.productos_impuestos',           (SELECT count(*) FROM public.productos_impuestos i JOIN public.productos p ON p.id = i.producto_id WHERE p.empresa_id = 7)),
  ('public.productos_campos',              (SELECT count(*) FROM public.productos_campos WHERE empresa_id = 7)),
  ('public.precios',                       (SELECT count(*) FROM public.precios WHERE empresa_id = 7)),
  ('core.entidades_catalogos (productos)', (SELECT count(*) FROM core.entidades_catalogos WHERE empresa_id = 7 AND entidad_tipo_id = 2)),
  ('core.catalogos (no se toca)',          (SELECT count(*) FROM core.catalogos WHERE empresa_id = 7)),
  ('core.campos_configuracion (no se toca)', (SELECT count(*) FROM core.campos_configuracion WHERE empresa_id = 7)),
  ('public.unidades (no se toca)',         (SELECT count(*) FROM public.unidades WHERE empresa_id = 7)),
  ('public.precios_listas (no se toca)',   (SELECT count(*) FROM public.precios_listas WHERE empresa_id = 7)),
  ('inventario.almacenes (no se toca)',    (SELECT count(*) FROM inventario.almacenes WHERE empresa_id = 7)),
  ('core.parametros_empresa (no se toca)', (SELECT count(*) FROM core.parametros_empresa WHERE empresa_id = 7))
) v(t, n);

INSERT INTO _conteos SELECT 'antes', t, n FROM _v_conteos;

-- Productos: precios no tiene cascada; impuestos, archivos y productos_campos se van por cascada.
-- core.entidades_catalogos no tiene llave foránea (es polimórfica): si no se borra, queda huérfana.
DELETE FROM public.precios WHERE empresa_id = 7;
DELETE FROM core.entidades_catalogos WHERE empresa_id = 7 AND entidad_tipo_id = 2;
DELETE FROM public.productos WHERE empresa_id = 7;

-- Contactos: el historial apunta al vendedor con ON DELETE RESTRICT, va primero.
DELETE FROM crm.contacto_responsabilidades
 WHERE empresa_id = 7
    OR contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = 7)
    OR vendedor_contacto_id IN (SELECT id FROM public.contactos WHERE empresa_id = 7);
DELETE FROM core.entidades_catalogos WHERE empresa_id = 7 AND entidad_tipo_id = 1;

-- Roles, datos fiscales, domicilios, personal, documentación y contactos_campos se van por cascada.
DELETE FROM public.contactos WHERE empresa_id = 7;

INSERT INTO _conteos SELECT 'despues', t, n FROM _v_conteos;

SELECT a.tabla, a.filas AS antes, d.filas AS despues
  FROM _conteos a JOIN _conteos d ON d.tabla = a.tabla AND d.momento = 'despues'
 WHERE a.momento = 'antes'
 ORDER BY a.tabla;

ROLLBACK;
