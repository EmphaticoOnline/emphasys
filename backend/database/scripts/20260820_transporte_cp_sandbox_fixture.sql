-- Fixture controlado para Carta Porte 3.1 en Facturama Sandbox.
-- NO crea viajes, documentos ni cartas_porte y NO llama servicios externos.
-- SQL PostgreSQL puro para la empresa de pruebas empresa_id = 8.

-- Recupera la sesión si el editor dejó una transacción anterior en estado abortado.
-- Si no existe una transacción abierta, PostgreSQL sólo emite un WARNING inocuo.
ROLLBACK;

BEGIN;

CREATE TEMP TABLE cp_test_context (
  empresa_id integer PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO cp_test_context (empresa_id) VALUES (8);

DO $fixture_preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM cp_test_context WHERE empresa_id = 9) THEN
    RAISE EXCEPTION 'Seguridad del fixture: la empresa de pruebas no puede ser la empresa 9.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM core.empresas WHERE id = 8) THEN
    RAISE EXCEPTION 'La empresa de pruebas 8 no existe.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM core.empresas WHERE id = 8 AND activo = true) THEN
    RAISE EXCEPTION 'La empresa de pruebas 8 está inactiva.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM core.empresas_cfdi_pac_config assignment
    JOIN core.cfdi_pac_config cfg ON cfg.id = assignment.cfdi_pac_config_id
    WHERE assignment.empresa_id = 8
      AND cfg.activo = true
      AND cfg.modo = 'sandbox'
      AND lower(cfg.pac) = 'facturama'
  ) THEN
    RAISE EXCEPTION 'La empresa 8 no tiene una asignación Facturama Sandbox activa.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sat.unidades WHERE clave = 'E48' AND vigente = true) THEN
    RAISE EXCEPTION 'Falta la unidad SAT E48 requerida por el producto de servicio.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sat.codigos_postales WHERE id = '20928')
     OR NOT EXISTS (SELECT 1 FROM sat.codigos_postales WHERE id = '45010' AND estado = 'JAL' AND municipio = '120' AND localidad = '10')
     OR NOT EXISTS (SELECT 1 FROM sat.codigos_postales WHERE id = '47000' AND estado = 'JAL' AND municipio = '073' AND localidad = '07')
     OR NOT EXISTS (SELECT 1 FROM sat.colonias WHERE codigo_postal = '45010' AND colonia = '0555')
     OR NOT EXISTS (SELECT 1 FROM sat.colonias WHERE codigo_postal = '47000' AND colonia = '1732') THEN
    RAISE EXCEPTION 'Faltan los códigos postales SAT 20928, 45010 o 47000 requeridos por el fixture.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.impuestos
    WHERE id = 'iva_16' AND activo = true AND tipo = 'traslado' AND tasa = 16
  ) THEN
    RAISE EXCEPTION 'El impuesto iva_16 activo con tasa 16%% no existe; el fixture no modificará impuestos globales.';
  END IF;

END
$fixture_preflight$;

-- Impuesto reservado para este fixture. Nunca modifica un impuesto preexistente.
INSERT INTO public.impuestos (id, nombre, tipo, tasa, activo)
VALUES ('ret_iva_4', 'Retención IVA 4%', 'retencion', 4, true)
ON CONFLICT (id) DO NOTHING;

DO $fixture_tax_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.impuestos
    WHERE id = 'ret_iva_4'
      AND tipo = 'retencion'
      AND tasa = 4
      AND activo = true
  ) THEN
    RAISE EXCEPTION 'El impuesto ret_iva_4 ya existe con una configuración incorrecta; el fixture no lo modificará.';
  END IF;
END
$fixture_tax_preflight$;

-- Contactos reservados del fixture. codigo_legacy funciona como clave idempotente.
INSERT INTO public.contactos
  (empresa_id, tipo_contacto, nombre, rfc, activo, bloqueado, codigo_legacy, observaciones)
