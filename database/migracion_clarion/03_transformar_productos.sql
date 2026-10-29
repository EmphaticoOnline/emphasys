-- database/migracion_clarion/03_transformar_productos.sql
-- Transforma Productos de Clarion (staging, _empresa = '7') a productos de la empresa 7 en dev_emphasys.
-- NO es una migración del ERP. Decisiones: memoria "migracion-clarion-productos" y página de Notion.
-- Prioridad: la información tal cual; solo se transforma lo necesario para que quepa y quede ligada.
--
-- Fuentes: staging_tipado.productos, unidades, almacen, almacenproducto (solo ALMACEN 1, para mínimo,
--          máximo, punto de reorden y ubicación), clasificacionproductos, familias, lineas, precios.
-- Destino: unidades, inventario.almacenes, productos, productos_impuestos, precios_listas, precios,
--          core.catalogos (+ precio_lista_id en las clasificaciones de clientes), core.entidades_catalogos,
--          core.campos_configuracion, productos_campos.
-- Pendiente a propósito:
--   - Existencias: en cero; se cargan con los movimientos de inventario (el recálculo las reconstruye).
--   - Proveedores y precios de proveedor: se ligan al migrar Proveedores (el nombre queda en campos).
--   - Cuentas contables por producto/almacén: requieren migrar contabilidad.cuentas.
--   - Equivalencias de unidades y materiales (ProductosMateriales): sin destino todavía.
--
-- Termina en ROLLBACK. Para guardar, cambiar ROLLBACK por COMMIT al final.
-- Deja la lista de casos a revisar en migrate.clarion_revision_productos (solo si se hace COMMIT).

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Candados
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF current_database() <> 'dev_emphasys' THEN
    RAISE EXCEPTION 'Este script solo corre en dev_emphasys (estás en %)', current_database();
  END IF;
  IF EXISTS (SELECT 1 FROM public.productos WHERE empresa_id = 7) THEN
    RAISE EXCEPTION 'La empresa 7 ya tiene productos; correr antes 01_limpiar_empresa_7.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staging.productos WHERE _empresa = '7') THEN
    RAISE EXCEPTION 'No hay productos en staging para la empresa 7';
  END IF;
  IF to_regclass('public.productos_campos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla productos_campos (migración 20261029_01_productos_campos.sql)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Funciones auxiliares (temporales, viven solo en esta sesión)
-- ---------------------------------------------------------------------------
-- Texto limpio: recorta y convierte '' en NULL.
CREATE FUNCTION pg_temp.t(v text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT NULLIF(btrim(v), '') $$;

-- Número: el 0 de Clarion es "sin capturar".
CREATE FUNCTION pg_temp.n(v numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS
$$ SELECT NULLIF(v, 0) $$;

-- Llave de comparación: mayúsculas y sin espacios dobles.
CREATE FUNCTION pg_temp.llave(v text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT upper(regexp_replace(btrim(v), '\s+', ' ', 'g')) $$;

-- ---------------------------------------------------------------------------
-- 2. Productos de Clarion (solo las columnas que se usan) y su renglón de ALMACEN 1
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _pro ON COMMIT DROP AS
SELECT p._ptr, btrim(p.identificacion) AS clave, p.descripcion, p.clasificacion, p.unidad, p.proveedor,
       p.proveedor2, p.proveedor3, p.tasa, p.sevende, p.secompra, p.esmanufacturable, p.tipo, p.clase, p.orden,
       p.familia, p.linea, p.presentacion, p.subpresentacion, p.tasacompras, p.usapedimento, p.fechamodificacion,
       p.umventa, p.umcompra, p.metodoidentificacion, p.tiemposurtido, p.cuentacontable, p.costoestandar,
       p.color, p.campousuario1, p.campousuario2, p.campousuario3, p.campousuario4, p.campousuario5,
       p.minimoparaventa, p.archivofotografia1, p.archivofotografia2, p.esunservicio, p.tiemporealizacion,
       p.valordestajo, p.margendeseadoutilidad, p.crearpreciopredeterminado, p.seretieneiva, p.tasaretencioniva,
       p.seretieneisr, p.tasaretencionisr, p.costopromedio, p.costomateriasprimas, p.costomanodeobra,
       p.costofabricacion, p.unidadesplanta, p.grueso, p.largo, p.ancho, p.puedegirar, p.fraccionarancelaria,
       p.clavealternaproveedor1, p.clavealternaproveedor2, p.clavealternaproveedor3,
       NULLIF(btrim(s.cubicaje), '')::numeric AS cubicaje,  -- la vista tipada lo castea a numeric(6,6) y truena
       p.piezasporcarton, p.pesobrutoporcarton, p.unidadpesobruto, p.baja, p.factordemanda, p.esestacional,
       p.demandaaltaenero, p.demandaaltafebrero, p.demandaaltamarzo, p.demandaaltaabril, p.demandaaltamayo,
       p.demandaaltajunio, p.demandaaltajulio, p.demandaaltaagosto, p.demandaaltaseptiembre,
       p.demandaaltaoctubre, p.demandaaltanoviembre, p.demandaaltadiciembre, p.fechaprimerallegada,
       p.fechalimitecompra1, p.fechalimitecompra2, p.observacionescompras, p.observacionesdiseno,
       p.minimoparaempaque, p.stockcajas, p.empaquedeseado, p.tasaiepsventas, p.pctiepsventas,
       p.tasaiepscompras, p.pctiepscompras, p.moq, p.costoreposicion, p.demandamensual, p.ultimocosto,
       p.precioanterior, p.archivofichatecnica, p.archivocertificado, p.codigoproductosat, p.unidadaduana,
       p.factorequivalenteunidadaduana, p.excluirvoltz, p.observaciones,
       a.minimo, a.maximo, a.puntoreorden, a.ubicacion
  FROM staging_tipado.productos p
  JOIN staging.productos s ON s._empresa = p._empresa AND s._ptr = p._ptr
  LEFT JOIN LATERAL (
    -- Un producto aparece dos veces en ALMACEN 1: se toma el último renglón.
    SELECT ap.minimo, ap.maximo, ap.puntoreorden, ap.ubicacion
      FROM staging_tipado.almacenproducto ap
     WHERE ap._empresa = '7' AND ap.almacen = 'ALMACEN 1' AND btrim(ap.producto) = btrim(p.identificacion)
     ORDER BY ap._ptr DESC LIMIT 1) a ON true
 WHERE p._empresa = '7';

-- ---------------------------------------------------------------------------
-- 3. Unidades: PZA es la PIEZA que ya existe; las demás se crean con su clave de Clarion
-- ---------------------------------------------------------------------------
INSERT INTO public.unidades (clave, descripcion, unidad_sat_id, empresa_id, activo)
-- El ERP exige unidad SAT y sat.unidades solo tiene 5 claves (E48, H87, MON, HUR, LTR): la que no
-- encuentre su clave queda como Pieza (H87) y se reporta en la lista de revisión.
SELECT left(u.clave, 20), coalesce(u.descripcion, u.clave),
       coalesce(s.id, (SELECT id FROM sat.unidades WHERE clave = 'H87')), 7, true
  FROM (
    SELECT btrim(identificacion) AS clave, pg_temp.t(descripcion) AS descripcion, pg_temp.t(codigounidadsat) AS sat
      FROM staging_tipado.unidades WHERE _empresa = '7'
    UNION   -- unidades usadas en productos que no están en el catálogo de Clarion
    SELECT x, NULL, NULL
      FROM _pro, LATERAL (VALUES (pg_temp.t(unidad)), (pg_temp.t(umventa)), (pg_temp.t(umcompra))) v(x)
     WHERE x IS NOT NULL
       AND pg_temp.llave(x) NOT IN (SELECT pg_temp.llave(identificacion) FROM staging_tipado.unidades WHERE _empresa = '7')
  ) u
  LEFT JOIN sat.unidades s ON s.clave = u.sat
 WHERE pg_temp.llave(u.clave) <> 'PZA'
ON CONFLICT (empresa_id, clave) DO NOTHING;

CREATE TEMP TABLE _um ON COMMIT DROP AS
SELECT pg_temp.llave(clave) AS llave, id FROM public.unidades WHERE empresa_id = 7 AND pg_temp.llave(clave) <> 'PIEZA'
UNION ALL
SELECT 'PZA', id FROM public.unidades WHERE empresa_id = 7 AND clave = 'PIEZA';

-- ---------------------------------------------------------------------------
-- 4. Almacenes (sin existencias; quedan listos para los movimientos de inventario)
-- ---------------------------------------------------------------------------
INSERT INTO inventario.almacenes (empresa_id, clave, nombre, tipo, activo)
SELECT 7, left(btrim(identificacion), 30), left(coalesce(pg_temp.t(descripcion), btrim(identificacion)), 120), 'normal', true
  FROM staging_tipado.almacen
 WHERE _empresa = '7' AND pg_temp.t(identificacion) IS NOT NULL
ON CONFLICT (empresa_id, clave) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Productos
-- ---------------------------------------------------------------------------
INSERT INTO public.productos (
  empresa_id, clave, descripcion, activo, clasificacion, tipo_producto, familia, linea, presentacion,
  unidad_compra, existencia_actual, minimo_inventario, costo_estandar, costo_promedio, ultimo_costo,
  iva_porcentaje, ieps_porcentaje, retiene_iva, retiene_isr, clave_producto_sat, fraccion_arancelaria,
  largo, ancho, espesor, piezas_por_empaque, peso_por_empaque, unidad_peso_empaque, ubicacion_almacen,
  archivo_fotografia_1, archivo_fotografia_2, archivo_ficha_tecnica, archivo_certificado,
  es_estacional, demanda_mensual_estimado, factor_demanda, observaciones, observaciones_compras,
  observaciones_diseno, unidad_venta_id, unidad_inventario_id, clave_unidad_sat, dias_entrega,
  cantidad_minima_compra, cantidad_minima_venta)
-- Sin descripción en Clarion: se usa la clave (la columna es obligatoria).
SELECT 7, p.clave, coalesce(pg_temp.t(p.descripcion), p.clave), NOT coalesce(p.baja, false), pg_temp.t(p.clasificacion),
       CASE upper(btrim(p.tipo)) WHEN 'I' THEN 'Inventariable' WHEN 'N' THEN 'No inventariable' WHEN 'K' THEN 'Kit' END,
       pg_temp.t(p.familia), pg_temp.t(p.linea), pg_temp.t(p.presentacion), pg_temp.t(p.umcompra),
       0,                                     -- existencias: se cargan con los movimientos de inventario
       pg_temp.n(p.minimo), pg_temp.n(p.costoestandar), pg_temp.n(p.costopromedio), pg_temp.n(p.ultimocosto),
       ti.tasa, pg_temp.n(p.pctiepsventas), coalesce(p.seretieneiva, false), coalesce(p.seretieneisr, false),
       pg_temp.t(p.codigoproductosat), pg_temp.t(p.fraccionarancelaria),
       pg_temp.n(p.largo), pg_temp.n(p.ancho), pg_temp.n(p.grueso), pg_temp.n(p.piezasporcarton),
       pg_temp.n(p.pesobrutoporcarton), pg_temp.t(p.unidadpesobruto), pg_temp.t(p.ubicacion),
       pg_temp.t(p.archivofotografia1), pg_temp.t(p.archivofotografia2),
       pg_temp.t(p.archivofichatecnica), pg_temp.t(p.archivocertificado),
       coalesce(p.esestacional, false), pg_temp.n(p.demandamensual), pg_temp.n(p.factordemanda),
       pg_temp.t(p.observaciones), pg_temp.t(p.observacionescompras), pg_temp.t(p.observacionesdiseno),
       uv.id, ui.id, su.codigounidadsat, NULLIF(p.tiemposurtido, 0), pg_temp.n(p.moq), pg_temp.n(p.minimoparaventa)
  FROM _pro p
  LEFT JOIN (SELECT pg_temp.llave(impuesto) AS llave, tasa::numeric AS tasa
               FROM staging.tasas WHERE _empresa = '7') ti ON ti.llave = pg_temp.llave(p.tasa)
  LEFT JOIN _um ui ON ui.llave = pg_temp.llave(p.unidad)
  LEFT JOIN _um uv ON uv.llave = pg_temp.llave(coalesce(pg_temp.t(p.umventa), p.unidad))
  LEFT JOIN (SELECT pg_temp.llave(identificacion) AS llave, pg_temp.t(codigounidadsat) AS codigounidadsat
               FROM staging_tipado.unidades WHERE _empresa = '7') su ON su.llave = pg_temp.llave(p.unidad);

CREATE TEMP TABLE _map ON COMMIT DROP AS
SELECT clave, id AS producto_id FROM public.productos WHERE empresa_id = 7;

-- ---------------------------------------------------------------------------
-- 6. Impuestos del producto (lo que usa el ERP al facturar)
--    IVA DIFERIDO (16 %) -> iva_16; retención FLETES (4 %) con SeRetieneIVA -> ret_iva_4.
-- ---------------------------------------------------------------------------
INSERT INTO public.productos_impuestos (producto_id, impuesto_id)
SELECT m.producto_id, 'iva_16'
  FROM _pro p JOIN _map m ON m.clave = p.clave
 WHERE pg_temp.llave(p.tasa) = 'IVA DIFERIDO'
UNION ALL
SELECT m.producto_id, 'ret_iva_4'
  FROM _pro p JOIN _map m ON m.clave = p.clave
 WHERE p.seretieneiva AND pg_temp.llave(p.tasaretencioniva) = 'FLETES';

-- ---------------------------------------------------------------------------
-- 7. Listas de precios y precios de venta
--    En Clarion los precios Preferente, Mercado Libre y Amazon se aplican a una clasificación de clientes;
--    en el ERP la clasificación del cliente apunta a su lista (core.catalogos.precio_lista_id).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _listas ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('NORMAL',        'Precio Normal',     1, true,  NULL),
  ('PREFERENTE',    'Precio Preferente', 2, false, 'PREFERENTE'),
  ('MERCADO LIBRE', 'Mercado Libre',     3, false, 'MERCADO LIBRE'),
  ('AMAZON',        'Amazon',            4, false, 'AMAZON')
) v(llave, nombre, orden, es_default, clasificacion_cliente);

INSERT INTO public.precios_listas (empresa_id, nombre, tipo_precio, activo, orden, es_default)
SELECT 7, l.nombre, 'VENTA', true, l.orden,
       l.es_default AND NOT EXISTS (SELECT 1 FROM public.precios_listas x
                                     WHERE x.empresa_id = 7 AND x.tipo_precio = 'VENTA' AND x.es_default)
  FROM _listas l
 WHERE NOT EXISTS (SELECT 1 FROM public.precios_listas x
                    WHERE x.empresa_id = 7 AND x.tipo_precio = 'VENTA' AND x.nombre = l.nombre);

ALTER TABLE _listas ADD COLUMN lista_id bigint;
UPDATE _listas l SET lista_id = x.id
  FROM public.precios_listas x WHERE x.empresa_id = 7 AND x.tipo_precio = 'VENTA' AND x.nombre = l.nombre;

UPDATE core.catalogos k SET precio_lista_id = l.lista_id
  FROM _listas l, core.catalogos_tipos ct
 WHERE ct.empresa_id = 7 AND ct.entidad_tipo_id = 1 AND ct.nombre = 'Clasificaciones de Contactos'
   AND k.tipo_catalogo_id = ct.id AND k.empresa_id = 7
   AND l.clasificacion_cliente IS NOT NULL AND pg_temp.llave(k.clave) = l.clasificacion_cliente;

-- Lista de cada precio: la clasificación de clientes si la trae; si no, el nombre del precio sin "PRECIO ".
CREATE TEMP TABLE _precios ON COMMIT DROP AS
SELECT pr._ptr, btrim(pr.producto) AS clave, pr.precio, pr.poromision, pr.fechahoramodificacion,
       regexp_replace(pg_temp.llave(coalesce(pg_temp.t(pr.clasificacion), pr.identificacionprecio)), '^PRECIO ', '') AS llave_lista,
       pr.identificacionprecio, pr.clasificacion, pr.opcionprecio
  FROM staging_tipado.precios pr
 WHERE pr._empresa = '7';

-- Si un producto tiene dos precios para la misma lista, queda el predeterminado y luego el más reciente.
CREATE TEMP TABLE _precio_elegido ON COMMIT DROP AS
SELECT DISTINCT ON (m.producto_id, l.lista_id)
       pr._ptr, m.producto_id, l.lista_id, pr.precio
  FROM _precios pr
  JOIN _map m ON m.clave = pr.clave
  JOIN _listas l ON l.llave = pr.llave_lista
 ORDER BY m.producto_id, l.lista_id, pr.poromision DESC, pr.fechahoramodificacion DESC NULLS LAST, pr._ptr DESC;

INSERT INTO public.precios (empresa_id, producto_id, precio_lista_id, precio, activo)
SELECT 7, producto_id, lista_id, precio, true FROM _precio_elegido;

-- ---------------------------------------------------------------------------
-- 8. Catálogos configurables de producto (Clasificación, Familia, Línea)
-- ---------------------------------------------------------------------------
INSERT INTO core.catalogos_tipos (empresa_id, entidad_tipo_id, nombre, permite_multiple, activo)
SELECT 7, 2, n, false, true
  FROM unnest(ARRAY['Clasificaciones de Productos', 'Familias de Productos', 'Líneas de Productos']) n
ON CONFLICT (empresa_id, nombre) DO NOTHING;

CREATE TEMP TABLE _tipos ON COMMIT DROP AS
SELECT v.campo, ct.id AS tipo_id
  FROM (VALUES ('clasificacion', 'Clasificaciones de Productos'), ('familia', 'Familias de Productos'),
               ('linea', 'Líneas de Productos')) v(campo, nombre)
  JOIN core.catalogos_tipos ct ON ct.empresa_id = 7 AND ct.nombre = v.nombre;

CREATE TEMP TABLE _pro_cat ON COMMIT DROP AS
SELECT m.producto_id, x.campo, pg_temp.llave(x.valor) AS llave, btrim(x.valor) AS valor
  FROM _pro p
  JOIN _map m ON m.clave = p.clave
  CROSS JOIN LATERAL (VALUES ('clasificacion', p.clasificacion), ('familia', p.familia), ('linea', p.linea)) x(campo, valor)
 WHERE pg_temp.t(x.valor) IS NOT NULL;

-- Valores: primero el catálogo de Clarion (con su descripción en extra), luego los que solo aparecen en productos.
CREATE TEMP TABLE _valores ON COMMIT DROP AS
WITH clarion AS (
  SELECT 'clasificacion' AS campo, 'ClasificacionProductos' AS tabla, identificacion, descripcion FROM staging_tipado.clasificacionproductos WHERE _empresa = '7'
  UNION ALL SELECT 'familia', 'Familias', identificacion, descripcion FROM staging_tipado.familias WHERE _empresa = '7'
  UNION ALL SELECT 'linea', 'Lineas', identificacion, descripcion FROM staging_tipado.lineas WHERE _empresa = '7'
), clarion_unico AS (
  SELECT DISTINCT ON (campo, pg_temp.llave(identificacion))
         campo, tabla, pg_temp.llave(identificacion) AS llave, btrim(identificacion) AS valor, pg_temp.t(descripcion) AS desc_clarion
    FROM clarion WHERE pg_temp.t(identificacion) IS NOT NULL
   ORDER BY campo, pg_temp.llave(identificacion), identificacion
), de_productos AS (
  SELECT DISTINCT ON (campo, llave) campo, llave, valor FROM _pro_cat ORDER BY campo, llave, valor
)
SELECT coalesce(cl.campo, dp.campo) AS campo, coalesce(cl.llave, dp.llave) AS llave,
       coalesce(cl.valor, dp.valor) AS valor,
       jsonb_build_object('origen', 'CLARION', 'tabla', coalesce(cl.tabla, 'Productos'))
         || CASE WHEN cl.desc_clarion IS NOT NULL THEN jsonb_build_object('descripcion_clarion', cl.desc_clarion) ELSE '{}' END AS extra
  FROM clarion_unico cl
  FULL JOIN de_productos dp ON dp.campo = cl.campo AND dp.llave = cl.llave;

INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, clave, descripcion, orden, activo, extra)
SELECT 7, t.tipo_id, left(v.valor, 40), left(v.valor, 150),
       row_number() OVER (PARTITION BY v.campo ORDER BY v.valor), true, v.extra
  FROM _valores v
  JOIN _tipos t ON t.campo = v.campo
 WHERE NOT EXISTS (SELECT 1 FROM core.catalogos k
                    WHERE k.empresa_id = 7 AND k.tipo_catalogo_id = t.tipo_id AND pg_temp.llave(k.clave) = v.llave);

INSERT INTO core.entidades_catalogos (empresa_id, entidad_tipo_id, entidad_id, catalogo_id)
SELECT DISTINCT 7, 2, pc.producto_id, k.id
  FROM _pro_cat pc
  JOIN _tipos t ON t.campo = pc.campo
  JOIN core.catalogos k ON k.empresa_id = 7 AND k.tipo_catalogo_id = t.tipo_id AND pg_temp.llave(k.clave) = pc.llave;

-- ---------------------------------------------------------------------------
-- 9. Campos configurables libres (core.campos_configuracion + productos_campos)
--    Solo se crea el campo si al menos un producto trae dato (en booleanos: al menos uno en sí).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _pc ON COMMIT DROP AS
SELECT m.producto_id, x.clave, x.texto, x.numero, x.fecha, x.bool
  FROM _pro p
  JOIN _map m ON m.clave = p.clave
  CROSS JOIN LATERAL (VALUES
    ('proveedor_1',                  pg_temp.t(p.proveedor), NULL::numeric, NULL::date, NULL::boolean),
    ('proveedor_2',                  pg_temp.t(p.proveedor2), NULL, NULL, NULL),
    ('proveedor_3',                  pg_temp.t(p.proveedor3), NULL, NULL, NULL),
    ('clave_alterna_proveedor_1',    pg_temp.t(p.clavealternaproveedor1), NULL, NULL, NULL),
    ('clave_alterna_proveedor_2',    pg_temp.t(p.clavealternaproveedor2), NULL, NULL, NULL),
    ('clave_alterna_proveedor_3',    pg_temp.t(p.clavealternaproveedor3), NULL, NULL, NULL),
    ('clarion_campo_usuario_1',      pg_temp.t(p.campousuario1), NULL, NULL, NULL),
    ('clarion_campo_usuario_2',      pg_temp.t(p.campousuario2), NULL, NULL, NULL),
    ('clarion_campo_usuario_3',      pg_temp.t(p.campousuario3), NULL, NULL, NULL),
    ('clarion_campo_usuario_4',      pg_temp.t(p.campousuario4), NULL, NULL, NULL),
    ('clarion_campo_usuario_5',      pg_temp.t(p.campousuario5), NULL, NULL, NULL),
    ('clase',                        pg_temp.t(p.clase), NULL, NULL, NULL),
    ('orden',                        pg_temp.t(p.orden), NULL, NULL, NULL),
    ('subpresentacion',              pg_temp.t(p.subpresentacion), NULL, NULL, NULL),
    ('color',                        pg_temp.t(p.color), NULL, NULL, NULL),
    ('tasa_compras',                 pg_temp.t(p.tasacompras), NULL, NULL, NULL),
    ('metodo_identificacion',        pg_temp.t(p.metodoidentificacion), NULL, NULL, NULL),
    ('cuenta_contable',              pg_temp.t(p.cuentacontable), NULL, NULL, NULL),
    ('tasa_retencion_iva',           pg_temp.t(p.tasaretencioniva), NULL, NULL, NULL),
    ('tasa_retencion_isr',           pg_temp.t(p.tasaretencionisr), NULL, NULL, NULL),
    ('tasa_ieps_ventas',             pg_temp.t(p.tasaiepsventas), NULL, NULL, NULL),
    ('tasa_ieps_compras',            pg_temp.t(p.tasaiepscompras), NULL, NULL, NULL),
    ('empaque_deseado',              pg_temp.t(p.empaquedeseado), NULL, NULL, NULL),
    ('unidad_aduana',                pg_temp.t(p.unidadaduana), NULL, NULL, NULL),
    ('tiempo_realizacion',           NULLIF(p.tiemporealizacion, '00:00')::text, NULL, NULL, NULL),
    ('meses_demanda_alta',           NULLIF(concat_ws(', ',
        CASE WHEN p.demandaaltaenero THEN 'enero' END, CASE WHEN p.demandaaltafebrero THEN 'febrero' END,
        CASE WHEN p.demandaaltamarzo THEN 'marzo' END, CASE WHEN p.demandaaltaabril THEN 'abril' END,
        CASE WHEN p.demandaaltamayo THEN 'mayo' END, CASE WHEN p.demandaaltajunio THEN 'junio' END,
        CASE WHEN p.demandaaltajulio THEN 'julio' END, CASE WHEN p.demandaaltaagosto THEN 'agosto' END,
        CASE WHEN p.demandaaltaseptiembre THEN 'septiembre' END, CASE WHEN p.demandaaltaoctubre THEN 'octubre' END,
        CASE WHEN p.demandaaltanoviembre THEN 'noviembre' END, CASE WHEN p.demandaaltadiciembre THEN 'diciembre' END), ''),
                                     NULL, NULL, NULL),
    ('maximo_inventario',            NULL, pg_temp.n(p.maximo), NULL, NULL),
    ('punto_reorden',                NULL, pg_temp.n(p.puntoreorden), NULL, NULL),
    ('costo_materias_primas',        NULL, pg_temp.n(p.costomateriasprimas), NULL, NULL),
    ('costo_mano_de_obra',           NULL, pg_temp.n(p.costomanodeobra), NULL, NULL),
    ('costo_fabricacion',            NULL, pg_temp.n(p.costofabricacion), NULL, NULL),
    ('costo_reposicion',             NULL, pg_temp.n(p.costoreposicion), NULL, NULL),
    ('precio_anterior',              NULL, pg_temp.n(p.precioanterior), NULL, NULL),
    ('valor_destajo',                NULL, pg_temp.n(p.valordestajo), NULL, NULL),
    ('margen_deseado_utilidad',      NULL, pg_temp.n(p.margendeseadoutilidad), NULL, NULL),
    ('unidades_planta',              NULL, NULLIF(p.unidadesplanta, 0)::numeric, NULL, NULL),
    ('cubicaje',                     NULL, pg_temp.n(p.cubicaje), NULL, NULL),
    ('minimo_para_empaque',          NULL, pg_temp.n(p.minimoparaempaque), NULL, NULL),
    ('stock_cajas',                  NULL, pg_temp.n(p.stockcajas), NULL, NULL),
    ('pct_ieps_compras',             NULL, pg_temp.n(p.pctiepscompras), NULL, NULL),
    ('factor_unidad_aduana',         NULL, pg_temp.n(p.factorequivalenteunidadaduana), NULL, NULL),
    ('fecha_modificacion_clarion',   NULL, NULL, p.fechamodificacion, NULL),
    ('fecha_primera_llegada',        NULL, NULL, p.fechaprimerallegada, NULL),
    ('fecha_limite_compra_1',        NULL, NULL, p.fechalimitecompra1, NULL),
    ('fecha_limite_compra_2',        NULL, NULL, p.fechalimitecompra2, NULL),
    ('se_vende',                     NULL, NULL, NULL, p.sevende),
    ('se_compra',                    NULL, NULL, NULL, p.secompra),
    ('es_manufacturable',            NULL, NULL, NULL, p.esmanufacturable),
    ('usa_pedimento',                NULL, NULL, NULL, p.usapedimento),
    ('es_un_servicio',               NULL, NULL, NULL, p.esunservicio),
    ('crear_precio_predeterminado',  NULL, NULL, NULL, p.crearpreciopredeterminado),
    ('puede_girar',                  NULL, NULL, NULL, p.puedegirar),
    ('excluir_voltz',                NULL, NULL, NULL, p.excluirvoltz <> 0)
  ) x(clave, texto, numero, fecha, bool)
 WHERE x.texto IS NOT NULL OR x.numero IS NOT NULL OR x.fecha IS NOT NULL OR x.bool IS NOT NULL;

CREATE TEMP TABLE _campos_def ON COMMIT DROP AS
SELECT * FROM (VALUES
  ( 1, 'proveedor_1',                 'Proveedor 1 (Clarion)',               'texto'),
  ( 2, 'proveedor_2',                 'Proveedor 2 (Clarion)',               'texto'),
  ( 3, 'proveedor_3',                 'Proveedor 3 (Clarion)',               'texto'),
  ( 4, 'clave_alterna_proveedor_1',   'Clave del proveedor 1',               'texto'),
  ( 5, 'clave_alterna_proveedor_2',   'Clave del proveedor 2',               'texto'),
  ( 6, 'clave_alterna_proveedor_3',   'Clave del proveedor 3',               'texto'),
  ( 7, 'clarion_campo_usuario_1',     'Campo usuario 1',                     'texto'),
  ( 8, 'clarion_campo_usuario_2',     'Campo usuario 2',                     'texto'),
  ( 9, 'clarion_campo_usuario_3',     'Campo usuario 3',                     'texto'),
  (10, 'clarion_campo_usuario_4',     'Campo usuario 4',                     'texto'),
  (11, 'clarion_campo_usuario_5',     'Campo usuario 5',                     'texto'),
  (12, 'clase',                       'Clase (MP / ENS / PT)',               'texto'),
  (13, 'orden',                       'Orden',                               'texto'),
  (14, 'subpresentacion',             'Subpresentación',                     'texto'),
  (15, 'color',                       'Color',                               'texto'),
  (16, 'tasa_compras',                'Tasa para compras',                   'texto'),
  (17, 'metodo_identificacion',       'Método de identificación',            'texto'),
  (18, 'cuenta_contable',             'Cuenta contable',                     'texto'),
  (19, 'tasa_retencion_iva',          'Tasa de retención de IVA',            'texto'),
  (20, 'tasa_retencion_isr',          'Tasa de retención de ISR',            'texto'),
  (21, 'tasa_ieps_ventas',            'Tasa IEPS ventas',                    'texto'),
  (22, 'tasa_ieps_compras',           'Tasa IEPS compras',                   'texto'),
  (23, 'empaque_deseado',             'Empaque deseado',                     'texto'),
  (24, 'unidad_aduana',               'Unidad aduana',                       'texto'),
  (25, 'tiempo_realizacion',          'Tiempo de realización',               'texto'),
  (26, 'meses_demanda_alta',          'Meses de demanda alta',               'texto'),
  (27, 'maximo_inventario',           'Máximo de inventario',                'numero'),
  (28, 'punto_reorden',               'Punto de reorden',                    'numero'),
  (29, 'costo_materias_primas',       'Costo de materias primas',            'numero'),
  (30, 'costo_mano_de_obra',          'Costo de mano de obra',               'numero'),
  (31, 'costo_fabricacion',           'Costo de fabricación',                'numero'),
  (32, 'costo_reposicion',            'Costo de reposición',                 'numero'),
  (33, 'precio_anterior',             'Precio anterior',                     'numero'),
  (34, 'valor_destajo',               'Valor destajo',                       'numero'),
  (35, 'margen_deseado_utilidad',     'Margen deseado de utilidad',          'numero'),
  (36, 'unidades_planta',             'Unidades planta',                     'numero'),
  (37, 'cubicaje',                    'Cubicaje',                            'numero'),
  (38, 'minimo_para_empaque',         'Mínimo para empaque',                 'numero'),
  (39, 'stock_cajas',                 'Stock en cajas',                      'numero'),
  (40, 'pct_ieps_compras',            '% IEPS compras',                      'numero'),
  (41, 'factor_unidad_aduana',        'Factor equivalente unidad aduana',    'numero'),
  (42, 'fecha_modificacion_clarion',  'Fecha de modificación (Clarion)',     'fecha'),
  (43, 'fecha_primera_llegada',       'Fecha de primera llegada',            'fecha'),
  (44, 'fecha_limite_compra_1',       'Fecha límite de compra 1',            'fecha'),
  (45, 'fecha_limite_compra_2',       'Fecha límite de compra 2',            'fecha'),
  (46, 'se_vende',                    'Se vende',                            'booleano'),
  (47, 'se_compra',                   'Se compra',                           'booleano'),
  (48, 'es_manufacturable',           'Es manufacturable',                   'booleano'),
  (49, 'usa_pedimento',               'Usa pedimento',                       'booleano'),
  (50, 'es_un_servicio',              'Es un servicio',                      'booleano'),
  (51, 'crear_precio_predeterminado', 'Crear precio predeterminado',         'booleano'),
  (52, 'puede_girar',                 'Puede girar',                         'booleano'),
  (53, 'excluir_voltz',               'Excluir de Voltz',                    'booleano')
) v(orden, clave, nombre, tipo_dato);

-- Campos sin ningún dato (booleanos: sin ningún "sí") no se crean ni se guardan.
DELETE FROM _campos_def d
 WHERE NOT EXISTS (SELECT 1 FROM _pc WHERE _pc.clave = d.clave AND (_pc.bool IS NULL OR _pc.bool));
DELETE FROM _pc WHERE clave NOT IN (SELECT clave FROM _campos_def);

INSERT INTO core.campos_configuracion (empresa_id, entidad_tipo_id, nombre, clave, tipo_dato, tipo_control, obligatorio, activo, orden)
SELECT 7, 2, d.nombre, d.clave, d.tipo_dato,
       CASE d.tipo_dato WHEN 'booleano' THEN 'checkbox' WHEN 'fecha' THEN 'date' ELSE 'input' END,
       false, true, d.orden
  FROM _campos_def d
 WHERE NOT EXISTS (SELECT 1 FROM core.campos_configuracion cc
                    WHERE cc.empresa_id = 7 AND cc.entidad_tipo_id = 2 AND cc.clave = d.clave);

CREATE TEMP TABLE _campos ON COMMIT DROP AS
SELECT d.clave, cc.id AS campo_id
  FROM _campos_def d
  JOIN core.campos_configuracion cc ON cc.empresa_id = 7 AND cc.entidad_tipo_id = 2 AND cc.clave = d.clave;

INSERT INTO public.productos_campos (empresa_id, producto_id, campo_id, valor_texto, valor_numero, valor_fecha, valor_boolean)
SELECT 7, x.producto_id, k.campo_id, x.texto, x.numero, x.fecha, x.bool
  FROM _pc x JOIN _campos k ON k.clave = x.clave;

-- ---------------------------------------------------------------------------
-- 10. Conteos de control: si algo no cuadra, se aborta todo
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _control (concepto text, esperado numeric, obtenido numeric) ON COMMIT DROP;

INSERT INTO _control VALUES
  ('Productos',
     (SELECT count(*) FROM _pro),
     (SELECT count(*) FROM public.productos WHERE empresa_id = 7)),
  ('Productos activos (NOT Baja)',
     (SELECT count(*) FROM _pro WHERE NOT coalesce(baja, false)),
     (SELECT count(*) FROM public.productos WHERE empresa_id = 7 AND activo)),
  ('Inventariables / no inventariables / kits',
     (SELECT count(*) FILTER (WHERE upper(btrim(tipo)) = 'I') * 10000 + count(*) FILTER (WHERE upper(btrim(tipo)) = 'N') * 10
             + count(*) FILTER (WHERE upper(btrim(tipo)) = 'K') FROM _pro),
     (SELECT count(*) FILTER (WHERE tipo_producto = 'Inventariable') * 10000 + count(*) FILTER (WHERE tipo_producto = 'No inventariable') * 10
             + count(*) FILTER (WHERE tipo_producto = 'Kit') FROM public.productos WHERE empresa_id = 7)),
  ('Productos con unidad -> con unidad de inventario',
     (SELECT count(*) FROM _pro WHERE pg_temp.t(unidad) IS NOT NULL),
     (SELECT count(*) FROM public.productos WHERE empresa_id = 7 AND unidad_inventario_id IS NOT NULL)),
  ('Productos con tasa -> con % IVA',
     (SELECT count(*) FROM _pro WHERE pg_temp.t(tasa) IS NOT NULL),
     (SELECT count(*) FROM public.productos WHERE empresa_id = 7 AND iva_porcentaje IS NOT NULL)),
  ('Impuestos iva_16',
     (SELECT count(*) FROM _pro WHERE pg_temp.llave(tasa) = 'IVA DIFERIDO'),
     (SELECT count(*) FROM public.productos_impuestos pi JOIN _map m ON m.producto_id = pi.producto_id WHERE pi.impuesto_id = 'iva_16')),
  ('Impuestos ret_iva_4',
     (SELECT count(*) FROM _pro WHERE seretieneiva AND pg_temp.llave(tasaretencioniva) = 'FLETES'),
     (SELECT count(*) FROM public.productos_impuestos pi JOIN _map m ON m.producto_id = pi.producto_id WHERE pi.impuesto_id = 'ret_iva_4')),
  ('Existencia total (debe ser 0)',
     0,
     (SELECT coalesce(sum(existencia_actual), 0) FROM public.productos WHERE empresa_id = 7)),
  ('Suma de costo promedio',
     (SELECT round(coalesce(sum(costopromedio), 0), 4) FROM _pro),
     (SELECT round(coalesce(sum(costo_promedio), 0), 4) FROM public.productos WHERE empresa_id = 7)),
  ('Suma de último costo',
     (SELECT round(coalesce(sum(ultimocosto), 0), 4) FROM _pro),
     (SELECT round(coalesce(sum(ultimo_costo), 0), 4) FROM public.productos WHERE empresa_id = 7)),
  ('Precios de Clarion con lista conocida',
     (SELECT count(*) FROM _precios),
     (SELECT count(*) FROM _precios pr JOIN _listas l ON l.llave = pr.llave_lista)),
  ('Precios (producto + lista)',
     (SELECT count(DISTINCT (m.producto_id, pr.llave_lista)) FROM _precios pr JOIN _map m ON m.clave = pr.clave),
     (SELECT count(*) FROM public.precios WHERE empresa_id = 7)),
  ('Almacenes',
     (SELECT count(*) FROM staging_tipado.almacen WHERE _empresa = '7' AND pg_temp.t(identificacion) IS NOT NULL),
     (SELECT count(*) FROM inventario.almacenes WHERE empresa_id = 7)),
  ('Clasificaciones de clientes ligadas a lista',
     3,
     (SELECT count(*) FROM core.catalogos k JOIN _listas l ON l.lista_id = k.precio_lista_id WHERE k.empresa_id = 7));

INSERT INTO _control
SELECT 'Catálogo ' || t.campo,
       (SELECT count(*) FROM _pro_cat pc WHERE pc.campo = t.campo),
       (SELECT count(*) FROM core.entidades_catalogos ec JOIN core.catalogos k ON k.id = ec.catalogo_id
         WHERE ec.empresa_id = 7 AND ec.entidad_tipo_id = 2 AND k.tipo_catalogo_id = t.tipo_id)
  FROM _tipos t;

SELECT concepto, esperado, obtenido, CASE WHEN esperado = obtenido THEN 'OK' ELSE '*** NO CUADRA ***' END AS estado
  FROM _control ORDER BY concepto;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _control WHERE esperado IS DISTINCT FROM obtenido) THEN
    RAISE EXCEPTION 'Conteos de control no cuadran; se cancela la transformación (ver tabla de control arriba)';
  END IF;
END $$;

-- Resumen informativo
SELECT 'Unidades de la empresa' AS concepto, count(*) AS filas FROM public.unidades WHERE empresa_id = 7
UNION ALL SELECT 'Listas de precios de venta', count(*) FROM public.precios_listas WHERE empresa_id = 7 AND tipo_precio = 'VENTA'
UNION ALL SELECT 'Valores de catálogo de producto', count(*) FROM core.catalogos k JOIN _tipos t ON t.tipo_id = k.tipo_catalogo_id
UNION ALL SELECT 'Campos configurables de producto', count(*) FROM _campos
UNION ALL SELECT 'Valores en productos_campos', count(*) FROM public.productos_campos WHERE empresa_id = 7;

-- ---------------------------------------------------------------------------
-- 11. Lista de casos a revisar (informativa)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS migrate.clarion_revision_productos;
CREATE TABLE migrate.clarion_revision_productos (tipo text, clave text, descripcion text, detalle text);

INSERT INTO migrate.clarion_revision_productos
SELECT 'Sin tasa de IVA (sin impuesto)', clave, btrim(descripcion), NULL
  FROM _pro WHERE pg_temp.t(tasa) IS NULL
UNION ALL
SELECT 'Tasa sin impuesto equivalente en el ERP', clave, btrim(descripcion), btrim(tasa)
  FROM _pro WHERE pg_temp.t(tasa) IS NOT NULL AND pg_temp.llave(tasa) <> 'IVA DIFERIDO'
UNION ALL
SELECT 'Precio repetido para la misma lista (se tomó otro)', pr.clave, NULL,
       concat_ws(' | ', pr.identificacionprecio, pr.clasificacion, pr.opcionprecio, 'precio ' || pr.precio)
  FROM _precios pr
  JOIN _map m ON m.clave = pr.clave
  JOIN _listas l ON l.llave = pr.llave_lista
 WHERE NOT EXISTS (SELECT 1 FROM _precio_elegido e WHERE e._ptr = pr._ptr)
UNION ALL
SELECT 'Precio de un producto que no existe', pr.clave, NULL, concat_ws(' | ', pr.identificacionprecio, 'precio ' || pr.precio)
  FROM _precios pr WHERE NOT EXISTS (SELECT 1 FROM _map m WHERE m.clave = pr.clave)
UNION ALL
SELECT 'Proveedor por ligar (al migrar Proveedores)', clave, btrim(descripcion),
       concat_ws(' | ', pg_temp.t(proveedor), pg_temp.t(proveedor2), pg_temp.t(proveedor3))
  FROM _pro WHERE coalesce(pg_temp.t(proveedor), pg_temp.t(proveedor2), pg_temp.t(proveedor3)) IS NOT NULL
UNION ALL
SELECT 'Sin descripción (se usó la clave)', clave, NULL, NULL
  FROM _pro WHERE pg_temp.t(descripcion) IS NULL
UNION ALL
SELECT 'Unidad sin clave SAT en el ERP (quedó como Pieza H87)', u.clave, u.descripcion,
       'Clave SAT en Clarion: ' || coalesce(pg_temp.t(su.codigounidadsat), '(vacía)')
  FROM public.unidades u
  JOIN sat.unidades sh ON sh.id = u.unidad_sat_id AND sh.clave = 'H87'
  LEFT JOIN staging_tipado.unidades su ON su._empresa = '7' AND pg_temp.llave(su.identificacion) = pg_temp.llave(u.clave)
 WHERE u.empresa_id = 7 AND u.clave <> 'PIEZA'
UNION ALL
SELECT 'Existencia en Clarion (no migrada, va con movimientos)', btrim(ap.producto), NULL,
       ap.almacen || ': ' || ap.existencia
  FROM staging_tipado.almacenproducto ap WHERE ap._empresa = '7' AND ap.existencia <> 0;

SELECT tipo, count(*) AS casos FROM migrate.clarion_revision_productos GROUP BY tipo ORDER BY tipo;

ROLLBACK;
