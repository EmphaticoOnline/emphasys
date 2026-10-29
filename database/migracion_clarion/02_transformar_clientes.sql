-- database/migracion_clarion/02_transformar_clientes.sql
-- Transforma Clientes de Clarion (staging, _empresa = '7') a contactos de la empresa 7 en dev_emphasys.
-- NO es una migración del ERP. Decisiones: memoria "migracion-clarion-clientes" y mapeo_clientes.xlsx.
--
-- Fuentes: staging_tipado.clientes, domiciliosclientes, personalclientes, agentesclientes,
--          zonasclientes, clasificacionclientes, descuentosclientes.
-- Destino: contactos (vendedores y clientes), contactos_roles, contactos_datos_fiscales,
--          contactos_domicilios, contactos_adicionales, core.catalogos_tipos/catalogos/entidades_catalogos,
--          core.campos_configuracion, contactos_campos.
-- Pendiente a propósito: cuentas contables por cliente (requiere migrar contabilidad.cuentas).
--
-- Termina en ROLLBACK. Para guardar, cambiar ROLLBACK por COMMIT al final.
-- Deja la lista de casos a revisar en migrate.clarion_revision_clientes (solo si se hace COMMIT).

BEGIN;

-- El trigger de responsabilidad registra el origen del vendedor asignado.
SET LOCAL app.responsabilidad_origen = 'importacion';

-- ---------------------------------------------------------------------------
-- 0. Candados
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF current_database() <> 'dev_emphasys' THEN
    RAISE EXCEPTION 'Este script solo corre en dev_emphasys (estás en %)', current_database();
  END IF;
  IF EXISTS (SELECT 1 FROM public.contactos WHERE empresa_id = 7) THEN
    RAISE EXCEPTION 'La empresa 7 ya tiene contactos; correr antes 01_limpiar_empresa_7.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staging.clientes WHERE _empresa = '7') THEN
    RAISE EXCEPTION 'No hay clientes en staging para la empresa 7';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staging.agentesclientes WHERE _empresa = '7') THEN
    RAISE EXCEPTION 'No hay agentes en staging para la empresa 7 (cargar AgentesClientes)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Funciones auxiliares (temporales, viven solo en esta sesión)