SELECT ctx.empresa_id, values_.tipo_contacto::public.tipo_contacto_enum,
       values_.nombre, values_.rfc, true, false, values_.codigo_legacy,
       'Fixture controlado Carta Porte Facturama Sandbox'
FROM cp_test_context ctx
CROSS JOIN (VALUES
  ('CP_TEST_CLIENTE',  'Cliente', 'ESCUELA KEMPER URGATE CP TEST', 'EKU9003173C9'),
  ('CP_TEST_ORIGEN',   'Otro',    'TAD ZAPOPAN PRUEBA',            'EKU9003173C9'),
  ('CP_TEST_DESTINO',  'Otro',    'SAN JUAN DE LOS LAGOS PRUEBA', 'EKU9003173C9'),
  ('CP_TEST_OPERADOR', 'Otro',    'OPERADOR CARTA PORTE PRUEBA',  'CACX7605101P8')
) AS values_(codigo_legacy, tipo_contacto, nombre, rfc)
WHERE NOT EXISTS (
  SELECT 1 FROM public.contactos c
  WHERE c.empresa_id = ctx.empresa_id
    AND c.codigo_legacy = values_.codigo_legacy
);

UPDATE public.contactos c
SET nombre = values_.nombre,
    rfc = values_.rfc,
    activo = true,
    bloqueado = false,
    observaciones = 'Fixture controlado Carta Porte Facturama Sandbox',
    updated_at = now()
FROM cp_test_context ctx
CROSS JOIN (VALUES
  ('CP_TEST_CLIENTE',  'ESCUELA KEMPER URGATE CP TEST', 'EKU9003173C9'),
  ('CP_TEST_ORIGEN',   'TAD ZAPOPAN PRUEBA',            'EKU9003173C9'),
  ('CP_TEST_DESTINO',  'SAN JUAN DE LOS LAGOS PRUEBA', 'EKU9003173C9'),
  ('CP_TEST_OPERADOR', 'OPERADOR CARTA PORTE PRUEBA',  'CACX7605101P8')
) AS values_(codigo_legacy, nombre, rfc)
WHERE c.empresa_id = ctx.empresa_id
  AND c.codigo_legacy = values_.codigo_legacy;

INSERT INTO public.contactos_datos_fiscales
  (contacto_id, rfc, curp, regimen_fiscal, uso_cfdi, forma_pago, metodo_pago,
   enviar_cfd, enviar_cfd_agente, es_publico_general, razon_social_fiscal, codigo_postal_fiscal)
SELECT c.id, c.rfc,
       CASE WHEN c.codigo_legacy = 'CP_TEST_OPERADOR' THEN 'CACX760510MDFRNN01' ELSE NULL END,
       CASE WHEN c.codigo_legacy = 'CP_TEST_OPERADOR' THEN '605' ELSE '601' END,
       CASE WHEN c.codigo_legacy = 'CP_TEST_CLIENTE' THEN 'G03' ELSE NULL END,
       CASE WHEN c.codigo_legacy = 'CP_TEST_CLIENTE' THEN '03' ELSE NULL END,
       CASE WHEN c.codigo_legacy = 'CP_TEST_CLIENTE' THEN 'PUE' ELSE NULL END,
       true, false, false,
       c.nombre,
       CASE
         WHEN c.codigo_legacy = 'CP_TEST_CLIENTE' THEN '20928'
         WHEN c.codigo_legacy IN ('CP_TEST_ORIGEN', 'CP_TEST_OPERADOR') THEN '45010'
         ELSE '47000'
       END
