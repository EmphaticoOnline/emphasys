-- database/migracion_clarion/04_transformar_proveedores.sql
-- Transforma Proveedores de Clarion (staging, _empresa = '7') a contactos de la empresa 7 en dev_emphasys.
-- NO es una migración del ERP. Corre después de 02_transformar_clientes.sql (y 03 de productos).
--
-- Fuentes: staging_tipado.proveedores, staging.personalproveedores, zonasproveedores, clasificacionproveedores.
-- Destino: contactos, contactos_roles, contactos_datos_fiscales, contactos_domicilios, contactos_adicionales,
--          core.catalogos_tipos/catalogos/entidades_catalogos, core.campos_configuracion, contactos_campos.
--
-- Decisiones de Toño (2026-10-30):
--   - Un contacto por proveedor de Clarion; los duplicados por moneda ("(Moneda Nacional)", "(MNX)") quedan
--     como contactos aparte, con su nombre tal cual.
--   - Proveedores que ya existen como cliente (mismo RFC válido): no se duplican; al cliente se le agrega el rol
--     proveedor (y fletera) y el código de proveedor de Clarion en un campo configurable.
--   - "**Baja**" en el nombre: nombre tal cual, activo = false.
--   - ProveeFletes = 1 -> rol fletera además de proveedor.
--   - Clasificación y Zona -> catálogos propios de proveedores (no se mezclan con los de clientes).
--   - RFC extranjero (registro fiscal sin forma de RFC) -> rfc XEXX010101000 y el registro en el campo
--     "Núm. de registro de identidad tributaria". RFC vacío queda vacío.
--   - DomiciliosProveedores (1 registro sin datos, "GDFGDFGDFG") no se migra.
-- Pendiente a propósito: cuentas contables (requiere contabilidad.cuentas) y PreciosProveedores (paso aparte).
--
-- Termina en ROLLBACK. Para guardar, cambiar ROLLBACK por COMMIT al final.
-- Deja la lista de casos a revisar en migrate.clarion_revision_proveedores (solo si se hace COMMIT).

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Candados
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF current_database() <> 'dev_emphasys' THEN
    RAISE EXCEPTION 'Este script solo corre en dev_emphasys (estás en %)', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Cliente') THEN
    RAISE EXCEPTION 'La empresa 7 no tiene clientes; correr antes 02_transformar_clientes.sql';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Proveedor')
     OR EXISTS (SELECT 1 FROM public.contactos_roles r JOIN public.contactos c ON c.id = r.contacto_id
                 WHERE c.empresa_id = 7 AND r.rol = 'proveedor') THEN
    RAISE EXCEPTION 'La empresa 7 ya tiene proveedores; correr antes 01_limpiar_empresa_7.sql y 02/03';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staging.proveedores WHERE _empresa = '7') THEN
    RAISE EXCEPTION 'No hay proveedores en staging para la empresa 7 (cargar Proveedores)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Funciones auxiliares (temporales, viven solo en esta sesión)
