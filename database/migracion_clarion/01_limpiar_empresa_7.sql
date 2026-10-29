-- database/migracion_clarion/01_limpiar_empresa_7.sql
-- Borra los datos de la migración de prueba anterior (junio 2026) de la empresa 7 en dev_emphasys.
-- NO es una migración: solo para la BD local de la migración Clarion.
-- No toca la configuración de la empresa (parámetros, tipos de documento, catálogos, roles,
-- series, unidades, conceptos, métodos de pago, cuentas, usuarios, CFDI, assets, grids).
--
-- Termina en ROLLBACK. Para borrar de verdad, cambiar ROLLBACK por COMMIT al final.
-- Respaldo previo: ~/respaldos/dev_emphasys_20261028_antes_limpieza_e7.dump

BEGIN;

-- Candados: el script supone que esto es lo que hay; si cambió, se detiene.
DO $$
BEGIN
  IF current_database() <> 'dev_emphasys' THEN
    RAISE EXCEPTION 'Este script solo corre en dev_emphasys (estás en %)', current_database();
  END IF;
  IF EXISTS (SELECT 1 FROM migrate.clientes_legacy_supplier WHERE empresa_id <> 7)
     OR EXISTS (SELECT 1 FROM migrate.productos_legacy_supplier WHERE empresa_id <> 7) THEN
    RAISE EXCEPTION 'migrate.*_legacy_supplier tiene filas de otra empresa; revisar antes de borrar';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto <> 'Cliente') THEN
    RAISE EXCEPTION 'La empresa 7 tiene contactos que no son Cliente; revisar antes de borrar';
  END IF;
END $$;

CREATE TEMP TABLE _conteos (momento text, tabla text, filas bigint) ON COMMIT DROP;

INSERT INTO _conteos
SELECT 'antes', t, n FROM (VALUES
  ('public.contactos',                        (SELECT count(*) FROM public.contactos WHERE empresa_id = 7)),
  ('public.contactos_datos_fiscales',         (SELECT count(*) FROM public.contactos_datos_fiscales f JOIN public.contactos c ON c.id = f.contacto_id WHERE c.empresa_id = 7)),
  ('public.contactos_domicilios',             (SELECT count(*) FROM public.contactos_domicilios d JOIN public.contactos c ON c.id = d.contacto_id WHERE c.empresa_id = 7)),
  ('public.productos',                        (SELECT count(*) FROM public.productos WHERE empresa_id = 7)),
  ('migrate.clientes_legacy_supplier',        (SELECT count(*) FROM migrate.clientes_legacy_supplier)),
  ('migrate.productos_legacy_supplier',       (SELECT count(*) FROM migrate.productos_legacy_supplier)),
  ('migrate.clientes_legacy_supplier_json',   (SELECT count(*) FROM migrate.clientes_legacy_supplier_json)),
  ('migrate.productos_legacy_supplier_json',  (SELECT count(*) FROM migrate.productos_legacy_supplier_json)),
  ('core.parametros_empresa (no se toca)',    (SELECT count(*) FROM core.parametros_empresa WHERE empresa_id = 7)),
  ('core.catalogos_tipos (no se toca)',       (SELECT count(*) FROM core.catalogos_tipos WHERE empresa_id = 7)),
  ('core.empresas_tipos_documento (no se toca)', (SELECT count(*) FROM core.empresas_tipos_documento WHERE empresa_id = 7))
) v(t, n);

-- Productos primero (proveedor_preferido_id apunta a contactos con SET NULL; da igual el orden,
-- pero así no se dispara ese UPDATE en vano).
DELETE FROM public.productos WHERE empresa_id = 7;

-- Datos fiscales y domicilios se van por ON DELETE CASCADE.
DELETE FROM public.contactos WHERE empresa_id = 7;

DELETE FROM migrate.clientes_legacy_supplier WHERE empresa_id = 7;
DELETE FROM migrate.productos_legacy_supplier WHERE empresa_id = 7;
DELETE FROM migrate.clientes_legacy_supplier_json;
DELETE FROM migrate.productos_legacy_supplier_json;

INSERT INTO _conteos
SELECT 'despues', t, n FROM (VALUES
  ('public.contactos',                        (SELECT count(*) FROM public.contactos WHERE empresa_id = 7)),
  ('public.contactos_datos_fiscales',         (SELECT count(*) FROM public.contactos_datos_fiscales f JOIN public.contactos c ON c.id = f.contacto_id WHERE c.empresa_id = 7)),
  ('public.contactos_domicilios',             (SELECT count(*) FROM public.contactos_domicilios d JOIN public.contactos c ON c.id = d.contacto_id WHERE c.empresa_id = 7)),
  ('public.productos',                        (SELECT count(*) FROM public.productos WHERE empresa_id = 7)),
  ('migrate.clientes_legacy_supplier',        (SELECT count(*) FROM migrate.clientes_legacy_supplier)),
  ('migrate.productos_legacy_supplier',       (SELECT count(*) FROM migrate.productos_legacy_supplier)),
  ('migrate.clientes_legacy_supplier_json',   (SELECT count(*) FROM migrate.clientes_legacy_supplier_json)),
  ('migrate.productos_legacy_supplier_json',  (SELECT count(*) FROM migrate.productos_legacy_supplier_json)),
  ('core.parametros_empresa (no se toca)',    (SELECT count(*) FROM core.parametros_empresa WHERE empresa_id = 7)),
  ('core.catalogos_tipos (no se toca)',       (SELECT count(*) FROM core.catalogos_tipos WHERE empresa_id = 7)),
  ('core.empresas_tipos_documento (no se toca)', (SELECT count(*) FROM core.empresas_tipos_documento WHERE empresa_id = 7))
) v(t, n);

SELECT a.tabla, a.filas AS antes, d.filas AS despues
  FROM _conteos a JOIN _conteos d ON d.tabla = a.tabla AND d.momento = 'despues'
 WHERE a.momento = 'antes'
 ORDER BY a.tabla;

ROLLBACK;