FROM public.contactos c
JOIN cp_test_context ctx ON ctx.empresa_id = c.empresa_id
WHERE c.codigo_legacy LIKE 'CP\_TEST\_%' ESCAPE '\'
ON CONFLICT (contacto_id) DO UPDATE
SET rfc = EXCLUDED.rfc,
    curp = EXCLUDED.curp,
    regimen_fiscal = EXCLUDED.regimen_fiscal,
    uso_cfdi = EXCLUDED.uso_cfdi,
    forma_pago = EXCLUDED.forma_pago,
    metodo_pago = EXCLUDED.metodo_pago,
    razon_social_fiscal = EXCLUDED.razon_social_fiscal,
    codigo_postal_fiscal = EXCLUDED.codigo_postal_fiscal,
    fecha_actualizacion = now();

-- Sólo puede existir un domicilio principal por contacto. En una reejecución,
-- libera primero cualquier principal anterior de los contactos reservados.
UPDATE public.contactos_domicilios d
SET es_principal = false
FROM public.contactos c
JOIN cp_test_context ctx ON ctx.empresa_id = c.empresa_id
WHERE d.contacto_id = c.id
  AND c.codigo_legacy LIKE 'CP\_TEST\_%' ESCAPE '\'
  AND d.identificador <> 'CP_TEST_FISCAL'
  AND d.es_principal = true;

UPDATE public.contactos_domicilios d
SET es_principal = true,
    calle = values_.calle,
    numero_exterior = values_.numero_exterior,
    colonia = values_.colonia,
    ciudad = values_.localidad_sat,
    estado = values_.estado,
    cp = values_.cp,
    pais = 'MEX',
    cp_sat = values_.cp,
    colonia_sat = values_.colonia_sat,
    texto_original = values_.calle || ' ' || values_.numero_exterior || ', ' || values_.ciudad_nombre
FROM public.contactos c
JOIN cp_test_context ctx ON ctx.empresa_id = c.empresa_id
CROSS JOIN (VALUES
  ('CP_TEST_CLIENTE',  'Avenida Universidad', '100', 'Luis Donaldo Colosio', '0027', 'Jesús María',      '04', 'AGU', '20928'),
  ('CP_TEST_ORIGEN',   'Avenida Vallarta',     '6503','Ciudad Granja', '0555', 'Zapopan',               '10', 'JAL', '45010'),
  ('CP_TEST_DESTINO',  'Calle Independencia',  '101', 'Centro',        '1732', 'San Juan de los Lagos', '07', 'JAL', '47000'),
  ('CP_TEST_OPERADOR', 'Calle Prueba',         '25',  'Ciudad Granja', '0555', 'Zapopan',               '10', 'JAL', '45010')
) AS values_(codigo_legacy, calle, numero_exterior, colonia, colonia_sat, ciudad_nombre, localidad_sat, estado, cp)
WHERE c.codigo_legacy = values_.codigo_legacy
  AND d.contacto_id = c.id
  AND d.identificador = 'CP_TEST_FISCAL';

INSERT INTO public.contactos_domicilios
  (contacto_id, identificador, es_principal, responsable, calle, numero_exterior,
   colonia, ciudad, estado, cp, pais, cp_sat, colonia_sat, texto_original)
SELECT c.id, 'CP_TEST_FISCAL', true, c.nombre, values_.calle, values_.numero_exterior,
       values_.colonia, values_.localidad_sat, values_.estado, values_.cp, 'MEX', values_.cp,
       values_.colonia_sat, values_.calle || ' ' || values_.numero_exterior || ', ' || values_.ciudad_nombre
FROM public.contactos c
JOIN cp_test_context ctx ON ctx.empresa_id = c.empresa_id
CROSS JOIN (VALUES
  ('CP_TEST_CLIENTE',  'Avenida Universidad', '100', 'Luis Donaldo Colosio', '0027', 'Jesús María',      '04', 'AGU', '20928'),
  ('CP_TEST_ORIGEN',   'Avenida Vallarta',     '6503','Ciudad Granja', '0555', 'Zapopan',               '10', 'JAL', '45010'),
  ('CP_TEST_DESTINO',  'Calle Independencia',  '101', 'Centro',        '1732', 'San Juan de los Lagos', '07', 'JAL', '47000'),
  ('CP_TEST_OPERADOR', 'Calle Prueba',         '25',  'Ciudad Granja', '0555', 'Zapopan',               '10', 'JAL', '45010')
) AS values_(codigo_legacy, calle, numero_exterior, colonia, colonia_sat, ciudad_nombre, localidad_sat, estado, cp)
WHERE c.codigo_legacy = values_.codigo_legacy
  AND NOT EXISTS (
    SELECT 1 FROM public.contactos_domicilios d
    WHERE d.contacto_id = c.id AND d.identificador = 'CP_TEST_FISCAL'
  );