-- ---------------------------------------------------------------------------
-- Texto limpio: recorta y convierte '' en NULL.
CREATE FUNCTION pg_temp.t(v text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT NULLIF(btrim(v), '') $$;

-- País: las formas de escribirlo en Proveedores -> un solo nombre; lo demás tal cual.
CREATE FUNCTION pg_temp.pais(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
           WHEN k IS NULL THEN NULL
           WHEN k IN ('MEX', 'MEXICO')                         THEN 'México'
           WHEN k = 'CHINA'                                    THEN 'China'
           WHEN k IN ('HONG KONG', 'HONGKONG')                 THEN 'Hong Kong'
           WHEN k LIKE 'TAIWAN%'                               THEN 'Taiwán'
           WHEN k IN ('ESTADOS UNIDOS', 'UNITED STATES', 'USA') THEN 'Estados Unidos'
           ELSE btrim(p)
         END
    FROM (SELECT upper(translate(pg_temp.t(p), 'ÉéÈè', 'EeEe')) AS k) x
$$;

-- Llave de comparación de catálogos: mayúsculas, sin espacios dobles, con errores de dedo unificados.
CREATE FUNCTION pg_temp.llave(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE k
           WHEN 'U.S.A.' THEN 'USA'
           ELSE k
         END
    FROM (SELECT upper(regexp_replace(btrim(v), '\s+', ' ', 'g')) AS k) x
$$;

-- ---------------------------------------------------------------------------
-- 2. Proveedores normalizados
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _prov ON COMMIT DROP AS
SELECT btrim(p.codigo) AS codigo, btrim(p.nombre) AS nombre, p.contacto, p.rfc, p.domicilio, p.colonia, p.ciudad,
       p.estado, p.cp, p.pais, p.telefono1, p.telefono2, p.telefono3, p.fax, p.clasificacion, p.zona,
       p.ivadesglosado, p.agente, p.diascredito, p.fechainiciorelaciones, p.concepto, p.fechaalta,
       p.email, p.paginaweb, p.proveefletes, p.anticipo, p.tiempoentrega, p.condiciones, p.curp,
       p.esextranjero, p.tiempotraslado, p.pocentajerequeridoanticipo, p.diasparafiniquito, p.observaciones,
       upper(regexp_replace(coalesce(p.rfc, ''), '[^A-Za-z0-9Ññ&]', '', 'g')) AS rfc_limpio
  FROM staging_tipado.proveedores p
 WHERE p._empresa = '7';

ALTER TABLE _prov ADD COLUMN rfc_valido boolean, ADD COLUMN rfc_generico boolean, ADD COLUMN rfc_extranjero boolean,
                  ADD COLUMN rfc_final text, ADD COLUMN es_baja boolean, ADD COLUMN es_fletera boolean,
                  ADD COLUMN cliente_id integer;

UPDATE _prov SET
  rfc_limpio     = NULLIF(rfc_limpio, ''),
  rfc_valido     = rfc_limpio ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$',
  rfc_generico   = rfc_limpio IN ('XAXX010101000', 'XEXX010101000'),
  -- Registro fiscal extranjero: no empieza como RFC (3-4 letras y fecha). Ej. 913302030955305, 47-1792914.
  rfc_extranjero = rfc_limpio <> '' AND rfc_limpio !~ '^[A-ZÑ&]{3,4}[0-9]',
  es_baja        = nombre ILIKE '%**Baja**%',
  es_fletera     = coalesce(proveefletes, 0) = 1;

-- RFC que va al contacto: el válido; XEXX para extranjeros; el que parece RFC pero no cuadra, tal cual.
UPDATE _prov SET rfc_final = CASE WHEN rfc_extranjero THEN 'XEXX010101000' ELSE rfc_limpio END;

-- Proveedor que ya es cliente: mismo RFC válido y no genérico, y un solo cliente con ese RFC.
UPDATE _prov p SET cliente_id = x.id
  FROM (SELECT c.rfc, min(c.id) AS id
          FROM public.contactos c
         WHERE c.empresa_id = 7 AND c.tipo_contacto = 'Cliente'
         GROUP BY c.rfc HAVING count(*) = 1) x
 WHERE p.rfc_valido AND NOT p.rfc_generico AND x.rfc = p.rfc_limpio;

-- Si dos proveedores caen en el mismo cliente, no se sabe cuál código guardar: se aborta.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _prov WHERE cliente_id IS NOT NULL GROUP BY cliente_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay dos proveedores con el RFC del mismo cliente; revisar antes de continuar';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Contactos nuevos (proveedores que no son cliente)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos (
  empresa_id, tipo_contacto, codigo_legacy, nombre, nombre_contacto, rfc, email,
  telefono, telefono_secundario, telefono_adicional, pagina_web,
  activo, bloqueado, dias_credito, fecha_alta, fecha_inicio_relaciones, iva_desglosado,
  ultimo_concepto_utilizado, observaciones)
SELECT 7, 'Proveedor', p.codigo, p.nombre, pg_temp.t(p.contacto),
       CASE WHEN length(p.rfc_final) <= 13 THEN p.rfc_final END,
       pg_temp.t(p.email), pg_temp.t(p.telefono1), pg_temp.t(p.telefono2), pg_temp.t(p.telefono3),
       pg_temp.t(p.paginaweb),
       NOT p.es_baja, false, p.diascredito,
       -- fecha_alta es obligatoria. Sin FechaAlta: inicio de relaciones, o la fecha con que empieza el código
       -- de Clarion (AAAAMMDD...).
       coalesce(p.fechaalta, p.fechainiciorelaciones, to_date(left(p.codigo, 8), 'YYYYMMDD'))::timestamptz,
       p.fechainiciorelaciones, p.ivadesglosado,
       pg_temp.t(p.concepto), pg_temp.t(p.observaciones)
  FROM _prov p
 WHERE p.cliente_id IS NULL
 ORDER BY p.codigo;

-- Código de Clarion -> contacto (nuevos y clientes existentes).
CREATE TEMP TABLE _map ON COMMIT DROP AS
SELECT c.codigo_legacy AS codigo, c.id AS contacto_id, true AS es_nuevo
  FROM public.contactos c
 WHERE c.empresa_id = 7 AND c.tipo_contacto = 'Proveedor'
UNION ALL
SELECT p.codigo, p.cliente_id, false
  FROM _prov p
 WHERE p.cliente_id IS NOT NULL;
CREATE UNIQUE INDEX ON _map (codigo);

-- ---------------------------------------------------------------------------
-- 4. Roles (proveedor para todos; fletera para ProveeFletes = 1)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos_roles (contacto_id, rol, origen, metadata)
SELECT m.contacto_id, r.rol, 'MIGRACION',
       jsonb_build_object('sistema', 'CLARION', 'tabla', 'Proveedores', 'codigo', m.codigo)
  FROM _map m
  JOIN _prov p ON p.codigo = m.codigo
  CROSS JOIN LATERAL (VALUES ('proveedor'), (CASE WHEN p.es_fletera THEN 'fletera' END)) r(rol)
 WHERE r.rol IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Datos fiscales (solo contactos nuevos con RFC; los clientes ya tienen los suyos)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos_datos_fiscales (contacto_id, rfc, curp, razon_social_fiscal, codigo_postal_fiscal)
SELECT m.contacto_id, left(p.rfc_final, 20), pg_temp.t(p.curp),
       CASE WHEN p.rfc_valido AND NOT p.rfc_generico THEN left(p.nombre, 200) END,
       CASE WHEN p.rfc_valido AND NOT p.rfc_generico AND btrim(p.cp) ~ '^[0-9]{5}$' THEN btrim(p.cp) END
  FROM _prov p
  JOIN _map m ON m.codigo = p.codigo AND m.es_nuevo
 WHERE p.rfc_final IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Domicilio principal (solo contactos nuevos)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos_domicilios (
  contacto_id, identificador, es_principal, calle, colonia, ciudad, estado, cp, pais, fax,
  texto_original, observaciones)
SELECT m.contacto_id, 'Principal', true,
       pg_temp.t(p.domicilio), pg_temp.t(p.colonia), pg_temp.t(p.ciudad), pg_temp.t(p.estado), pg_temp.t(p.cp),
       pg_temp.pais(p.pais),
       CASE WHEN length(pg_temp.t(p.fax)) <= 20 THEN pg_temp.t(p.fax) END,
       pg_temp.t(p.domicilio),
       -- Lo que no cabe en su columna se guarda completo aquí.
       CASE WHEN length(pg_temp.t(p.fax)) > 20 THEN 'Fax: ' || btrim(p.fax) END
  FROM _prov p
  JOIN _map m ON m.codigo = p.codigo AND m.es_nuevo
 WHERE coalesce(pg_temp.t(p.domicilio), pg_temp.t(p.colonia), pg_temp.t(p.ciudad), pg_temp.t(p.estado),
                pg_temp.t(p.cp), pg_temp.t(p.pais), pg_temp.t(p.fax)) IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Personal (PersonalProveedores -> contactos_adicionales)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos_adicionales (empresa_id, contacto_id, nombre, puesto, email, telefono, observaciones, activo)
SELECT 7, m.contacto_id,
       coalesce(pg_temp.t(x.nombre), pg_temp.t(x.puesto), pg_temp.t(x.telefono)),
       pg_temp.t(x.puesto), NULL, pg_temp.t(x.telefono), pg_temp.t(x.observaciones), true
  FROM staging.personalproveedores x
  JOIN _map m ON m.codigo = btrim(x.codigocliente)
 WHERE x._empresa = '7'
   AND coalesce(pg_temp.t(x.nombre), pg_temp.t(x.puesto), pg_temp.t(x.telefono)) IS NOT NULL
 ORDER BY x._ptr;

-- ---------------------------------------------------------------------------
-- 8. Catálogos configurables (Zona y Clasificación de proveedores)
-- ---------------------------------------------------------------------------
INSERT INTO core.catalogos_tipos (empresa_id, entidad_tipo_id, nombre, permite_multiple, activo)
SELECT 7, 1, n, false, true
  FROM unnest(ARRAY['Zonas de Proveedores', 'Clasificaciones de Proveedores']) n
ON CONFLICT (empresa_id, nombre) DO NOTHING;

CREATE TEMP TABLE _tipos ON COMMIT DROP AS
SELECT v.campo, ct.id AS tipo_id
  FROM (VALUES ('zona', 'Zonas de Proveedores'), ('clasificacion', 'Clasificaciones de Proveedores')) v(campo, nombre)
  JOIN core.catalogos_tipos ct ON ct.empresa_id = 7 AND ct.nombre = v.nombre;

-- Valor de cada proveedor por catálogo.
CREATE TEMP TABLE _prov_cat ON COMMIT DROP AS
SELECT m.contacto_id, x.campo, pg_temp.llave(x.valor) AS llave, btrim(x.valor) AS valor
  FROM _prov p
  JOIN _map m ON m.codigo = p.codigo
  CROSS JOIN LATERAL (VALUES ('zona', p.zona), ('clasificacion', p.clasificacion)) x(campo, valor)
 WHERE pg_temp.t(x.valor) IS NOT NULL;

-- Valores: primero los catálogos de Clarion (con su descripción en extra), luego lo que solo aparece en proveedores.
CREATE TEMP TABLE _valores ON COMMIT DROP AS
WITH clarion AS (
  SELECT 'zona' AS campo, pg_temp.llave(identificacion) AS llave, btrim(identificacion) AS valor,
         'ZonasProveedores' AS tabla, pg_temp.t(descripcion) AS desc_clarion, _ptr
    FROM staging.zonasproveedores WHERE _empresa = '7' AND pg_temp.t(identificacion) IS NOT NULL
  UNION ALL
  SELECT 'clasificacion', pg_temp.llave(identificacion), btrim(identificacion),
         'ClasificacionProveedores', pg_temp.t(descripcion), _ptr
    FROM staging.clasificacionproveedores WHERE _empresa = '7' AND pg_temp.t(identificacion) IS NOT NULL
),
clarion_unico AS (
  -- Ante un error de dedo unificado, gana la forma ya corregida (ej. USA sobre U.S.A.).
  SELECT DISTINCT ON (campo, llave) * FROM clarion
   ORDER BY campo, llave, (upper(valor) = llave) DESC, _ptr
),
de_proveedores AS (
  SELECT DISTINCT ON (campo, llave) campo, llave, valor
    FROM (SELECT campo, llave, valor, count(*) AS n FROM _prov_cat GROUP BY 1, 2, 3) z
   ORDER BY campo, llave, (upper(valor) = llave) DESC, n DESC, valor
)
SELECT coalesce(cl.campo, dp.campo) AS campo,
       coalesce(cl.llave, dp.llave) AS llave,
       coalesce(cl.valor, dp.valor) AS valor,
       CASE WHEN cl.campo IS NOT NULL
            THEN jsonb_build_object('origen', 'CLARION', 'tabla', cl.tabla, 'descripcion_clarion', cl.desc_clarion)
            ELSE jsonb_build_object('origen', 'CLARION', 'tabla', 'Proveedores') END AS extra
  FROM clarion_unico cl
  FULL JOIN de_proveedores dp ON dp.campo = cl.campo AND dp.llave = cl.llave;

INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, clave, descripcion, orden, activo, extra)
SELECT 7, t.tipo_id, left(v.valor, 40), left(v.valor, 150),
       row_number() OVER (PARTITION BY v.campo ORDER BY v.valor), true, v.extra
  FROM _valores v
  JOIN _tipos t ON t.campo = v.campo
 WHERE NOT EXISTS (SELECT 1 FROM core.catalogos k
                    WHERE k.empresa_id = 7 AND k.tipo_catalogo_id = t.tipo_id AND pg_temp.llave(k.clave) = v.llave);

INSERT INTO core.entidades_catalogos (empresa_id, entidad_tipo_id, entidad_id, catalogo_id)
SELECT DISTINCT 7, 1, pc.contacto_id, k.id
  FROM _prov_cat pc
  JOIN _tipos t ON t.campo = pc.campo
  JOIN core.catalogos k ON k.empresa_id = 7 AND k.tipo_catalogo_id = t.tipo_id AND pg_temp.llave(k.clave) = pc.llave;

-- ---------------------------------------------------------------------------
-- 9. Campos configurables (core.campos_configuracion + contactos_campos)
-- ---------------------------------------------------------------------------
-- num_reg_id_trib ya existe (lo creó 02_transformar_clientes.sql); aquí solo se asegura.
CREATE TEMP TABLE _campos_def ON COMMIT DROP AS
SELECT * FROM (VALUES
  (15, 'num_reg_id_trib',                  'Núm. de registro de identidad tributaria', 'texto'),
  (19, 'codigo_proveedor_clarion',         'Código de proveedor en Clarion',           'texto'),
  (20, 'agente_proveedor',                 'Agente del proveedor',                     'texto'),
  (21, 'anticipo_proveedor',               'Anticipo',                                 'numero'),
  (22, 'porcentaje_anticipo_proveedor',    'Porcentaje requerido de anticipo',         'numero'),
  (23, 'tiempo_entrega_proveedor',         'Tiempo de entrega',                        'numero'),
  (24, 'tiempo_traslado_proveedor',        'Tiempo de traslado',                       'numero'),
  (25, 'condiciones_proveedor',            'Condiciones de compra (Clarion)',          'texto'),
  (26, 'dias_finiquito_proveedor',         'Días para finiquito',                      'numero')
) v(orden, clave, nombre, tipo_dato);

INSERT INTO core.campos_configuracion (empresa_id, entidad_tipo_id, nombre, clave, tipo_dato, tipo_control, obligatorio, activo, orden)
SELECT 7, 1, d.nombre, d.clave, d.tipo_dato, 'input', false, true, d.orden
  FROM _campos_def d
 WHERE NOT EXISTS (SELECT 1 FROM core.campos_configuracion cc
                    WHERE cc.empresa_id = 7 AND cc.entidad_tipo_id = 1 AND cc.clave = d.clave);

CREATE TEMP TABLE _campos ON COMMIT DROP AS
SELECT d.clave, cc.id AS campo_id
  FROM _campos_def d
  JOIN core.campos_configuracion cc ON cc.empresa_id = 7 AND cc.entidad_tipo_id = 1 AND cc.clave = d.clave;

-- Números en cero son el valor por omisión de Clarion: no se guardan.
INSERT INTO public.contactos_campos (empresa_id, contacto_id, campo_id, valor_texto, valor_numero)
SELECT 7, m.contacto_id, k.campo_id, x.texto, x.numero
  FROM _prov p
  JOIN _map m ON m.codigo = p.codigo
  CROSS JOIN LATERAL (VALUES
    ('num_reg_id_trib',               CASE WHEN p.rfc_extranjero THEN btrim(p.rfc) END, NULL::numeric),
    ('codigo_proveedor_clarion',      CASE WHEN NOT m.es_nuevo THEN p.codigo END, NULL),
    ('agente_proveedor',              pg_temp.t(p.agente), NULL),
    ('anticipo_proveedor',            NULL, NULLIF(p.anticipo, 0)),
    ('porcentaje_anticipo_proveedor', NULL, NULLIF(p.pocentajerequeridoanticipo, 0)),
    ('tiempo_entrega_proveedor',      NULL, NULLIF(p.tiempoentrega, 0)::numeric),
    ('tiempo_traslado_proveedor',     NULL, NULLIF(p.tiempotraslado, 0)::numeric),
    ('condiciones_proveedor',         pg_temp.t(p.condiciones), NULL),
    ('dias_finiquito_proveedor',      NULL, NULLIF(p.diasparafiniquito, 0))
  ) x(clave, texto, numero)
  JOIN _campos k ON k.clave = x.clave
 WHERE x.texto IS NOT NULL OR x.numero IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 10. Conteos de control: si algo no cuadra, se aborta todo
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _control (concepto text, esperado bigint, obtenido bigint) ON COMMIT DROP;

INSERT INTO _control VALUES
  ('Proveedores de Clarion = nuevos + ya clientes',
     (SELECT count(*) FROM _prov),
     (SELECT count(*) FROM _map)),
  ('Contactos nuevos tipo Proveedor',
     (SELECT count(*) FROM _prov WHERE cliente_id IS NULL),
     (SELECT count(*) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Proveedor')),
  ('Proveedores nuevos activos (sin **Baja**)',
     (SELECT count(*) FROM _prov WHERE cliente_id IS NULL AND NOT es_baja),
     (SELECT count(*) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Proveedor' AND activo)),
  ('Roles proveedor',
     (SELECT count(*) FROM _prov),
     (SELECT count(*) FROM public.contactos_roles r JOIN _map m ON m.contacto_id = r.contacto_id WHERE r.rol = 'proveedor')),
  ('Roles fletera',
     (SELECT count(*) FROM _prov WHERE es_fletera),
     (SELECT count(*) FROM public.contactos_roles r JOIN _map m ON m.contacto_id = r.contacto_id WHERE r.rol = 'fletera')),
  ('Datos fiscales (nuevos con RFC)',
     (SELECT count(*) FROM _prov WHERE cliente_id IS NULL AND rfc_final IS NOT NULL),
     (SELECT count(*) FROM public.contactos_datos_fiscales f JOIN _map m ON m.contacto_id = f.contacto_id AND m.es_nuevo)),
  ('Código de proveedor en clientes existentes',
     (SELECT count(*) FROM _prov WHERE cliente_id IS NOT NULL),
     (SELECT count(*) FROM public.contactos_campos v JOIN _campos k ON k.campo_id = v.campo_id
       WHERE v.empresa_id = 7 AND k.clave = 'codigo_proveedor_clarion')),
  ('Registro fiscal extranjero',
     (SELECT count(*) FROM _prov WHERE rfc_extranjero),
     (SELECT count(*) FROM public.contactos_campos v JOIN _campos k ON k.campo_id = v.campo_id
       JOIN _map m ON m.contacto_id = v.contacto_id WHERE v.empresa_id = 7 AND k.clave = 'num_reg_id_trib')),
  ('Suma de días de crédito (nuevos)',
     (SELECT coalesce(sum(diascredito), 0) FROM _prov WHERE cliente_id IS NULL),
     (SELECT coalesce(sum(dias_credito), 0) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Proveedor'));

INSERT INTO _control
SELECT 'Catálogo ' || t.campo,
       (SELECT count(*) FROM _prov_cat pc WHERE pc.campo = t.campo),
       (SELECT count(*) FROM core.entidades_catalogos ec JOIN core.catalogos k ON k.id = ec.catalogo_id
         WHERE ec.empresa_id = 7 AND ec.entidad_tipo_id = 1 AND k.tipo_catalogo_id = t.tipo_id)
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
SELECT 'Domicilios principales (nuevos)' AS concepto, count(*) AS filas
  FROM public.contactos_domicilios d JOIN _map m ON m.contacto_id = d.contacto_id AND m.es_nuevo WHERE d.es_principal
UNION ALL SELECT 'Personal (contactos adicionales)', count(*)
  FROM public.contactos_adicionales a JOIN _map m ON m.contacto_id = a.contacto_id
UNION ALL SELECT 'Valores de catálogo de proveedores', count(*)
  FROM core.catalogos k JOIN _tipos t ON t.tipo_id = k.tipo_catalogo_id
UNION ALL SELECT 'Valores en contactos_campos (proveedores)', count(*)
  FROM public.contactos_campos v JOIN _map m ON m.contacto_id = v.contacto_id
       JOIN _campos k ON k.campo_id = v.campo_id;

-- ---------------------------------------------------------------------------
-- 11. Lista de casos a revisar
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS migrate.clarion_revision_proveedores;
CREATE TABLE migrate.clarion_revision_proveedores (tipo text, codigo text, nombre text, detalle text);

INSERT INTO migrate.clarion_revision_proveedores
SELECT 'Ya era cliente (se le agregó el rol)', codigo, nombre, 'contacto ' || cliente_id
  FROM _prov WHERE cliente_id IS NOT NULL
UNION ALL
SELECT 'RFC repetido entre proveedores', codigo, nombre, rfc_limpio
  FROM _prov WHERE rfc_limpio IN (SELECT rfc_limpio FROM _prov WHERE rfc_limpio IS NOT NULL
                                   GROUP BY 1 HAVING count(*) > 1)
UNION ALL
SELECT 'Registro fiscal extranjero (RFC XEXX)', codigo, nombre, btrim(rfc)
  FROM _prov WHERE rfc_extranjero
UNION ALL
SELECT 'RFC con formato inválido (tal cual)', codigo, nombre, coalesce(btrim(rfc), '') || ' -> ' || rfc_limpio
  FROM _prov WHERE rfc_limpio IS NOT NULL AND NOT rfc_valido AND NOT rfc_extranjero
UNION ALL
SELECT 'Sin RFC (sin datos fiscales)', codigo, nombre, pg_temp.pais(pais)
  FROM _prov WHERE rfc_limpio IS NULL AND cliente_id IS NULL
UNION ALL
SELECT 'Dado de baja (inactivo)', codigo, nombre, NULL
  FROM _prov WHERE es_baja
UNION ALL
SELECT 'Sin fecha de alta (se tomó de inicio de relaciones o del código)', codigo, nombre,
       coalesce(fechainiciorelaciones, to_date(left(codigo, 8), 'YYYYMMDD'))::text
  FROM _prov WHERE fechaalta IS NULL AND cliente_id IS NULL
UNION ALL
SELECT 'Fax a observaciones del domicilio', codigo, nombre, btrim(fax)
  FROM _prov WHERE length(pg_temp.t(fax)) > 20 AND cliente_id IS NULL
UNION ALL
SELECT 'Domicilio adicional omitido (sin datos)', btrim(d.codigocliente), btrim(d.identificaci_n), '_ptr ' || d._ptr
  FROM staging.domiciliosproveedores d WHERE d._empresa = '7';

SELECT tipo, count(*) AS casos FROM migrate.clarion_revision_proveedores GROUP BY tipo ORDER BY tipo;

ROLLBACK;