-- ---------------------------------------------------------------------------
-- Texto limpio: recorta y convierte '' en NULL.
CREATE FUNCTION pg_temp.t(v text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT NULLIF(btrim(v), '') $$;

-- País: MEX/MEXICO/MÉXICO -> 'México'; un código SAT de 3 letras -> su nombre; vacío -> país del código SAT.
CREATE FUNCTION pg_temp.pais(p text, codigo_sat text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
           WHEN pg_temp.t(p) IS NULL THEN (SELECT texto FROM sat.paises WHERE id = upper(pg_temp.t(codigo_sat)))
           WHEN upper(translate(btrim(p), 'Éé', 'Ee')) IN ('MEX', 'MEXICO', 'MEXCO', 'MEICO') THEN 'México'
           WHEN length(btrim(p)) = 3 AND EXISTS (SELECT 1 FROM sat.paises WHERE id = upper(btrim(p)))
             THEN (SELECT texto FROM sat.paises WHERE id = upper(btrim(p)))
           ELSE btrim(p)
         END
$$;

-- Llave de comparación de catálogos: mayúsculas, sin espacios dobles, con errores de dedo unificados.
CREATE FUNCTION pg_temp.llave(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE k
           WHEN 'CENTROAMERCIA' THEN 'CENTROAMERICA'
           WHEN 'NO ESPECIFADA' THEN 'NO ESPECIFICADA'
           ELSE k
         END
    FROM (SELECT upper(regexp_replace(btrim(v), '\s+', ' ', 'g')) AS k) x
$$;

-- ---------------------------------------------------------------------------
-- 2. Clientes normalizados
-- ---------------------------------------------------------------------------
-- Solo las columnas que se usan: la vista tipada truena con columnas descartadas
-- (ej. CodigoAdicional trae "1." y no convierte a bigint).
CREATE TEMP TABLE _cli ON COMMIT DROP AS
SELECT c.codigo, c.nombre, c.contacto, c.rfc, c.domicilio, c.colonia, c.ciudad, c.estado, c.cp, c.pais,
       c.telefono1, c.telefono2, c.telefono3, c.fax, c.clasificacion, c.zona, c.ivadesglosado, c.agente,
       c.descuento, c.diascredito, c.limitecredito, c.fechainiciorelaciones, c.concepto, c.bloqueado,
       c.motivobloqueo, c.fechaalta, c.publicogeneral, c.email, c.paginaweb, c.nivelriesgo, c.comentarioscredito,
       c.campousuario1, c.campousuario2, c.campousuario3, c.campousuario4, c.campousuario5, c.cobrariva,
       c.curp, c.baja, c.formapago,
       c.lunescontrarecibo, c.martescontrarecibo, c.miercolescontrarecibo, c.juevescontrarecibo,
       c.viernescontrarecibo, c.horariocontrarecibo,
       c.lunespago, c.martespago, c.miercolespago, c.juevespago, c.viernespago, c.horariopago,
       c.lunesrecepcionmercancia, c.martesrecepcionmercancia, c.miercolesrecepcionmercancia,
       c.juevesrecepcionmercancia, c.viernesrecepcionmercancia, c.horariorecepcionmercancia,
       c.calle, c.numeroexterior, c.numerointerior, c.enviarcfd, c.enviarcfdagente, c.metodopago,
       c.numerocuentapago, c.bloquearalsiguientedia, c.categoria, c.estatus, c.usarultimoprecio, c.mercado,
       c.codigopaissat, c.codigoregimenfiscal, c.bancocuentapredeterminada, c.formapagopredeterminada,
       c.numregidtrib, c.usocfdipredeterminado, c.incoterm, c.listabancos, c.listacuentas, c.observaciones,
       upper(regexp_replace(coalesce(c.rfc, ''), '[^A-Za-z0-9Ññ&]', '', 'g')) AS rfc_limpio
  FROM staging_tipado.clientes c
 WHERE c._empresa = '7';

ALTER TABLE _cli ADD COLUMN rfc_valido boolean, ADD COLUMN rfc_generico boolean,
                 ADD COLUMN agente_canonico text, ADD COLUMN descuento_texto text;

UPDATE _cli SET
  rfc_limpio    = NULLIF(rfc_limpio, ''),
  rfc_valido    = rfc_limpio ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$',
  rfc_generico  = rfc_limpio IN ('XAXX010101000', 'XEXX010101000'),
  -- Agentes escritos distinto en el cliente que en el catálogo de agentes.
  agente_canonico = CASE pg_temp.llave(agente)
                      WHEN 'SAUL PEÑA'             THEN 'SAUL PEÑA RODRIGUEZ'
                      WHEN 'MARIA DOLOREZ ALVAREZ' THEN 'MARIA DOLORES ALVAREZ JUAREZ'
                      ELSE pg_temp.llave(agente)
                    END,
  -- Descuentos que no son número (PREFERENTE, ML) se van a observaciones.
  descuento_texto = CASE WHEN pg_temp.t(descuento) !~ '^[0-9]+(\.[0-9]+)?$' THEN pg_temp.t(descuento) END;

-- ---------------------------------------------------------------------------
-- 3. Vendedores (catálogo AgentesClientes + "Cuentas Incobrables")
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _agentes ON COMMIT DROP AS
SELECT pg_temp.llave(a.nombre) AS llave,
       btrim(a.nombre)         AS nombre,
       pg_temp.t(a.email)      AS email,
       pg_temp.t(a.telefono)   AS telefono,
       pg_temp.t(a.domicilio)  AS domicilio,
       pg_temp.t(a.colonia)    AS colonia,
       pg_temp.t(a.ciudad)     AS ciudad,
       pg_temp.t(a.estado)     AS estado,
       pg_temp.t(a.cp)         AS cp,
       pg_temp.pais(a.pa_s, NULL) AS pais,
       concat_ws(E'\n',
         pg_temp.t(a.observaciones),
         CASE WHEN a.porcentajecomision IS NOT NULL AND a.porcentajecomision <> 0
              THEN 'Comisión en Clarion: ' || a.porcentajecomision || '%' END) AS observaciones
  FROM staging_tipado.agentesclientes a
 WHERE a._empresa = '7' AND pg_temp.t(a.nombre) IS NOT NULL
UNION ALL
SELECT 'CUENTAS INCOBRABLES', 'Cuentas Incobrables', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       'Creado en la migración: agente usado en clientes de Clarion que no existe en AgentesClientes.';

INSERT INTO public.contactos (empresa_id, tipo_contacto, nombre, email, telefono, activo, observaciones)
SELECT 7, 'Vendedor', a.nombre, a.email, a.telefono, true, NULLIF(a.observaciones, '')
  FROM _agentes a
 ORDER BY a.nombre;

CREATE TEMP TABLE _vend ON COMMIT DROP AS
SELECT a.llave, c.id AS contacto_id
  FROM _agentes a
  JOIN public.contactos c ON c.empresa_id = 7 AND c.tipo_contacto = 'Vendedor' AND c.nombre = a.nombre;

INSERT INTO public.contactos_roles (contacto_id, rol, origen, metadata)
SELECT v.contacto_id, 'vendedor', 'MIGRACION',
       jsonb_build_object('sistema', 'CLARION', 'tabla', 'AgentesClientes', 'nombre', a.nombre)
  FROM _vend v JOIN _agentes a ON a.llave = v.llave;

INSERT INTO public.contactos_domicilios (contacto_id, identificador, es_principal, calle, colonia, ciudad, estado, cp, pais, texto_original)
SELECT v.contacto_id, 'Principal', true, a.domicilio, a.colonia, a.ciudad, a.estado, a.cp, a.pais, a.domicilio
  FROM _vend v JOIN _agentes a ON a.llave = v.llave
 WHERE coalesce(a.domicilio, a.colonia, a.ciudad, a.estado, a.cp) IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Clientes
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos (
  empresa_id, tipo_contacto, codigo_legacy, nombre, nombre_contacto, rfc, email,
  telefono, telefono_secundario, telefono_adicional, pagina_web,
  activo, bloqueado, motivo_bloqueo, dias_credito, limite_credito, vendedor_id,
  fecha_alta, fecha_inicio_relaciones, iva_desglosado, ultimo_concepto_utilizado, observaciones)
SELECT 7, 'Cliente', btrim(c.codigo), btrim(c.nombre), pg_temp.t(c.contacto),
       CASE WHEN length(c.rfc_limpio) <= 13 THEN c.rfc_limpio END,
       pg_temp.t(c.email),
       pg_temp.t(c.telefono1), pg_temp.t(c.telefono2), pg_temp.t(c.telefono3), pg_temp.t(c.paginaweb),
       NOT coalesce(c.baja, false), coalesce(c.bloqueado, false), pg_temp.t(c.motivobloqueo),
       c.diascredito, c.limitecredito, v.contacto_id,
       c.fechaalta::timestamptz, c.fechainiciorelaciones, c.ivadesglosado, pg_temp.t(c.concepto),
       NULLIF(concat_ws(E'\n',
         pg_temp.t(c.observaciones),
         CASE WHEN c.descuento_texto IS NOT NULL THEN 'Descuento en Clarion: ' || c.descuento_texto END), '')
  FROM _cli c
  LEFT JOIN _vend v ON v.llave = c.agente_canonico
 ORDER BY c.codigo;

CREATE TEMP TABLE _map ON COMMIT DROP AS
SELECT c.codigo_legacy AS codigo, c.id AS contacto_id
  FROM public.contactos c
 WHERE c.empresa_id = 7 AND c.tipo_contacto = 'Cliente';
CREATE UNIQUE INDEX ON _map (codigo);

INSERT INTO public.contactos_roles (contacto_id, rol, origen, metadata)
SELECT m.contacto_id, 'cliente', 'MIGRACION',
       jsonb_build_object('sistema', 'CLARION', 'tabla', 'Clientes', 'codigo', m.codigo)
  FROM _map m;

-- ---------------------------------------------------------------------------
-- 5. Datos fiscales (solo clientes con RFC)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos_datos_fiscales (
  contacto_id, rfc, curp, regimen_fiscal, uso_cfdi, forma_pago, metodo_pago,
  enviar_cfd, enviar_cfd_agente, es_publico_general, razon_social_fiscal, codigo_postal_fiscal)
SELECT m.contacto_id, c.rfc_limpio, pg_temp.t(c.curp), pg_temp.t(c.codigoregimenfiscal),
       pg_temp.t(c.usocfdipredeterminado),
       -- Clarion guardó formas de pago (01, 02, 03, 99) en MetodoPago; se usan si no hay forma predeterminada.
       coalesce(pg_temp.t(c.formapagopredeterminada), substring(pg_temp.t(c.metodopago) FROM '^(0[1-9]|[1-9][0-9]) ')),
       CASE WHEN upper(pg_temp.t(c.metodopago)) IN ('PUE', 'PPD') THEN upper(btrim(c.metodopago)) END,
       coalesce(c.enviarcfd, true), coalesce(c.enviarcfdagente, false), coalesce(c.publicogeneral, false),
       CASE WHEN c.rfc_valido AND NOT c.rfc_generico THEN left(btrim(c.nombre), 200) END,
       -- El domicilio principal es el fiscal. Solo CP de 5 dígitos; los de 4 en Clarion están truncados
       -- (Tepic 6300, Culiacán 8000), no les falta el cero inicial. XAXX/XEXX usan el CP del emisor.
       CASE WHEN c.rfc_valido AND NOT c.rfc_generico AND btrim(c.cp) ~ '^[0-9]{5}$' THEN btrim(c.cp) END
  FROM _cli c
  JOIN _map m ON m.codigo = btrim(c.codigo)
 WHERE c.rfc_limpio IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Domicilio principal (Clientes)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos_domicilios (
  contacto_id, identificador, es_principal, calle, numero_exterior, numero_interior,
  colonia, ciudad, estado, cp, pais, fax, texto_original, observaciones)
SELECT m.contacto_id, 'Principal', true,
       pg_temp.t(c.calle), pg_temp.t(c.numeroexterior), pg_temp.t(c.numerointerior),
       CASE WHEN length(pg_temp.t(c.colonia)) <= 60 THEN pg_temp.t(c.colonia) END,
       pg_temp.t(c.ciudad), pg_temp.t(c.estado), pg_temp.t(c.cp),
       pg_temp.pais(c.pais, c.codigopaissat),
       CASE WHEN length(pg_temp.t(c.fax)) <= 20 THEN pg_temp.t(c.fax) END,
       pg_temp.t(c.domicilio),
       -- Lo que no cabe en su columna se guarda completo aquí.
       NULLIF(concat_ws(E'\n',
         CASE WHEN length(pg_temp.t(c.colonia)) > 60 THEN 'Colonia: ' || btrim(c.colonia) END,
         CASE WHEN length(pg_temp.t(c.fax)) > 20 THEN 'Fax: ' || btrim(c.fax) END), '')
  FROM _cli c
  JOIN _map m ON m.codigo = btrim(c.codigo)
 WHERE coalesce(pg_temp.t(c.calle), pg_temp.t(c.numeroexterior), pg_temp.t(c.numerointerior),
                pg_temp.t(c.colonia), pg_temp.t(c.ciudad), pg_temp.t(c.estado), pg_temp.t(c.cp),
                pg_temp.t(c.pais), pg_temp.t(c.codigopaissat), pg_temp.t(c.fax), pg_temp.t(c.domicilio)) IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Domicilios adicionales (DomiciliosClientes)
-- ---------------------------------------------------------------------------
INSERT INTO public.contactos_domicilios (
  contacto_id, identificador, es_principal, responsable, calle, colonia, ciudad, estado, cp, pais,
  telefono, fax, tipo_referencia, texto_original, observaciones)
SELECT m.contacto_id, btrim(d.identificaci_n), false, pg_temp.t(d.responsable),
       pg_temp.t(d.domicilio), pg_temp.t(d.colonia), pg_temp.t(d.ciudad), pg_temp.t(d.estado), pg_temp.t(d.cp),
       pg_temp.pais(d.pa_s, NULL),
       CASE WHEN length(pg_temp.t(d.telefono)) <= 20 THEN pg_temp.t(d.telefono) END,
       CASE WHEN length(pg_temp.t(d.fax)) <= 20 THEN pg_temp.t(d.fax) END,
       pg_temp.t(d.clasificacion), pg_temp.t(d.domicilio),
       NULLIF(concat_ws(E'\n',
         pg_temp.t(d.observaciones),
         CASE WHEN pg_temp.t(d.agente) IS NOT NULL THEN 'Agente en Clarion: ' || btrim(d.agente) END,
         CASE WHEN length(pg_temp.t(d.telefono)) > 20 THEN 'Teléfono: ' || btrim(d.telefono) END,
         CASE WHEN length(pg_temp.t(d.fax)) > 20 THEN 'Fax: ' || btrim(d.fax) END), '')
  FROM staging_tipado.domiciliosclientes d
  JOIN _map m ON m.codigo = btrim(d.codigocliente)
 WHERE d._empresa = '7';

-- ---------------------------------------------------------------------------
-- 8. Personal (PersonalClientes -> contactos_adicionales)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _personal ON COMMIT DROP AS
SELECT m.contacto_id, p._ptr,
       coalesce(pg_temp.t(p.nombre), pg_temp.t(p.puesto), pg_temp.t(p.email), pg_temp.t(p.telefono)) AS nombre,
       pg_temp.t(p.nombre) IS NULL AS sin_nombre,
       pg_temp.t(p.puesto) AS puesto, pg_temp.t(p.email) AS email, pg_temp.t(p.telefono) AS telefono,
       pg_temp.t(p.observaciones) AS observaciones, coalesce(p.enviarcfd, false) AS enviar_cfdi,
       btrim(p.codigocliente) AS codigo
  FROM staging_tipado.personalclientes p
  JOIN _map m ON m.codigo = btrim(p.codigocliente)
 WHERE p._empresa = '7';

-- Correo repetido en el mismo cliente: queda activo el primero con nombre; los demás, inactivos.
-- Si cualquiera de ellos recibía CFD, el activo conserva esa marca.
ALTER TABLE _personal ADD COLUMN activo boolean, ADD COLUMN enviar_cfdi_final boolean;
UPDATE _personal p SET
  activo = x.rn = 1,
  enviar_cfdi_final = CASE WHEN x.rn = 1 THEN x.alguno_cfdi ELSE p.enviar_cfdi END
  FROM (SELECT _ptr,
               row_number() OVER w AS rn,
               bool_or(enviar_cfdi) OVER (PARTITION BY contacto_id, lower(coalesce(email, '#' || _ptr))) AS alguno_cfdi
          FROM _personal
        WINDOW w AS (PARTITION BY contacto_id, lower(coalesce(email, '#' || _ptr)) ORDER BY sin_nombre, _ptr)) x
 WHERE x._ptr = p._ptr;

INSERT INTO public.contactos_adicionales (empresa_id, contacto_id, nombre, puesto, email, telefono, observaciones, activo, enviar_cfdi)
SELECT 7, p.contacto_id, p.nombre, p.puesto, p.email, p.telefono, p.observaciones, p.activo, p.enviar_cfdi_final
  FROM _personal p
 WHERE p.nombre IS NOT NULL
 ORDER BY p.contacto_id, p._ptr;

-- ---------------------------------------------------------------------------
-- 9. Catálogos configurables (Zona, Clasificación, Categoría, Estatus, Mercado, Descuento)
-- ---------------------------------------------------------------------------
INSERT INTO core.catalogos_tipos (empresa_id, entidad_tipo_id, nombre, permite_multiple, activo)
SELECT 7, 1, n, false, true
  FROM unnest(ARRAY['Zonas de Contactos', 'Clasificaciones de Contactos', 'Categorías de Contactos',
                    'Estatus de Contactos', 'Mercados de Contactos', 'Descuentos de Contactos']) n
ON CONFLICT (empresa_id, nombre) DO NOTHING;

CREATE TEMP TABLE _tipos ON COMMIT DROP AS
SELECT v.campo, ct.id AS tipo_id
  FROM (VALUES ('zona', 'Zonas de Contactos'), ('clasificacion', 'Clasificaciones de Contactos'),
               ('categoria', 'Categorías de Contactos'), ('estatus', 'Estatus de Contactos'),
               ('mercado', 'Mercados de Contactos'), ('descuento', 'Descuentos de Contactos')) v(campo, nombre)
  JOIN core.catalogos_tipos ct ON ct.empresa_id = 7 AND ct.nombre = v.nombre;

-- Valor de cada cliente por catálogo (una fila por cliente y catálogo con dato).
CREATE TEMP TABLE _cli_cat ON COMMIT DROP AS
SELECT m.contacto_id, x.campo, pg_temp.llave(x.valor) AS llave, btrim(x.valor) AS valor
  FROM _cli c
  JOIN _map m ON m.codigo = btrim(c.codigo)
  CROSS JOIN LATERAL (VALUES ('zona', c.zona), ('clasificacion', c.clasificacion), ('categoria', c.categoria),
                             ('estatus', c.estatus), ('mercado', c.mercado),
                             -- Descuento: solo números distintos de cero.
                             ('descuento', CASE WHEN pg_temp.t(c.descuento) ~ '^[0-9]+(\.[0-9]+)?$'
                                                 AND btrim(c.descuento)::numeric <> 0 THEN btrim(c.descuento) END)
                     ) x(campo, valor)
 WHERE pg_temp.t(x.valor) IS NOT NULL;

-- Valores: primero los catálogos de Clarion (con su descripción vieja en extra), luego lo que solo aparece en clientes.
CREATE TEMP TABLE _valores ON COMMIT DROP AS
WITH clarion AS (
  SELECT 'zona' AS campo, pg_temp.llave(identificacion) AS llave, btrim(identificacion) AS valor,
         'ZonasClientes' AS tabla, pg_temp.t(descripcion) AS desc_clarion, _ptr
    FROM staging.zonasclientes WHERE _empresa = '7' AND pg_temp.t(identificacion) IS NOT NULL
  UNION ALL
  SELECT 'clasificacion', pg_temp.llave(identificacion), btrim(identificacion),
         'ClasificacionClientes', pg_temp.t(descripcion), _ptr
    FROM staging.clasificacionclientes WHERE _empresa = '7' AND pg_temp.t(identificacion) IS NOT NULL
  UNION ALL
  SELECT 'descuento', pg_temp.llave(identificacion), btrim(identificacion),
         'DescuentosClientes', concat_ws(' | ', pg_temp.t(descripcion), 'descuento ' || pg_temp.t(descuento)), _ptr
    FROM staging.descuentosclientes WHERE _empresa = '7' AND pg_temp.t(identificacion) IS NOT NULL
),
clarion_unico AS (
  SELECT DISTINCT ON (campo, llave) * FROM clarion ORDER BY campo, llave, _ptr
),
de_clientes AS (
  -- La forma más usada de escribir cada valor (para los que no están en un catálogo de Clarion).
  SELECT DISTINCT ON (campo, llave) campo, llave, valor
    FROM (SELECT campo, llave, valor, count(*) AS n FROM _cli_cat GROUP BY 1, 2, 3) z
   ORDER BY campo, llave, (valor = llave) DESC, n DESC, valor
)
SELECT coalesce(cl.campo, dc.campo) AS campo,
       coalesce(cl.llave, dc.llave) AS llave,
       -- Errores de dedo unificados: si la llave cambió, se usa la llave corregida como valor.
       CASE WHEN pg_temp.llave(coalesce(cl.valor, dc.valor)) <> upper(regexp_replace(coalesce(cl.valor, dc.valor), '\s+', ' ', 'g'))
            THEN coalesce(cl.llave, dc.llave)
            ELSE coalesce(cl.valor, dc.valor) END AS valor,
       CASE WHEN cl.campo IS NOT NULL
            THEN jsonb_build_object('origen', 'CLARION', 'tabla', cl.tabla, 'descripcion_clarion', cl.desc_clarion)
            ELSE jsonb_build_object('origen', 'CLARION', 'tabla', 'Clientes') END AS extra
  FROM clarion_unico cl
  FULL JOIN de_clientes dc ON dc.campo = cl.campo AND dc.llave = cl.llave;

INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, clave, descripcion, orden, activo, extra)
SELECT 7, t.tipo_id, left(v.valor, 40), left(v.valor, 150),
       row_number() OVER (PARTITION BY v.campo ORDER BY
         CASE WHEN v.campo = 'descuento' AND v.valor ~ '^[0-9]+(\.[0-9]+)?$' THEN lpad(v.valor, 10, '0') ELSE v.valor END),
       true, v.extra
  FROM _valores v
  JOIN _tipos t ON t.campo = v.campo
 WHERE NOT EXISTS (SELECT 1 FROM core.catalogos k
                    WHERE k.empresa_id = 7 AND k.tipo_catalogo_id = t.tipo_id AND pg_temp.llave(k.clave) = v.llave);

INSERT INTO core.entidades_catalogos (empresa_id, entidad_tipo_id, entidad_id, catalogo_id)
SELECT DISTINCT 7, 1, cc.contacto_id, k.id
  FROM _cli_cat cc
  JOIN _tipos t ON t.campo = cc.campo
  JOIN core.catalogos k ON k.empresa_id = 7 AND k.tipo_catalogo_id = t.tipo_id AND pg_temp.llave(k.clave) = cc.llave;

-- ---------------------------------------------------------------------------
-- 10. Campos configurables libres (core.campos_configuracion + contactos_campos)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _campos_def ON COMMIT DROP AS
SELECT * FROM (VALUES
  ( 1, 'clarion_campo_usuario_1',        'Campo usuario 1',                      'texto'),
  ( 2, 'clarion_campo_usuario_2',        'Campo usuario 2',                      'texto'),
  ( 3, 'clarion_campo_usuario_3',        'Campo usuario 3',                      'texto'),
  ( 4, 'clarion_campo_usuario_4',        'Campo usuario 4',                      'texto'),
  ( 5, 'clarion_campo_usuario_5',        'Campo usuario 5',                      'texto'),
  ( 6, 'nivel_riesgo',                   'Nivel de riesgo',                      'texto'),
  ( 7, 'comentarios_credito',            'Comentarios de crédito',               'texto'),
  ( 8, 'observaciones_cobranza',         'Observaciones de cobranza',            'texto'),
  ( 9, 'forma_pago_texto',               'Forma de pago (texto)',                'texto'),
  (10, 'numero_cuenta_pago',             'Número de cuenta de pago',             'texto'),
  (11, 'banco_cuenta_predeterminada',    'Banco / cuenta predeterminada',        'texto'),
  (12, 'lista_bancos',                   'Lista de bancos',                      'texto'),
  (13, 'lista_cuentas',                  'Lista de cuentas',                     'texto'),
  (14, 'incoterm',                       'Incoterm',                             'texto'),
  (15, 'num_reg_id_trib',                'Núm. de registro de identidad tributaria', 'texto'),
  (16, 'cobrar_iva',                     'Cobrar IVA',                           'booleano'),
  (17, 'bloquear_al_siguiente_dia',      'Bloquear al siguiente día',            'booleano'),
  (18, 'usar_ultimo_precio',             'Usar último precio',                   'booleano')
) v(orden, clave, nombre, tipo_dato);

INSERT INTO core.campos_configuracion (empresa_id, entidad_tipo_id, nombre, clave, tipo_dato, tipo_control, obligatorio, activo, orden)
SELECT 7, 1, d.nombre, d.clave, d.tipo_dato, CASE d.tipo_dato WHEN 'booleano' THEN 'checkbox' ELSE 'input' END,
       false, true, d.orden
  FROM _campos_def d
 WHERE NOT EXISTS (SELECT 1 FROM core.campos_configuracion cc
                    WHERE cc.empresa_id = 7 AND cc.entidad_tipo_id = 1 AND cc.clave = d.clave);

CREATE TEMP TABLE _campos ON COMMIT DROP AS
SELECT d.clave, cc.id AS campo_id
  FROM _campos_def d
  JOIN core.campos_configuracion cc ON cc.empresa_id = 7 AND cc.entidad_tipo_id = 1 AND cc.clave = d.clave;

-- Días y horarios de contrarecibo, pago y recepción de mercancía en un solo texto.
CREATE FUNCTION pg_temp.agenda(etiqueta text, lu boolean, ma boolean, mi boolean, ju boolean, vi boolean, horario text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(lu OR ma OR mi OR ju OR vi, false) OR pg_temp.t(horario) IS NOT NULL THEN
    etiqueta || ': ' || concat_ws('. ',
      NULLIF(concat_ws(', ',
        CASE WHEN lu THEN 'lunes' END, CASE WHEN ma THEN 'martes' END, CASE WHEN mi THEN 'miércoles' END,
        CASE WHEN ju THEN 'jueves' END, CASE WHEN vi THEN 'viernes' END), ''),
      'Horario: ' || pg_temp.t(horario))
  END
$$;

INSERT INTO public.contactos_campos (empresa_id, contacto_id, campo_id, valor_texto, valor_boolean)
SELECT 7, m.contacto_id, k.campo_id, x.texto, x.bool
  FROM _cli c
  JOIN _map m ON m.codigo = btrim(c.codigo)
  CROSS JOIN LATERAL (VALUES
    ('clarion_campo_usuario_1',     pg_temp.t(c.campousuario1), NULL::boolean),
    ('clarion_campo_usuario_2',     pg_temp.t(c.campousuario2), NULL),
    ('clarion_campo_usuario_3',     pg_temp.t(c.campousuario3), NULL),
    ('clarion_campo_usuario_4',     pg_temp.t(c.campousuario4), NULL),
    ('clarion_campo_usuario_5',     pg_temp.t(c.campousuario5), NULL),
    ('nivel_riesgo',                pg_temp.t(c.nivelriesgo), NULL),
    ('comentarios_credito',         pg_temp.t(c.comentarioscredito), NULL),
    ('observaciones_cobranza',      NULLIF(concat_ws(E'\n',
        pg_temp.agenda('Contrarecibo', c.lunescontrarecibo, c.martescontrarecibo, c.miercolescontrarecibo,
                       c.juevescontrarecibo, c.viernescontrarecibo, c.horariocontrarecibo),
        pg_temp.agenda('Pago', c.lunespago, c.martespago, c.miercolespago, c.juevespago, c.viernespago, c.horariopago),
        pg_temp.agenda('Recepción de mercancía', c.lunesrecepcionmercancia, c.martesrecepcionmercancia,
                       c.miercolesrecepcionmercancia, c.juevesrecepcionmercancia, c.viernesrecepcionmercancia,
                       c.horariorecepcionmercancia)), ''), NULL),
    ('forma_pago_texto',            pg_temp.t(c.formapago), NULL),
    ('numero_cuenta_pago',          pg_temp.t(c.numerocuentapago), NULL),
    ('banco_cuenta_predeterminada', pg_temp.t(c.bancocuentapredeterminada), NULL),
    ('lista_bancos',                pg_temp.t(c.listabancos), NULL),
    ('lista_cuentas',               pg_temp.t(c.listacuentas), NULL),
    ('incoterm',                    pg_temp.t(c.incoterm), NULL),
    ('num_reg_id_trib',             pg_temp.t(c.numregidtrib), NULL),
    ('cobrar_iva',                  NULL, c.cobrariva),
    ('bloquear_al_siguiente_dia',   NULL, c.bloquearalsiguientedia),
    ('usar_ultimo_precio',          NULL, c.usarultimoprecio)
  ) x(clave, texto, bool)
  JOIN _campos k ON k.clave = x.clave
 WHERE x.texto IS NOT NULL OR x.bool IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 11. Conteos de control: si algo no cuadra, se aborta todo
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _control (concepto text, esperado bigint, obtenido bigint) ON COMMIT DROP;

INSERT INTO _control VALUES
  ('Clientes',
     (SELECT count(*) FROM _cli),
     (SELECT count(*) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Cliente')),
  ('Clientes activos (NOT Baja)',
     (SELECT count(*) FROM _cli WHERE NOT coalesce(baja, false)),
     (SELECT count(*) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Cliente' AND activo)),
  ('Vendedores',
     (SELECT count(*) FROM _agentes),
     (SELECT count(*) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Vendedor')),
  ('Clientes con agente -> con vendedor',
     (SELECT count(*) FROM _cli WHERE pg_temp.t(agente) IS NOT NULL),
     (SELECT count(*) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Cliente' AND vendedor_id IS NOT NULL)),
  ('Roles cliente',
     (SELECT count(*) FROM _cli),
     (SELECT count(*) FROM public.contactos_roles r JOIN _map m ON m.contacto_id = r.contacto_id WHERE r.rol = 'cliente')),
  ('Datos fiscales (clientes con RFC)',
     (SELECT count(*) FROM _cli WHERE rfc_limpio IS NOT NULL),
     (SELECT count(*) FROM public.contactos_datos_fiscales f JOIN _map m ON m.contacto_id = f.contacto_id)),
  ('Domicilios adicionales',
     (SELECT count(*) FROM staging.domiciliosclientes WHERE _empresa = '7'),
     (SELECT count(*) FROM public.contactos_domicilios d JOIN _map m ON m.contacto_id = d.contacto_id WHERE NOT d.es_principal)),
  ('Personal (sin los totalmente vacíos)',
     (SELECT count(*) FROM _personal WHERE nombre IS NOT NULL),
     (SELECT count(*) FROM public.contactos_adicionales WHERE empresa_id = 7)),
  ('Suma de límite de crédito',
     (SELECT round(coalesce(sum(limitecredito), 0)) FROM _cli),
     (SELECT round(coalesce(sum(limite_credito), 0)) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Cliente')),
  ('Suma de días de crédito',
     (SELECT coalesce(sum(diascredito), 0) FROM _cli),
     (SELECT coalesce(sum(dias_credito), 0) FROM public.contactos WHERE empresa_id = 7 AND tipo_contacto = 'Cliente'));

INSERT INTO _control
SELECT 'Catálogo ' || t.campo,
       (SELECT count(*) FROM _cli_cat cc WHERE cc.campo = t.campo),
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
SELECT 'Domicilios principales' AS concepto, count(*) AS filas
  FROM public.contactos_domicilios d JOIN _map m ON m.contacto_id = d.contacto_id WHERE d.es_principal
UNION ALL SELECT 'Valores de catálogo creados', count(*) FROM core.catalogos WHERE empresa_id = 7 AND extra->>'origen' = 'CLARION'
UNION ALL SELECT 'Campos configurables de contacto', count(*) FROM _campos
UNION ALL SELECT 'Valores en contactos_campos', count(*) FROM public.contactos_campos WHERE empresa_id = 7
UNION ALL SELECT 'Personal inactivo por correo repetido', count(*) FROM public.contactos_adicionales WHERE empresa_id = 7 AND NOT activo
UNION ALL SELECT 'Datos fiscales con CP fiscal', count(*) FROM public.contactos_datos_fiscales f JOIN _map m ON m.contacto_id = f.contacto_id WHERE f.codigo_postal_fiscal IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 12. Lista de casos a revisar
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS migrate.clarion_revision_clientes;
CREATE TABLE migrate.clarion_revision_clientes (tipo text, codigo text, nombre text, detalle text);

INSERT INTO migrate.clarion_revision_clientes
SELECT 'RFC repetido entre clientes', btrim(codigo), btrim(nombre), rfc_limpio
  FROM _cli WHERE rfc_limpio IN (SELECT rfc_limpio FROM _cli WHERE rfc_limpio IS NOT NULL AND NOT rfc_generico
                                  GROUP BY 1 HAVING count(*) > 1)
UNION ALL
SELECT 'RFC con formato inválido', btrim(codigo), btrim(nombre), coalesce(btrim(rfc), '') || ' -> ' || rfc_limpio
  FROM _cli WHERE rfc_limpio IS NOT NULL AND NOT rfc_valido
UNION ALL
SELECT 'RFC de más de 13 (solo en datos fiscales)', btrim(codigo), btrim(nombre), rfc_limpio
  FROM _cli WHERE length(rfc_limpio) > 13
UNION ALL
SELECT 'Sin RFC (sin datos fiscales)', btrim(codigo), btrim(nombre), NULL
  FROM _cli WHERE rfc_limpio IS NULL
UNION ALL
SELECT 'Razón social copiada del nombre', btrim(codigo), btrim(nombre), rfc_limpio
  FROM _cli WHERE rfc_valido AND NOT rfc_generico
UNION ALL
SELECT 'CP fiscal vacío (domicilio sin CP de 5 dígitos)', btrim(codigo), btrim(nombre), coalesce(btrim(cp), '')
  FROM _cli WHERE rfc_valido AND NOT rfc_generico AND coalesce(btrim(cp), '') !~ '^[0-9]{5}$'
UNION ALL
SELECT 'Descuento no numérico (a observaciones)', btrim(codigo), btrim(nombre), descuento_texto
  FROM _cli WHERE descuento_texto IS NOT NULL
UNION ALL
SELECT 'Agente renombrado', btrim(codigo), btrim(nombre), btrim(agente) || ' -> ' || agente_canonico
  FROM _cli WHERE pg_temp.llave(agente) <> agente_canonico
UNION ALL
SELECT 'Domicilio: dato a observaciones', btrim(codigo), btrim(nombre),
       concat_ws('; ', CASE WHEN length(pg_temp.t(colonia)) > 60 THEN 'colonia' END,
                       CASE WHEN length(pg_temp.t(fax)) > 20 THEN 'fax' END)
  FROM _cli WHERE length(pg_temp.t(colonia)) > 60 OR length(pg_temp.t(fax)) > 20
UNION ALL
SELECT 'Personal omitido (vacío)', p.codigo, NULL, '_ptr ' || p._ptr
  FROM _personal p WHERE p.nombre IS NULL
UNION ALL
SELECT 'Personal inactivo (correo repetido)', p.codigo, p.nombre, p.email
  FROM _personal p WHERE p.nombre IS NOT NULL AND NOT p.activo;

SELECT tipo, count(*) AS casos FROM migrate.clarion_revision_clientes GROUP BY tipo ORDER BY tipo;

ROLLBACK;