INSERT INTO public.contactos_roles (contacto_id, rol, activo, origen, metadata)
SELECT c.id, values_.rol, true, 'CP_TEST', '{}'::jsonb
FROM public.contactos c
JOIN cp_test_context ctx ON ctx.empresa_id = c.empresa_id
CROSS JOIN (VALUES
  ('CP_TEST_CLIENTE', 'cliente'),
  ('CP_TEST_OPERADOR', 'operador')
) AS values_(codigo_legacy, rol)
WHERE c.codigo_legacy = values_.codigo_legacy
ON CONFLICT (contacto_id, rol) DO UPDATE
SET activo = true, origen = 'CP_TEST';

-- Producto maestro de la mercancía de prueba (el servicio de transporte
-- CP_TEST_SERV_TRANSP sigue siendo un concepto distinto).
INSERT INTO public.productos
  (empresa_id, clave, descripcion, tipo_producto, activo, clave_bienes_transportados_sat,
   es_material_peligroso, clave_material_peligroso_sat, clave_embalaje_sat, descripcion_embalaje)
SELECT ctx.empresa_id, 'CP_TEST_DIESEL', 'DIESEL AUTOMOTRIZ', 'Inventariable', true, '15101505',
       true, '1203', 'Z01', 'No aplica'
FROM cp_test_context ctx
ON CONFLICT (empresa_id, clave) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    clave_bienes_transportados_sat = EXCLUDED.clave_bienes_transportados_sat,
    es_material_peligroso = EXCLUDED.es_material_peligroso,
    clave_material_peligroso_sat = EXCLUDED.clave_material_peligroso_sat,
    clave_embalaje_sat = EXCLUDED.clave_embalaje_sat,
    descripcion_embalaje = EXCLUDED.descripcion_embalaje,
    activo = true;

-- Ubicaciones de origen/destino: el maestro operativo es
-- public.contactos_domicilios (transporte.ubicaciones fue retirado en la
-- consolidación 20260901). Los domicilios CP_TEST_FISCAL de los contactos
-- CP_TEST_ORIGEN / CP_TEST_DESTINO ya se crean/actualizan más arriba y son
-- exactamente los que consume el Viaje mediante viaje_ubicaciones.domicilio_id.

INSERT INTO transporte.vehiculos
  (empresa_id, clave_interna, placas, configuracion_vehicular_sat,
   peso_bruto_vehicular, tipo_permiso_sict, numero_permiso_sict,
   aseguradora_responsabilidad_civil, poliza_responsabilidad_civil,
   aseguradora_medio_ambiente, poliza_medio_ambiente,
   aseguradora_carga, poliza_carga, modelo_anio, activo)
SELECT ctx.empresa_id, 'CP_TEST_T3S2', 'CPTEST1', 'T3S2', 44000,
       'TPAF01', 'CP-TEST-PERMISO-001',
       'ASEGURADORA CP TEST', 'CP-TEST-RC-001',
       'ASEGURADORA CP TEST', 'CP-TEST-MA-001',
       'ASEGURADORA CP TEST', 'CP-TEST-CARGA-001', 2024, true
FROM cp_test_context ctx
ON CONFLICT (empresa_id, clave_interna) DO UPDATE
SET placas = EXCLUDED.placas,
    configuracion_vehicular_sat = EXCLUDED.configuracion_vehicular_sat,
    peso_bruto_vehicular = EXCLUDED.peso_bruto_vehicular,
    tipo_permiso_sict = EXCLUDED.tipo_permiso_sict,
    numero_permiso_sict = EXCLUDED.numero_permiso_sict,
    aseguradora_responsabilidad_civil = EXCLUDED.aseguradora_responsabilidad_civil,
    poliza_responsabilidad_civil = EXCLUDED.poliza_responsabilidad_civil,
    aseguradora_medio_ambiente = EXCLUDED.aseguradora_medio_ambiente,
    poliza_medio_ambiente = EXCLUDED.poliza_medio_ambiente,
    aseguradora_carga = EXCLUDED.aseguradora_carga,
    poliza_carga = EXCLUDED.poliza_carga,
    modelo_anio = EXCLUDED.modelo_anio,
    activo = true,
    updated_at = now();

INSERT INTO transporte.remolques
  (empresa_id, clave_interna, subtipo_remolque_sat, placas, activo)
SELECT ctx.empresa_id, 'CP_TEST_CTR028', 'CTR028', '41VA7J', true
FROM cp_test_context ctx
ON CONFLICT (empresa_id, clave_interna) DO UPDATE
SET subtipo_remolque_sat = EXCLUDED.subtipo_remolque_sat,
    placas = EXCLUDED.placas,
    activo = true,
    updated_at = now();

INSERT INTO transporte.operadores
  (empresa_id, contacto_id, numero_licencia, tipo_licencia, vigencia_licencia, activo)
SELECT ctx.empresa_id, c.id, 'CP-TEST-LIC-001', 'Federal', DATE '2030-12-31', true
FROM cp_test_context ctx
JOIN public.contactos c
  ON c.empresa_id = ctx.empresa_id AND c.codigo_legacy = 'CP_TEST_OPERADOR'
ON CONFLICT (empresa_id, contacto_id) DO UPDATE
SET numero_licencia = EXCLUDED.numero_licencia,
    tipo_licencia = EXCLUDED.tipo_licencia,
    vigencia_licencia = EXCLUDED.vigencia_licencia,
    activo = true,
    updated_at = now();

-- Producto de servicio reservado para capturar manualmente la factura.
INSERT INTO public.unidades (clave, descripcion, unidad_sat_id, empresa_id, activo)
SELECT 'CP_TEST_E48', 'Unidad de servicio CP TEST', su.id, ctx.empresa_id, true
FROM cp_test_context ctx
JOIN sat.unidades su ON su.clave = 'E48' AND su.vigente = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.unidades u
  WHERE u.empresa_id = ctx.empresa_id AND u.clave = 'CP_TEST_E48'
);

INSERT INTO public.productos
  (empresa_id, clave, descripcion, activo, tipo_producto, unidad_venta_id,
   unidad_inventario_id, clave_producto_sat, clave_unidad_sat, iva_porcentaje,
   retiene_iva, retiene_isr, es_estacional, observaciones)
SELECT ctx.empresa_id, 'CP_TEST_SERV_TRANSP', 'Servicio de transporte CP TEST', true,
       'SERVICIO', u.id, NULL, '78101802', 'E48', 16, true, false, false,
       'Fixture controlado Carta Porte Facturama Sandbox'
FROM cp_test_context ctx
JOIN public.unidades u
  ON u.empresa_id = ctx.empresa_id AND u.clave = 'CP_TEST_E48'
ON CONFLICT (empresa_id, clave) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo = true,
    tipo_producto = EXCLUDED.tipo_producto,
    unidad_venta_id = EXCLUDED.unidad_venta_id,
    unidad_inventario_id = NULL,
    clave_producto_sat = EXCLUDED.clave_producto_sat,
    clave_unidad_sat = EXCLUDED.clave_unidad_sat,
    iva_porcentaje = 16,
    retiene_iva = true,
    retiene_isr = false,
    observaciones = EXCLUDED.observaciones;

-- El producto pertenece al fixture: su conjunto efectivo debe ser exactamente IVA 16% + retención IVA 4% de prueba.
DELETE FROM public.productos_impuestos pi
USING public.productos p, cp_test_context ctx
WHERE pi.producto_id = p.id
  AND p.empresa_id = ctx.empresa_id
  AND p.clave = 'CP_TEST_SERV_TRANSP'
  AND pi.impuesto_id NOT IN ('iva_16', 'ret_iva_4');

INSERT INTO public.productos_impuestos (producto_id, impuesto_id)
SELECT p.id, values_.impuesto_id
FROM public.productos p
JOIN cp_test_context ctx ON ctx.empresa_id = p.empresa_id
CROSS JOIN (VALUES ('iva_16'), ('ret_iva_4')) AS values_(impuesto_id)
WHERE p.clave = 'CP_TEST_SERV_TRANSP'
  AND NOT EXISTS (
    SELECT 1 FROM public.productos_impuestos pi
    WHERE pi.producto_id = p.id AND pi.impuesto_id = values_.impuesto_id
  );

COMMIT;

-- Identificadores que se usarán en la UI y en los endpoints reales.
SELECT
  e.id AS empresa_id,
  e.nombre AS empresa_nombre,
  (SELECT c.id FROM public.contactos c WHERE c.empresa_id=e.id AND c.codigo_legacy='CP_TEST_CLIENTE' ORDER BY c.id LIMIT 1) AS cliente_contacto_id,
  (SELECT p.id FROM public.productos p WHERE p.empresa_id=e.id AND p.clave='CP_TEST_DIESEL') AS producto_id,
  (SELECT d.id FROM public.contactos_domicilios d JOIN public.contactos c ON c.id=d.contacto_id
     WHERE c.empresa_id=e.id AND c.codigo_legacy='CP_TEST_ORIGEN' AND d.identificador='CP_TEST_FISCAL' ORDER BY d.id LIMIT 1) AS origen_domicilio_id,
  (SELECT d.id FROM public.contactos_domicilios d JOIN public.contactos c ON c.id=d.contacto_id
     WHERE c.empresa_id=e.id AND c.codigo_legacy='CP_TEST_DESTINO' AND d.identificador='CP_TEST_FISCAL' ORDER BY d.id LIMIT 1) AS destino_domicilio_id,
  (SELECT v.id FROM transporte.vehiculos v WHERE v.empresa_id=e.id AND v.clave_interna='CP_TEST_T3S2') AS vehiculo_id,
  (SELECT r.id FROM transporte.remolques r WHERE r.empresa_id=e.id AND r.clave_interna='CP_TEST_CTR028') AS remolque_id,
  (SELECT o.id FROM transporte.operadores o JOIN public.contactos c ON c.id=o.contacto_id WHERE o.empresa_id=e.id AND c.codigo_legacy='CP_TEST_OPERADOR') AS operador_id,
  (SELECT c.id FROM public.contactos c WHERE c.empresa_id=e.id AND c.codigo_legacy='CP_TEST_OPERADOR' ORDER BY c.id LIMIT 1) AS operador_contacto_id,
  (SELECT p.id FROM public.productos p WHERE p.empresa_id=e.id AND p.clave='CP_TEST_SERV_TRANSP') AS producto_id
FROM core.empresas e
WHERE e.id = 8;

SELECT p.id AS producto_id, p.clave, p.descripcion, p.clave_producto_sat, p.clave_unidad_sat,
       i.id AS impuesto_id, i.tipo, i.tasa
FROM public.productos p
JOIN public.productos_impuestos pi ON pi.producto_id = p.id
JOIN public.impuestos i ON i.id = pi.impuesto_id
WHERE p.empresa_id = 8
  AND p.clave = 'CP_TEST_SERV_TRANSP'
ORDER BY i.tipo, i.id;
