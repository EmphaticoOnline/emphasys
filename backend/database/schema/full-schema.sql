-- Full schema export
-- Database: emphasys
-- Generated at: 2026-06-26T02:44:42.575Z
--
-- PostgreSQL database dump
--

\restrict 0bIZzGRrWQiaVG6AkDiscTXvmf7Qo6c9bCRmWUbYymNnqWUfVgI8iCfPkMq2v4V

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: core; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA core;


--
-- Name: crm; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA crm;


--
-- Name: inventario; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA inventario;


--
-- Name: SCHEMA inventario; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA inventario IS 'Módulo de inventario del ERP. Contiene movimientos, partidas y existencias por producto y almacén.';


--
-- Name: mantenimiento; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA mantenimiento;


--
-- Name: migrate; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA migrate;


--
-- Name: produccion; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA produccion;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: sat; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sat;


--
-- Name: whatsapp; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA whatsapp;


--
-- Name: SCHEMA whatsapp; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA whatsapp IS 'Modulo CRM Conversacional WhatsApp integrado al ERP/CRM con soporte multiempresa.';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA sat;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: postgres_fdw; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgres_fdw WITH SCHEMA sat;


--
-- Name: EXTENSION postgres_fdw; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgres_fdw IS 'foreign-data wrapper for remote PostgreSQL servers';


--
-- Name: tipo_contacto_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_contacto_enum AS ENUM (
    'Cliente',
    'Proveedor',
    'Vendedor',
    'Prospecto',
    'Otro',
    'Lead',
    'Varios'
);


--
-- Name: bootstrap_empresa(integer, integer); Type: PROCEDURE; Schema: core; Owner: -
--

CREATE PROCEDURE core.bootstrap_empresa(IN p_empresa_id integer, IN p_usuario_id integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
  ---------------------------------------------------------------------------
  -- Validaciones
  ---------------------------------------------------------------------------
  PERFORM 1 FROM core.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La empresa % no existe', p_empresa_id;
  END IF;

  PERFORM 1 FROM core.usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario % no existe', p_usuario_id;
  END IF;

  ---------------------------------------------------------------------------
  -- Roles base
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Creando roles base...';
  INSERT INTO core.roles (empresa_id, nombre, descripcion, activo)
  VALUES
    (p_empresa_id, 'Administrador', 'Rol base administrador', true),
    (p_empresa_id, 'Supervisor',    'Rol base supervisor',    true),
    (p_empresa_id, 'Operador',      'Rol base operador',      true),
    (p_empresa_id, 'Consulta',      'Rol base consulta',      true)
  ON CONFLICT (empresa_id, nombre) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Asociación usuario-empresa
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Registrando usuario en la empresa...';
  INSERT INTO core.usuarios_empresas (usuario_id, empresa_id)
  VALUES (p_usuario_id, p_empresa_id)
  ON CONFLICT (usuario_id, empresa_id) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Asignar rol Administrador al usuario
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Asignando rol Administrador al usuario...';
  INSERT INTO core.usuarios_roles (usuario_id, empresa_id, rol_id)
  SELECT
    p_usuario_id,
    p_empresa_id,
    r.id
  FROM core.roles r
  WHERE r.empresa_id = p_empresa_id
    AND r.nombre = 'Administrador'
  ON CONFLICT (usuario_id, empresa_id, rol_id) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Parámetros por empresa (copiando core.parametros)
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Inicializando parametros_empresa...';
  INSERT INTO core.parametros_empresa (empresa_id, parametro_id, valor)
  SELECT p_empresa_id, p.parametro_id, COALESCE(p.valor_default, NULL)
  FROM core.parametros p
  WHERE NOT EXISTS (
    SELECT 1
    FROM core.parametros_empresa pe
    WHERE pe.empresa_id = p_empresa_id
      AND pe.parametro_id = p.parametro_id
  );

---------------------------------------------------------------------------
-- Valores críticos de parámetros (hardcoded)
---------------------------------------------------------------------------
RAISE NOTICE 'Aplicando valores críticos de configuración...';

UPDATE core.parametros_empresa pe
SET valor = v.valor
FROM (
  VALUES
    ('decimales_costos','2'),
    ('decimales_cantidades','2'),
    ('decimales_precios','2'),
    ('variacion_maxima_costos','0.20'),
    ('porcentaje_iva_predeterminado','0.16'),

    ('usar_series','true'),
    ('permitir_afectacion_ajustes','true'),
    ('usar_ultimo_costo_precios','true'),

    ('serie_facturas','F'),
    ('serie_notas','N'),
    ('serie_notas_credito','NC'),
    ('serie_pedidos','P'),
    ('serie_ordenes_entrega','OE'),

    ('serie_ordenes_compra','OC'),
    ('serie_pagos_proveedores','PGP'),

    ('serie_transacciones_inventario','INV'),
    ('serie_ajustes','AJ'),
    ('serie_entradas','EN'),

    ('serie_nota_venta','N'),

    ('oc_requiere_autorizacion','true'),
    ('aprobacion_automatica_pagos','false'),
    ('utilizar_limite_credito','true'),
    ('restringir_segun_vencimiento','false'),
    ('tipo_cliente_obligatorio','true')
) AS v(clave,valor)
JOIN core.parametros p
  ON p.clave = v.clave
WHERE pe.parametro_id = p.parametro_id
AND pe.empresa_id = p_empresa_id;

  ---------------------------------------------------------------------------
  -- Impuestos por default
  ---------------------------------------------------------------------------

RAISE NOTICE 'Creando impuestos por defecto...';

INSERT INTO core.empresas_impuestos_default
(empresa_id, impuesto_id, orden)
VALUES
(p_empresa_id, 'iva_16', 1)
ON CONFLICT DO NOTHING;

  ---------------------------------------------------------------------------
  -- Tipos de documento por empresa (copiando core.tipos_documento)
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Inicializando empresas_tipos_documento...';
  INSERT INTO core.empresas_tipos_documento
    (empresa_id, tipo_documento_id, activo, orden, usuario_creacion_id)
  SELECT
    p_empresa_id,
    td.id,
    td.activo,
    td.orden,
    p_usuario_id
  FROM core.tipos_documento td
  WHERE NOT EXISTS (
    SELECT 1
    FROM core.empresas_tipos_documento etd
    WHERE etd.empresa_id = p_empresa_id
      AND etd.tipo_documento_id = td.id
  );

  ---------------------------------------------------------------------------
  -- Transiciones base de tipos de documento
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Inicializando transiciones de documentos...';
  WITH t(cod_origen, cod_destino) AS (
    VALUES
      ('cotizacion',    'pedido'),
      ('pedido',        'orden_entrega'),
      ('orden_entrega', 'remision'),
      ('remision',      'factura'),
      ('requisicion',   'orden_compra'),
      ('orden_compra',  'recepcion'),
      ('recepcion',     'factura_compra')
  )
  INSERT INTO core.empresas_tipos_documento_transiciones
    (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id, activo, orden, usuario_creacion_id)
  SELECT
    p_empresa_id,
    etd_origen.tipo_documento_id,
    etd_destino.tipo_documento_id,
    true,
    ROW_NUMBER() OVER (ORDER BY t.cod_origen, t.cod_destino) - 1,
    p_usuario_id
  FROM t
  JOIN core.tipos_documento td_origen   ON td_origen.codigo  = t.cod_origen
  JOIN core.tipos_documento td_destino  ON td_destino.codigo = t.cod_destino
  JOIN core.empresas_tipos_documento etd_origen
       ON etd_origen.empresa_id = p_empresa_id
      AND etd_origen.tipo_documento_id = td_origen.id
  JOIN core.empresas_tipos_documento etd_destino
       ON etd_destino.empresa_id = p_empresa_id
      AND etd_destino.tipo_documento_id = td_destino.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM core.empresas_tipos_documento_transiciones x
    WHERE x.empresa_id = p_empresa_id
      AND x.tipo_documento_origen_id  = etd_origen.tipo_documento_id
      AND x.tipo_documento_destino_id = etd_destino.tipo_documento_id
  );

  ---------------------------------------------------------------------------
  -- Cuenta financiera inicial
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Creando cuenta financiera inicial...';
  INSERT INTO public.finanzas_cuentas
    (empresa_id, identificador, numero_cuenta, tipo_cuenta, moneda,
     saldo, saldo_inicial, saldo_conciliado, es_cuenta_efectivo, afecta_total_disponible)
  SELECT p_empresa_id, 'Caja', NULL, 'Disponibilidad', 'MXN',
         0, 0, 0, true, true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.finanzas_cuentas fc
    WHERE fc.empresa_id = p_empresa_id
      AND fc.identificador = 'Caja'
  );

  ---------------------------------------------------------------------------
  -- Conceptos base
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Creando conceptos base...';
  INSERT INTO public.conceptos
    (empresa_id, nombre_concepto, es_gasto, activo, orden, color)
  VALUES
    (p_empresa_id, 'Ingreso', false, true, 0, '#2E7D32'),
    (p_empresa_id, 'Venta',   false, true, 1, '#1565C0'),
    (p_empresa_id, 'Gasto',   true,  true, 2, '#C62828'),
    (p_empresa_id, 'Compra',  true,  true, 3, '#6A1B9A'),
    (p_empresa_id, 'Ajuste',  true,  true, 4, '#F9A825')
  ON CONFLICT (empresa_id, nombre_concepto) DO NOTHING;

  ---------------------------------------------------------------------------
  -- Unidades
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Creando unidades base...';
  INSERT INTO public.unidades
	(clave, descripcion, unidad_sat_id, empresa_id, activo)
  VALUES
    ('SERVICIO', 'Servicio', 1, p_empresa_id, true),
    ('MES',   'Mes', 3, p_empresa_id, true),
    ('HORA',   'Hora',  4, p_empresa_id, true),
    ('PIEZA',  'Pieza', 2, p_empresa_id, true)
  ON CONFLICT (empresa_id, clave) DO NOTHING;

	---------------------------------------------------------------------------
	-- Catálogos configurables (tipos) por empresa
	---------------------------------------------------------------------------
	RAISE NOTICE 'Inicializando catalogos_tipos...';
	
	INSERT INTO core.catalogos_tipos
	  (empresa_id, entidad_tipo_id, nombre, permite_multiple, activo)
	SELECT
	  p_empresa_id,
	  ct.entidad_tipo_id,
	  ct.nombre,
	  ct.permite_multiple,
	  ct.activo
	FROM core.catalogos_tipos ct
	WHERE ct.empresa_id = 1
	AND NOT EXISTS (
	  SELECT 1
	  FROM core.catalogos_tipos ct2
	  WHERE ct2.empresa_id = p_empresa_id
	    AND ct2.entidad_tipo_id = ct.entidad_tipo_id
	    AND ct2.nombre = ct.nombre
	);

  ---------------------------------------------------------------------------
  -- Aviso final
  ---------------------------------------------------------------------------
  RAISE NOTICE 'Bootstrap completado para la empresa %.', p_empresa_id;

END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: validar_usuario_vendedor_contacto(); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.validar_usuario_vendedor_contacto() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.vendedor_contacto_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
    FROM public.contactos c
   WHERE c.id = NEW.vendedor_contacto_id
     AND c.tipo_contacto = 'Vendedor';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vendedor_contacto_id % no es un Vendedor válido', NEW.vendedor_contacto_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: set_actividades_updated_at(); Type: FUNCTION; Schema: crm; Owner: -
--

CREATE FUNCTION crm.set_actividades_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: aplicar_movimiento(integer, character varying, date, integer, integer, text, jsonb); Type: FUNCTION; Schema: inventario; Owner: -
--

CREATE FUNCTION inventario.aplicar_movimiento(p_empresa_id integer, p_tipo_movimiento character varying, p_fecha date, p_usuario_id integer, p_documento_id integer, p_observaciones text, p_partidas jsonb) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_movimiento_id         BIGINT;
  v_partida               JSONB;
  v_producto_id           INTEGER;
  v_almacen_id            INTEGER;
  v_cantidad              NUMERIC(18,6);
  v_signo                 SMALLINT;
  v_tipo_partida          VARCHAR(25);
  v_costo_unitario        NUMERIC(18,6);
  v_almacen_destino_id    INTEGER;
  v_doc_partida_id        INTEGER;
  v_existencia_actual     NUMERIC(18,6);
  v_existencia_resultante NUMERIC(18,6);
BEGIN
  INSERT INTO inventario.movimientos (
    empresa_id,
    tipo_movimiento,
    fecha,
    usuario_id,
    documento_id,
    observaciones
  ) VALUES (
    p_empresa_id,
    p_tipo_movimiento,
    p_fecha,
    p_usuario_id,
    p_documento_id,
    p_observaciones
  ) RETURNING id INTO v_movimiento_id;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    v_producto_id        := (v_partida->>'producto_id')::INTEGER;
    v_almacen_id         := (v_partida->>'almacen_id')::INTEGER;
    v_cantidad           := (v_partida->>'cantidad')::NUMERIC;
    v_signo              := (v_partida->>'signo')::SMALLINT;
    v_tipo_partida       := COALESCE(v_partida->>'tipo_partida', 'normal');
    v_costo_unitario     := (v_partida->>'costo_unitario')::NUMERIC;
    v_almacen_destino_id := (v_partida->>'almacen_destino_id')::INTEGER;
    v_doc_partida_id     := (v_partida->>'documento_partida_id')::INTEGER;

    SELECT existencia
      INTO v_existencia_actual
      FROM inventario.existencias
     WHERE empresa_id  = p_empresa_id
       AND producto_id = v_producto_id
       AND almacen_id  = v_almacen_id
     FOR UPDATE;

    v_existencia_actual     := COALESCE(v_existencia_actual, 0);
    v_existencia_resultante := v_existencia_actual + (v_cantidad * v_signo);

    INSERT INTO inventario.movimientos_partidas (
      empresa_id,
      movimiento_id,
      documento_partida_id,
      producto_id,
      almacen_id,
      almacen_destino_id,
      fecha_movimiento,
      cantidad,
      signo,
      tipo_partida,
      costo_unitario,
      existencia_resultante
    ) VALUES (
      p_empresa_id,
      v_movimiento_id,
      v_doc_partida_id,
      v_producto_id,
      v_almacen_id,
      v_almacen_destino_id,
      p_fecha,
      v_cantidad,
      v_signo,
      v_tipo_partida,
      v_costo_unitario,
      v_existencia_resultante
    );

    INSERT INTO inventario.existencias (
      empresa_id,
      producto_id,
      almacen_id,
      existencia,
      updated_at
    ) VALUES (
      p_empresa_id,
      v_producto_id,
      v_almacen_id,
      v_existencia_resultante,
      now()
    ) ON CONFLICT (empresa_id, producto_id, almacen_id)
      DO UPDATE SET
        existencia = v_existencia_resultante,
        updated_at = now();
  END LOOP;

  RETURN v_movimiento_id;
END;
$$;


--
-- Name: to_bool_legacy(text); Type: FUNCTION; Schema: migrate; Owner: -
--

CREATE FUNCTION migrate.to_bool_legacy(p_value text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT CASE
        WHEN trim(coalesce(p_value, '')) IN ('1', 'true', 'TRUE', 'True', 'S', 'SI', 'Sí', 'Y') THEN true
        ELSE false
    END;
$$;


--
-- Name: to_int_legacy(text); Type: FUNCTION; Schema: migrate; Owner: -
--

CREATE FUNCTION migrate.to_int_legacy(p_value text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT NULLIF(
        regexp_replace(
            replace(coalesce(p_value, ''), ',', ''),
            '[^0-9\-]',
            '',
            'g'
        ),
        ''
    )::integer;
$$;


--
-- Name: to_numeric_legacy(text); Type: FUNCTION; Schema: migrate; Owner: -
--

CREATE FUNCTION migrate.to_numeric_legacy(p_value text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT NULLIF(
        regexp_replace(
            replace(coalesce(p_value, ''), ',', ''),
            '[^0-9\.\-]',
            '',
            'g'
        ),
        ''
    )::numeric;
$$;


--
-- Name: to_timestamptz_legacy(text); Type: FUNCTION; Schema: migrate; Owner: -
--

CREATE FUNCTION migrate.to_timestamptz_legacy(p_value text) RETURNS timestamp with time zone
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    v text;
BEGIN
    v := trim(coalesce(p_value, ''));

    IF v = '' THEN
        RETURN NULL;
    END IF;

    BEGIN
        RETURN v::timestamptz;
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: fn_actualizar_estadisticas_whatsapp(); Type: FUNCTION; Schema: whatsapp; Owner: -
--

CREATE FUNCTION whatsapp.fn_actualizar_estadisticas_whatsapp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    f date;
BEGIN
    IF NEW.fecha_envio IS NULL THEN
        RETURN NEW;
    END IF;

    f := NEW.fecha_envio::date;

    INSERT INTO whatsapp.whatsapp_estadisticas (
        fecha,
        mensajes_enviados,
        mensajes_recibidos,
        plantillas_usadas
    )
    VALUES (
        f,
        CASE WHEN NEW.tipo_mensaje = 'saliente' THEN 1 ELSE 0 END,
        CASE WHEN NEW.tipo_mensaje = 'entrante' THEN 1 ELSE 0 END,
        CASE WHEN NEW.tipo_mensaje = 'saliente'
             AND NEW.plantilla_nombre IS NOT NULL THEN 1 ELSE 0 END
    )
    ON CONFLICT (fecha)
    DO UPDATE SET
        mensajes_enviados =
            whatsapp.whatsapp_estadisticas.mensajes_enviados + EXCLUDED.mensajes_enviados,
        mensajes_recibidos =
            whatsapp.whatsapp_estadisticas.mensajes_recibidos + EXCLUDED.mensajes_recibidos,
        plantillas_usadas =
            whatsapp.whatsapp_estadisticas.plantillas_usadas + EXCLUDED.plantillas_usadas;

    RETURN NEW;
END;
$$;


--
-- Name: fn_normaliza_telefono_e164(text); Type: FUNCTION; Schema: whatsapp; Owner: -
--

CREATE FUNCTION whatsapp.fn_normaliza_telefono_e164(tel text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    s text;
BEGIN
    IF tel IS NULL THEN
        RETURN NULL;
    END IF;

    s := regexp_replace(tel, '[\s\-\(\)\.\t]', '', 'g');
    s := regexp_replace(s, '[^+0-9]', '', 'g');

    IF left(s,1) <> '+' THEN
        s := '+52' || s;
    END IF;

    RETURN s;
END;
$$;


--
-- Name: FUNCTION fn_normaliza_telefono_e164(tel text); Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON FUNCTION whatsapp.fn_normaliza_telefono_e164(tel text) IS 'Normaliza un telefono al formato E.164. Asume prefijo +52 si no existe.';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: whatsapp; Owner: -
--

CREATE FUNCTION whatsapp.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: sp_whatsapp_log_mensaje_contactado(text, text, text, text, text, timestamp with time zone, text, text, jsonb); Type: FUNCTION; Schema: whatsapp; Owner: -
--

CREATE FUNCTION whatsapp.sp_whatsapp_log_mensaje_contactado(numero_telefono_raw text, tipo_mensaje text, canal text DEFAULT NULL::text, contenido text DEFAULT NULL::text, plantilla_nombre text DEFAULT NULL::text, fecha_envio timestamp with time zone DEFAULT NULL::timestamp with time zone, status text DEFAULT NULL::text, id_externo text DEFAULT NULL::text, respuesta_json jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    tel text;
    cid integer;
    conv_id bigint;
BEGIN
    tel := whatsapp.fn_normaliza_telefono_e164(numero_telefono_raw);

    IF fecha_envio IS NULL THEN
        fecha_envio := now();
    END IF;

    SELECT id INTO cid
    FROM whatsapp.vcontactos_telefonos
    WHERE telefonoe164 = tel
    LIMIT 1;

    SELECT id INTO conv_id
    FROM whatsapp.whatsapp_conversaciones
    WHERE contacto_id = cid
      AND estado = 'abierta'
    ORDER BY creada_en DESC
    LIMIT 1;

    IF conv_id IS NULL THEN
        INSERT INTO whatsapp.whatsapp_conversaciones (
            contacto_id,
            creada_en,
            ultimo_mensaje_en
        )
        VALUES (
            cid,
            fecha_envio,
            fecha_envio
        )
        RETURNING id INTO conv_id;
    ELSE
        UPDATE whatsapp.whatsapp_conversaciones
        SET ultimo_mensaje_en = fecha_envio
        WHERE id = conv_id;
    END IF;

    INSERT INTO whatsapp.whatsapp_mensajes (
        contacto_id,
        conversacion_id,
        numero_telefono,
        tipo_mensaje,
        canal,
        contenido,
        plantilla_nombre,
        fecha_envio,
        status,
        id_externo,
        respuesta_json
    )
    VALUES (
        cid,
        conv_id,
        tel,
        tipo_mensaje,
        canal,
        contenido,
        plantilla_nombre,
        fecha_envio,
        status,
        id_externo,
        respuesta_json
    );

    PERFORM whatsapp.sp_whatsapp_touch_estado(
        tel,
        CASE WHEN tipo_mensaje = 'entrante'
             THEN 'in'
             ELSE 'out'
        END
    );
END;
$$;


--
-- Name: sp_whatsapp_touch_estado(text, text); Type: FUNCTION; Schema: whatsapp; Owner: -
--

CREATE FUNCTION whatsapp.sp_whatsapp_touch_estado(numero_telefono_raw text, tipo_evento text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    tel text;
BEGIN
    tel := whatsapp.fn_normaliza_telefono_e164(numero_telefono_raw);

    INSERT INTO whatsapp.whatsapp_contacto_estado (
        numero_telefono,
        opt_in,
        opt_out,
        ultimo_in,
        ultimo_out
    )
    VALUES (
        tel,
        (tipo_evento = 'optin'),
        (tipo_evento = 'optout'),
        CASE WHEN tipo_evento = 'in' THEN now() ELSE NULL END,
        CASE WHEN tipo_evento = 'out' THEN now() ELSE NULL END
    )
    ON CONFLICT (numero_telefono)
    DO UPDATE SET
        ultimo_in  = CASE WHEN tipo_evento = 'in'
                          THEN now()
                          ELSE whatsapp_contacto_estado.ultimo_in END,
        ultimo_out = CASE WHEN tipo_evento = 'out'
                          THEN now()
                          ELSE whatsapp_contacto_estado.ultimo_out END,
        opt_in  = CASE WHEN tipo_evento = 'optin'
                       THEN true
                       ELSE whatsapp_contacto_estado.opt_in END,
        opt_out = CASE WHEN tipo_evento = 'optout'
                       THEN true
                       ELSE whatsapp_contacto_estado.opt_out END,
        actualizado_en = now();
END;
$$;


SET default_table_access_method = heap;

--
-- Name: campos_configuracion; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.campos_configuracion (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    entidad_tipo_id integer NOT NULL,
    tipo_documento character varying(30),
    nombre character varying(120) NOT NULL,
    clave character varying(60),
    tipo_dato character varying(20) NOT NULL,
    tipo_control character varying(20),
    catalogo_tipo_id integer,
    campo_padre_id integer,
    obligatorio boolean DEFAULT false,
    activo boolean DEFAULT true,
    orden integer,
    created_at timestamp without time zone DEFAULT now(),
    proposito_sistema character varying(50)
);


--
-- Name: TABLE campos_configuracion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.campos_configuracion IS 'Define campos dinámicos configurables que pueden aparecer en documentos, partidas, contactos o productos.';


--
-- Name: COLUMN campos_configuracion.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.id IS 'Identificador único del campo configurable.';


--
-- Name: COLUMN campos_configuracion.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.empresa_id IS 'Empresa propietaria de la configuración del campo dinámico.';


--
-- Name: COLUMN campos_configuracion.entidad_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.entidad_tipo_id IS 'Tipo de entidad donde se aplicará el campo (documento, partida, contacto, producto).';


--
-- Name: COLUMN campos_configuracion.tipo_documento; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.tipo_documento IS 'Tipo de documento específico cuando el campo aplica a documentos o partidas.';


--
-- Name: COLUMN campos_configuracion.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.nombre IS 'Nombre visible del campo que aparecerá en la interfaz de captura.';


--
-- Name: COLUMN campos_configuracion.clave; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.clave IS 'Clave técnica del campo utilizada en lógica de negocio, reportes o integraciones.';


--
-- Name: COLUMN campos_configuracion.tipo_dato; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.tipo_dato IS 'Tipo de dato lógico del campo (texto, numero, fecha, booleano o lista).';


--
-- Name: COLUMN campos_configuracion.tipo_control; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.tipo_control IS 'Tipo de control visual sugerido para el frontend (textbox, dropdown, checkbox, datepicker).';


--
-- Name: COLUMN campos_configuracion.catalogo_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.catalogo_tipo_id IS 'Tipo de catálogo utilizado cuando el campo es de tipo lista.';


--
-- Name: COLUMN campos_configuracion.campo_padre_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.campo_padre_id IS 'Permite definir dependencias entre campos dinámicos (ejemplo: Modelo depende de Marca).';


--
-- Name: COLUMN campos_configuracion.obligatorio; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.obligatorio IS 'Indica si el campo debe ser capturado obligatoriamente.';


--
-- Name: COLUMN campos_configuracion.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.activo IS 'Indica si el campo está activo y disponible para captura.';


--
-- Name: COLUMN campos_configuracion.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.orden IS 'Orden de aparición del campo dentro del formulario.';


--
-- Name: COLUMN campos_configuracion.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.created_at IS 'Fecha y hora en que se creó el registro de configuración.';


--
-- Name: COLUMN campos_configuracion.proposito_sistema; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.proposito_sistema IS 'Propósito especial del campo configurable dentro del sistema. Ejemplo: PRECIOS.';


--
-- Name: campos_configuracion_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.campos_configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campos_configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.campos_configuracion_id_seq OWNED BY core.campos_configuracion.id;


--
-- Name: campos_obligatorios; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.campos_obligatorios (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    entidad character varying(50) NOT NULL,
    contexto character varying(50),
    campo character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE campos_obligatorios; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.campos_obligatorios IS 'Campos configurados como obligatorios por empresa, entidad y contexto. La tabla solo almacena excepciones: si un campo no existe aquí, se considera opcional.';


--
-- Name: COLUMN campos_obligatorios.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.id IS 'Identificador único del registro.';


--
-- Name: COLUMN campos_obligatorios.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.empresa_id IS 'Empresa a la que pertenece la configuración.';


--
-- Name: COLUMN campos_obligatorios.entidad; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.entidad IS 'Entidad funcional del sistema, por ejemplo contactos o documentos. No depende del nombre físico del formulario.';


--
-- Name: COLUMN campos_obligatorios.contexto; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.contexto IS 'Contexto específico de la entidad. En contactos puede ser el tipo de contacto; en documentos puede ser el tipo_documento. Puede ser NULL cuando la configuración aplique a toda la entidad.';


--
-- Name: COLUMN campos_obligatorios.campo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.campo IS 'Nombre técnico del campo dentro de la entidad.';


--
-- Name: COLUMN campos_obligatorios.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.created_at IS 'Fecha y hora en que se creó la configuración.';


--
-- Name: campos_obligatorios_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.campos_obligatorios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campos_obligatorios_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.campos_obligatorios_id_seq OWNED BY core.campos_obligatorios.id;


--
-- Name: catalogos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.catalogos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_catalogo_id integer NOT NULL,
    clave character varying(40),
    descripcion character varying(150) NOT NULL,
    orden integer,
    activo boolean DEFAULT true,
    extra jsonb,
    created_at timestamp without time zone DEFAULT now(),
    catalogo_padre_id integer,
    precio_lista_id bigint
);


--
-- Name: TABLE catalogos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.catalogos IS 'Valores de cada tipo de catálogo configurable';


--
-- Name: COLUMN catalogos.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.id IS 'Identificador interno del registro del catálogo';


--
-- Name: COLUMN catalogos.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.empresa_id IS 'Empresa propietaria del catálogo';


--
-- Name: COLUMN catalogos.tipo_catalogo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.tipo_catalogo_id IS 'Tipo de catálogo al que pertenece el registro';


--
-- Name: COLUMN catalogos.clave; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.clave IS 'Clave corta opcional del elemento del catálogo';


--
-- Name: COLUMN catalogos.descripcion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.descripcion IS 'Descripción visible del elemento del catálogo';


--
-- Name: COLUMN catalogos.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.orden IS 'Orden sugerido de aparición en listas';


--
-- Name: COLUMN catalogos.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.activo IS 'Indica si el elemento del catálogo está activo';


--
-- Name: COLUMN catalogos.extra; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.extra IS 'Información adicional flexible en formato JSON';


--
-- Name: COLUMN catalogos.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.created_at IS 'Fecha de creación del registro';


--
-- Name: COLUMN catalogos.catalogo_padre_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.catalogo_padre_id IS 'Referencia al registro padre dentro del mismo catálogo. Permite construir jerarquías como Marca → Modelo.';


--
-- Name: catalogos_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.catalogos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogos_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.catalogos_id_seq OWNED BY core.catalogos.id;


--
-- Name: catalogos_tipos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.catalogos_tipos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    entidad_tipo_id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    permite_multiple boolean DEFAULT false,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE catalogos_tipos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.catalogos_tipos IS 'Tipos de catálogos configurables por empresa y por tipo de entidad';


--
-- Name: COLUMN catalogos_tipos.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.id IS 'Identificador interno del tipo de catálogo';


--
-- Name: COLUMN catalogos_tipos.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.empresa_id IS 'Empresa propietaria del tipo de catálogo';


--
-- Name: COLUMN catalogos_tipos.entidad_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.entidad_tipo_id IS 'Tipo de entidad al que aplica el catálogo';


--
-- Name: COLUMN catalogos_tipos.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.nombre IS 'Nombre visible del tipo de catálogo';


--
-- Name: COLUMN catalogos_tipos.permite_multiple; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.permite_multiple IS 'Indica si la entidad puede tener múltiples valores de este tipo';


--
-- Name: COLUMN catalogos_tipos.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.activo IS 'Indica si el tipo de catálogo está activo';


--
-- Name: COLUMN catalogos_tipos.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.created_at IS 'Fecha de creación del registro';


--
-- Name: catalogos_tipos_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.catalogos_tipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogos_tipos_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.catalogos_tipos_id_seq OWNED BY core.catalogos_tipos.id;


--
-- Name: cfdi_pac_config; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_pac_config (
    id integer NOT NULL,
    pac character varying(50) DEFAULT 'facturama'::character varying NOT NULL,
    modo character varying(20) DEFAULT 'sandbox'::character varying NOT NULL,
    base_url text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    stamp_path text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT cfdi_pac_config_modo_chk CHECK (((modo)::text = ANY ((ARRAY['sandbox'::character varying, 'produccion'::character varying])::text[])))
);


--
-- Name: cfdi_pac_config_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_pac_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_pac_config_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_pac_config_id_seq OWNED BY core.cfdi_pac_config.id;


--
-- Name: empresas; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas (
    id integer NOT NULL,
    identificador character varying(120) NOT NULL,
    nombre character varying(150) NOT NULL,
    razon_social character varying(200) NOT NULL,
    rfc character varying(13) NOT NULL,
    regimen_fiscal_id text NOT NULL,
    codigo_postal_id text NOT NULL,
    estado_id text NOT NULL,
    localidad_id text,
    colonia_id text,
    calle character varying(150),
    numero_exterior character varying(20),
    numero_interior character varying(20),
    pais character varying(100) DEFAULT 'México'::character varying,
    telefono character varying(30),
    email character varying(120),
    sitio_web character varying(150),
    certificado_csd text,
    llave_privada_csd text,
    password_csd character varying(100),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    codigo_postal character varying(10),
    regimen_fiscal character varying(10),
    cfdi_csd_registrado_facturama boolean DEFAULT false NOT NULL,
    cfdi_csd_fecha_actualizacion timestamp without time zone,
    cfdi_csd_cer_path character varying,
    cfdi_csd_key_path character varying,
    cfdi_csd_password_encrypted text
);


--
-- Name: TABLE empresas; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas IS 'Empresas registradas en la plataforma Emphasys ERP/CRM';


--
-- Name: COLUMN empresas.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.id IS 'Identificador interno de la empresa';


--
-- Name: COLUMN empresas.identificador; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.identificador IS 'Alias o nombre corto de la empresa (ej. Runika, Dicor)';


--
-- Name: COLUMN empresas.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.nombre IS 'Nombre visible de la empresa dentro del sistema';


--
-- Name: COLUMN empresas.razon_social; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.razon_social IS 'Razón social fiscal registrada ante el SAT';


--
-- Name: COLUMN empresas.rfc; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.rfc IS 'RFC de la empresa';


--
-- Name: COLUMN empresas.regimen_fiscal_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.regimen_fiscal_id IS 'Régimen fiscal SAT';


--
-- Name: COLUMN empresas.codigo_postal_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.codigo_postal_id IS 'Código postal SAT del domicilio fiscal';


--
-- Name: COLUMN empresas.estado_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.estado_id IS 'Estado SAT del domicilio';


--
-- Name: COLUMN empresas.localidad_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.localidad_id IS 'Localidad SAT del domicilio';


--
-- Name: COLUMN empresas.colonia_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.colonia_id IS 'Colonia SAT del domicilio';


--
-- Name: COLUMN empresas.calle; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.calle IS 'Calle del domicilio fiscal';


--
-- Name: COLUMN empresas.numero_exterior; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.numero_exterior IS 'Número exterior del domicilio';


--
-- Name: COLUMN empresas.numero_interior; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.numero_interior IS 'Número interior del domicilio';


--
-- Name: COLUMN empresas.pais; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.pais IS 'País del domicilio';


--
-- Name: COLUMN empresas.telefono; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.telefono IS 'Teléfono principal de la empresa';


--
-- Name: COLUMN empresas.email; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.email IS 'Correo electrónico de contacto';


--
-- Name: COLUMN empresas.sitio_web; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.sitio_web IS 'Sitio web de la empresa';


--
-- Name: COLUMN empresas.certificado_csd; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.certificado_csd IS 'Certificado digital para timbrado CFDI';


--
-- Name: COLUMN empresas.llave_privada_csd; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.llave_privada_csd IS 'Llave privada del certificado digital';


--
-- Name: COLUMN empresas.password_csd; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.password_csd IS 'Password del certificado digital';


--
-- Name: COLUMN empresas.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.activo IS 'Indica si la empresa está activa';


--
-- Name: COLUMN empresas.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.created_at IS 'Fecha de creación del registro';


--
-- Name: COLUMN empresas.cfdi_csd_registrado_facturama; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.cfdi_csd_registrado_facturama IS 'Indica si el CSD fue registrado exitosamente en Facturama Multiemisor';


--
-- Name: COLUMN empresas.cfdi_csd_fecha_actualizacion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.cfdi_csd_fecha_actualizacion IS 'Fecha de la ultima actualizacion del CSD en Facturama Multiemisor';


--
-- Name: COLUMN empresas.cfdi_csd_cer_path; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.cfdi_csd_cer_path IS 'Ruta relativa en uploads del archivo .cer cargado para Facturama Multiemisor';


--
-- Name: COLUMN empresas.cfdi_csd_key_path; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.cfdi_csd_key_path IS 'Ruta relativa en uploads del archivo .key cargado para Facturama Multiemisor';


--
-- Name: COLUMN empresas.cfdi_csd_password_encrypted; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.cfdi_csd_password_encrypted IS 'Contrasena CSD cifrada para registro en Facturama Multiemisor';


--
-- Name: empresas_assets; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_assets (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    ruta character varying(500) NOT NULL,
    mime_type character varying(100),
    tamano_bytes bigint,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE empresas_assets; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_assets IS 'Archivos asociados a empresas (logos, firmas, documentos u otros assets corporativos).';


--
-- Name: COLUMN empresas_assets.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.id IS 'Identificador interno del asset';


--
-- Name: COLUMN empresas_assets.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.empresa_id IS 'Empresa propietaria del archivo';


--
-- Name: COLUMN empresas_assets.tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.tipo IS 'Tipo de asset (logo_default, logo_factura, firma, marca_agua, etc.)';


--
-- Name: COLUMN empresas_assets.nombre_archivo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.nombre_archivo IS 'Nombre original del archivo subido por el usuario';


--
-- Name: COLUMN empresas_assets.ruta; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.ruta IS 'Ruta física o URL donde se encuentra almacenado el archivo';


--
-- Name: COLUMN empresas_assets.mime_type; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.mime_type IS 'Tipo MIME del archivo';


--
-- Name: COLUMN empresas_assets.tamano_bytes; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.tamano_bytes IS 'Tamaño del archivo en bytes';


--
-- Name: COLUMN empresas_assets.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.activo IS 'Indica si el asset está activo';


--
-- Name: COLUMN empresas_assets.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.created_at IS 'Fecha de creación del registro';


--
-- Name: empresas_assets_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_assets_id_seq OWNED BY core.empresas_assets.id;


--
-- Name: empresas_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_id_seq OWNED BY core.empresas.id;


--
-- Name: empresas_impuestos_default; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_impuestos_default (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    impuesto_id character varying(30) NOT NULL,
    orden integer DEFAULT 0
);


--
-- Name: TABLE empresas_impuestos_default; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_impuestos_default IS 'Impuestos predeterminados de una empresa. Se aplican cuando un producto no tiene impuestos definidos.';


--
-- Name: COLUMN empresas_impuestos_default.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_impuestos_default.empresa_id IS 'Empresa a la que pertenecen los impuestos predeterminados.';


--
-- Name: COLUMN empresas_impuestos_default.impuesto_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_impuestos_default.impuesto_id IS 'Impuesto que se aplicará por defecto a los productos sin impuestos definidos.';


--
-- Name: COLUMN empresas_impuestos_default.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_impuestos_default.orden IS 'Orden de aplicación del impuesto cuando existen múltiples impuestos.';


--
-- Name: empresas_impuestos_default_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_impuestos_default_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_impuestos_default_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_impuestos_default_id_seq OWNED BY core.empresas_impuestos_default.id;


--
-- Name: empresas_tipos_documento; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_tipos_documento (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0,
    usuario_creacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    whatsapp_plantilla_default_id bigint,
    afecta_inventario character varying(20) DEFAULT NULL::character varying,
    afecta_reservado boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE empresas_tipos_documento; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_tipos_documento IS 'Tabla que define qué tipos de documentos utiliza cada empresa y permite habilitarlos o deshabilitarlos.';


--
-- Name: COLUMN empresas_tipos_documento.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.empresa_id IS 'Empresa a la que aplica el tipo de documento.';


--
-- Name: COLUMN empresas_tipos_documento.tipo_documento_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.tipo_documento_id IS 'Tipo de documento habilitado para la empresa.';


--
-- Name: COLUMN empresas_tipos_documento.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.activo IS 'Indica si el tipo de documento está habilitado para la empresa.';


--
-- Name: COLUMN empresas_tipos_documento.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.orden IS 'Orden de aparición en la interfaz del ERP para esa empresa.';


--
-- Name: COLUMN empresas_tipos_documento.usuario_creacion_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.usuario_creacion_id IS 'Usuario que creó el registro.';


--
-- Name: COLUMN empresas_tipos_documento.fecha_creacion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.fecha_creacion IS 'Fecha de creación del registro.';


--
-- Name: COLUMN empresas_tipos_documento.whatsapp_plantilla_default_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.whatsapp_plantilla_default_id IS 'Plantilla de WhatsApp predeterminada para este tipo de documento y empresa.';


--
-- Name: COLUMN empresas_tipos_documento.afecta_inventario; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.afecta_inventario IS 'Define cómo afecta inventario: none, entrada, salida, transferencia.';


--
-- Name: COLUMN empresas_tipos_documento.afecta_reservado; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.afecta_reservado IS 'Indica si el documento afecta cantidades reservadas (apartados o compromisos).';


--
-- Name: empresas_tipos_documento_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_tipos_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_tipos_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_tipos_documento_id_seq OWNED BY core.empresas_tipos_documento.id;


--
-- Name: empresas_tipos_documento_transiciones; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_tipos_documento_transiciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento_origen_id integer NOT NULL,
    tipo_documento_destino_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0,
    usuario_creacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE empresas_tipos_documento_transiciones; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_tipos_documento_transiciones IS 'Define, por empresa, qué tipos de documento pueden generarse a partir de otros dentro del ERP.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.empresa_id IS 'Empresa a la que aplica la transición entre tipos de documento.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.tipo_documento_origen_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.tipo_documento_origen_id IS 'Tipo de documento desde el cual se genera otro documento.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.tipo_documento_destino_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.tipo_documento_destino_id IS 'Tipo de documento que puede generarse a partir del documento origen.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.activo IS 'Indica si la transición está habilitada para la empresa.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.orden IS 'Orden en que aparecerá la opción en la interfaz.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.usuario_creacion_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.usuario_creacion_id IS 'Usuario que registró la transición.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.fecha_creacion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.fecha_creacion IS 'Fecha de creación del registro.';


--
-- Name: empresas_tipos_documento_transiciones_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_tipos_documento_transiciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_tipos_documento_transiciones_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_tipos_documento_transiciones_id_seq OWNED BY core.empresas_tipos_documento_transiciones.id;


--
-- Name: entidades_catalogos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.entidades_catalogos (
    empresa_id integer NOT NULL,
    entidad_tipo_id integer NOT NULL,
    entidad_id integer NOT NULL,
    catalogo_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE entidades_catalogos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.entidades_catalogos IS 'Relación entre entidades del sistema y valores de catálogo';


--
-- Name: COLUMN entidades_catalogos.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.empresa_id IS 'Empresa propietaria de la entidad';


--
-- Name: COLUMN entidades_catalogos.entidad_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.entidad_tipo_id IS 'Tipo de entidad relacionada';


--
-- Name: COLUMN entidades_catalogos.entidad_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.entidad_id IS 'Identificador de la entidad';


--
-- Name: COLUMN entidades_catalogos.catalogo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.catalogo_id IS 'Valor de catálogo asignado a la entidad';


--
-- Name: COLUMN entidades_catalogos.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.created_at IS 'Fecha de creación de la relación';


--
-- Name: entidades_tipos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.entidades_tipos (
    id integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- Name: TABLE entidades_tipos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.entidades_tipos IS 'Tipos de entidades que pueden tener catálogos configurables';


--
-- Name: COLUMN entidades_tipos.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_tipos.id IS 'Identificador interno del tipo de entidad';


--
-- Name: COLUMN entidades_tipos.codigo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_tipos.codigo IS 'Código técnico del tipo de entidad (CONTACTO, PRODUCTO)';


--
-- Name: COLUMN entidades_tipos.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_tipos.nombre IS 'Nombre visible del tipo de entidad';


--
-- Name: entidades_tipos_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.entidades_tipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entidades_tipos_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.entidades_tipos_id_seq OWNED BY core.entidades_tipos.id;


--
-- Name: grid_preferences; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.grid_preferences (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    pantalla text NOT NULL,
    perfil_dispositivo text NOT NULL,
    preferencias jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grid_preferences_perfil_chk CHECK ((perfil_dispositivo = ANY (ARRAY['desktop'::text, 'tablet'::text, 'mobile'::text])))
);


--
-- Name: grid_preferences_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.grid_preferences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grid_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.grid_preferences_id_seq OWNED BY core.grid_preferences.id;


--
-- Name: modulos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.modulos (
    modulo_id integer NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL
);


--
-- Name: modulos_modulo_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.modulos_modulo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modulos_modulo_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.modulos_modulo_id_seq OWNED BY core.modulos.modulo_id;


--
-- Name: parametros; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.parametros (
    parametro_id integer NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL,
    tipo_dato text NOT NULL,
    tipo_control text NOT NULL,
    parametro_padre_id integer,
    valor_activacion text,
    valor_default text
);


--
-- Name: COLUMN parametros.valor_default; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.parametros.valor_default IS 'Valor por defecto del parámetro si la empresa no ha configurado uno.';


--
-- Name: parametros_empresa; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.parametros_empresa (
    empresa_id integer NOT NULL,
    parametro_id integer NOT NULL,
    valor text
);


--
-- Name: TABLE parametros_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.parametros_empresa IS 'Valores configurados de parámetros para cada empresa del ERP.';


--
-- Name: parametros_modulos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.parametros_modulos (
    parametro_id integer NOT NULL,
    modulo_id integer NOT NULL
);


--
-- Name: parametros_opciones; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.parametros_opciones (
    opcion_id integer NOT NULL,
    parametro_id integer NOT NULL,
    valor character varying(100) NOT NULL,
    etiqueta character varying(200) NOT NULL,
    orden integer DEFAULT 0
);


--
-- Name: TABLE parametros_opciones; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.parametros_opciones IS 'Opciones disponibles para parámetros tipo dropdown.';


--
-- Name: COLUMN parametros_opciones.valor; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.parametros_opciones.valor IS 'Valor que se guardará en la base de datos.';


--
-- Name: COLUMN parametros_opciones.etiqueta; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.parametros_opciones.etiqueta IS 'Texto que se mostrará al usuario.';


--
-- Name: parametros_opciones_opcion_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.parametros_opciones_opcion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parametros_opciones_opcion_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.parametros_opciones_opcion_id_seq OWNED BY core.parametros_opciones.opcion_id;


--
-- Name: parametros_parametro_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.parametros_parametro_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parametros_parametro_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.parametros_parametro_id_seq OWNED BY core.parametros.parametro_id;


--
-- Name: roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.roles (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(200),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE roles; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.roles IS 'Roles disponibles para usuarios dentro de cada empresa';


--
-- Name: COLUMN roles.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.id IS 'Identificador interno del rol';


--
-- Name: COLUMN roles.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.empresa_id IS 'Empresa a la que pertenece el rol';


--
-- Name: COLUMN roles.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.nombre IS 'Nombre del rol (Administrador, Ventas, etc)';


--
-- Name: COLUMN roles.descripcion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.descripcion IS 'Descripción del rol';


--
-- Name: COLUMN roles.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.activo IS 'Indica si el rol está activo';


--
-- Name: COLUMN roles.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.created_at IS 'Fecha de creación del rol';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.roles_id_seq OWNED BY core.roles.id;


--
-- Name: tipos_documento; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.tipos_documento (
    id integer NOT NULL,
    codigo character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    nombre_plural character varying(120) NOT NULL,
    icono character varying(50),
    orden integer DEFAULT 0,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    modulo character varying(30),
    naturaleza_saldo character varying(20),
    afecta_inventario character varying(20),
    CONSTRAINT chk_tipos_documento_naturaleza_saldo CHECK (((naturaleza_saldo)::text = ANY ((ARRAY['cargo'::character varying, 'abono'::character varying, 'none'::character varying])::text[])))
);


--
-- Name: TABLE tipos_documento; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.tipos_documento IS 'Catálogo de tipos de documentos comerciales utilizados por el ERP (cotización, pedido, factura, etc.).';


--
-- Name: COLUMN tipos_documento.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.id IS 'Identificador único del tipo de documento.';


--
-- Name: COLUMN tipos_documento.codigo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.codigo IS 'Clave técnica utilizada internamente por el sistema para identificar el tipo de documento.';


--
-- Name: COLUMN tipos_documento.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.nombre IS 'Nombre en singular del documento utilizado en formularios y títulos (ej. Cotización).';


--
-- Name: COLUMN tipos_documento.nombre_plural; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.nombre_plural IS 'Nombre en plural utilizado en menús, tabs y listados (ej. Cotizaciones).';


--
-- Name: COLUMN tipos_documento.icono; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.icono IS 'Nombre del icono utilizado en la interfaz gráfica (normalmente iconos de Material UI).';


--
-- Name: COLUMN tipos_documento.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.orden IS 'Orden de aparición del tipo de documento en listas o menús del sistema.';


--
-- Name: COLUMN tipos_documento.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.activo IS 'Indica si el tipo de documento está disponible para uso en el sistema.';


--
-- Name: COLUMN tipos_documento.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.created_at IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN tipos_documento.modulo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.modulo IS 'Módulo al que pertenece el documento (ventas o compras).';


--
-- Name: COLUMN tipos_documento.naturaleza_saldo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.naturaleza_saldo IS 'Define comportamiento financiero del documento: cargo, abono o none.';


--
-- Name: COLUMN tipos_documento.afecta_inventario; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.tipos_documento.afecta_inventario IS 'Comportamiento predeterminado de afectación de inventario para este tipo de documento.
 NULL significa que el tipo no tiene default definido (se resuelve como ''none'').
 Puede ser sobreescrito por empresa en core.empresas_tipos_documento.afecta_inventario.';


--
-- Name: tipos_documento_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.tipos_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tipos_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.tipos_documento_id_seq OWNED BY core.tipos_documento.id;


--
-- Name: usuarios; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuarios (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    ultimo_login timestamp without time zone,
    activo boolean DEFAULT true,
    es_superadmin boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    vendedor_contacto_id integer,
    ruta_inicio text
);


--
-- Name: TABLE usuarios; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.usuarios IS 'Usuarios del sistema que pueden acceder a una o más empresas';


--
-- Name: COLUMN usuarios.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.id IS 'Identificador interno del usuario';


--
-- Name: COLUMN usuarios.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.nombre IS 'Nombre completo del usuario';


--
-- Name: COLUMN usuarios.email; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.email IS 'Correo electrónico usado como login';


--
-- Name: COLUMN usuarios.password_hash; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.password_hash IS 'Hash de la contraseña del usuario';


--
-- Name: COLUMN usuarios.ultimo_login; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.ultimo_login IS 'Fecha del último acceso del usuario';


--
-- Name: COLUMN usuarios.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.activo IS 'Indica si el usuario está activo';


--
-- Name: COLUMN usuarios.es_superadmin; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.es_superadmin IS 'Usuario administrador global de la plataforma';


--
-- Name: COLUMN usuarios.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.created_at IS 'Fecha de creación del usuario';


--
-- Name: COLUMN usuarios.ruta_inicio; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.ruta_inicio IS 'Ruta inicial sugerida al iniciar sesión';


--
-- Name: usuarios_empresas; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuarios_empresas (
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE usuarios_empresas; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.usuarios_empresas IS 'Relación entre usuarios y empresas a las que tienen acceso';


--
-- Name: COLUMN usuarios_empresas.usuario_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.usuario_id IS 'Usuario que tiene acceso a la empresa';


--
-- Name: COLUMN usuarios_empresas.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.empresa_id IS 'Empresa a la que el usuario tiene acceso';


--
-- Name: COLUMN usuarios_empresas.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.activo IS 'Indica si el acceso está activo';


--
-- Name: COLUMN usuarios_empresas.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.created_at IS 'Fecha de creación de la relación';


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.usuarios_id_seq OWNED BY core.usuarios.id;


--
-- Name: usuarios_roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuarios_roles (
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    rol_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE usuarios_roles; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.usuarios_roles IS 'Asignación de roles a usuarios dentro de cada empresa';


--
-- Name: COLUMN usuarios_roles.usuario_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.usuario_id IS 'Usuario al que se asigna el rol';


--
-- Name: COLUMN usuarios_roles.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.empresa_id IS 'Empresa donde aplica el rol';


--
-- Name: COLUMN usuarios_roles.rol_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.rol_id IS 'Rol asignado al usuario';


--
-- Name: COLUMN usuarios_roles.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.created_at IS 'Fecha de creación de la asignación';


--
-- Name: actividades; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.actividades (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    usuario_asignado_id integer NOT NULL,
    usuario_creador_id integer NOT NULL,
    oportunidad_id integer,
    tipo_actividad character varying(30) NOT NULL,
    fecha_programada timestamp without time zone NOT NULL,
    notas text,
    estatus character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_realizacion timestamp without time zone,
    resultado text,
    recordatorio boolean DEFAULT false,
    recordatorio_minutos integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    recordatorio_disparado_at timestamp without time zone,
    contacto_id integer
);


--
-- Name: TABLE actividades; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.actividades IS 'Tabla de actividades programadas de seguimiento comercial en el ERP multiempresa.';


--
-- Name: COLUMN actividades.id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.id IS 'Identificador unico de la actividad.';


--
-- Name: COLUMN actividades.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.empresa_id IS 'Empresa a la que pertenece la actividad dentro del modelo multiempresa.';


--
-- Name: COLUMN actividades.usuario_asignado_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.usuario_asignado_id IS 'Usuario responsable de ejecutar la actividad.';


--
-- Name: COLUMN actividades.usuario_creador_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.usuario_creador_id IS 'Usuario que creo o asigno la actividad.';


--
-- Name: COLUMN actividades.oportunidad_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.oportunidad_id IS 'Oportunidad de venta relacionada. Es opcional y puede ser NULL para actividades generales.';


--
-- Name: COLUMN actividades.tipo_actividad; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.tipo_actividad IS 'Tipo de actividad. No usa catalogo por ahora; los valores se controlan desde aplicacion.';


--
-- Name: COLUMN actividades.fecha_programada; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.fecha_programada IS 'Fecha y hora en que debe ejecutarse la actividad.';


--
-- Name: COLUMN actividades.notas; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.notas IS 'Notas o instrucciones capturadas para el seguimiento.';


--
-- Name: COLUMN actividades.estatus; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.estatus IS 'Estatus de la actividad. Los valores se controlan desde aplicacion.';


--
-- Name: COLUMN actividades.fecha_realizacion; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.fecha_realizacion IS 'Fecha y hora en que se realizo la actividad. A nivel aplicacion es obligatoria cuando el estatus sea realizada.';


--
-- Name: COLUMN actividades.resultado; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.resultado IS 'Resultado de la actividad. A nivel aplicacion es obligatorio cuando el estatus sea realizada.';


--
-- Name: COLUMN actividades.recordatorio; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.recordatorio IS 'Indica si la actividad debe generar un recordatorio antes de su ejecucion.';


--
-- Name: COLUMN actividades.recordatorio_minutos; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.recordatorio_minutos IS 'Cantidad de minutos antes de la actividad en que se debe avisar.';


--
-- Name: COLUMN actividades.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.created_at IS 'Fecha y hora de creacion del registro.';


--
-- Name: COLUMN actividades.updated_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.updated_at IS 'Fecha y hora de la ultima actualizacion del registro.';


--
-- Name: COLUMN actividades.contacto_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.contacto_id IS 'Contacto al que pertenece la actividad. En Fase 1 es nullable solo para permitir backfill y auditoria.';


--
-- Name: actividades_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.actividades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividades_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.actividades_id_seq OWNED BY crm.actividades.id;


--
-- Name: configuracion_email_empresa; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.configuracion_email_empresa (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    smtp_host character varying(255) NOT NULL,
    smtp_port integer NOT NULL,
    smtp_user character varying(255) NOT NULL,
    smtp_password text,
    smtp_secure boolean DEFAULT false NOT NULL,
    email_remitente character varying(255),
    nombre_remitente character varying(255),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT configuracion_email_empresa_smtp_port_chk CHECK (((smtp_port >= 1) AND (smtp_port <= 65535)))
);


--
-- Name: configuracion_email_empresa_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.configuracion_email_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_email_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.configuracion_email_empresa_id_seq OWNED BY crm.configuracion_email_empresa.id;


--
-- Name: configuracion_email_usuario; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.configuracion_email_usuario (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    smtp_host character varying(255) NOT NULL,
    smtp_port integer NOT NULL,
    smtp_user character varying(255) NOT NULL,
    smtp_password text,
    smtp_secure boolean DEFAULT false NOT NULL,
    email_remitente character varying(255),
    nombre_remitente character varying(255),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT configuracion_email_usuario_smtp_port_chk CHECK (((smtp_port >= 1) AND (smtp_port <= 65535)))
);


--
-- Name: configuracion_email_usuario_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.configuracion_email_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_email_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.configuracion_email_usuario_id_seq OWNED BY crm.configuracion_email_usuario.id;


--
-- Name: conversacion_etiquetas; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.conversacion_etiquetas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    conversacion_id integer NOT NULL,
    etiqueta_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE conversacion_etiquetas; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.conversacion_etiquetas IS 'Tabla puente que relaciona conversaciones con múltiples etiquetas';


--
-- Name: COLUMN conversacion_etiquetas.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.empresa_id IS 'Empresa propietaria de la relación';


--
-- Name: COLUMN conversacion_etiquetas.conversacion_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.conversacion_id IS 'ID de la conversación de WhatsApp';


--
-- Name: COLUMN conversacion_etiquetas.etiqueta_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.etiqueta_id IS 'ID de la etiqueta asignada a la conversación';


--
-- Name: COLUMN conversacion_etiquetas.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.created_at IS 'Fecha en que se asignó la etiqueta a la conversación';


--
-- Name: conversacion_etiquetas_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.conversacion_etiquetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversacion_etiquetas_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.conversacion_etiquetas_id_seq OWNED BY crm.conversacion_etiquetas.id;


--
-- Name: conversaciones; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.conversaciones (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer NOT NULL,
    estado character varying(20) DEFAULT 'abierta'::character varying NOT NULL,
    asignado_a integer,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_mensaje_en timestamp with time zone DEFAULT now() NOT NULL,
    cerrada_en timestamp with time zone,
    prioridad character varying(10) DEFAULT 'media'::character varying NOT NULL,
    siguiente_accion character varying(30) DEFAULT 'responder'::character varying NOT NULL,
    etapa_oportunidad character varying(30) DEFAULT 'nuevo'::character varying NOT NULL,
    CONSTRAINT chk_etapa_oportunidad CHECK (((etapa_oportunidad)::text = ANY ((ARRAY['nuevo'::character varying, 'contactado'::character varying, 'interesado'::character varying, 'cotizado'::character varying, 'negociacion'::character varying, 'convertida'::character varying, 'perdida'::character varying])::text[]))),
    CONSTRAINT conversaciones_estado_check CHECK (((estado)::text = ANY (ARRAY[('abierta'::character varying)::text, ('cerrada'::character varying)::text])))
);


--
-- Name: TABLE conversaciones; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.conversaciones IS 'Agrupa mensajes en ciclos comerciales por empresa.';


--
-- Name: COLUMN conversaciones.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversaciones.empresa_id IS 'Empresa propietaria de la conversacion.';


--
-- Name: COLUMN conversaciones.contacto_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversaciones.contacto_id IS 'Contacto asociado a la conversacion.';


--
-- Name: COLUMN conversaciones.etapa_oportunidad; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversaciones.etapa_oportunidad IS 'Etapa comercial del lead: nuevo, contactado, interesado, cotizado, negociacion, convertida o perdida.';


--
-- Name: conversaciones_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

ALTER TABLE crm.conversaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME crm.conversaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_plantillas; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.email_plantillas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(100) NOT NULL,
    asunto text NOT NULL,
    html text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_plantillas_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.email_plantillas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_plantillas_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.email_plantillas_id_seq OWNED BY crm.email_plantillas.id;


--
-- Name: etiquetas; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.etiquetas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    color text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_whatsapp_etiquetas_color_hex CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text))
);


--
-- Name: TABLE etiquetas; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.etiquetas IS 'Catálogo de etiquetas para clasificar conversaciones de WhatsApp por empresa';


--
-- Name: COLUMN etiquetas.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.empresa_id IS 'Empresa a la que pertenece la etiqueta';


--
-- Name: COLUMN etiquetas.nombre; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.nombre IS 'Nombre de la etiqueta (ej: Cotizado, Urgente, Seguimiento)';


--
-- Name: COLUMN etiquetas.color; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.color IS 'Color en formato HEX (#RRGGBB), sin transparencia';


--
-- Name: COLUMN etiquetas.activo; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.activo IS 'Indica si la etiqueta está disponible para uso';


--
-- Name: COLUMN etiquetas.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.created_at IS 'Fecha de creación del registro';


--
-- Name: COLUMN etiquetas.updated_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.updated_at IS 'Fecha de última actualización';


--
-- Name: etiquetas_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.etiquetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: etiquetas_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.etiquetas_id_seq OWNED BY crm.etiquetas.id;


--
-- Name: mensajes; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.mensajes (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer,
    conversacion_id bigint,
    telefono character varying(20),
    tipo_mensaje character varying(20),
    canal character varying(50),
    contenido text,
    plantilla_nombre character varying(100),
    fecha_envio timestamp with time zone,
    status character varying(20),
    id_externo character varying(100),
    intentos_envio integer DEFAULT 0 NOT NULL,
    respuesta_json jsonb,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    tipo_contenido character varying(20) DEFAULT 'text'::character varying NOT NULL,
    media_url text,
    mime_type character varying(100),
    caption text,
    email_from character varying(150),
    email_to character varying(150),
    email_subject character varying(200),
    email_cc character varying(200),
    email_bcc character varying(200),
    in_reply_to character varying(150),
    CONSTRAINT mensajes_status_check CHECK ((((status)::text = ANY (ARRAY[('queued'::character varying)::text, ('sent'::character varying)::text, ('delivered'::character varying)::text, ('read'::character varying)::text, ('failed'::character varying)::text, ('received'::character varying)::text])) OR (status IS NULL))),
    CONSTRAINT mensajes_telefono_check CHECK (((telefono)::text ~ '^[+0-9]{8,20}$'::text)),
    CONSTRAINT mensajes_tipo_contenido_chk CHECK (((tipo_contenido)::text = ANY ((ARRAY['text'::character varying, 'image'::character varying, 'audio'::character varying, 'document'::character varying])::text[]))),
    CONSTRAINT mensajes_tipo_mensaje_check CHECK (((tipo_mensaje)::text = ANY (ARRAY[('saliente'::character varying)::text, ('entrante'::character varying)::text])))
);


--
-- Name: TABLE mensajes; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.mensajes IS 'Registro historico de mensajes por empresa.';


--
-- Name: COLUMN mensajes.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.empresa_id IS 'Empresa propietaria del mensaje.';


--
-- Name: COLUMN mensajes.tipo_contenido; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.tipo_contenido IS 'Tipo de contenido del mensaje: text, image, audio, document';


--
-- Name: COLUMN mensajes.media_url; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.media_url IS 'URL del archivo multimedia asociado al mensaje (si aplica)';


--
-- Name: COLUMN mensajes.mime_type; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.mime_type IS 'MIME type del archivo multimedia (si aplica)';


--
-- Name: COLUMN mensajes.caption; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.caption IS 'Texto/caption asociado a mensajes multimedia (imagen, audio, documento)';


--
-- Name: COLUMN mensajes.email_from; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_from IS 'Remitente para mensajes de correo dentro del canal CRM.';


--
-- Name: COLUMN mensajes.email_to; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_to IS 'Destinatario principal para mensajes de correo dentro del canal CRM.';


--
-- Name: COLUMN mensajes.email_subject; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_subject IS 'Asunto del correo asociado al mensaje CRM.';


--
-- Name: COLUMN mensajes.email_cc; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_cc IS 'Destinatarios en copia para mensajes de correo del CRM.';


--
-- Name: COLUMN mensajes.email_bcc; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_bcc IS 'Destinatarios en copia oculta para mensajes de correo del CRM.';


--
-- Name: COLUMN mensajes.in_reply_to; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.in_reply_to IS 'Identificador externo del mensaje al que responde un correo.';


--
-- Name: mensajes_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

ALTER TABLE crm.mensajes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME crm.mensajes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: oportunidades_venta; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.oportunidades_venta (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    conversacion_id integer,
    contacto_id integer NOT NULL,
    vendedor_id integer,
    estatus character varying(20) DEFAULT 'abierta'::character varying NOT NULL,
    etapa character varying(50),
    cotizacion_principal_id integer,
    fecha_estimada_decision date,
    fecha_reactivacion_estimada date,
    dolor_validado boolean,
    presupuesto_validado boolean,
    contacto_es_decisor boolean,
    comentarios_no_cierre text,
    observaciones text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE oportunidades_venta; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.oportunidades_venta IS 'Oportunidades comerciales del CRM. Una oportunidad representa un proceso de venta asociado a un contacto y puede originarse desde una conversación, pero no es la conversación.';


--
-- Name: COLUMN oportunidades_venta.id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.id IS 'Identificador interno de la oportunidad de venta.';


--
-- Name: COLUMN oportunidades_venta.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.empresa_id IS 'Empresa a la que pertenece la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.conversacion_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.conversacion_id IS 'Conversación de origen asociada a la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.contacto_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.contacto_id IS 'Contacto o cliente asociado a la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.vendedor_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.vendedor_id IS 'Vendedor responsable de la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.estatus; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.estatus IS 'Estatus comercial: abierta, pausada, convertida, perdida o cancelada.';


--
-- Name: COLUMN oportunidades_venta.etapa; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.etapa IS 'Etapa comercial.';


--
-- Name: COLUMN oportunidades_venta.cotizacion_principal_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.cotizacion_principal_id IS 'Cotización principal de la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.fecha_estimada_decision; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.fecha_estimada_decision IS 'Fecha tentativa de decisión del cliente.';


--
-- Name: COLUMN oportunidades_venta.fecha_reactivacion_estimada; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.fecha_reactivacion_estimada IS 'Fecha para retomar una oportunidad pausada.';


--
-- Name: COLUMN oportunidades_venta.dolor_validado; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.dolor_validado IS 'Indica si la necesidad del cliente es real.';


--
-- Name: COLUMN oportunidades_venta.presupuesto_validado; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.presupuesto_validado IS 'Indica si el cliente tiene presupuesto.';


--
-- Name: COLUMN oportunidades_venta.contacto_es_decisor; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.contacto_es_decisor IS 'Indica si el contacto decide.';


--
-- Name: COLUMN oportunidades_venta.comentarios_no_cierre; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.comentarios_no_cierre IS 'Explicación de por qué no se concretó.';


--
-- Name: COLUMN oportunidades_venta.observaciones; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.observaciones IS 'Notas operativas del vendedor.';


--
-- Name: COLUMN oportunidades_venta.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.created_at IS 'Fecha de creación.';


--
-- Name: COLUMN oportunidades_venta.updated_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.updated_at IS 'Fecha de actualización.';


--
-- Name: oportunidades_venta_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.oportunidades_venta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: oportunidades_venta_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.oportunidades_venta_id_seq OWNED BY crm.oportunidades_venta.id;


--
-- Name: reglas_seguimiento; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.reglas_seguimiento (
    empresa_id integer NOT NULL,
    tiempo_tolerancia_respuesta_a_cliente integer DEFAULT 30 NOT NULL,
    tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente integer DEFAULT 4 NOT NULL,
    tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente integer DEFAULT 24 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE reglas_seguimiento; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.reglas_seguimiento IS 'Configuración por empresa de umbrales operativos para seguimiento comercial de leads.';


--
-- Name: COLUMN reglas_seguimiento.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.empresa_id IS 'Empresa propietaria de la configuración de seguimiento.';


--
-- Name: COLUMN reglas_seguimiento.tiempo_tolerancia_respuesta_a_cliente; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_tolerancia_respuesta_a_cliente IS 'Minutos tolerados para responder a un mensaje entrante antes de escalar a riesgo.';


--
-- Name: COLUMN reglas_seguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente IS 'Horas después de un mensaje saliente a partir de las cuales el lead se considera activo sin requerir seguimiento.';


--
-- Name: COLUMN reglas_seguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente IS 'Horas máximas sin respuesta del cliente tras un mensaje saliente antes de considerar riesgo de pérdida.';


--
-- Name: almacenes; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.almacenes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    clave character varying(30) NOT NULL,
    nombre character varying(120) NOT NULL,
    tipo character varying(30) DEFAULT 'normal'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT chk_inventario_almacenes_clave_no_vacia CHECK ((btrim((clave)::text) <> ''::text)),
    CONSTRAINT chk_inventario_almacenes_nombre_no_vacio CHECK ((btrim((nombre)::text) <> ''::text)),
    CONSTRAINT chk_inventario_almacenes_tipo_no_vacio CHECK ((btrim((tipo)::text) <> ''::text))
);


--
-- Name: TABLE almacenes; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.almacenes IS 'Catálogo de almacenes por empresa para el módulo de inventario.';


--
-- Name: COLUMN almacenes.id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.id IS 'Identificador único interno del almacén.';


--
-- Name: COLUMN almacenes.empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.empresa_id IS 'Empresa a la que pertenece el almacén.';


--
-- Name: COLUMN almacenes.clave; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.clave IS 'Clave corta obligatoria del almacén, usada como identificador visible para los usuarios.';


--
-- Name: COLUMN almacenes.nombre; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.nombre IS 'Nombre descriptivo del almacén.';


--
-- Name: COLUMN almacenes.tipo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.tipo IS 'Tipo de almacén: normal, transito, virtual, produccion, consignacion, etc.';


--
-- Name: COLUMN almacenes.activo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.activo IS 'Indica si el almacén está activo para operación.';


--
-- Name: COLUMN almacenes.created_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.created_at IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN almacenes.updated_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.almacenes.updated_at IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: almacenes_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

ALTER TABLE inventario.almacenes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME inventario.almacenes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: existencias; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.existencias (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    producto_id integer NOT NULL,
    almacen_id integer NOT NULL,
    existencia numeric(18,6) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE existencias; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.existencias IS 'Existencias actuales por producto y almacén. Permite consultas rápidas sin recorrer todo el kardex.';


--
-- Name: COLUMN existencias.id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.id IS 'Identificador único del registro de existencias.';


--
-- Name: COLUMN existencias.empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.empresa_id IS 'Empresa propietaria del registro de existencias.';


--
-- Name: COLUMN existencias.producto_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.producto_id IS 'Producto al que corresponde la existencia.';


--
-- Name: COLUMN existencias.almacen_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.almacen_id IS 'Almacén donde se controla la existencia. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';


--
-- Name: COLUMN existencias.existencia; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.existencia IS 'Cantidad actual disponible del producto en el almacén.';


--
-- Name: COLUMN existencias.updated_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.updated_at IS 'Fecha y hora de última actualización del registro de existencias.';


--
-- Name: existencias_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.existencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: existencias_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.existencias_id_seq OWNED BY inventario.existencias.id;


--
-- Name: movimientos; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimientos (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    documento_id bigint,
    usuario_id bigint,
    tipo_movimiento character varying(30) NOT NULL,
    fecha date NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    es_reversion boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE movimientos; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.movimientos IS 'Encabezado de movimientos de inventario. Representa una transacción que afecta existencias, ya sea originada por documento o por captura independiente.';


--
-- Name: COLUMN movimientos.id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.id IS 'Identificador único del movimiento de inventario.';


--
-- Name: COLUMN movimientos.empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.empresa_id IS 'Empresa propietaria del movimiento.';


--
-- Name: COLUMN movimientos.documento_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.documento_id IS 'Documento origen que generó el movimiento. Puede ser NULL para ajustes, transferencias, conteos u otros movimientos independientes.';


--
-- Name: COLUMN movimientos.usuario_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.usuario_id IS 'Usuario que registró o confirmó el movimiento.';


--
-- Name: COLUMN movimientos.tipo_movimiento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.tipo_movimiento IS 'Tipo general del movimiento: compra, venta, ajuste, transferencia, conteo, merma, devolución, etc.';


--
-- Name: COLUMN movimientos.fecha; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.fecha IS 'Fecha efectiva del movimiento de inventario.';


--
-- Name: COLUMN movimientos.observaciones; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.observaciones IS 'Notas u observaciones generales relacionadas con el movimiento.';


--
-- Name: COLUMN movimientos.created_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.created_at IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN movimientos.updated_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.updated_at IS 'Fecha y hora de última actualización del registro.';


--
-- Name: COLUMN movimientos.es_reversion; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.es_reversion IS 'Indica si el movimiento fue generado como reverso por cancelación de documento.';


--
-- Name: movimientos_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.movimientos_id_seq OWNED BY inventario.movimientos.id;


--
-- Name: movimientos_partidas; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimientos_partidas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    movimiento_id bigint NOT NULL,
    documento_partida_id integer,
    producto_id integer NOT NULL,
    almacen_id integer NOT NULL,
    almacen_destino_id integer,
    fecha_movimiento date NOT NULL,
    cantidad numeric(18,6) NOT NULL,
    signo smallint NOT NULL,
    tipo_partida character varying(25) DEFAULT 'normal'::character varying NOT NULL,
    costo_unitario numeric(18,6),
    existencia_resultante numeric(18,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_inv_part_cantidad CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT chk_inv_part_signo CHECK ((signo = ANY (ARRAY['-1'::integer, 1]))),
    CONSTRAINT chk_inv_part_tipo CHECK (((tipo_partida)::text = ANY (ARRAY[('normal'::character varying)::text, ('salida_transferencia'::character varying)::text, ('entrada_transferencia'::character varying)::text])))
);


--
-- Name: TABLE movimientos_partidas; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.movimientos_partidas IS 'Detalle de movimientos de inventario. Cada fila representa una afectación física en el kardex de un producto y un almacén.';


--
-- Name: COLUMN movimientos_partidas.id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.id IS 'Identificador único de la partida del movimiento.';


--
-- Name: COLUMN movimientos_partidas.empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.empresa_id IS 'Empresa propietaria de la partida.';


--
-- Name: COLUMN movimientos_partidas.movimiento_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.movimiento_id IS 'Referencia al encabezado del movimiento de inventario.';


--
-- Name: COLUMN movimientos_partidas.documento_partida_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.documento_partida_id IS 'Referencia opcional a la partida del documento que originó la afectación.';


--
-- Name: COLUMN movimientos_partidas.producto_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.producto_id IS 'Producto afectado por la partida.';


--
-- Name: COLUMN movimientos_partidas.almacen_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.almacen_id IS 'Almacén afectado por esta partida. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';


--
-- Name: COLUMN movimientos_partidas.almacen_destino_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.almacen_destino_id IS 'Almacén destino relacionado. Se usa principalmente en transferencias. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';


--
-- Name: COLUMN movimientos_partidas.fecha_movimiento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.fecha_movimiento IS 'Fecha efectiva usada para ordenar el kardex y recalcular existencias históricas.';


--
-- Name: COLUMN movimientos_partidas.cantidad; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.cantidad IS 'Cantidad del producto afectada por la partida.';


--
-- Name: COLUMN movimientos_partidas.signo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.signo IS 'Naturaleza del movimiento: +1 entrada, -1 salida.';


--
-- Name: COLUMN movimientos_partidas.tipo_partida; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.tipo_partida IS 'Tipo de partida: normal, salida_transferencia o entrada_transferencia.';


--
-- Name: COLUMN movimientos_partidas.costo_unitario; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.costo_unitario IS 'Costo unitario del producto al momento del movimiento.';


--
-- Name: COLUMN movimientos_partidas.existencia_resultante; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.existencia_resultante IS 'Existencia del producto en el almacén inmediatamente después de aplicar esta partida.';


--
-- Name: COLUMN movimientos_partidas.created_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.created_at IS 'Fecha y hora de creación del registro.';


--
-- Name: movimientos_partidas_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.movimientos_partidas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_partidas_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.movimientos_partidas_id_seq OWNED BY inventario.movimientos_partidas.id;


--
-- Name: clientes_legacy_supplier; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.clientes_legacy_supplier (
    empresa_id integer NOT NULL,
    codigo_legacy character varying(20) NOT NULL,
    agente character varying(50),
    agente_cobranza character varying(50),
    clasificacion character varying(80),
    categoria character varying(80),
    mercado character varying(80),
    goldmine character varying(100),
    proceso_general_venta character varying(100),
    cuenta_contable character varying(50),
    descuento numeric(12,4),
    saldo_maximo_deudor numeric(12,2),
    usar_ultimo_precio boolean,
    cobrar_iva boolean,
    es_extranjero boolean,
    intercompania boolean,
    banco_cuenta_predeterminada character varying(100),
    numero_cuenta_pago character varying(100),
    comentarios_credito text,
    autorizado_por character varying(100),
    fecha_autorizacion timestamp with time zone,
    fecha_inicio_relaciones timestamp with time zone,
    fecha_ultimo_movimiento timestamp with time zone,
    bloquear_al_siguiente_dia boolean,
    usuario_bloqueo character varying(100),
    pagina_web character varying(150),
    lunes_contrarecibo boolean,
    martes_contrarecibo boolean,
    miercoles_contrarecibo boolean,
    jueves_contrarecibo boolean,
    viernes_contrarecibo boolean,
    lunes_pago boolean,
    martes_pago boolean,
    miercoles_pago boolean,
    jueves_pago boolean,
    viernes_pago boolean,
    lunes_recepcion_mercancia boolean,
    martes_recepcion_mercancia boolean,
    miercoles_recepcion_mercancia boolean,
    jueves_recepcion_mercancia boolean,
    viernes_recepcion_mercancia boolean,
    horario_contrarecibo character varying(100),
    horario_pago character varying(100),
    horario_recepcion_mercancia character varying(100),
    campo_usuario_1 character varying(150),
    campo_usuario_2 character varying(150),
    campo_usuario_3 character varying(150),
    campo_usuario_4 character varying(150),
    campo_usuario_5 character varying(150),
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clientes_legacy_supplier_json; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.clientes_legacy_supplier_json (
    id bigint NOT NULL,
    data jsonb NOT NULL,
    fecha_importacion timestamp with time zone DEFAULT now()
);


--
-- Name: clientes_legacy_supplier_json_id_seq; Type: SEQUENCE; Schema: migrate; Owner: -
--

CREATE SEQUENCE migrate.clientes_legacy_supplier_json_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientes_legacy_supplier_json_id_seq; Type: SEQUENCE OWNED BY; Schema: migrate; Owner: -
--

ALTER SEQUENCE migrate.clientes_legacy_supplier_json_id_seq OWNED BY migrate.clientes_legacy_supplier_json.id;


--
-- Name: productos_legacy_supplier; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.productos_legacy_supplier (
    empresa_id integer NOT NULL,
    clave_producto character varying(50) NOT NULL,
    proveedor_surtido character varying(150),
    proveedor_surtido_2 character varying(150),
    proveedor_surtido_3 character varying(150),
    unidad_aduana character varying(20),
    factor_equivalente_unidad_aduana numeric(18,6),
    usa_pedimento boolean,
    costo_reposicion numeric(18,6),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: productos_legacy_supplier_json; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.productos_legacy_supplier_json (
    id bigint NOT NULL,
    data jsonb NOT NULL,
    fecha_importacion timestamp with time zone DEFAULT now()
);


--
-- Name: productos_legacy_supplier_json_id_seq; Type: SEQUENCE; Schema: migrate; Owner: -
--

CREATE SEQUENCE migrate.productos_legacy_supplier_json_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_legacy_supplier_json_id_seq; Type: SEQUENCE OWNED BY; Schema: migrate; Owner: -
--

ALTER SEQUENCE migrate.productos_legacy_supplier_json_id_seq OWNED BY migrate.productos_legacy_supplier_json.id;


--
-- Name: productos_raw; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.productos_raw (
    empresa_id integer NOT NULL,
    data jsonb NOT NULL,
    fecha_importacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_clientes_legacy_supplier; Type: VIEW; Schema: migrate; Owner: -
--

CREATE VIEW migrate.v_clientes_legacy_supplier AS
 SELECT clientes_legacy_supplier_json.id AS legacy_id,
    (clientes_legacy_supplier_json.data ->> 'CLI:Codigo'::text) AS codigo_legacy,
    (clientes_legacy_supplier_json.data ->> 'CLI:Nombre'::text) AS nombre,
    (clientes_legacy_supplier_json.data ->> 'CLI:Contacto'::text) AS nombre_contacto,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:RFC'::text)), ''::text) AS rfc,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:Email'::text)), ''::text) AS email,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:Telefono1'::text)), ''::text) AS telefono,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:Telefono2'::text)), ''::text) AS telefono_secundario,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:Telefono3'::text)), ''::text) AS telefono_3,
    migrate.to_bool_legacy((clientes_legacy_supplier_json.data ->> 'CLI:Baja'::text)) AS baja,
    migrate.to_bool_legacy((clientes_legacy_supplier_json.data ->> 'CLI:Bloqueado'::text)) AS bloqueado,
    migrate.to_int_legacy((clientes_legacy_supplier_json.data ->> 'CLI:DiasCredito'::text)) AS dias_credito,
    migrate.to_numeric_legacy((clientes_legacy_supplier_json.data ->> 'CLI:LimiteCredito'::text)) AS limite_credito,
    (clientes_legacy_supplier_json.data ->> 'CLI:Observaciones'::text) AS observaciones,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:MotivoBloqueo'::text)), ''::text) AS motivo_bloqueo,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:Zona'::text)), ''::text) AS zona,
    NULLIF(TRIM(BOTH FROM (clientes_legacy_supplier_json.data ->> 'CLI:Concepto'::text)), ''::text) AS ultimo_concepto_utilizado,
    migrate.to_bool_legacy((clientes_legacy_supplier_json.data ->> 'CLI:IVADesglosado'::text)) AS iva_desglosado,
    (clientes_legacy_supplier_json.data ->> 'CLI:Domicilio'::text) AS domicilio,
    (clientes_legacy_supplier_json.data ->> 'CLI:Calle'::text) AS calle,
    (clientes_legacy_supplier_json.data ->> 'CLI:NumeroExterior'::text) AS numero_exterior,
    (clientes_legacy_supplier_json.data ->> 'CLI:NumeroInterior'::text) AS numero_interior,
    (clientes_legacy_supplier_json.data ->> 'CLI:Colonia'::text) AS colonia,
    (clientes_legacy_supplier_json.data ->> 'CLI:Ciudad'::text) AS ciudad,
    (clientes_legacy_supplier_json.data ->> 'CLI:Estado'::text) AS estado,
    (clientes_legacy_supplier_json.data ->> 'CLI:CP'::text) AS codigo_postal,
    (clientes_legacy_supplier_json.data ->> 'CLI:Pais'::text) AS pais,
    (clientes_legacy_supplier_json.data ->> 'CLI:CodigoRegimenFiscal'::text) AS codigo_regimen_fiscal,
    (clientes_legacy_supplier_json.data ->> 'CLI:UsoCFDIPredeterminado'::text) AS uso_cfdi_predeterminado,
    (clientes_legacy_supplier_json.data ->> 'CLI:FormaPagoPredeterminada'::text) AS forma_pago_predeterminada,
    (clientes_legacy_supplier_json.data ->> 'CLI:MetodoPago'::text) AS metodo_pago,
    (clientes_legacy_supplier_json.data ->> 'CLI:CodigoPaisSAT'::text) AS codigo_pais_sat,
    clientes_legacy_supplier_json.data AS raw_data
   FROM migrate.clientes_legacy_supplier_json;


--
-- Name: v_productos_legacy_supplier; Type: VIEW; Schema: migrate; Owner: -
--

CREATE VIEW migrate.v_productos_legacy_supplier AS
 SELECT productos_legacy_supplier_json.id AS legacy_id,
    (productos_legacy_supplier_json.data ->> 'PRD:Identificacion'::text) AS clave,
    (productos_legacy_supplier_json.data ->> 'PRD:Descripcion'::text) AS descripcion,
    (productos_legacy_supplier_json.data ->> 'PRD:Clasificacion'::text) AS clasificacion,
    (productos_legacy_supplier_json.data ->> 'PRD:Familia'::text) AS familia,
    (productos_legacy_supplier_json.data ->> 'PRD:Linea'::text) AS linea,
    (productos_legacy_supplier_json.data ->> 'PRD:Presentacion'::text) AS presentacion,
    (productos_legacy_supplier_json.data ->> 'PRD:Unidad'::text) AS unidad,
    (productos_legacy_supplier_json.data ->> 'PRD:UMCompra'::text) AS unidad_compra,
    (productos_legacy_supplier_json.data ->> 'PRD:UMVenta'::text) AS unidad_venta,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:Existencia'::text)) AS existencia_actual,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:MinimoParaVenta'::text)) AS cantidad_minima_venta,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:MOQ'::text)) AS cantidad_minima_compra,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:CostoEstandar'::text)) AS costo_estandar,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:CostoPromedio'::text)) AS costo_promedio,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:UltimoCosto'::text)) AS ultimo_costo,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:Tasa'::text)) AS iva_porcentaje,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:PctIEPSVentas'::text)) AS ieps_porcentaje,
    migrate.to_bool_legacy((productos_legacy_supplier_json.data ->> 'PRD:SeRetieneIVA'::text)) AS retiene_iva,
    migrate.to_bool_legacy((productos_legacy_supplier_json.data ->> 'PRD:SeRetieneISR'::text)) AS retiene_isr,
    (productos_legacy_supplier_json.data ->> 'PRD:CodigoProductoSAT'::text) AS clave_producto_sat,
    (productos_legacy_supplier_json.data ->> 'PRD:FraccionArancelaria'::text) AS fraccion_arancelaria,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:Largo'::text)) AS largo,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:Ancho'::text)) AS ancho,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:Grueso'::text)) AS espesor,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:PesoBrutoPorCarton'::text)) AS peso_por_empaque,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:PiezasPorCarton'::text)) AS piezas_por_empaque,
    (productos_legacy_supplier_json.data ->> 'PRD:UnidadPesoBruto'::text) AS unidad_peso_empaque,
    migrate.to_int_legacy((productos_legacy_supplier_json.data ->> 'PRD:TiempoSurtido'::text)) AS dias_entrega,
    (productos_legacy_supplier_json.data ->> 'PRD:Observaciones'::text) AS observaciones,
    (productos_legacy_supplier_json.data ->> 'PRD:ObservacionesCompras'::text) AS observaciones_compras,
    (productos_legacy_supplier_json.data ->> 'PRD:ObservacionesDiseno'::text) AS observaciones_diseno,
    (productos_legacy_supplier_json.data ->> 'PRD:ArchivoFotografia1'::text) AS archivo_fotografia_1,
    (productos_legacy_supplier_json.data ->> 'PRD:ArchivoFotografia2'::text) AS archivo_fotografia_2,
    (productos_legacy_supplier_json.data ->> 'PRD:ArchivoFichaTecnica'::text) AS archivo_ficha_tecnica,
    (productos_legacy_supplier_json.data ->> 'PRD:ArchivoCertificado'::text) AS archivo_certificado,
    (productos_legacy_supplier_json.data ->> 'PRD:Proveedor'::text) AS proveedor_legacy,
    (productos_legacy_supplier_json.data ->> 'PRD:Proveedor2'::text) AS proveedor_2_legacy,
    (productos_legacy_supplier_json.data ->> 'PRD:Proveedor3'::text) AS proveedor_3_legacy,
    migrate.to_bool_legacy((productos_legacy_supplier_json.data ->> 'PRD:Baja'::text)) AS baja,
    migrate.to_bool_legacy((productos_legacy_supplier_json.data ->> 'PRD:EsUnServicio'::text)) AS es_servicio,
    migrate.to_bool_legacy((productos_legacy_supplier_json.data ->> 'PRD:EsManufacturable'::text)) AS es_manufacturable,
    migrate.to_bool_legacy((productos_legacy_supplier_json.data ->> 'PRD:EsEstacional'::text)) AS es_estacional,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:DemandaMensual'::text)) AS demanda_mensual_estimado,
    migrate.to_numeric_legacy((productos_legacy_supplier_json.data ->> 'PRD:FactorDemanda'::text)) AS factor_demanda,
    productos_legacy_supplier_json.data AS raw_data
   FROM migrate.productos_legacy_supplier_json;


--
-- Name: etapas; Type: TABLE; Schema: produccion; Owner: -
--

CREATE TABLE produccion.etapas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    color character varying(20),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: etapas_id_seq; Type: SEQUENCE; Schema: produccion; Owner: -
--

CREATE SEQUENCE produccion.etapas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: etapas_id_seq; Type: SEQUENCE OWNED BY; Schema: produccion; Owner: -
--

ALTER SEQUENCE produccion.etapas_id_seq OWNED BY produccion.etapas.id;


--
-- Name: seguimientos; Type: TABLE; Schema: produccion; Owner: -
--

CREATE TABLE produccion.seguimientos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    documento_id integer NOT NULL,
    etapa_id integer,
    fecha_promesa date,
    comentarios text,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: seguimientos_id_seq; Type: SEQUENCE; Schema: produccion; Owner: -
--

CREATE SEQUENCE produccion.seguimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: produccion; Owner: -
--

ALTER SEQUENCE produccion.seguimientos_id_seq OWNED BY produccion.seguimientos.id;


--
-- Name: aplicaciones_saldo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aplicaciones_saldo (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    finanzas_operacion_id integer,
    documento_origen_id integer,
    documento_destino_id integer NOT NULL,
    monto numeric(15,2) NOT NULL,
    monto_moneda_documento numeric(15,2) NOT NULL,
    fecha_aplicacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    num_parcialidad integer,
    imp_saldo_ant numeric(20,6),
    imp_saldo_insoluto numeric(20,6),
    created_by integer,
    CONSTRAINT chk_aplicacion_origen CHECK ((((finanzas_operacion_id IS NOT NULL) AND (documento_origen_id IS NULL)) OR ((finanzas_operacion_id IS NULL) AND (documento_origen_id IS NOT NULL))))
);


--
-- Name: TABLE aplicaciones_saldo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.aplicaciones_saldo IS 'Registra aplicaciones de saldo desde pagos o notas de crédito hacia documentos destino (por ejemplo facturas). Soporta multimoneda.';


--
-- Name: COLUMN aplicaciones_saldo.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.id IS 'Identificador único de la aplicación.';


--
-- Name: COLUMN aplicaciones_saldo.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.empresa_id IS 'Empresa a la que pertenece la aplicación (soporte multiempresa).';


--
-- Name: COLUMN aplicaciones_saldo.finanzas_operacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.finanzas_operacion_id IS 'Origen de la aplicación cuando proviene de una operación financiera (pago de banco o caja).';


--
-- Name: COLUMN aplicaciones_saldo.documento_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.documento_origen_id IS 'Origen de la aplicación cuando proviene de un documento (por ejemplo una nota de crédito).';


--
-- Name: COLUMN aplicaciones_saldo.documento_destino_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.documento_destino_id IS 'Documento que recibe la aplicación de saldo (factura, factura_compra, etc.).';


--
-- Name: COLUMN aplicaciones_saldo.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.monto IS 'Monto aplicado en moneda base del sistema (por ejemplo MXN). Se descuenta del saldo del origen.';


--
-- Name: COLUMN aplicaciones_saldo.monto_moneda_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.monto_moneda_documento IS 'Monto aplicado expresado en la moneda del documento destino. Se utiliza para calcular el saldo del documento destino.';


--
-- Name: COLUMN aplicaciones_saldo.fecha_aplicacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.fecha_aplicacion IS 'Fecha efectiva en la que se realiza la aplicación del saldo.';


--
-- Name: COLUMN aplicaciones_saldo.fecha_creacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.fecha_creacion IS 'Fecha en que se creó el registro de la aplicación en el sistema.';


--
-- Name: COLUMN aplicaciones_saldo.num_parcialidad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.num_parcialidad IS 'Número de parcialidad SAT (1-based). Cuenta cuántas aplicaciones previas existen
para el mismo documento_destino_id en el momento del INSERT. Calculado dentro de
la misma transacción con FOR UPDATE sobre el documento destino.';


--
-- Name: COLUMN aplicaciones_saldo.imp_saldo_ant; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.imp_saldo_ant IS 'Saldo de la factura (documento_destino) antes de esta aplicación, en la moneda
del documento destino. Equivale al campo ImpSaldoAnterior del complemento SAT
Pagos 2.0. Calculado como: total_factura - SUM(monto_moneda_documento) de
aplicaciones previas al momento del INSERT.';


--
-- Name: COLUMN aplicaciones_saldo.imp_saldo_insoluto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.imp_saldo_insoluto IS 'Saldo de la factura (documento_destino) después de esta aplicación, en la moneda
del documento destino. Equivale al campo ImpSaldoInsoluto del complemento SAT
Pagos 2.0. Calculado como: imp_saldo_ant - monto_moneda_documento.';


--
-- Name: COLUMN aplicaciones_saldo.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.created_by IS 'ID del usuario que registró la aplicación de saldo (ref. tabla usuarios). NULL en registros anteriores a Fase 1.';


--
-- Name: aplicaciones_saldo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aplicaciones_saldo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aplicaciones_saldo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aplicaciones_saldo_id_seq OWNED BY public.aplicaciones_saldo.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    empresa_id bigint,
    usuario_id bigint NOT NULL,
    modulo character varying(100) NOT NULL,
    entidad character varying(100) NOT NULL,
    entidad_id character varying(100),
    accion character varying(50) NOT NULL,
    descripcion text,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    ip_address inet,
    user_agent text,
    origen character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: autorizaciones_reglas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autorizaciones_reglas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    transicion_id integer NOT NULL,
    monto_minimo numeric(18,4),
    monto_maximo numeric(18,4),
    modo character varying(20) DEFAULT 'flujo'::character varying NOT NULL,
    rol_autorizador_id integer,
    usuario_autorizador_id integer,
    nivel smallint DEFAULT 1 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT autorizaciones_reglas_modo_check CHECK (((modo)::text = ANY ((ARRAY['ninguna'::character varying, 'directa'::character varying, 'flujo'::character varying])::text[]))),
    CONSTRAINT ck_autorizador_segun_modo CHECK ((((modo)::text = 'ninguna'::text) OR ((rol_autorizador_id IS NOT NULL) AND (usuario_autorizador_id IS NULL)) OR ((rol_autorizador_id IS NULL) AND (usuario_autorizador_id IS NOT NULL))))
);


--
-- Name: TABLE autorizaciones_reglas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.autorizaciones_reglas IS 'Políticas de autorización por transición documental y rango de monto. Define si una transición (ej. cotización → factura) requiere autorización y bajo qué modo. Invariante: no pueden existir dos filas activas con la misma transicion_id cuyos rangos [monto_minimo, monto_maximo] se solapen; esta regla se valida en la capa de negocio al insertar o actualizar.';


--
-- Name: COLUMN autorizaciones_reglas.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.id IS 'Identificador interno de la política.';


--
-- Name: COLUMN autorizaciones_reglas.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.empresa_id IS 'Empresa a la que pertenece esta política. Referencia core.empresas.';


--
-- Name: COLUMN autorizaciones_reglas.transicion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.transicion_id IS 'Transición documental a la que aplica la política. Referencia core.empresas_tipos_documento_transiciones; contiene el par (tipo_documento_origen, tipo_documento_destino) habilitado para la empresa.';


--
-- Name: COLUMN autorizaciones_reglas.monto_minimo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.monto_minimo IS 'Límite inferior del rango de monto (inclusive). NULL significa sin límite inferior (aplica desde cero).';


--
-- Name: COLUMN autorizaciones_reglas.monto_maximo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.monto_maximo IS 'Límite superior del rango de monto (inclusive). NULL significa sin límite superior (aplica hasta cualquier monto).';


--
-- Name: COLUMN autorizaciones_reglas.modo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.modo IS 'Modo de autorización: ninguna = libre, sin restricción; directa = solo usuarios con el rol/usuario asignado pueden ejecutar la transición; flujo = se crea una solicitud formal y el documento queda bloqueado hasta que el autorizador responda.';


--
-- Name: COLUMN autorizaciones_reglas.rol_autorizador_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.rol_autorizador_id IS 'Rol que puede autorizar la transición en modos directa y flujo. Mutuamente excluyente con usuario_autorizador_id. NULL cuando modo=ninguna.';


--
-- Name: COLUMN autorizaciones_reglas.usuario_autorizador_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.usuario_autorizador_id IS 'Usuario específico que puede autorizar la transición en modos directa y flujo. Mutuamente excluyente con rol_autorizador_id. NULL cuando modo=ninguna.';


--
-- Name: COLUMN autorizaciones_reglas.nivel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.nivel IS 'Nivel de autorización en cadena. Reservado para uso futuro (cadenas de aprobación multinivel). Sprint 2 usa siempre nivel = 1.';


--
-- Name: COLUMN autorizaciones_reglas.activa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.activa IS 'Soft-delete: false oculta la política sin eliminarla. Las políticas inactivas no se evalúan en tiempo de ejecución ni participan en la validación de traslape.';


--
-- Name: COLUMN autorizaciones_reglas.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.created_at IS 'Marca de tiempo de creación del registro (UTC).';


--
-- Name: COLUMN autorizaciones_reglas.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.updated_at IS 'Marca de tiempo de la última modificación del registro (UTC).';


--
-- Name: CONSTRAINT ck_autorizador_segun_modo ON autorizaciones_reglas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT ck_autorizador_segun_modo ON public.autorizaciones_reglas IS 'Garantiza coherencia entre modo y autorizador: modo ninguna no requiere autorizador; modos directa y flujo requieren exactamente uno (rol XOR usuario).';


--
-- Name: autorizaciones_reglas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.autorizaciones_reglas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: autorizaciones_reglas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.autorizaciones_reglas_id_seq OWNED BY public.autorizaciones_reglas.id;


--
-- Name: autorizaciones_solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autorizaciones_solicitudes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    regla_id integer NOT NULL,
    documento_origen_id integer NOT NULL,
    tipo_documento_origen character varying(60) NOT NULL,
    tipo_documento_destino character varying(60) NOT NULL,
    folio_documento_origen character varying(60),
    monto numeric(18,4) NOT NULL,
    usuario_solicitante_id integer NOT NULL,
    usuario_autorizador_id integer,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    comentario_solicitante text,
    comentario_autorizador text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    respondido_at timestamp with time zone,
    CONSTRAINT autorizaciones_solicitudes_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'cancelada'::character varying])::text[])))
);


--
-- Name: TABLE autorizaciones_solicitudes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.autorizaciones_solicitudes IS 'Registro de solicitudes formales de autorización generadas por el modo=flujo. Se crea una fila cuando un usuario intenta ejecutar una transición sujeta a flujo y el documento aún no está aprobado. El documento origen queda en estado_autorizacion=pendiente hasta que el autorizador responde o el solicitante cancela. Los campos tipo_documento_* y folio_documento_origen se copian del documento en el momento de la solicitud para preservar el historial aunque el documento sea modificado o cancelado posteriormente.';


--
-- Name: COLUMN autorizaciones_solicitudes.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.id IS 'Identificador interno de la solicitud.';


--
-- Name: COLUMN autorizaciones_solicitudes.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.empresa_id IS 'Empresa a la que pertenece la solicitud. Referencia core.empresas.';


--
-- Name: COLUMN autorizaciones_solicitudes.regla_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.regla_id IS 'Política de autorización que disparó la creación de esta solicitud. Referencia autorizaciones_reglas.';


--
-- Name: COLUMN autorizaciones_solicitudes.documento_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.documento_origen_id IS 'Documento cuya transición está pendiente de aprobación. Referencia public.documentos.';


--
-- Name: COLUMN autorizaciones_solicitudes.tipo_documento_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.tipo_documento_origen IS 'Código del tipo de documento origen en el momento de crear la solicitud (ej. cotizacion). Desnormalizado para preservar historial.';


--
-- Name: COLUMN autorizaciones_solicitudes.tipo_documento_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.tipo_documento_destino IS 'Código del tipo de documento que se intentó generar (ej. factura). Desnormalizado para preservar historial.';


--
-- Name: COLUMN autorizaciones_solicitudes.folio_documento_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.folio_documento_origen IS 'Folio (serie + número) del documento origen en el momento de crear la solicitud. Desnormalizado para mostrar en la bandeja sin join adicional.';


--
-- Name: COLUMN autorizaciones_solicitudes.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.monto IS 'Total del documento origen en el momento de crear la solicitud. Determina qué política aplica; se congela aquí para que un cambio posterior en el documento no altere la solicitud en curso.';


--
-- Name: COLUMN autorizaciones_solicitudes.usuario_solicitante_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.usuario_solicitante_id IS 'Usuario que intentó ejecutar la transición y desencadenó la solicitud. Referencia core.usuarios.';


--
-- Name: COLUMN autorizaciones_solicitudes.usuario_autorizador_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.usuario_autorizador_id IS 'Usuario que efectivamente respondió la solicitud (aprobó o rechazó). Puede diferir del autorizador asignado por la regla si el rol permite a varios usuarios responder. NULL mientras la solicitud esté pendiente.';


--
-- Name: COLUMN autorizaciones_solicitudes.estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.estado IS 'Estado del ciclo de vida de la solicitud: pendiente (en espera de respuesta), aprobada (autorizador aprobó; el documento pasa a estado_autorizacion=aprobada), rechazada (autorizador rechazó), cancelada (el solicitante retiró la solicitud; el documento vuelve a estado_autorizacion=no_requerida).';


--
-- Name: COLUMN autorizaciones_solicitudes.comentario_solicitante; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.comentario_solicitante IS 'Comentario opcional que el solicitante puede incluir al crear la solicitud.';


--
-- Name: COLUMN autorizaciones_solicitudes.comentario_autorizador; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.comentario_autorizador IS 'Comentario opcional que el autorizador incluye al aprobar o rechazar.';


--
-- Name: COLUMN autorizaciones_solicitudes.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.created_at IS 'Marca de tiempo de creación de la solicitud (UTC).';


--
-- Name: COLUMN autorizaciones_solicitudes.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.updated_at IS 'Marca de tiempo de la última modificación (UTC). Se actualiza al responder o cancelar.';


--
-- Name: COLUMN autorizaciones_solicitudes.respondido_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.respondido_at IS 'Marca de tiempo en que el autorizador respondió (aprobó o rechazó). NULL mientras la solicitud esté pendiente o cancelada.';


--
-- Name: autorizaciones_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.autorizaciones_solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: autorizaciones_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.autorizaciones_solicitudes_id_seq OWNED BY public.autorizaciones_solicitudes.id;


--
-- Name: conceptos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conceptos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre_concepto character varying(60) NOT NULL,
    es_gasto boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    rubro_presupuesto_id integer,
    observaciones text,
    cuenta_contable character varying(30),
    orden integer DEFAULT 0,
    color character varying(20)
);


--
-- Name: COLUMN conceptos.cuenta_contable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conceptos.cuenta_contable IS 'Cuenta contable asociada al concepto. Se utilizará en el módulo de contabilidad.';


--
-- Name: COLUMN conceptos.orden; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conceptos.orden IS 'Orden de presentación del concepto en listas y dropdowns.';


--
-- Name: COLUMN conceptos.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conceptos.color IS 'Color opcional para representar el concepto en reportes o gráficos.';


--
-- Name: conceptos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conceptos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conceptos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conceptos_id_seq OWNED BY public.conceptos.id;


--
-- Name: contactos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_contacto public.tipo_contacto_enum DEFAULT 'Cliente'::public.tipo_contacto_enum NOT NULL,
    nombre character varying(150) NOT NULL,
    rfc character varying(13),
    email character varying(150),
    telefono character varying(30),
    activo boolean DEFAULT true NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    dias_credito smallint,
    limite_credito numeric(12,2),
    vendedor_id integer,
    fecha_alta timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    motivo_bloqueo character varying(100),
    zona character varying(20),
    ultimo_concepto_utilizado character varying(50),
    iva_desglosado boolean,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    telefono_secundario character varying(15),
    codigo_legacy character varying(20),
    precio_lista_id bigint,
    nombre_contacto character varying(150),
    interes_inicial character varying(500)
);


--
-- Name: COLUMN contactos.precio_lista_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contactos.precio_lista_id IS 'Lista de precios asignada directamente al contacto. Tiene prioridad sobre la lista derivada de campos configurables.';


--
-- Name: COLUMN contactos.nombre_contacto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contactos.nombre_contacto IS 'Nombre de la persona de contacto asociado a la empresa del contacto';


--
-- Name: COLUMN contactos.interes_inicial; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contactos.interes_inicial IS 'Interés inicial capturado para seguimiento comercial del contacto';


--
-- Name: contactos_datos_fiscales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos_datos_fiscales (
    id integer NOT NULL,
    contacto_id integer NOT NULL,
    rfc character varying(20) NOT NULL,
    curp character varying(18),
    regimen_fiscal character varying(10),
    uso_cfdi character varying(10),
    forma_pago character varying(10),
    metodo_pago character varying(10),
    enviar_cfd boolean DEFAULT true NOT NULL,
    enviar_cfd_agente boolean DEFAULT false NOT NULL,
    es_publico_general boolean DEFAULT false NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contactos_datos_fiscales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contactos_datos_fiscales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contactos_datos_fiscales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contactos_datos_fiscales_id_seq OWNED BY public.contactos_datos_fiscales.id;


--
-- Name: contactos_domicilios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos_domicilios (
    id integer NOT NULL,
    contacto_id integer NOT NULL,
    identificador character varying(60) NOT NULL,
    es_principal boolean DEFAULT false NOT NULL,
    responsable character varying(100),
    calle character varying(100),
    numero_exterior character varying(20),
    numero_interior character varying(20),
    colonia character varying(60),
    ciudad character varying(60),
    estado character varying(40),
    cp character varying(10),
    pais character varying(40) DEFAULT 'México'::character varying,
    cruces text,
    recibe character varying(100),
    telefono_recibe character varying(20),
    telefono character varying(20),
    fax character varying(20),
    observaciones text,
    cp_sat text,
    colonia_sat text
);


--
-- Name: contactos_domicilios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contactos_domicilios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contactos_domicilios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contactos_domicilios_id_seq OWNED BY public.contactos_domicilios.id;


--
-- Name: contactos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contactos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contactos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contactos_id_seq OWNED BY public.contactos.id;


--
-- Name: credito_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito_operaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer NOT NULL,
    documento_id integer,
    tipo_operacion character varying(20) NOT NULL,
    fecha date NOT NULL,
    monto numeric(15,2) NOT NULL,
    referencia character varying(100),
    observaciones text,
    usuario_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_credito_operaciones_tipo CHECK (((tipo_operacion)::text = ANY (ARRAY[('cargo'::character varying)::text, ('abono'::character varying)::text, ('ajuste'::character varying)::text])))
);


--
-- Name: credito_operaciones_aplicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito_operaciones_aplicaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    operacion_origen_id integer NOT NULL,
    operacion_aplicada_id integer NOT NULL,
    fecha date NOT NULL,
    monto_aplicado numeric(15,2) NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_oca_monto CHECK ((monto_aplicado > (0)::numeric))
);


--
-- Name: credito_operaciones_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito_operaciones_items (
    id integer NOT NULL,
    operacion_credito_id integer NOT NULL,
    documento_id integer,
    partida_id integer,
    producto_id integer,
    cantidad numeric(15,6),
    monto numeric(15,2) NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_ruteo_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_ruteo_leads (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    origen character varying(50) NOT NULL,
    modo_asignacion character varying(20) NOT NULL,
    vendedor_fijo_id integer,
    ultimo_vendedor_id integer,
    prioridad integer DEFAULT 1,
    activo boolean DEFAULT true NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp with time zone,
    CONSTRAINT chk_crl_modo_asignacion CHECK (((modo_asignacion)::text = ANY (ARRAY[('round_robin'::character varying)::text, ('fijo'::character varying)::text, ('prioridad'::character varying)::text])))
);


--
-- Name: crm_ruteo_leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_ruteo_leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_ruteo_leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_ruteo_leads_id_seq OWNED BY public.crm_ruteo_leads.id;


--
-- Name: documentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos (
    id integer NOT NULL,
    tipo_documento character varying(30) NOT NULL,
    estatus_documento character varying(30) NOT NULL,
    serie character varying(10),
    numero integer,
    empresa_id integer NOT NULL,
    almacen_id integer,
    contacto_principal_id integer NOT NULL,
    contacto_facturacion_id integer,
    contacto_entrega_id integer,
    agente_id integer,
    fecha_documento date NOT NULL,
    fecha_vencimiento date,
    fecha_entrega date,
    fecha_cancelacion date,
    moneda character varying(10) DEFAULT 'MXN'::character varying NOT NULL,
    tipo_cambio numeric(9,4),
    subtotal numeric(15,2) NOT NULL,
    descuento_global numeric(9,4),
    descuento numeric(15,2),
    iva numeric(15,2),
    ieps numeric(15,2),
    retencion_iva numeric(15,2),
    retencion_isr numeric(15,2),
    total numeric(15,2) NOT NULL,
    saldo numeric(15,2),
    domicilio_entrega_id integer,
    fletera_id integer,
    observaciones text,
    comentarios_internos text,
    documento_origen_id integer,
    documento_padre_id integer,
    documento_relacionado_id integer,
    es_restitucion boolean DEFAULT false NOT NULL,
    es_publico_general boolean DEFAULT false NOT NULL,
    usuario_creacion_id integer NOT NULL,
    usuario_modificacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_modificacion timestamp with time zone,
    rfc_receptor character varying(13),
    nombre_receptor text,
    regimen_fiscal_receptor text,
    uso_cfdi text,
    forma_pago text,
    metodo_pago text,
    codigo_postal_receptor character varying(10),
    tratamiento_impuestos character varying(30) DEFAULT 'normal'::character varying NOT NULL,
    estado_seguimiento text DEFAULT 'borrador'::text,
    comentario_seguimiento text,
    producto_resumen text,
    oportunidad_id integer,
    motivo_nc character varying(20),
    concepto_id integer,
    finanzas_operacion_id integer,
    periodicidad_global character varying(2) DEFAULT NULL::character varying,
    meses_global character varying(2) DEFAULT NULL::character varying,
    anio_global smallint,
    factura_global_id integer,
    usuario_cancelacion_id integer,
    motivo_cancelacion text,
    motivo_sat character varying(2),
    uuid_sustitucion character varying(36),
    estado_autorizacion character varying(20) DEFAULT 'no_requerida'::character varying,
    serie_externa character varying(10),
    numero_externo integer,
    CONSTRAINT chk_documentos_motivo_nc CHECK (((motivo_nc IS NULL) OR ((motivo_nc)::text = ANY ((ARRAY['devolucion'::character varying, 'bonificacion'::character varying, 'otro'::character varying])::text[])))),
    CONSTRAINT documentos_estado_autorizacion_check CHECK (((estado_autorizacion)::text = ANY ((ARRAY['no_requerida'::character varying, 'pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying])::text[])))
);


--
-- Name: TABLE documentos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos IS 'Tabla universal de documentos del ERP (cotizaciones, pedidos, facturas, etc.).';


--
-- Name: COLUMN documentos.almacen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.almacen_id IS 'Almacén predeterminado del documento. Se usa cuando la partida no especifica uno.';


--
-- Name: COLUMN documentos.tratamiento_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.tratamiento_impuestos IS 'Define el tratamiento fiscal del documento. Valores esperados: normal, sin_iva, tasa_cero, exento, venta_publico_general, factura_global. Determina cómo se calculan los impuestos y el tratamiento fiscal/operativo del documento.';


--
-- Name: COLUMN documentos.motivo_nc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.motivo_nc IS 'Motivo de la nota de crédito. Valores esperados: devolucion, bonificacion, otro.';


--
-- Name: COLUMN documentos.concepto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.concepto_id IS 'Concepto contable/comercial asociado al documento. Utilizado para contabilización y clasificación.';


--
-- Name: COLUMN documentos.periodicidad_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.periodicidad_global IS 'Código SAT de periodicidad para factura global: 01=Diario, 02=Semanal, 03=Quincenal, 04=Mensual, 05=Bimestral';


--
-- Name: COLUMN documentos.meses_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.meses_global IS 'Código SAT de mes(es) para factura global: 01-12 mensual, 13-18 bimestral';


--
-- Name: COLUMN documentos.anio_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.anio_global IS 'Año de la factura global (4 dígitos)';


--
-- Name: COLUMN documentos.factura_global_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.factura_global_id IS 'Para ventas publico_general: ID de la factura global que las incluye. Evita doble agrupación.';


--
-- Name: COLUMN documentos.usuario_cancelacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.usuario_cancelacion_id IS 'Usuario que ejecutó la cancelación del documento';


--
-- Name: COLUMN documentos.motivo_cancelacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.motivo_cancelacion IS 'Motivo interno de cancelación capturado por el usuario';


--
-- Name: COLUMN documentos.motivo_sat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.motivo_sat IS 'Motivo SAT de cancelación CFDI (ejemplo: 01, 02, 03, 04)';


--
-- Name: COLUMN documentos.uuid_sustitucion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.uuid_sustitucion IS 'UUID del CFDI sustituto cuando el motivo SAT requiere sustitución';


--
-- Name: COLUMN documentos.estado_autorizacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.estado_autorizacion IS 'Ciclo de vida de autorización del documento. Valores: no_requerida (sin política activa o modo ninguna/directa), pendiente (solicitud de flujo creada y en espera), aprobada (autorizador aprobó; habilita re-ejecución de la transición), rechazada (autorizador rechazó). Solo modo=flujo transiciona entre pendiente/aprobada/rechazada; los otros modos permanecen en no_requerida.';


--
-- Name: documentos_campos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_campos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    documento_id integer NOT NULL,
    campo_id integer NOT NULL,
    catalogo_id integer,
    valor_texto text,
    valor_numero numeric,
    valor_fecha date,
    valor_boolean boolean,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE documentos_campos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_campos IS 'Almacena los valores capturados de campos dinámicos asociados al encabezado de documentos.';


--
-- Name: COLUMN documentos_campos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.id IS 'Identificador único del registro.';


--
-- Name: COLUMN documentos_campos.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.empresa_id IS 'Empresa propietaria del registro.';


--
-- Name: COLUMN documentos_campos.documento_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.documento_id IS 'Referencia al documento donde se capturó el valor dinámico.';


--
-- Name: COLUMN documentos_campos.campo_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.campo_id IS 'Referencia al campo configurado en core.campos_configuracion.';


--
-- Name: COLUMN documentos_campos.catalogo_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.catalogo_id IS 'Referencia al valor del catálogo cuando el campo dinámico es tipo lista.';


--
-- Name: COLUMN documentos_campos.valor_texto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_texto IS 'Valor capturado cuando el tipo de dato es texto.';


--
-- Name: COLUMN documentos_campos.valor_numero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_numero IS 'Valor capturado cuando el tipo de dato es numérico.';


--
-- Name: COLUMN documentos_campos.valor_fecha; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_fecha IS 'Valor capturado cuando el tipo de dato es fecha.';


--
-- Name: COLUMN documentos_campos.valor_boolean; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_boolean IS 'Valor capturado cuando el tipo de dato es booleano.';


--
-- Name: COLUMN documentos_campos.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.created_at IS 'Fecha de creación del registro.';


--
-- Name: documentos_campos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_campos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_campos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_campos_id_seq OWNED BY public.documentos_campos.id;


--
-- Name: documentos_cancelacion_intentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_cancelacion_intentos (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    documento_id integer NOT NULL,
    usuario_id integer NOT NULL,
    estado character varying(40) NOT NULL,
    motivo_cancelacion text,
    motivo_sat character varying(2),
    uuid_sustitucion character varying(36),
    cfdi_uuid character varying(36),
    facturama_respuesta jsonb,
    error_externo_mensaje text,
    error_interno_mensaje text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documentos_cancelacion_intentos_estado_check CHECK (((estado)::text = ANY ((ARRAY['iniciado'::character varying, 'error_externo'::character varying, 'externo_ok'::character varying, 'completado'::character varying, 'externo_ok_interno_pendiente'::character varying, 'error_interno'::character varying])::text[])))
);


--
-- Name: TABLE documentos_cancelacion_intentos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_cancelacion_intentos IS 'Seguimiento de intentos de cancelación de documentos (saga corta)';


--
-- Name: COLUMN documentos_cancelacion_intentos.estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.estado IS 'iniciado | error_externo | externo_ok | completado | externo_ok_interno_pendiente | error_interno';


--
-- Name: COLUMN documentos_cancelacion_intentos.cfdi_uuid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.cfdi_uuid IS 'UUID del CFDI que fue cancelado en Facturama (NULL si el documento no tenía CFDI timbrado)';


--
-- Name: COLUMN documentos_cancelacion_intentos.facturama_respuesta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.facturama_respuesta IS 'Respuesta JSON devuelta por Facturama al cancelar el CFDI';


--
-- Name: COLUMN documentos_cancelacion_intentos.error_externo_mensaje; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.error_externo_mensaje IS 'Mensaje de error cuando Facturama rechazó la cancelación';


--
-- Name: COLUMN documentos_cancelacion_intentos.error_interno_mensaje; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.error_interno_mensaje IS 'Mensaje de error cuando la transacción interna falló';


--
-- Name: documentos_cancelacion_intentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_cancelacion_intentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_cancelacion_intentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_cancelacion_intentos_id_seq OWNED BY public.documentos_cancelacion_intentos.id;


--
-- Name: documentos_cfdi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_cfdi (
    documento_id integer NOT NULL,
    uuid character varying(36) NOT NULL,
    fecha_timbrado timestamp with time zone NOT NULL,
    version_cfdi character varying(10),
    serie_cfdi character varying(10),
    folio_cfdi character varying(20),
    no_certificado character varying(30),
    no_certificado_sat character varying(30),
    sello_cfdi text,
    sello_sat text,
    cadena_original text,
    xml_timbrado text,
    qr_url text,
    estado_sat character varying(20),
    fecha_cancelacion timestamp with time zone,
    xml_cancelacion text,
    fecha_emision timestamp with time zone,
    rfc_proveedor_certificacion character varying(20),
    pac character varying(20),
    pac_id character varying(50),
    rfc_emisor text,
    rfc_receptor text,
    total numeric(14,2)
);


--
-- Name: documentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_id_seq OWNED BY public.documentos.id;


--
-- Name: documentos_partidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_partidas (
    id integer NOT NULL,
    documento_id integer NOT NULL,
    numero_partida integer NOT NULL,
    producto_id integer,
    descripcion_alterna character varying(255),
    cantidad numeric(15,6) NOT NULL,
    unidad character varying(20),
    factor_conversion numeric(11,4),
    cantidad_inventariable numeric(15,6),
    precio_unitario numeric(15,6) NOT NULL,
    descuento numeric(9,4),
    subtotal_partida numeric(15,2) NOT NULL,
    iva_porcentaje numeric(9,4),
    iva_monto numeric(15,2),
    ieps_porcentaje numeric(9,4),
    ieps_monto numeric(15,2),
    retencion_iva_porcentaje numeric(9,4),
    retencion_iva_monto numeric(15,2),
    retencion_isr_porcentaje numeric(9,4),
    retencion_isr_monto numeric(15,2),
    total_partida numeric(15,2) NOT NULL,
    costo numeric(15,6),
    costo_indirecto numeric(15,6),
    cantidad_entregada numeric(15,6),
    cantidad_facturada numeric(15,6),
    cantidad_cancelada numeric(15,6),
    cantidad_devuelta numeric(15,6),
    cantidad_en_entrada numeric(15,6),
    saldo_cantidad numeric(15,6),
    es_gasto boolean DEFAULT false NOT NULL,
    es_componente boolean DEFAULT false NOT NULL,
    partida_padre_id integer,
    partida_origen_id integer,
    titulo_agrupador character varying(70),
    archivo_imagen_1 character varying(255),
    archivo_imagen_2 character varying(255),
    observaciones text,
    comentarios_internos text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_modificacion timestamp with time zone,
    es_parte_oportunidad boolean DEFAULT true,
    producto_archivo_id integer,
    precio_lista_id bigint,
    precio_editado_manual boolean DEFAULT false NOT NULL,
    precio_origen character varying(30),
    almacen_id integer
);


--
-- Name: COLUMN documentos_partidas.es_parte_oportunidad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas.es_parte_oportunidad IS 'Indica si la partida de la cotizacion debe considerarse dentro del monto real de la oportunidad comercial. Permite distinguir entre el total completo cotizado y las partidas que efectivamente cuentan para pipeline, forecast y valor comercial de la oportunidad.';


--
-- Name: COLUMN documentos_partidas.precio_lista_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas.precio_lista_id IS 'Lista de precios utilizada para resolver automáticamente el precio de la partida.';


--
-- Name: COLUMN documentos_partidas.precio_editado_manual; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas.precio_editado_manual IS 'Indica si el precio unitario fue modificado manualmente por el usuario después de ser sugerido por el sistema.';


--
-- Name: COLUMN documentos_partidas.precio_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas.precio_origen IS 'Origen del precio unitario. Ejemplos: LISTA, DEFAULT, MANUAL, LEGACY.';


--
-- Name: COLUMN documentos_partidas.almacen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas.almacen_id IS 'Almacén específico de la partida. Si es NULL, se usa el almacén del documento.';


--
-- Name: documentos_partidas_campos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_partidas_campos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    partida_id integer NOT NULL,
    campo_id integer NOT NULL,
    catalogo_id integer,
    valor_texto text,
    valor_numero numeric,
    valor_fecha date,
    valor_boolean boolean,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE documentos_partidas_campos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_partidas_campos IS 'Almacena los valores capturados de campos dinámicos asociados a partidas de documentos.';


--
-- Name: COLUMN documentos_partidas_campos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.id IS 'Identificador único del registro de valor dinámico.';


--
-- Name: COLUMN documentos_partidas_campos.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.empresa_id IS 'Empresa propietaria del registro.';


--
-- Name: COLUMN documentos_partidas_campos.partida_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.partida_id IS 'Referencia a la partida del documento donde se capturó el campo dinámico.';


--
-- Name: COLUMN documentos_partidas_campos.campo_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.campo_id IS 'Referencia al campo definido en la tabla core.campos_configuracion.';


--
-- Name: COLUMN documentos_partidas_campos.catalogo_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.catalogo_id IS 'Referencia al valor del catálogo cuando el campo dinámico es tipo lista.';


--
-- Name: COLUMN documentos_partidas_campos.valor_texto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.valor_texto IS 'Valor capturado cuando el tipo de dato del campo es texto.';


--
-- Name: COLUMN documentos_partidas_campos.valor_numero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.valor_numero IS 'Valor capturado cuando el tipo de dato del campo es numérico.';


--
-- Name: COLUMN documentos_partidas_campos.valor_fecha; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.valor_fecha IS 'Valor capturado cuando el tipo de dato del campo es fecha.';


--
-- Name: COLUMN documentos_partidas_campos.valor_boolean; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.valor_boolean IS 'Valor capturado cuando el tipo de dato del campo es booleano.';


--
-- Name: COLUMN documentos_partidas_campos.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_campos.created_at IS 'Fecha y hora de creación del registro.';


--
-- Name: documentos_partidas_campos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_partidas_campos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_partidas_campos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_partidas_campos_id_seq OWNED BY public.documentos_partidas_campos.id;


--
-- Name: documentos_partidas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_partidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_partidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_partidas_id_seq OWNED BY public.documentos_partidas.id;


--
-- Name: documentos_partidas_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_partidas_impuestos (
    id integer NOT NULL,
    partida_id integer NOT NULL,
    impuesto_id character varying(30) NOT NULL,
    tasa numeric(9,4) NOT NULL,
    base numeric(15,2) NOT NULL,
    monto numeric(15,2) NOT NULL
);


--
-- Name: TABLE documentos_partidas_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_partidas_impuestos IS 'Impuestos aplicados a cada partida de documento. Permite múltiples impuestos por partida (IVA, IEPS, retenciones).';


--
-- Name: COLUMN documentos_partidas_impuestos.partida_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.partida_id IS 'Referencia a la partida del documento.';


--
-- Name: COLUMN documentos_partidas_impuestos.impuesto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.impuesto_id IS 'Impuesto aplicado a la partida.';


--
-- Name: COLUMN documentos_partidas_impuestos.tasa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.tasa IS 'Tasa del impuesto utilizada al momento del cálculo.';


--
-- Name: COLUMN documentos_partidas_impuestos.base; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.base IS 'Base sobre la cual se calcula el impuesto.';


--
-- Name: COLUMN documentos_partidas_impuestos.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.monto IS 'Monto calculado del impuesto.';


--
-- Name: documentos_partidas_impuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_partidas_impuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_partidas_impuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_partidas_impuestos_id_seq OWNED BY public.documentos_partidas_impuestos.id;


--
-- Name: documentos_partidas_vinculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_partidas_vinculos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    documento_origen_id integer NOT NULL,
    documento_destino_id integer NOT NULL,
    partida_origen_id integer NOT NULL,
    partida_destino_id integer NOT NULL,
    cantidad numeric(15,6) NOT NULL,
    usuario_creacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE documentos_partidas_vinculos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_partidas_vinculos IS 'Tabla que registra vínculos entre partidas de documentos permitiendo relaciones muchos-a-muchos y control de cantidades aplicadas entre documentos (pedido, factura, entrega, recepción, etc.).';


--
-- Name: COLUMN documentos_partidas_vinculos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.id IS 'Identificador único del vínculo entre partidas.';


--
-- Name: COLUMN documentos_partidas_vinculos.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.empresa_id IS 'Empresa a la que pertenece el vínculo entre partidas.';


--
-- Name: COLUMN documentos_partidas_vinculos.documento_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.documento_origen_id IS 'Documento del cual proviene la partida origen.';


--
-- Name: COLUMN documentos_partidas_vinculos.documento_destino_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.documento_destino_id IS 'Documento que recibe o consume la cantidad.';


--
-- Name: COLUMN documentos_partidas_vinculos.partida_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.partida_origen_id IS 'Partida que origina la cantidad (ejemplo: partida del pedido o requisición).';


--
-- Name: COLUMN documentos_partidas_vinculos.partida_destino_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.partida_destino_id IS 'Partida que consume o aplica la cantidad (ejemplo: partida de factura, entrega o recepción).';


--
-- Name: COLUMN documentos_partidas_vinculos.cantidad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.cantidad IS 'Cantidad aplicada desde la partida origen hacia la partida destino.';


--
-- Name: COLUMN documentos_partidas_vinculos.usuario_creacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.usuario_creacion_id IS 'Usuario que registró la creación del vínculo entre partidas.';


--
-- Name: COLUMN documentos_partidas_vinculos.fecha_creacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.fecha_creacion IS 'Fecha y hora de creación del vínculo.';


--
-- Name: documentos_partidas_vinculos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_partidas_vinculos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_partidas_vinculos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_partidas_vinculos_id_seq OWNED BY public.documentos_partidas_vinculos.id;


--
-- Name: documentos_saldo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.documentos_saldo AS
 SELECT d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total,
        CASE
            WHEN ((td.naturaleza_saldo)::text = 'abono'::text) THEN GREATEST((0)::numeric, (abs(COALESCE(d.total, (0)::numeric)) - COALESCE(origen.aplicado_origen_moneda, (0)::numeric)))
            WHEN ((td.naturaleza_saldo)::text = 'cargo'::text) THEN GREATEST((0)::numeric, (COALESCE(d.total, (0)::numeric) - COALESCE(destino.aplicado_destino_moneda, (0)::numeric)))
            ELSE (0)::numeric
        END AS saldo
   FROM (((public.documentos d
     JOIN core.tipos_documento td ON ((lower((td.codigo)::text) = lower((d.tipo_documento)::text))))
     LEFT JOIN ( SELECT a.documento_destino_id AS documento_id,
            a.empresa_id,
            sum(COALESCE(a.monto_moneda_documento, (0)::numeric)) AS aplicado_destino_moneda
           FROM public.aplicaciones_saldo a
          WHERE (a.documento_destino_id IS NOT NULL)
          GROUP BY a.documento_destino_id, a.empresa_id) destino ON (((destino.documento_id = d.id) AND (destino.empresa_id = d.empresa_id))))
     LEFT JOIN ( SELECT a.documento_origen_id AS documento_id,
            a.empresa_id,
            sum((COALESCE(a.monto, (0)::numeric) / NULLIF(abs(COALESCE(doc.tipo_cambio, (1)::numeric)), (0)::numeric))) AS aplicado_origen_moneda
           FROM (public.aplicaciones_saldo a
             JOIN public.documentos doc ON (((doc.id = a.documento_origen_id) AND (doc.empresa_id = a.empresa_id))))
          WHERE (a.documento_origen_id IS NOT NULL)
          GROUP BY a.documento_origen_id, a.empresa_id) origen ON (((origen.documento_id = d.id) AND (origen.empresa_id = d.empresa_id))));


--
-- Name: VIEW documentos_saldo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.documentos_saldo IS 'Vista universal de saldos documentales basada en naturaleza_saldo.';


--
-- Name: finanzas_aplicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_aplicaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    operacion_id integer NOT NULL,
    documento_id integer NOT NULL,
    monto numeric(15,2) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE finanzas_aplicaciones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.finanzas_aplicaciones IS 'Relación entre operaciones financieras y documentos. Permite aplicar pagos o cobros a facturas, pedidos u otros documentos.';


--
-- Name: COLUMN finanzas_aplicaciones.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.empresa_id IS 'Empresa propietaria del registro.';


--
-- Name: COLUMN finanzas_aplicaciones.operacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.operacion_id IS 'Operación financiera que aplica el pago o cobro.';


--
-- Name: COLUMN finanzas_aplicaciones.documento_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.documento_id IS 'Documento al que se aplica el monto (ej. factura).';


--
-- Name: COLUMN finanzas_aplicaciones.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.monto IS 'Monto aplicado del pago o cobro al documento.';


--
-- Name: COLUMN finanzas_aplicaciones.fecha_creacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.fecha_creacion IS 'Fecha de creación del registro.';


--
-- Name: finanzas_aplicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_aplicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_aplicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_aplicaciones_id_seq OWNED BY public.finanzas_aplicaciones.id;


--
-- Name: finanzas_conciliaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_conciliaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cuenta_id integer NOT NULL,
    fecha_corte date NOT NULL,
    saldo_banco numeric(15,2) NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id integer,
    saldo_conciliado_anterior numeric(15,2),
    total_depositos_cotejados numeric(15,2),
    total_retiros_cotejados numeric(15,2),
    saldo_conciliado_calculado numeric(15,2)
);


--
-- Name: COLUMN finanzas_conciliaciones.saldo_conciliado_anterior; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_conciliaciones.saldo_conciliado_anterior IS 'Valor de finanzas_cuentas.saldo_conciliado antes de ejecutar este cierre (base del cuadre).';


--
-- Name: COLUMN finanzas_conciliaciones.total_depositos_cotejados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_conciliaciones.total_depositos_cotejados IS 'Suma de depósitos con estado cotejado incluidos en este cierre.';


--
-- Name: COLUMN finanzas_conciliaciones.total_retiros_cotejados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_conciliaciones.total_retiros_cotejados IS 'Suma de retiros con estado cotejado incluidos en este cierre.';


--
-- Name: COLUMN finanzas_conciliaciones.saldo_conciliado_calculado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_conciliaciones.saldo_conciliado_calculado IS 'saldo_conciliado_anterior + total_depositos_cotejados - total_retiros_cotejados. Base correcta de cuadre con saldo_banco.';


--
-- Name: finanzas_conciliaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_conciliaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_conciliaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_conciliaciones_id_seq OWNED BY public.finanzas_conciliaciones.id;


--
-- Name: finanzas_conciliaciones_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_conciliaciones_operaciones (
    id integer NOT NULL,
    conciliacion_id integer NOT NULL,
    operacion_id integer NOT NULL
);


--
-- Name: finanzas_conciliaciones_operaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_conciliaciones_operaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_conciliaciones_operaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_conciliaciones_operaciones_id_seq OWNED BY public.finanzas_conciliaciones_operaciones.id;


--
-- Name: finanzas_cuentas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_cuentas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    identificador character varying(40) NOT NULL,
    numero_cuenta character varying(30),
    tipo_cuenta character varying(20) NOT NULL,
    moneda character varying(3) DEFAULT 'MXN'::character varying NOT NULL,
    saldo numeric(15,2) DEFAULT 0 NOT NULL,
    saldo_inicial numeric(15,2) DEFAULT 0 NOT NULL,
    saldo_conciliado numeric(15,2) DEFAULT 0 NOT NULL,
    fecha_ultima_conciliacion timestamp with time zone,
    es_cuenta_efectivo boolean DEFAULT false NOT NULL,
    afecta_total_disponible boolean DEFAULT true NOT NULL,
    cuenta_cerrada boolean DEFAULT false NOT NULL,
    observaciones text,
    CONSTRAINT chk_fc_moneda CHECK (((moneda)::text = ANY (ARRAY[('MXN'::character varying)::text, ('USD'::character varying)::text, ('EUR'::character varying)::text]))),
    CONSTRAINT chk_fc_tipo CHECK (((tipo_cuenta)::text = ANY (ARRAY[('Disponibilidad'::character varying)::text, ('Seguimiento'::character varying)::text])))
);


--
-- Name: finanzas_cuentas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_cuentas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_cuentas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_cuentas_id_seq OWNED BY public.finanzas_cuentas.id;


--
-- Name: finanzas_metodos_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_metodos_pago (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    clave character varying(40) NOT NULL,
    nombre character varying(100) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    requiere_referencia boolean DEFAULT false NOT NULL,
    es_efectivo boolean DEFAULT false NOT NULL,
    forma_pago_sat text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE finanzas_metodos_pago; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.finanzas_metodos_pago IS 'Catálogo operativo de métodos de pago por empresa (efectivo, SPEI, cheque, tarjeta…). No confundir con sat.formas_pago (CFDI).';


--
-- Name: COLUMN finanzas_metodos_pago.requiere_referencia; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_metodos_pago.requiere_referencia IS 'Si true, la operación debe informar el campo referencia (número de cheque, SPEI, etc.).';


--
-- Name: COLUMN finanzas_metodos_pago.forma_pago_sat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_metodos_pago.forma_pago_sat IS 'Código SAT sugerido (informativo). No se usa para timbrar ni modifica documentos.forma_pago.';


--
-- Name: finanzas_metodos_pago_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_metodos_pago_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_metodos_pago_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_metodos_pago_id_seq OWNED BY public.finanzas_metodos_pago.id;


--
-- Name: finanzas_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_operaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha date NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    monto numeric(15,2) NOT NULL,
    referencia character varying(100),
    observaciones text,
    cuenta_id integer NOT NULL,
    contacto_id integer,
    factura_id integer,
    es_transferencia boolean DEFAULT false NOT NULL,
    transferencia_id integer,
    estado_conciliacion character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    saldo numeric(15,2),
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    concepto_id integer,
    naturaleza_operacion character varying(30) DEFAULT 'movimiento_general'::character varying NOT NULL,
    documento_origen_id integer,
    created_by integer,
    metodo_pago_id integer,
    CONSTRAINT chk_fo_conciliacion CHECK (((estado_conciliacion)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('cotejado'::character varying)::text, ('conciliado'::character varying)::text]))),
    CONSTRAINT chk_fo_tipo CHECK (((tipo_movimiento)::text = ANY (ARRAY[('Deposito'::character varying)::text, ('Retiro'::character varying)::text])))
);


--
-- Name: COLUMN finanzas_operaciones.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_operaciones.created_by IS 'ID del usuario que creó la operación (ref. tabla usuarios). NULL en registros anteriores a Fase 1.';


--
-- Name: finanzas_operaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_operaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_operaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_operaciones_id_seq OWNED BY public.finanzas_operaciones.id;


--
-- Name: finanzas_programacion_pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_programacion_pagos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    documento_id integer,
    proveedor_id integer,
    fecha_programada date NOT NULL,
    monto_programado numeric(20,6) NOT NULL,
    moneda character varying(3) DEFAULT 'MXN'::character varying NOT NULL,
    cuenta_origen_id integer,
    metodo_pago_id integer,
    referencia character varying(100),
    estatus character varying(20) DEFAULT 'programado'::character varying NOT NULL,
    notas text,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    documento_pago_id integer,
    finanzas_operacion_id integer,
    CONSTRAINT chk_programacion_estatus CHECK (((estatus)::text = ANY ((ARRAY['programado'::character varying, 'pagado'::character varying, 'cancelado'::character varying])::text[]))),
    CONSTRAINT chk_programacion_monto CHECK ((monto_programado > (0)::numeric))
);


--
-- Name: TABLE finanzas_programacion_pagos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.finanzas_programacion_pagos IS 'Programación (plan) de pagos a proveedores sobre facturas de compra. No genera movimientos financieros; el pago real se registra con finanzas_operaciones.';


--
-- Name: COLUMN finanzas_programacion_pagos.documento_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_programacion_pagos.documento_id IS 'LEGACY: apuntaba a la única factura en el modelo v1. NULL para programaciones creadas con el modelo v2 (multi-factura). La información canónica de facturas está en finanzas_programacion_pagos_detalle.';


--
-- Name: COLUMN finanzas_programacion_pagos.proveedor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_programacion_pagos.proveedor_id IS 'Desnormalizado de documentos.contacto_principal_id para eficiencia de listado.';


--
-- Name: COLUMN finanzas_programacion_pagos.estatus; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_programacion_pagos.estatus IS 'programado: pendiente de pagar. pagado: se ejecutó el pago real (Fase 3.2B). cancelado: anulado sin pagar.';


--
-- Name: COLUMN finanzas_programacion_pagos.documento_pago_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_programacion_pagos.documento_pago_id IS 'Documento pago_proveedor creado al ejecutar el pago real (Fase 3.2B). NULL hasta que se pague.';


--
-- Name: COLUMN finanzas_programacion_pagos.finanzas_operacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_programacion_pagos.finanzas_operacion_id IS 'Operación bancaria (finanzas_operaciones) creada al ejecutar el pago. NULL hasta que se pague.';


--
-- Name: finanzas_programacion_pagos_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_programacion_pagos_detalle (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    programacion_id integer NOT NULL,
    documento_id integer NOT NULL,
    monto_programado numeric(20,6) NOT NULL,
    moneda character varying(3) DEFAULT 'MXN'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_det_monto CHECK ((monto_programado > (0)::numeric))
);


--
-- Name: TABLE finanzas_programacion_pagos_detalle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.finanzas_programacion_pagos_detalle IS 'Detalle de programación de pago: una fila por factura de compra cubierta. Permite pagar varias facturas del mismo proveedor en un solo movimiento bancario.';


--
-- Name: COLUMN finanzas_programacion_pagos_detalle.programacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_programacion_pagos_detalle.programacion_id IS 'FK al encabezado. ON DELETE CASCADE: al cancelar/borrar la programación se eliminan sus detalles.';


--
-- Name: COLUMN finanzas_programacion_pagos_detalle.documento_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_programacion_pagos_detalle.documento_id IS 'FK a la factura de compra que se pagará parcial o totalmente.';


--
-- Name: finanzas_programacion_pagos_detalle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_programacion_pagos_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_programacion_pagos_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_programacion_pagos_detalle_id_seq OWNED BY public.finanzas_programacion_pagos_detalle.id;


--
-- Name: finanzas_programacion_pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_programacion_pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_programacion_pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_programacion_pagos_id_seq OWNED BY public.finanzas_programacion_pagos.id;


--
-- Name: finanzas_transferencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_transferencias (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cuenta_origen_id integer NOT NULL,
    cuenta_destino_id integer NOT NULL,
    monto numeric(15,2) NOT NULL,
    fecha date NOT NULL,
    referencia character varying(100),
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id integer,
    CONSTRAINT chk_ft_cuentas_distintas CHECK ((cuenta_origen_id <> cuenta_destino_id))
);


--
-- Name: finanzas_transferencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_transferencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_transferencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_transferencias_id_seq OWNED BY public.finanzas_transferencias.id;


--
-- Name: impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impuestos (
    id character varying(30) NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(20) NOT NULL,
    tasa numeric(9,4) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.impuestos IS 'Catálogo general de impuestos que pueden aplicarse en documentos y partidas (IVA, IEPS, retenciones, etc).';


--
-- Name: COLUMN impuestos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.id IS 'Identificador único del impuesto (ej. iva_16, iva_8, ret_iva).';


--
-- Name: COLUMN impuestos.nombre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.nombre IS 'Nombre descriptivo del impuesto.';


--
-- Name: COLUMN impuestos.tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.tipo IS 'Tipo de impuesto: traslado o retencion.';


--
-- Name: COLUMN impuestos.tasa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.tasa IS 'Porcentaje del impuesto.';


--
-- Name: COLUMN impuestos.activo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.activo IS 'Indica si el impuesto está activo.';


--
-- Name: oc_partidas_recepcion; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.oc_partidas_recepcion AS
 SELECT dp_oc.documento_id AS oc_id,
    d_oc.empresa_id,
    dp_oc.id AS partida_oc_id,
    dp_oc.producto_id,
    dp_oc.cantidad AS cantidad_ordenada,
    COALESCE(sum(
        CASE
            WHEN ((lower((d_dest.tipo_documento)::text) = 'recepcion'::text) AND (lower((COALESCE(d_dest.estatus_documento, ''::character varying))::text) <> ALL (ARRAY['cancelado'::text, 'cancelada'::text]))) THEN dpv.cantidad
            ELSE (0)::numeric
        END), (0)::numeric) AS cantidad_recibida,
    (dp_oc.cantidad - COALESCE(sum(
        CASE
            WHEN ((lower((d_dest.tipo_documento)::text) = 'recepcion'::text) AND (lower((COALESCE(d_dest.estatus_documento, ''::character varying))::text) <> ALL (ARRAY['cancelado'::text, 'cancelada'::text]))) THEN dpv.cantidad
            ELSE (0)::numeric
        END), (0)::numeric)) AS cantidad_pendiente
   FROM (((public.documentos_partidas dp_oc
     JOIN public.documentos d_oc ON (((d_oc.id = dp_oc.documento_id) AND (lower((d_oc.tipo_documento)::text) = 'orden_compra'::text))))
     LEFT JOIN public.documentos_partidas_vinculos dpv ON (((dpv.documento_origen_id = d_oc.id) AND (dpv.partida_origen_id = dp_oc.id))))
     LEFT JOIN public.documentos d_dest ON ((d_dest.id = dpv.documento_destino_id)))
  GROUP BY dp_oc.documento_id, d_oc.empresa_id, dp_oc.id, dp_oc.producto_id, dp_oc.cantidad;


--
-- Name: VIEW oc_partidas_recepcion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.oc_partidas_recepcion IS 'Progreso de recepción por partida de Orden de Compra. Sin columnas adicionales ni triggers.';


--
-- Name: operaciones_credito_aplicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operaciones_credito_aplicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operaciones_credito_aplicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operaciones_credito_aplicaciones_id_seq OWNED BY public.credito_operaciones_aplicaciones.id;


--
-- Name: operaciones_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operaciones_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operaciones_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operaciones_credito_id_seq OWNED BY public.credito_operaciones.id;


--
-- Name: operaciones_credito_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operaciones_credito_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operaciones_credito_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operaciones_credito_items_id_seq OWNED BY public.credito_operaciones_items.id;


--
-- Name: plantillas_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantillas_documento (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento text NOT NULL,
    nombre text NOT NULL,
    contenido_html text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    configuracion jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE plantillas_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.plantillas_documento IS 'Plantillas de layout configurables para documentos (PDF), por empresa.';


--
-- Name: COLUMN plantillas_documento.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.id IS 'Identificador único de la plantilla';


--
-- Name: COLUMN plantillas_documento.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.empresa_id IS 'Empresa propietaria de la plantilla';


--
-- Name: COLUMN plantillas_documento.tipo_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.tipo_documento IS 'Tipo de documento (factura, cotizacion, etc.) asociado a la plantilla (uso legado o fallback)';


--
-- Name: COLUMN plantillas_documento.nombre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.nombre IS 'Nombre descriptivo de la plantilla';


--
-- Name: COLUMN plantillas_documento.contenido_html; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.contenido_html IS 'Contenido HTML de la plantilla (uso legado si aplica)';


--
-- Name: COLUMN plantillas_documento.activo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.activo IS 'Indica si la plantilla está activa';


--
-- Name: COLUMN plantillas_documento.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.created_at IS 'Fecha de creación de la plantilla';


--
-- Name: COLUMN plantillas_documento.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.updated_at IS 'Fecha de última actualización de la plantilla';


--
-- Name: COLUMN plantillas_documento.configuracion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.configuracion IS 'Configuración del layout en formato JSON (colores, visibilidad de secciones, etc.)';


--
-- Name: plantillas_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plantillas_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantillas_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plantillas_documento_id_seq OWNED BY public.plantillas_documento.id;


--
-- Name: precios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precios (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    producto_id bigint NOT NULL,
    precio_lista_id bigint NOT NULL,
    contacto_id bigint,
    precio numeric(18,6) DEFAULT 0 NOT NULL,
    moneda_id bigint,
    vigencia_desde timestamp without time zone,
    vigencia_hasta timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE precios; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.precios IS 'Precios de productos por lista, con posibilidad futura de precio específico por contacto.';


--
-- Name: precios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.precios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: precios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.precios_id_seq OWNED BY public.precios.id;


--
-- Name: precios_listas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precios_listas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    tipo_precio character varying(20) DEFAULT 'VENTA'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    orden integer,
    es_default boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE precios_listas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.precios_listas IS 'Define listas de precios de venta o compra por empresa.';


--
-- Name: COLUMN precios_listas.tipo_precio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.precios_listas.tipo_precio IS 'Tipo de lista de precio. Valores esperados: VENTA o COMPRA.';


--
-- Name: precios_listas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.precios_listas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: precios_listas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.precios_listas_id_seq OWNED BY public.precios_listas.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    clave character varying(50) NOT NULL,
    descripcion character varying(150) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    clasificacion character varying(50),
    tipo_producto character varying(30) NOT NULL,
    familia character varying(50),
    linea character varying(50),
    presentacion character varying(50),
    unidad_compra character varying(20),
    factor_conversion numeric(15,6),
    existencia_actual numeric(15,4),
    minimo_inventario numeric(15,4),
    costo_estandar numeric(19,6),
    costo_promedio numeric(19,6),
    ultimo_costo numeric(19,6),
    precio_publico numeric(15,2),
    precio_mayoreo numeric(15,2),
    precio_menudeo numeric(15,2),
    precio_distribuidor numeric(15,2),
    iva_porcentaje numeric(5,2),
    ieps_porcentaje numeric(5,2),
    retiene_iva boolean DEFAULT false,
    retiene_isr boolean DEFAULT false,
    clave_producto_sat character varying(20),
    fraccion_arancelaria character varying(15),
    largo numeric(9,3),
    ancho numeric(9,3),
    alto numeric(9,3),
    espesor numeric(9,3),
    diametro numeric(9,3),
    peso_unitario numeric(9,3),
    equivalente_m2 numeric(9,3),
    piezas_por_empaque numeric(9,2),
    peso_por_empaque numeric(9,2),
    unidad_peso_empaque character varying(20),
    ubicacion_almacen character varying(50),
    proveedor_principal_id integer,
    proveedor_alternativo_1_id integer,
    proveedor_alternativo_2_id integer,
    archivo_fotografia_1 character varying(255),
    archivo_fotografia_2 character varying(255),
    archivo_ficha_tecnica character varying(255),
    archivo_certificado character varying(255),
    es_estacional boolean DEFAULT false,
    demanda_mensual_estimado numeric(11,2),
    factor_demanda numeric(7,2),
    observaciones text,
    observaciones_compras text,
    observaciones_diseno text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    empresa_id integer NOT NULL,
    unidad_venta_id integer,
    unidad_inventario_id integer,
    clave_unidad_sat character varying(10),
    dias_entrega integer,
    cantidad_minima_compra numeric(15,4),
    proveedor_preferido_id integer,
    pais_origen_id text,
    cantidad_minima_venta numeric(15,4)
);


--
-- Name: productos_archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos_archivos (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo_archivo character varying(30) NOT NULL,
    archivo character varying(255) NOT NULL,
    descripcion character varying(150),
    orden_visual integer DEFAULT 1 NOT NULL,
    principal boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: productos_archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_archivos_id_seq OWNED BY public.productos_archivos.id;


--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: productos_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos_impuestos (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    impuesto_id character varying(30) NOT NULL
);


--
-- Name: TABLE productos_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.productos_impuestos IS 'Relación entre productos e impuestos aplicables. Permite que cada producto tenga uno o varios impuestos.';


--
-- Name: COLUMN productos_impuestos.producto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.productos_impuestos.producto_id IS 'Identificador del producto al que se le aplica el impuesto.';


--
-- Name: COLUMN productos_impuestos.impuesto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.productos_impuestos.impuesto_id IS 'Impuesto que aplica al producto.';


--
-- Name: productos_impuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_impuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_impuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_impuestos_id_seq OWNED BY public.productos_impuestos.id;


--
-- Name: reglas_tratamiento_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_tratamiento_impuestos (
    id integer NOT NULL,
    tratamiento character varying(20) NOT NULL,
    impuesto_id character varying(30) NOT NULL
);


--
-- Name: TABLE reglas_tratamiento_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reglas_tratamiento_impuestos IS 'Define qué impuestos se aplican dependiendo del tratamiento_impuestos del documento (normal, sin_iva, tasa_cero, exento).';


--
-- Name: COLUMN reglas_tratamiento_impuestos.tratamiento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_tratamiento_impuestos.tratamiento IS 'Tratamiento fiscal definido en el documento.';


--
-- Name: COLUMN reglas_tratamiento_impuestos.impuesto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_tratamiento_impuestos.impuesto_id IS 'Impuesto que debe aplicarse cuando el documento tiene ese tratamiento.';


--
-- Name: reglas_tratamiento_impuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_tratamiento_impuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_tratamiento_impuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_tratamiento_impuestos_id_seq OWNED BY public.reglas_tratamiento_impuestos.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    nombre character varying(40) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: series_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_documento (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento text NOT NULL,
    serie character varying(10) NOT NULL,
    layout_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    descripcion text,
    es_fiscal boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    ultimo_numero integer DEFAULT 0 NOT NULL,
    CONSTRAINT chk_series_tipo_lower CHECK ((tipo_documento = lower(tipo_documento)))
);


--
-- Name: TABLE series_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.series_documento IS 'Define series de documentos por empresa, permitiendo asociar plantillas específicas de layout por serie.';


--
-- Name: COLUMN series_documento.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.id IS 'Identificador único de la serie';


--
-- Name: COLUMN series_documento.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.empresa_id IS 'Empresa a la que pertenece la serie';


--
-- Name: COLUMN series_documento.tipo_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.tipo_documento IS 'Tipo de documento (factura, cotizacion, etc.)';


--
-- Name: COLUMN series_documento.serie; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.serie IS 'Nombre o clave de la serie (ej. A, B, MOSTRADOR)';


--
-- Name: COLUMN series_documento.layout_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.layout_id IS 'Plantilla de layout asociada a la serie (opcional)';


--
-- Name: COLUMN series_documento.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.created_at IS 'Fecha de creación de la serie';


--
-- Name: COLUMN series_documento.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.updated_at IS 'Fecha de última actualización de la serie';


--
-- Name: series_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.series_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: series_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.series_documento_id_seq OWNED BY public.series_documento.id;


--
-- Name: temp_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_leads (
    nombre text,
    correo text,
    telefono text,
    empresa text,
    estado text,
    producto_servicio text,
    vendedor text,
    seguimiento text,
    estatus text,
    "NÚMERO DE TELÉFONO" bigint,
    "Column4" bigint,
    "FRECUENCIA" character varying(50),
    "PRODUCTO/SERVICIO" character varying(50),
    "Column12" character varying(50),
    "Column13" character varying(50),
    "Column14" character varying(50),
    "Column15" character varying(50),
    "Column16" character varying(50),
    "Column17" character varying(50),
    "Column18" character varying(50),
    "Column19" character varying(50),
    "Column20" character varying(50),
    "Column21" character varying(50),
    "Column22" character varying(50),
    "Column23" character varying(50),
    "Column24" character varying(50),
    "Column25" character varying(50),
    "Column26" character varying(50),
    "Column27" character varying(50),
    "Column28" character varying(50),
    "Column29" character varying(50),
    "Column30" character varying(50)
);


--
-- Name: unidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidades (
    id integer NOT NULL,
    clave character varying(20) NOT NULL,
    descripcion character varying(100) NOT NULL,
    unidad_sat_id integer NOT NULL,
    empresa_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: unidades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unidades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unidades_id_seq OWNED BY public.unidades.id;


--
-- Name: usuarios_series_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios_series_documento (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    serie_documento_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios_series_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_series_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_series_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_series_documento_id_seq OWNED BY public.usuarios_series_documento.id;


--
-- Name: aduanas; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.aduanas (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: claves_unidades; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.claves_unidades (
    id text NOT NULL,
    texto text NOT NULL,
    descripcion text NOT NULL,
    notas text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    simbolo text NOT NULL,
    search_vector tsvector
);


--
-- Name: codigos_postales; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.codigos_postales (
    id text NOT NULL,
    estado text NOT NULL,
    municipio text NOT NULL,
    localidad text NOT NULL,
    estimulo_frontera integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    huso_descripcion text NOT NULL,
    huso_verano_mes_inicio text NOT NULL,
    huso_verano_dia_inicio text NOT NULL,
    huso_verano_hora_inicio text NOT NULL,
    huso_verano_diferencia text NOT NULL,
    huso_invierno_mes_inicio text NOT NULL,
    huso_invierno_dia_inicio text NOT NULL,
    huso_invierno_hora_inicio text NOT NULL,
    huso_invierno_diferencia text NOT NULL
);


--
-- Name: colonias; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.colonias (
    colonia text NOT NULL,
    codigo_postal text NOT NULL,
    texto text NOT NULL,
    search_vector tsvector
);


--
-- Name: estados; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.estados (
    estado text NOT NULL,
    pais text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: exportaciones; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.exportaciones (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: formas_pago; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.formas_pago (
    id text NOT NULL,
    texto text NOT NULL,
    es_bancarizado integer NOT NULL,
    requiere_numero_operacion integer NOT NULL,
    permite_banco_ordenante_rfc integer NOT NULL,
    permite_cuenta_ordenante integer NOT NULL,
    patron_cuenta_ordenante text,
    permite_banco_beneficiario_rfc integer NOT NULL,
    permite_cuenta_beneficiario integer NOT NULL,
    patron_cuenta_beneficiario text,
    permite_tipo_cadena_pago integer NOT NULL,
    requiere_banco_ordenante_nombre_ext integer NOT NULL,
    vigencia_desde text,
    vigencia_hasta text
);


--
-- Name: impuestos; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.impuestos (
    id text NOT NULL,
    texto text NOT NULL,
    retencion integer NOT NULL,
    traslado integer NOT NULL,
    ambito text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: localidades; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.localidades (
    localidad text NOT NULL,
    estado text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    search_vector tsvector
);


--
-- Name: meses; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.meses (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: metodos_pago; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.metodos_pago (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: monedas; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.monedas (
    id text NOT NULL,
    texto text NOT NULL,
    decimales integer NOT NULL,
    porcentaje_variacion integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: municipios; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.municipios (
    municipio text NOT NULL,
    estado text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    search_vector tsvector
);


--
-- Name: numeros_pedimento_aduana; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.numeros_pedimento_aduana (
    aduana text NOT NULL,
    patente text NOT NULL,
    ejercicio integer NOT NULL,
    cantidad integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: objetos_impuestos; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.objetos_impuestos (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: paises; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.paises (
    id text NOT NULL,
    texto text NOT NULL,
    patron_codigo_postal text NOT NULL,
    patron_identidad_tributaria text NOT NULL,
    validacion_identidad_tributaria text NOT NULL,
    agrupaciones text NOT NULL
);


--
-- Name: patentes_aduanales; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.patentes_aduanales (
    id text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: periodicidades; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.periodicidades (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: productos_servicios; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.productos_servicios (
    id text NOT NULL,
    texto text NOT NULL,
    iva_trasladado text NOT NULL,
    ieps_trasladado text NOT NULL,
    complemento text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    estimulo_frontera text NOT NULL,
    similares text NOT NULL,
    search_vector tsvector
);


--
-- Name: regimenes_fiscales; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.regimenes_fiscales (
    id text NOT NULL,
    texto text NOT NULL,
    aplica_fisica integer NOT NULL,
    aplica_moral integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: reglas_tasa_cuota; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.reglas_tasa_cuota (
    tipo text NOT NULL,
    minimo text NOT NULL,
    valor text NOT NULL,
    impuesto text NOT NULL,
    factor text NOT NULL,
    traslado integer NOT NULL,
    retencion integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: tipos_comprobantes; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.tipos_comprobantes (
    id text NOT NULL,
    texto text NOT NULL,
    valor_maximo text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: tipos_factores; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.tipos_factores (
    id text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: tipos_relaciones; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.tipos_relaciones (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: unidades; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.unidades (
    id integer NOT NULL,
    clave character varying(10) NOT NULL,
    descripcion character varying(150) NOT NULL,
    vigente boolean DEFAULT true NOT NULL
);


--
-- Name: unidades_id_seq; Type: SEQUENCE; Schema: sat; Owner: -
--

CREATE SEQUENCE sat.unidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unidades_id_seq; Type: SEQUENCE OWNED BY; Schema: sat; Owner: -
--

ALTER SEQUENCE sat.unidades_id_seq OWNED BY sat.unidades.id;


--
-- Name: usos_cfdi; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.usos_cfdi (
    id text NOT NULL,
    texto text NOT NULL,
    aplica_fisica integer NOT NULL,
    aplica_moral integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    regimenes_fiscales_receptores text NOT NULL
);


--
-- Name: config; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.config (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    phone_number character varying(20) NOT NULL,
    api_key character varying(255) NOT NULL,
    app_name character varying(100) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT config_phone_number_chk CHECK (((phone_number)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: TABLE config; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.config IS 'Configuración del canal WhatsApp por empresa (API key, número, app de Gupshup)';


--
-- Name: config_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

CREATE SEQUENCE whatsapp.config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: config_id_seq; Type: SEQUENCE OWNED BY; Schema: whatsapp; Owner: -
--

ALTER SEQUENCE whatsapp.config_id_seq OWNED BY whatsapp.config.id;


--
-- Name: contacto_estado; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.contacto_estado (
    empresa_id integer NOT NULL,
    telefono character varying(20) NOT NULL,
    opt_in boolean DEFAULT false NOT NULL,
    opt_out boolean DEFAULT false NOT NULL,
    ultimo_in timestamp with time zone,
    ultimo_out timestamp with time zone,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contacto_estado_telefono_check CHECK (((telefono)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: TABLE contacto_estado; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.contacto_estado IS 'Controla ventana 24h y consentimiento por empresa.';


--
-- Name: COLUMN contacto_estado.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.contacto_estado.empresa_id IS 'Empresa a la que pertenece el telefono.';


--
-- Name: contacto_mapeo; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.contacto_mapeo (
    numero_telefono character varying(20) NOT NULL,
    contacto_id integer,
    verificado boolean DEFAULT false NOT NULL,
    observado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contacto_mapeo_numero_telefono_check CHECK (((numero_telefono)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: conversacion_etiquetas; Type: VIEW; Schema: whatsapp; Owner: -
--

CREATE VIEW whatsapp.conversacion_etiquetas AS
 SELECT conversacion_etiquetas.id,
    conversacion_etiquetas.empresa_id,
    conversacion_etiquetas.conversacion_id,
    conversacion_etiquetas.etiqueta_id,
    conversacion_etiquetas.created_at
   FROM crm.conversacion_etiquetas;


--
-- Name: conversaciones; Type: VIEW; Schema: whatsapp; Owner: -
--

CREATE VIEW whatsapp.conversaciones AS
 SELECT conversaciones.id,
    conversaciones.empresa_id,
    conversaciones.contacto_id,
    conversaciones.estado,
    conversaciones.asignado_a,
    conversaciones.creada_en,
    conversaciones.ultimo_mensaje_en,
    conversaciones.cerrada_en,
    conversaciones.prioridad,
    conversaciones.siguiente_accion,
    conversaciones.etapa_oportunidad
   FROM crm.conversaciones;


--
-- Name: estadisticas; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.estadisticas (
    empresa_id integer NOT NULL,
    fecha date NOT NULL,
    mensajes_enviados integer DEFAULT 0 NOT NULL,
    mensajes_recibidos integer DEFAULT 0 NOT NULL,
    plantillas_usadas integer DEFAULT 0 NOT NULL,
    errores_envio integer DEFAULT 0 NOT NULL
);


--
-- Name: TABLE estadisticas; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.estadisticas IS 'Estadisticas diarias de WhatsApp por empresa.';


--
-- Name: COLUMN estadisticas.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.estadisticas.empresa_id IS 'Empresa a la que pertenecen las metricas.';


--
-- Name: etiquetas; Type: VIEW; Schema: whatsapp; Owner: -
--

CREATE VIEW whatsapp.etiquetas AS
 SELECT etiquetas.id,
    etiquetas.empresa_id,
    etiquetas.nombre,
    etiquetas.color,
    etiquetas.activo,
    etiquetas.created_at,
    etiquetas.updated_at
   FROM crm.etiquetas;


--
-- Name: intentos_contacto; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.intentos_contacto (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    pagina_origen text,
    producto text,
    fuente text,
    mensaje_prellenado text,
    session_id text,
    ip_address inet,
    user_agent text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    tipo_intento text
);


--
-- Name: TABLE intentos_contacto; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.intentos_contacto IS 'Registra intentos de contacto a WhatsApp desde la web antes de que exista una conversacion real. Representa intencion del usuario.';


--
-- Name: COLUMN intentos_contacto.id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.id IS 'Identificador unico del intento de contacto.';


--
-- Name: COLUMN intentos_contacto.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.empresa_id IS 'Empresa a la que pertenece el intento de contacto.';


--
-- Name: COLUMN intentos_contacto.pagina_origen; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.pagina_origen IS 'Ruta o URL de la pagina donde se genero el clic (ej. /sky-dancer).';


--
-- Name: COLUMN intentos_contacto.producto; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.producto IS 'Producto o categoria asociada al clic (ej. Sky Dancer, Display).';


--
-- Name: COLUMN intentos_contacto.fuente; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.fuente IS 'Origen del trafico (ej. web, landing, campaña, QR).';


--
-- Name: COLUMN intentos_contacto.mensaje_prellenado; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.mensaje_prellenado IS 'Mensaje que se envia prellenado al abrir WhatsApp.';


--
-- Name: COLUMN intentos_contacto.session_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.session_id IS 'Identificador de sesion del navegador para agrupar eventos del mismo usuario.';


--
-- Name: COLUMN intentos_contacto.ip_address; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.ip_address IS 'Direccion IP del usuario al momento del clic.';


--
-- Name: COLUMN intentos_contacto.user_agent; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.user_agent IS 'Cadena de identificacion del navegador o dispositivo del usuario.';


--
-- Name: COLUMN intentos_contacto.creado_en; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.creado_en IS 'Fecha y hora en que se registro el intento de contacto.';


--
-- Name: intentos_contacto_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

CREATE SEQUENCE whatsapp.intentos_contacto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intentos_contacto_id_seq; Type: SEQUENCE OWNED BY; Schema: whatsapp; Owner: -
--

ALTER SEQUENCE whatsapp.intentos_contacto_id_seq OWNED BY whatsapp.intentos_contacto.id;


--
-- Name: mensajes; Type: VIEW; Schema: whatsapp; Owner: -
--

CREATE VIEW whatsapp.mensajes AS
 SELECT mensajes.id,
    mensajes.empresa_id,
    mensajes.contacto_id,
    mensajes.conversacion_id,
    mensajes.telefono,
    mensajes.tipo_mensaje,
    mensajes.canal,
    mensajes.contenido,
    mensajes.plantilla_nombre,
    mensajes.fecha_envio,
    mensajes.status,
    mensajes.id_externo,
    mensajes.intentos_envio,
    mensajes.respuesta_json,
    mensajes.creado_en,
    mensajes.tipo_contenido,
    mensajes.media_url,
    mensajes.mime_type,
    mensajes.caption,
    mensajes.email_from,
    mensajes.email_to,
    mensajes.email_subject,
    mensajes.email_cc,
    mensajes.email_bcc,
    mensajes.in_reply_to
   FROM crm.mensajes;


--
-- Name: plantillas; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.plantillas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nombre_interno character varying(120) NOT NULL,
    tipo character varying(50) NOT NULL,
    proveedor character varying(50) NOT NULL,
    provider_template_id character varying(120) NOT NULL,
    es_default boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone,
    contenido text,
    configuracion_parametros jsonb
);


--
-- Name: TABLE plantillas; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.plantillas IS 'Plantillas de WhatsApp definidas por empresa. Permiten desacoplar el ERP del proveedor (ej. Gupshup) y controlar el uso por tipo de mensaje (ej. reactivación).';


--
-- Name: COLUMN plantillas.id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.id IS 'Identificador único de la plantilla.';


--
-- Name: COLUMN plantillas.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.empresa_id IS 'Empresa a la que pertenece la plantilla.';


--
-- Name: COLUMN plantillas.nombre_interno; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.nombre_interno IS 'Nombre descriptivo interno para identificar la plantilla dentro del ERP.';


--
-- Name: COLUMN plantillas.tipo; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.tipo IS 'Tipo o propósito de la plantilla (ej. reactivacion, seguimiento, cierre).';


--
-- Name: COLUMN plantillas.proveedor; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.proveedor IS 'Proveedor de mensajería (ej. gupshup). Permite soportar múltiples integraciones en el futuro.';


--
-- Name: COLUMN plantillas.provider_template_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.provider_template_id IS 'Identificador de la plantilla en el proveedor (ej. template_id en Gupshup).';


--
-- Name: COLUMN plantillas.es_default; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.es_default IS 'Indica si esta plantilla es la predeterminada para su empresa y tipo. Solo puede existir una por empresa + tipo.';


--
-- Name: COLUMN plantillas.activa; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.activa IS 'Indica si la plantilla está disponible para uso.';


--
-- Name: COLUMN plantillas.creado_en; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.creado_en IS 'Fecha de creación del registro.';


--
-- Name: COLUMN plantillas.actualizado_en; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.actualizado_en IS 'Fecha de última actualización del registro.';


--
-- Name: COLUMN plantillas.contenido; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.contenido IS 'Cuerpo del mensaje de la plantilla. Puede contener variables. Se usa para mostrar vista previa y detectar variables al enviar desde el CRM.';


--
-- Name: COLUMN plantillas.configuracion_parametros; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.configuracion_parametros IS 'Configuración de variables de la plantilla. Array JSON con estructura: [{variable: number, label: string, origen: "manual"|"contacto.nombre"|"contacto.telefono"|"contacto.empresa"}]. NULL = todas las variables son manuales.';


--
-- Name: plantillas_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

CREATE SEQUENCE whatsapp.plantillas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantillas_id_seq; Type: SEQUENCE OWNED BY; Schema: whatsapp; Owner: -
--

ALTER SEQUENCE whatsapp.plantillas_id_seq OWNED BY whatsapp.plantillas.id;


--
-- Name: vcontactos_telefonos; Type: VIEW; Schema: whatsapp; Owner: -
--

CREATE VIEW whatsapp.vcontactos_telefonos AS
 WITH domicilio_principal AS (
         SELECT DISTINCT ON (d.contacto_id) d.contacto_id,
            d.ciudad,
            d.estado,
            d.pais
           FROM public.contactos_domicilios d
          ORDER BY d.contacto_id, d.es_principal DESC, d.id
        )
 SELECT c.id,
    c.empresa_id,
    c.nombre,
    dp.ciudad,
    dp.estado,
    dp.pais,
    c.email,
    whatsapp.fn_normaliza_telefono_e164((c.telefono)::text) AS telefonoe164
   FROM (public.contactos c
     LEFT JOIN domicilio_principal dp ON ((dp.contacto_id = c.id)))
  WHERE (c.telefono IS NOT NULL);


--
-- Name: VIEW vcontactos_telefonos; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON VIEW whatsapp.vcontactos_telefonos IS 'Vista que expone contactos con telefono normalizado y empresa asociada.';


--
-- Name: campos_configuracion id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion ALTER COLUMN id SET DEFAULT nextval('core.campos_configuracion_id_seq'::regclass);


--
-- Name: campos_obligatorios id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_obligatorios ALTER COLUMN id SET DEFAULT nextval('core.campos_obligatorios_id_seq'::regclass);


--
-- Name: catalogos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos ALTER COLUMN id SET DEFAULT nextval('core.catalogos_id_seq'::regclass);


--
-- Name: catalogos_tipos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos_tipos ALTER COLUMN id SET DEFAULT nextval('core.catalogos_tipos_id_seq'::regclass);


--
-- Name: cfdi_pac_config id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_pac_config ALTER COLUMN id SET DEFAULT nextval('core.cfdi_pac_config_id_seq'::regclass);


--
-- Name: empresas id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas ALTER COLUMN id SET DEFAULT nextval('core.empresas_id_seq'::regclass);


--
-- Name: empresas_assets id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_assets ALTER COLUMN id SET DEFAULT nextval('core.empresas_assets_id_seq'::regclass);


--
-- Name: empresas_impuestos_default id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default ALTER COLUMN id SET DEFAULT nextval('core.empresas_impuestos_default_id_seq'::regclass);


--
-- Name: empresas_tipos_documento id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento ALTER COLUMN id SET DEFAULT nextval('core.empresas_tipos_documento_id_seq'::regclass);


--
-- Name: empresas_tipos_documento_transiciones id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones ALTER COLUMN id SET DEFAULT nextval('core.empresas_tipos_documento_transiciones_id_seq'::regclass);


--
-- Name: entidades_tipos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_tipos ALTER COLUMN id SET DEFAULT nextval('core.entidades_tipos_id_seq'::regclass);


--
-- Name: grid_preferences id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences ALTER COLUMN id SET DEFAULT nextval('core.grid_preferences_id_seq'::regclass);


--
-- Name: modulos modulo_id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.modulos ALTER COLUMN modulo_id SET DEFAULT nextval('core.modulos_modulo_id_seq'::regclass);


--
-- Name: parametros parametro_id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros ALTER COLUMN parametro_id SET DEFAULT nextval('core.parametros_parametro_id_seq'::regclass);


--
-- Name: parametros_opciones opcion_id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones ALTER COLUMN opcion_id SET DEFAULT nextval('core.parametros_opciones_opcion_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles ALTER COLUMN id SET DEFAULT nextval('core.roles_id_seq'::regclass);


--
-- Name: tipos_documento id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.tipos_documento ALTER COLUMN id SET DEFAULT nextval('core.tipos_documento_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios ALTER COLUMN id SET DEFAULT nextval('core.usuarios_id_seq'::regclass);


--
-- Name: actividades id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades ALTER COLUMN id SET DEFAULT nextval('crm.actividades_id_seq'::regclass);


--
-- Name: configuracion_email_empresa id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa ALTER COLUMN id SET DEFAULT nextval('crm.configuracion_email_empresa_id_seq'::regclass);


--
-- Name: configuracion_email_usuario id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario ALTER COLUMN id SET DEFAULT nextval('crm.configuracion_email_usuario_id_seq'::regclass);


--
-- Name: conversacion_etiquetas id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas ALTER COLUMN id SET DEFAULT nextval('crm.conversacion_etiquetas_id_seq'::regclass);


--
-- Name: email_plantillas id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas ALTER COLUMN id SET DEFAULT nextval('crm.email_plantillas_id_seq'::regclass);


--
-- Name: etiquetas id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.etiquetas ALTER COLUMN id SET DEFAULT nextval('crm.etiquetas_id_seq'::regclass);


--
-- Name: oportunidades_venta id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.oportunidades_venta ALTER COLUMN id SET DEFAULT nextval('crm.oportunidades_venta_id_seq'::regclass);


--
-- Name: existencias id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias ALTER COLUMN id SET DEFAULT nextval('inventario.existencias_id_seq'::regclass);


--
-- Name: movimientos id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos ALTER COLUMN id SET DEFAULT nextval('inventario.movimientos_id_seq'::regclass);


--
-- Name: movimientos_partidas id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas ALTER COLUMN id SET DEFAULT nextval('inventario.movimientos_partidas_id_seq'::regclass);


--
-- Name: clientes_legacy_supplier_json id; Type: DEFAULT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.clientes_legacy_supplier_json ALTER COLUMN id SET DEFAULT nextval('migrate.clientes_legacy_supplier_json_id_seq'::regclass);


--
-- Name: productos_legacy_supplier_json id; Type: DEFAULT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.productos_legacy_supplier_json ALTER COLUMN id SET DEFAULT nextval('migrate.productos_legacy_supplier_json_id_seq'::regclass);


--
-- Name: etapas id; Type: DEFAULT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.etapas ALTER COLUMN id SET DEFAULT nextval('produccion.etapas_id_seq'::regclass);


--
-- Name: seguimientos id; Type: DEFAULT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.seguimientos ALTER COLUMN id SET DEFAULT nextval('produccion.seguimientos_id_seq'::regclass);


--
-- Name: aplicaciones_saldo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_saldo_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: autorizaciones_reglas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas ALTER COLUMN id SET DEFAULT nextval('public.autorizaciones_reglas_id_seq'::regclass);


--
-- Name: autorizaciones_solicitudes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.autorizaciones_solicitudes_id_seq'::regclass);


--
-- Name: conceptos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conceptos ALTER COLUMN id SET DEFAULT nextval('public.conceptos_id_seq'::regclass);


--
-- Name: contactos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos ALTER COLUMN id SET DEFAULT nextval('public.contactos_id_seq'::regclass);


--
-- Name: contactos_datos_fiscales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales ALTER COLUMN id SET DEFAULT nextval('public.contactos_datos_fiscales_id_seq'::regclass);


--
-- Name: contactos_domicilios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios ALTER COLUMN id SET DEFAULT nextval('public.contactos_domicilios_id_seq'::regclass);


--
-- Name: credito_operaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones ALTER COLUMN id SET DEFAULT nextval('public.operaciones_credito_id_seq'::regclass);


--
-- Name: credito_operaciones_aplicaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones ALTER COLUMN id SET DEFAULT nextval('public.operaciones_credito_aplicaciones_id_seq'::regclass);


--
-- Name: credito_operaciones_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items ALTER COLUMN id SET DEFAULT nextval('public.operaciones_credito_items_id_seq'::regclass);


--
-- Name: crm_ruteo_leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads ALTER COLUMN id SET DEFAULT nextval('public.crm_ruteo_leads_id_seq'::regclass);


--
-- Name: documentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos ALTER COLUMN id SET DEFAULT nextval('public.documentos_id_seq'::regclass);


--
-- Name: documentos_campos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos ALTER COLUMN id SET DEFAULT nextval('public.documentos_campos_id_seq'::regclass);


--
-- Name: documentos_cancelacion_intentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos ALTER COLUMN id SET DEFAULT nextval('public.documentos_cancelacion_intentos_id_seq'::regclass);


--
-- Name: documentos_partidas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_id_seq'::regclass);


--
-- Name: documentos_partidas_campos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_campos ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_campos_id_seq'::regclass);


--
-- Name: documentos_partidas_impuestos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_impuestos ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_impuestos_id_seq'::regclass);


--
-- Name: documentos_partidas_vinculos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_vinculos_id_seq'::regclass);


--
-- Name: finanzas_aplicaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_aplicaciones_id_seq'::regclass);


--
-- Name: finanzas_conciliaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_conciliaciones_id_seq'::regclass);


--
-- Name: finanzas_conciliaciones_operaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_conciliaciones_operaciones_id_seq'::regclass);


--
-- Name: finanzas_cuentas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_cuentas ALTER COLUMN id SET DEFAULT nextval('public.finanzas_cuentas_id_seq'::regclass);


--
-- Name: finanzas_metodos_pago id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_metodos_pago ALTER COLUMN id SET DEFAULT nextval('public.finanzas_metodos_pago_id_seq'::regclass);


--
-- Name: finanzas_operaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_operaciones_id_seq'::regclass);


--
-- Name: finanzas_programacion_pagos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos ALTER COLUMN id SET DEFAULT nextval('public.finanzas_programacion_pagos_id_seq'::regclass);


--
-- Name: finanzas_programacion_pagos_detalle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos_detalle ALTER COLUMN id SET DEFAULT nextval('public.finanzas_programacion_pagos_detalle_id_seq'::regclass);


--
-- Name: finanzas_transferencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias ALTER COLUMN id SET DEFAULT nextval('public.finanzas_transferencias_id_seq'::regclass);


--
-- Name: plantillas_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_documento ALTER COLUMN id SET DEFAULT nextval('public.plantillas_documento_id_seq'::regclass);


--
-- Name: precios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios ALTER COLUMN id SET DEFAULT nextval('public.precios_id_seq'::regclass);


--
-- Name: precios_listas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_listas ALTER COLUMN id SET DEFAULT nextval('public.precios_listas_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: productos_archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_archivos ALTER COLUMN id SET DEFAULT nextval('public.productos_archivos_id_seq'::regclass);


--
-- Name: productos_impuestos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_impuestos ALTER COLUMN id SET DEFAULT nextval('public.productos_impuestos_id_seq'::regclass);


--
-- Name: reglas_tratamiento_impuestos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_tratamiento_impuestos ALTER COLUMN id SET DEFAULT nextval('public.reglas_tratamiento_impuestos_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: series_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento ALTER COLUMN id SET DEFAULT nextval('public.series_documento_id_seq'::regclass);


--
-- Name: unidades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades ALTER COLUMN id SET DEFAULT nextval('public.unidades_id_seq'::regclass);


--
-- Name: usuarios_series_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento ALTER COLUMN id SET DEFAULT nextval('public.usuarios_series_documento_id_seq'::regclass);


--
-- Name: unidades id; Type: DEFAULT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.unidades ALTER COLUMN id SET DEFAULT nextval('sat.unidades_id_seq'::regclass);


--
-- Name: config id; Type: DEFAULT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config ALTER COLUMN id SET DEFAULT nextval('whatsapp.config_id_seq'::regclass);


--
-- Name: intentos_contacto id; Type: DEFAULT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.intentos_contacto ALTER COLUMN id SET DEFAULT nextval('whatsapp.intentos_contacto_id_seq'::regclass);


--
-- Name: plantillas id; Type: DEFAULT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.plantillas ALTER COLUMN id SET DEFAULT nextval('whatsapp.plantillas_id_seq'::regclass);


--
-- Name: campos_configuracion campos_configuracion_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT campos_configuracion_pkey PRIMARY KEY (id);


--
-- Name: campos_obligatorios campos_obligatorios_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_obligatorios
    ADD CONSTRAINT campos_obligatorios_pkey PRIMARY KEY (id);


--
-- Name: catalogos catalogos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos
    ADD CONSTRAINT catalogos_pkey PRIMARY KEY (id);


--
-- Name: catalogos_tipos catalogos_tipos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos_tipos
    ADD CONSTRAINT catalogos_tipos_pkey PRIMARY KEY (id);


--
-- Name: cfdi_pac_config cfdi_pac_config_pac_modo_unique; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_pac_config
    ADD CONSTRAINT cfdi_pac_config_pac_modo_unique UNIQUE (pac, modo);


--
-- Name: cfdi_pac_config cfdi_pac_config_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_pac_config
    ADD CONSTRAINT cfdi_pac_config_pkey PRIMARY KEY (id);


--
-- Name: empresas_assets empresas_assets_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_assets
    ADD CONSTRAINT empresas_assets_pkey PRIMARY KEY (id);


--
-- Name: empresas_impuestos_default empresas_impuestos_default_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default
    ADD CONSTRAINT empresas_impuestos_default_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: empresas_tipos_documento empresas_tipos_documento_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT empresas_tipos_documento_pkey PRIMARY KEY (id);


--
-- Name: empresas_tipos_documento_transiciones empresas_tipos_documento_transiciones_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT empresas_tipos_documento_transiciones_pkey PRIMARY KEY (id);


--
-- Name: entidades_catalogos entidades_catalogos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_catalogos
    ADD CONSTRAINT entidades_catalogos_pkey PRIMARY KEY (empresa_id, entidad_tipo_id, entidad_id, catalogo_id);


--
-- Name: entidades_tipos entidades_tipos_codigo_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_tipos
    ADD CONSTRAINT entidades_tipos_codigo_key UNIQUE (codigo);


--
-- Name: entidades_tipos entidades_tipos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_tipos
    ADD CONSTRAINT entidades_tipos_pkey PRIMARY KEY (id);


--
-- Name: grid_preferences grid_preferences_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_pkey PRIMARY KEY (id);


--
-- Name: grid_preferences grid_preferences_unique_scope; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_unique_scope UNIQUE (usuario_id, empresa_id, pantalla, perfil_dispositivo);


--
-- Name: modulos modulos_clave_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.modulos
    ADD CONSTRAINT modulos_clave_key UNIQUE (clave);


--
-- Name: modulos modulos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.modulos
    ADD CONSTRAINT modulos_pkey PRIMARY KEY (modulo_id);


--
-- Name: parametros parametros_clave_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros
    ADD CONSTRAINT parametros_clave_key UNIQUE (clave);


--
-- Name: parametros_empresa parametros_empresa_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_empresa
    ADD CONSTRAINT parametros_empresa_pkey PRIMARY KEY (empresa_id, parametro_id);


--
-- Name: parametros_modulos parametros_modulos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_modulos
    ADD CONSTRAINT parametros_modulos_pkey PRIMARY KEY (parametro_id, modulo_id);


--
-- Name: parametros_opciones parametros_opciones_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones
    ADD CONSTRAINT parametros_opciones_pkey PRIMARY KEY (opcion_id);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (parametro_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: tipos_documento tipos_documento_codigo_unique; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.tipos_documento
    ADD CONSTRAINT tipos_documento_codigo_unique UNIQUE (codigo);


--
-- Name: tipos_documento tipos_documento_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.tipos_documento
    ADD CONSTRAINT tipos_documento_pkey PRIMARY KEY (id);


--
-- Name: empresas_impuestos_default uq_empresas_impuestos_default; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default
    ADD CONSTRAINT uq_empresas_impuestos_default UNIQUE (empresa_id, impuesto_id);


--
-- Name: empresas_tipos_documento uq_empresas_tipos_documento; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT uq_empresas_tipos_documento UNIQUE (empresa_id, tipo_documento_id);


--
-- Name: empresas_tipos_documento_transiciones uq_empresas_tipos_documento_transiciones; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT uq_empresas_tipos_documento_transiciones UNIQUE (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id);


--
-- Name: parametros_opciones uq_parametro_opcion; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones
    ADD CONSTRAINT uq_parametro_opcion UNIQUE (parametro_id, valor);


--
-- Name: usuarios_roles uq_usuarios_roles_usuario_empresa; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT uq_usuarios_roles_usuario_empresa UNIQUE (usuario_id, empresa_id);


--
-- Name: usuarios_empresas usuarios_empresas_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_pkey PRIMARY KEY (usuario_id, empresa_id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios_roles usuarios_roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_pkey PRIMARY KEY (usuario_id, empresa_id, rol_id);


--
-- Name: actividades actividades_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT actividades_pkey PRIMARY KEY (id);


--
-- Name: configuracion_email_empresa configuracion_email_empresa_empresa_uk; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa
    ADD CONSTRAINT configuracion_email_empresa_empresa_uk UNIQUE (empresa_id);


--
-- Name: configuracion_email_empresa configuracion_email_empresa_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa
    ADD CONSTRAINT configuracion_email_empresa_pkey PRIMARY KEY (id);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_pkey PRIMARY KEY (id);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_usuario_empresa_uk; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_usuario_empresa_uk UNIQUE (usuario_id, empresa_id);


--
-- Name: conversacion_etiquetas conversacion_etiquetas_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT conversacion_etiquetas_pkey PRIMARY KEY (id);


--
-- Name: conversaciones conversaciones_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversaciones
    ADD CONSTRAINT conversaciones_pkey PRIMARY KEY (id);


--
-- Name: email_plantillas email_plantillas_empresa_tipo_uk; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas
    ADD CONSTRAINT email_plantillas_empresa_tipo_uk UNIQUE (empresa_id, tipo);


--
-- Name: email_plantillas email_plantillas_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas
    ADD CONSTRAINT email_plantillas_pkey PRIMARY KEY (id);


--
-- Name: etiquetas etiquetas_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.etiquetas
    ADD CONSTRAINT etiquetas_pkey PRIMARY KEY (id);


--
-- Name: mensajes mensajes_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.mensajes
    ADD CONSTRAINT mensajes_pkey PRIMARY KEY (id);


--
-- Name: oportunidades_venta oportunidades_venta_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.oportunidades_venta
    ADD CONSTRAINT oportunidades_venta_pkey PRIMARY KEY (id);


--
-- Name: reglas_seguimiento pk_crm_reglas_seguimiento; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.reglas_seguimiento
    ADD CONSTRAINT pk_crm_reglas_seguimiento PRIMARY KEY (empresa_id);


--
-- Name: conversacion_etiquetas uq_whatsapp_conversacion_etiquetas; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT uq_whatsapp_conversacion_etiquetas UNIQUE (conversacion_id, etiqueta_id);


--
-- Name: existencias existencias_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT existencias_pkey PRIMARY KEY (id);


--
-- Name: movimientos_partidas movimientos_partidas_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT movimientos_partidas_pkey PRIMARY KEY (id);


--
-- Name: movimientos movimientos_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT movimientos_pkey PRIMARY KEY (id);


--
-- Name: almacenes pk_inventario_almacenes; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.almacenes
    ADD CONSTRAINT pk_inventario_almacenes PRIMARY KEY (id);


--
-- Name: existencias uq_inv_existencias_empresa_producto_almacen; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT uq_inv_existencias_empresa_producto_almacen UNIQUE (empresa_id, producto_id, almacen_id);


--
-- Name: clientes_legacy_supplier_json clientes_legacy_supplier_json_pkey; Type: CONSTRAINT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.clientes_legacy_supplier_json
    ADD CONSTRAINT clientes_legacy_supplier_json_pkey PRIMARY KEY (id);


--
-- Name: clientes_legacy_supplier pk_clientes_legacy_supplier; Type: CONSTRAINT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.clientes_legacy_supplier
    ADD CONSTRAINT pk_clientes_legacy_supplier PRIMARY KEY (empresa_id, codigo_legacy);


--
-- Name: productos_legacy_supplier pk_productos_legacy_supplier; Type: CONSTRAINT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.productos_legacy_supplier
    ADD CONSTRAINT pk_productos_legacy_supplier PRIMARY KEY (empresa_id, clave_producto);


--
-- Name: productos_legacy_supplier_json productos_legacy_supplier_json_pkey; Type: CONSTRAINT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.productos_legacy_supplier_json
    ADD CONSTRAINT productos_legacy_supplier_json_pkey PRIMARY KEY (id);


--
-- Name: etapas etapas_pkey; Type: CONSTRAINT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.etapas
    ADD CONSTRAINT etapas_pkey PRIMARY KEY (id);


--
-- Name: seguimientos seguimientos_pkey; Type: CONSTRAINT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.seguimientos
    ADD CONSTRAINT seguimientos_pkey PRIMARY KEY (id);


--
-- Name: aplicaciones_saldo aplicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT aplicaciones_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_pkey PRIMARY KEY (id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: conceptos conceptos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conceptos
    ADD CONSTRAINT conceptos_pkey PRIMARY KEY (id);


--
-- Name: contactos_datos_fiscales contactos_datos_fiscales_contacto_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales
    ADD CONSTRAINT contactos_datos_fiscales_contacto_id_key UNIQUE (contacto_id);


--
-- Name: contactos_datos_fiscales contactos_datos_fiscales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales
    ADD CONSTRAINT contactos_datos_fiscales_pkey PRIMARY KEY (id);


--
-- Name: contactos_domicilios contactos_domicilios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT contactos_domicilios_pkey PRIMARY KEY (id);


--
-- Name: contactos contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (id);


--
-- Name: credito_operaciones_aplicaciones credito_operaciones_aplicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones
    ADD CONSTRAINT credito_operaciones_aplicaciones_pkey PRIMARY KEY (id);


--
-- Name: credito_operaciones credito_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones
    ADD CONSTRAINT credito_operaciones_pkey PRIMARY KEY (id);


--
-- Name: crm_ruteo_leads crm_ruteo_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT crm_ruteo_leads_pkey PRIMARY KEY (id);


--
-- Name: documentos_campos documentos_campos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT documentos_campos_pkey PRIMARY KEY (id);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_pkey PRIMARY KEY (id);


--
-- Name: documentos_cfdi documentos_cfdi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cfdi
    ADD CONSTRAINT documentos_cfdi_pkey PRIMARY KEY (documento_id);


--
-- Name: documentos_partidas_campos documentos_partidas_campos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_campos
    ADD CONSTRAINT documentos_partidas_campos_pkey PRIMARY KEY (id);


--
-- Name: documentos_partidas_impuestos documentos_partidas_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_impuestos
    ADD CONSTRAINT documentos_partidas_impuestos_pkey PRIMARY KEY (id);


--
-- Name: documentos_partidas documentos_partidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT documentos_partidas_pkey PRIMARY KEY (id);


--
-- Name: documentos_partidas_vinculos documentos_partidas_vinculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT documentos_partidas_vinculos_pkey PRIMARY KEY (id);


--
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (id);


--
-- Name: finanzas_aplicaciones finanzas_aplicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones
    ADD CONSTRAINT finanzas_aplicaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_conciliaciones_operaciones finanzas_conciliaciones_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT finanzas_conciliaciones_operaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_conciliaciones finanzas_conciliaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones
    ADD CONSTRAINT finanzas_conciliaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_cuentas finanzas_cuentas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_cuentas
    ADD CONSTRAINT finanzas_cuentas_pkey PRIMARY KEY (id);


--
-- Name: finanzas_metodos_pago finanzas_metodos_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_metodos_pago
    ADD CONSTRAINT finanzas_metodos_pago_pkey PRIMARY KEY (id);


--
-- Name: finanzas_operaciones finanzas_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT finanzas_operaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_programacion_pagos_detalle finanzas_programacion_pagos_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos_detalle
    ADD CONSTRAINT finanzas_programacion_pagos_detalle_pkey PRIMARY KEY (id);


--
-- Name: finanzas_programacion_pagos finanzas_programacion_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos
    ADD CONSTRAINT finanzas_programacion_pagos_pkey PRIMARY KEY (id);


--
-- Name: finanzas_transferencias finanzas_transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias
    ADD CONSTRAINT finanzas_transferencias_pkey PRIMARY KEY (id);


--
-- Name: impuestos impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impuestos
    ADD CONSTRAINT impuestos_pkey PRIMARY KEY (id);


--
-- Name: credito_operaciones_items operaciones_credito_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT operaciones_credito_items_pkey PRIMARY KEY (id);


--
-- Name: plantillas_documento plantillas_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_documento
    ADD CONSTRAINT plantillas_documento_pkey PRIMARY KEY (id);


--
-- Name: precios_listas precios_listas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_listas
    ADD CONSTRAINT precios_listas_pkey PRIMARY KEY (id);


--
-- Name: precios precios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT precios_pkey PRIMARY KEY (id);


--
-- Name: productos_archivos productos_archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_archivos
    ADD CONSTRAINT productos_archivos_pkey PRIMARY KEY (id);


--
-- Name: productos_impuestos productos_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_impuestos
    ADD CONSTRAINT productos_impuestos_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: reglas_tratamiento_impuestos reglas_tratamiento_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_tratamiento_impuestos
    ADD CONSTRAINT reglas_tratamiento_impuestos_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: series_documento series_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT series_documento_pkey PRIMARY KEY (id);


--
-- Name: unidades unidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades
    ADD CONSTRAINT unidades_pkey PRIMARY KEY (id);


--
-- Name: crm_ruteo_leads uq_crl_empresa_origen; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT uq_crl_empresa_origen UNIQUE (empresa_id, origen);


--
-- Name: finanzas_programacion_pagos_detalle uq_det_prog_doc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos_detalle
    ADD CONSTRAINT uq_det_prog_doc UNIQUE (programacion_id, documento_id);


--
-- Name: documentos_partidas_vinculos uq_doc_partidas_vinculos; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT uq_doc_partidas_vinculos UNIQUE (partida_origen_id, partida_destino_id);


--
-- Name: finanzas_metodos_pago uq_finanzas_metodos_pago_empresa_clave; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_metodos_pago
    ADD CONSTRAINT uq_finanzas_metodos_pago_empresa_clave UNIQUE (empresa_id, clave);


--
-- Name: productos uq_productos_empresa_clave; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT uq_productos_empresa_clave UNIQUE (empresa_id, clave);


--
-- Name: series_documento uq_series_documento_empresa_tipo_serie; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT uq_series_documento_empresa_tipo_serie UNIQUE (empresa_id, tipo_documento, serie);


--
-- Name: unidades uq_unidad_empresa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades
    ADD CONSTRAINT uq_unidad_empresa UNIQUE (empresa_id, clave);


--
-- Name: usuarios_series_documento uq_usuarios_series_documento; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT uq_usuarios_series_documento UNIQUE (usuario_id, serie_documento_id);


--
-- Name: usuarios_series_documento usuarios_series_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT usuarios_series_documento_pkey PRIMARY KEY (id);


--
-- Name: contactos_domicilios ux_cd_identificador; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT ux_cd_identificador UNIQUE (contacto_id, identificador);


--
-- Name: conceptos ux_concepto_empresa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conceptos
    ADD CONSTRAINT ux_concepto_empresa UNIQUE (empresa_id, nombre_concepto);


--
-- Name: finanzas_cuentas ux_fc_identificador; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_cuentas
    ADD CONSTRAINT ux_fc_identificador UNIQUE (empresa_id, identificador);


--
-- Name: finanzas_conciliaciones_operaciones ux_fco_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT ux_fco_unique UNIQUE (conciliacion_id, operacion_id);


--
-- Name: aduanas aduanas_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.aduanas
    ADD CONSTRAINT aduanas_pkey PRIMARY KEY (id);


--
-- Name: claves_unidades claves_unidades_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.claves_unidades
    ADD CONSTRAINT claves_unidades_pkey PRIMARY KEY (id);


--
-- Name: codigos_postales codigos_postales_cp_key; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.codigos_postales
    ADD CONSTRAINT codigos_postales_cp_key UNIQUE (id);


--
-- Name: codigos_postales codigos_postales_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.codigos_postales
    ADD CONSTRAINT codigos_postales_pkey PRIMARY KEY (id);


--
-- Name: colonias colonias_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.colonias
    ADD CONSTRAINT colonias_pkey PRIMARY KEY (codigo_postal, colonia);


--
-- Name: estados estados_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.estados
    ADD CONSTRAINT estados_pkey PRIMARY KEY (estado);


--
-- Name: exportaciones exportaciones_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.exportaciones
    ADD CONSTRAINT exportaciones_pkey PRIMARY KEY (id);


--
-- Name: formas_pago formas_pago_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.formas_pago
    ADD CONSTRAINT formas_pago_pkey PRIMARY KEY (id);


--
-- Name: impuestos impuestos_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.impuestos
    ADD CONSTRAINT impuestos_pkey PRIMARY KEY (id);


--
-- Name: localidades localidades_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.localidades
    ADD CONSTRAINT localidades_pkey PRIMARY KEY (estado, localidad);


--
-- Name: meses meses_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.meses
    ADD CONSTRAINT meses_pkey PRIMARY KEY (id);


--
-- Name: metodos_pago metodos_pago_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.metodos_pago
    ADD CONSTRAINT metodos_pago_pkey PRIMARY KEY (id);


--
-- Name: monedas monedas_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.monedas
    ADD CONSTRAINT monedas_pkey PRIMARY KEY (id);


--
-- Name: municipios municipios_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.municipios
    ADD CONSTRAINT municipios_pkey PRIMARY KEY (estado, municipio);


--
-- Name: numeros_pedimento_aduana numeros_pedimento_aduana_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.numeros_pedimento_aduana
    ADD CONSTRAINT numeros_pedimento_aduana_pkey PRIMARY KEY (aduana, patente, ejercicio);


--
-- Name: objetos_impuestos objetos_impuestos_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.objetos_impuestos
    ADD CONSTRAINT objetos_impuestos_pkey PRIMARY KEY (id);


--
-- Name: paises paises_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.paises
    ADD CONSTRAINT paises_pkey PRIMARY KEY (id);


--
-- Name: patentes_aduanales patentes_aduanales_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.patentes_aduanales
    ADD CONSTRAINT patentes_aduanales_pkey PRIMARY KEY (id);


--
-- Name: periodicidades periodicidades_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.periodicidades
    ADD CONSTRAINT periodicidades_pkey PRIMARY KEY (id);


--
-- Name: productos_servicios productos_servicios_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.productos_servicios
    ADD CONSTRAINT productos_servicios_pkey PRIMARY KEY (id);


--
-- Name: regimenes_fiscales regimenes_fiscales_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.regimenes_fiscales
    ADD CONSTRAINT regimenes_fiscales_pkey PRIMARY KEY (id);


--
-- Name: reglas_tasa_cuota reglas_tasa_cuota_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.reglas_tasa_cuota
    ADD CONSTRAINT reglas_tasa_cuota_pkey PRIMARY KEY (tipo, impuesto, factor, minimo, valor);


--
-- Name: tipos_comprobantes tipos_comprobantes_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.tipos_comprobantes
    ADD CONSTRAINT tipos_comprobantes_pkey PRIMARY KEY (id);


--
-- Name: tipos_factores tipos_factores_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.tipos_factores
    ADD CONSTRAINT tipos_factores_pkey PRIMARY KEY (id);


--
-- Name: tipos_relaciones tipos_relaciones_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.tipos_relaciones
    ADD CONSTRAINT tipos_relaciones_pkey PRIMARY KEY (id);


--
-- Name: unidades unidades_clave_key; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.unidades
    ADD CONSTRAINT unidades_clave_key UNIQUE (clave);


--
-- Name: unidades unidades_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.unidades
    ADD CONSTRAINT unidades_pkey PRIMARY KEY (id);


--
-- Name: usos_cfdi usos_cfdi_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.usos_cfdi
    ADD CONSTRAINT usos_cfdi_pkey PRIMARY KEY (id);


--
-- Name: config config_empresa_id_uk; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config
    ADD CONSTRAINT config_empresa_id_uk UNIQUE (empresa_id);


--
-- Name: config config_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (id);


--
-- Name: contacto_estado contacto_estado_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.contacto_estado
    ADD CONSTRAINT contacto_estado_pkey PRIMARY KEY (empresa_id, telefono);


--
-- Name: contacto_mapeo contacto_mapeo_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.contacto_mapeo
    ADD CONSTRAINT contacto_mapeo_pkey PRIMARY KEY (numero_telefono);


--
-- Name: estadisticas estadisticas_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.estadisticas
    ADD CONSTRAINT estadisticas_pkey PRIMARY KEY (empresa_id, fecha);


--
-- Name: intentos_contacto intentos_contacto_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.intentos_contacto
    ADD CONSTRAINT intentos_contacto_pkey PRIMARY KEY (id);


--
-- Name: plantillas plantillas_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.plantillas
    ADD CONSTRAINT plantillas_pkey PRIMARY KEY (id);


--
-- Name: idx_campos_configuracion_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_campos_configuracion_empresa ON core.campos_configuracion USING btree (empresa_id);


--
-- Name: INDEX idx_campos_configuracion_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_campos_configuracion_empresa IS 'Optimiza consultas de campos configurables filtradas por empresa.';


--
-- Name: idx_campos_configuracion_entidad; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_campos_configuracion_entidad ON core.campos_configuracion USING btree (entidad_tipo_id);


--
-- Name: INDEX idx_campos_configuracion_entidad; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_campos_configuracion_entidad IS 'Optimiza consultas de campos configurables por tipo de entidad.';


--
-- Name: idx_catalogos_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_empresa ON core.catalogos USING btree (empresa_id);


--
-- Name: INDEX idx_catalogos_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_catalogos_empresa IS 'Optimiza consultas de catálogos filtradas por empresa';


--
-- Name: idx_catalogos_padre; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_padre ON core.catalogos USING btree (catalogo_padre_id);


--
-- Name: INDEX idx_catalogos_padre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_catalogos_padre IS 'Optimiza consultas que filtran registros por catálogo padre (ejemplo: modelos de una marca).';


--
-- Name: idx_catalogos_precio_lista; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_precio_lista ON core.catalogos USING btree (precio_lista_id) WHERE (precio_lista_id IS NOT NULL);


--
-- Name: idx_catalogos_tipo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_tipo ON core.catalogos USING btree (empresa_id, tipo_catalogo_id);


--
-- Name: INDEX idx_catalogos_tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_catalogos_tipo IS 'Optimiza consultas por tipo de catálogo';


--
-- Name: idx_catalogos_tipos_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_tipos_empresa ON core.catalogos_tipos USING btree (empresa_id);


--
-- Name: INDEX idx_catalogos_tipos_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_catalogos_tipos_empresa IS 'Optimiza consultas de tipos de catálogo por empresa';


--
-- Name: idx_empresas_assets_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_assets_empresa ON core.empresas_assets USING btree (empresa_id);


--
-- Name: INDEX idx_empresas_assets_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_assets_empresa IS 'Optimiza consultas de assets por empresa';


--
-- Name: idx_empresas_assets_tipo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_assets_tipo ON core.empresas_assets USING btree (empresa_id, tipo);


--
-- Name: INDEX idx_empresas_assets_tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_assets_tipo IS 'Optimiza consultas de assets por empresa y tipo';


--
-- Name: idx_empresas_cp; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_cp ON core.empresas USING btree (codigo_postal_id);


--
-- Name: INDEX idx_empresas_cp; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_cp IS 'Optimiza consultas por código postal';


--
-- Name: idx_empresas_estado; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_estado ON core.empresas USING btree (estado_id);


--
-- Name: INDEX idx_empresas_estado; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_estado IS 'Optimiza consultas por estado';


--
-- Name: idx_empresas_identificador; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_empresas_identificador ON core.empresas USING btree (identificador);


--
-- Name: INDEX idx_empresas_identificador; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_identificador IS 'Garantiza unicidad del alias de empresa';


--
-- Name: idx_empresas_impuestos_default_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_impuestos_default_empresa ON core.empresas_impuestos_default USING btree (empresa_id);


--
-- Name: idx_empresas_impuestos_default_impuesto; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_impuestos_default_impuesto ON core.empresas_impuestos_default USING btree (impuesto_id);


--
-- Name: idx_empresas_nombre; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_nombre ON core.empresas USING btree (nombre);


--
-- Name: INDEX idx_empresas_nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_nombre IS 'Optimiza búsquedas por nombre de empresa';


--
-- Name: idx_empresas_regimen; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_regimen ON core.empresas USING btree (regimen_fiscal_id);


--
-- Name: INDEX idx_empresas_regimen; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_regimen IS 'Optimiza consultas por régimen fiscal';


--
-- Name: idx_empresas_rfc; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_empresas_rfc ON core.empresas USING btree (rfc);


--
-- Name: INDEX idx_empresas_rfc; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_rfc IS 'Optimiza búsqueda de empresa por RFC';


--
-- Name: idx_empresas_tipos_documento_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_tipos_documento_empresa ON core.empresas_tipos_documento USING btree (empresa_id);


--
-- Name: idx_empresas_tipos_documento_tipo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_tipos_documento_tipo ON core.empresas_tipos_documento USING btree (tipo_documento_id);


--
-- Name: INDEX idx_empresas_tipos_documento_tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_tipos_documento_tipo IS 'Índice para consultas por tipo de documento.';


--
-- Name: idx_empresas_tipos_documento_whatsapp_plantilla; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_tipos_documento_whatsapp_plantilla ON core.empresas_tipos_documento USING btree (whatsapp_plantilla_default_id);


--
-- Name: idx_entidades_catalogos_entidad; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_entidades_catalogos_entidad ON core.entidades_catalogos USING btree (empresa_id, entidad_tipo_id, entidad_id);


--
-- Name: INDEX idx_entidades_catalogos_entidad; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_entidades_catalogos_entidad IS 'Optimiza consultas de catálogos asociados a una entidad';


--
-- Name: idx_etdt_destino; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_etdt_destino ON core.empresas_tipos_documento_transiciones USING btree (tipo_documento_destino_id);


--
-- Name: INDEX idx_etdt_destino; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_etdt_destino IS 'Índice para consultas por tipo de documento destino.';


--
-- Name: idx_etdt_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_etdt_empresa ON core.empresas_tipos_documento_transiciones USING btree (empresa_id);


--
-- Name: INDEX idx_etdt_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_etdt_empresa IS 'Índice para consultas por empresa.';


--
-- Name: idx_etdt_origen; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_etdt_origen ON core.empresas_tipos_documento_transiciones USING btree (tipo_documento_origen_id);


--
-- Name: INDEX idx_etdt_origen; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_etdt_origen IS 'Índice para consultas por tipo de documento origen.';


--
-- Name: idx_grid_preferences_lookup; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_grid_preferences_lookup ON core.grid_preferences USING btree (usuario_id, empresa_id, pantalla, perfil_dispositivo);


--
-- Name: idx_grid_preferences_updated_at; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_grid_preferences_updated_at ON core.grid_preferences USING btree (updated_at DESC);


--
-- Name: idx_parametros_empresa_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_empresa_empresa ON core.parametros_empresa USING btree (empresa_id);


--
-- Name: idx_parametros_empresa_parametro; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_empresa_parametro ON core.parametros_empresa USING btree (parametro_id);


--
-- Name: idx_parametros_opciones_parametro; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_opciones_parametro ON core.parametros_opciones USING btree (parametro_id);


--
-- Name: idx_parametros_padre; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_padre ON core.parametros USING btree (parametro_padre_id);


--
-- Name: idx_roles_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_roles_empresa ON core.roles USING btree (empresa_id);


--
-- Name: INDEX idx_roles_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_roles_empresa IS 'Optimiza consultas de roles por empresa';


--
-- Name: idx_roles_empresa_nombre; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_roles_empresa_nombre ON core.roles USING btree (empresa_id, nombre);


--
-- Name: idx_tipos_documento_modulo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_tipos_documento_modulo ON core.tipos_documento USING btree (modulo);


--
-- Name: INDEX idx_tipos_documento_modulo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_tipos_documento_modulo IS 'Permite filtrar rápidamente tipos de documento por módulo (ventas o compras).';


--
-- Name: idx_usuarios_email; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_usuarios_email ON core.usuarios USING btree (email);


--
-- Name: INDEX idx_usuarios_email; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_usuarios_email IS 'Garantiza unicidad del correo electrónico';


--
-- Name: idx_usuarios_empresas_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_usuarios_empresas_empresa ON core.usuarios_empresas USING btree (empresa_id);


--
-- Name: INDEX idx_usuarios_empresas_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_usuarios_empresas_empresa IS 'Optimiza consultas de usuarios por empresa';


--
-- Name: idx_usuarios_roles_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_usuarios_roles_empresa ON core.usuarios_roles USING btree (empresa_id);


--
-- Name: INDEX idx_usuarios_roles_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_usuarios_roles_empresa IS 'Optimiza consultas de roles por empresa';


--
-- Name: idx_usuarios_vendedor_contacto_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_usuarios_vendedor_contacto_id ON core.usuarios USING btree (vendedor_contacto_id);


--
-- Name: ux_campos_configuracion_empresa_proposito_sistema; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_campos_configuracion_empresa_proposito_sistema ON core.campos_configuracion USING btree (empresa_id, proposito_sistema) WHERE (proposito_sistema IS NOT NULL);


--
-- Name: ux_campos_obligatorios; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_campos_obligatorios ON core.campos_obligatorios USING btree (empresa_id, entidad, contexto, campo);


--
-- Name: ux_catalogos_tipos_empresa_nombre; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_catalogos_tipos_empresa_nombre ON core.catalogos_tipos USING btree (empresa_id, nombre);


--
-- Name: INDEX ux_catalogos_tipos_empresa_nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.ux_catalogos_tipos_empresa_nombre IS 'Evita duplicar nombres de catálogo dentro de una empresa';


--
-- Name: ux_cfdi_pac_config_activo_modo; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_cfdi_pac_config_activo_modo ON core.cfdi_pac_config USING btree (modo) WHERE (activo = true);


--
-- Name: idx_actividades_contacto; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_contacto ON crm.actividades USING btree (contacto_id);


--
-- Name: idx_actividades_estatus; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_estatus ON crm.actividades USING btree (estatus);


--
-- Name: idx_actividades_oportunidad; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_oportunidad ON crm.actividades USING btree (oportunidad_id);


--
-- Name: idx_actividades_usuario_asignado_fecha; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_usuario_asignado_fecha ON crm.actividades USING btree (usuario_asignado_id, fecha_programada);


--
-- Name: idx_whatsapp_conversacion_etiquetas_empresa_conversacion; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_whatsapp_conversacion_etiquetas_empresa_conversacion ON crm.conversacion_etiquetas USING btree (empresa_id, conversacion_id);


--
-- Name: INDEX idx_whatsapp_conversacion_etiquetas_empresa_conversacion; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.idx_whatsapp_conversacion_etiquetas_empresa_conversacion IS 'Optimiza búsqueda de etiquetas por conversación y empresa';


--
-- Name: idx_whatsapp_conversacion_etiquetas_etiqueta; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_whatsapp_conversacion_etiquetas_etiqueta ON crm.conversacion_etiquetas USING btree (etiqueta_id);


--
-- Name: INDEX idx_whatsapp_conversacion_etiquetas_etiqueta; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.idx_whatsapp_conversacion_etiquetas_etiqueta IS 'Optimiza consultas de conversaciones por etiqueta';


--
-- Name: idx_whatsapp_etiquetas_empresa_activo; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_whatsapp_etiquetas_empresa_activo ON crm.etiquetas USING btree (empresa_id, activo);


--
-- Name: INDEX idx_whatsapp_etiquetas_empresa_activo; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.idx_whatsapp_etiquetas_empresa_activo IS 'Optimiza consultas de etiquetas activas por empresa';


--
-- Name: ix_conv_empresa_estado; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX ix_conv_empresa_estado ON crm.conversaciones USING btree (empresa_id, estado);


--
-- Name: ix_mensajes_empresa_fecha; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX ix_mensajes_empresa_fecha ON crm.mensajes USING btree (empresa_id, fecha_envio DESC);


--
-- Name: ux_crm_reglas_seguimiento_empresa_id; Type: INDEX; Schema: crm; Owner: -
--

CREATE UNIQUE INDEX ux_crm_reglas_seguimiento_empresa_id ON crm.reglas_seguimiento USING btree (empresa_id);


--
-- Name: ux_mensaje_externo; Type: INDEX; Schema: crm; Owner: -
--

CREATE UNIQUE INDEX ux_mensaje_externo ON crm.mensajes USING btree (empresa_id, id_externo) WHERE (id_externo IS NOT NULL);


--
-- Name: ux_whatsapp_etiquetas_empresa_nombre; Type: INDEX; Schema: crm; Owner: -
--

CREATE UNIQUE INDEX ux_whatsapp_etiquetas_empresa_nombre ON crm.etiquetas USING btree (empresa_id, lower(nombre));


--
-- Name: INDEX ux_whatsapp_etiquetas_empresa_nombre; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.ux_whatsapp_etiquetas_empresa_nombre IS 'Evita duplicados de nombre de etiqueta por empresa (case-insensitive)';


--
-- Name: idx_inv_existencias_lookup; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_existencias_lookup ON inventario.existencias USING btree (empresa_id, producto_id, almacen_id);


--
-- Name: INDEX idx_inv_existencias_lookup; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_existencias_lookup IS 'Índice para consultas rápidas de existencias por empresa, producto y almacén.';


--
-- Name: idx_inv_mov_documento; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_mov_documento ON inventario.movimientos USING btree (documento_id);


--
-- Name: INDEX idx_inv_mov_documento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_mov_documento IS 'Índice para localizar movimientos originados por documentos.';


--
-- Name: idx_inv_mov_empresa; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_mov_empresa ON inventario.movimientos USING btree (empresa_id);


--
-- Name: INDEX idx_inv_mov_empresa; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_mov_empresa IS 'Índice para consultas de movimientos por empresa.';


--
-- Name: idx_inv_mov_tipo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_mov_tipo ON inventario.movimientos USING btree (empresa_id, tipo_movimiento);


--
-- Name: INDEX idx_inv_mov_tipo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_mov_tipo IS 'Índice para consultas de movimientos por empresa y tipo de movimiento.';


--
-- Name: idx_inv_part_kardex; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_kardex ON inventario.movimientos_partidas USING btree (empresa_id, producto_id, almacen_id, fecha_movimiento, id);


--
-- Name: INDEX idx_inv_part_kardex; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_part_kardex IS 'Índice principal para recorridos de kardex y recalculo histórico por empresa, producto y almacén.';


--
-- Name: idx_inv_part_movimiento; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_movimiento ON inventario.movimientos_partidas USING btree (movimiento_id);


--
-- Name: INDEX idx_inv_part_movimiento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_part_movimiento IS 'Índice para recuperar rápidamente las partidas de un movimiento.';


--
-- Name: idx_inv_part_recalculo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_recalculo ON inventario.movimientos_partidas USING btree (empresa_id, producto_id, almacen_id, id);


--
-- Name: idx_inv_part_transferencia_destino; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_transferencia_destino ON inventario.movimientos_partidas USING btree (empresa_id, producto_id, almacen_destino_id, fecha_movimiento, id);


--
-- Name: INDEX idx_inv_part_transferencia_destino; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_part_transferencia_destino IS 'Índice auxiliar para rastrear transferencias hacia un almacén destino.';


--
-- Name: idx_inventario_almacenes_empresa_activo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inventario_almacenes_empresa_activo ON inventario.almacenes USING btree (empresa_id, activo);


--
-- Name: INDEX idx_inventario_almacenes_empresa_activo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inventario_almacenes_empresa_activo IS 'Índice para filtrar almacenes activos por empresa.';


--
-- Name: idx_inventario_almacenes_empresa_id; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inventario_almacenes_empresa_id ON inventario.almacenes USING btree (empresa_id);


--
-- Name: INDEX idx_inventario_almacenes_empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inventario_almacenes_empresa_id IS 'Índice para búsquedas de almacenes por empresa.';


--
-- Name: idx_inventario_almacenes_empresa_nombre; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inventario_almacenes_empresa_nombre ON inventario.almacenes USING btree (empresa_id, nombre);


--
-- Name: INDEX idx_inventario_almacenes_empresa_nombre; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inventario_almacenes_empresa_nombre IS 'Índice para búsquedas y ordenamientos por nombre dentro de la empresa.';


--
-- Name: uq_inventario_almacenes_empresa_clave; Type: INDEX; Schema: inventario; Owner: -
--

CREATE UNIQUE INDEX uq_inventario_almacenes_empresa_clave ON inventario.almacenes USING btree (empresa_id, clave);


--
-- Name: INDEX uq_inventario_almacenes_empresa_clave; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.uq_inventario_almacenes_empresa_clave IS 'Garantiza que la clave del almacén no se repita dentro de una misma empresa.';


--
-- Name: idx_produccion_etapas_empresa; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_etapas_empresa ON produccion.etapas USING btree (empresa_id);


--
-- Name: idx_produccion_etapas_empresa_orden; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_etapas_empresa_orden ON produccion.etapas USING btree (empresa_id, orden);


--
-- Name: idx_produccion_seguimientos_documento; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_seguimientos_documento ON produccion.seguimientos USING btree (documento_id);


--
-- Name: idx_produccion_seguimientos_empresa; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_seguimientos_empresa ON produccion.seguimientos USING btree (empresa_id);


--
-- Name: idx_produccion_seguimientos_etapa; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_seguimientos_etapa ON produccion.seguimientos USING btree (etapa_id);


--
-- Name: documentos_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documentos_unico ON public.documentos USING btree (empresa_id, lower((tipo_documento)::text), COALESCE(serie, ''::character varying), numero);


--
-- Name: idx_aplicaciones_doc_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_doc_destino ON public.aplicaciones_saldo USING btree (documento_destino_id);


--
-- Name: INDEX idx_aplicaciones_doc_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_doc_destino IS 'Optimiza consultas para calcular saldo pendiente de documentos destino (facturas).';


--
-- Name: idx_aplicaciones_doc_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_doc_origen ON public.aplicaciones_saldo USING btree (documento_origen_id);


--
-- Name: INDEX idx_aplicaciones_doc_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_doc_origen IS 'Optimiza consultas para calcular saldo disponible de notas de crédito.';


--
-- Name: idx_aplicaciones_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_empresa ON public.aplicaciones_saldo USING btree (empresa_id);


--
-- Name: INDEX idx_aplicaciones_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_empresa IS 'Permite filtrar rápidamente aplicaciones por empresa.';


--
-- Name: idx_aplicaciones_operacion_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_operacion_empresa ON public.aplicaciones_saldo USING btree (empresa_id, finanzas_operacion_id);


--
-- Name: idx_aplicaciones_saldo_operacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_saldo_operacion ON public.aplicaciones_saldo USING btree (finanzas_operacion_id);


--
-- Name: INDEX idx_aplicaciones_saldo_operacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_saldo_operacion IS 'Optimiza consultas para calcular saldo de operaciones financieras (pagos).';


--
-- Name: idx_aut_reglas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_reglas_empresa ON public.autorizaciones_reglas USING btree (empresa_id);


--
-- Name: INDEX idx_aut_reglas_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_reglas_empresa IS 'Acelera la consulta de políticas activas al filtrar por empresa_id.';


--
-- Name: idx_aut_reglas_transicion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_reglas_transicion ON public.autorizaciones_reglas USING btree (transicion_id);


--
-- Name: INDEX idx_aut_reglas_transicion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_reglas_transicion IS 'Acelera la búsqueda de políticas para una transición concreta durante la validación en tiempo de ejecución y la detección de traslape de rangos.';


--
-- Name: idx_aut_sol_autorizador_resp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_autorizador_resp ON public.autorizaciones_solicitudes USING btree (usuario_autorizador_id);


--
-- Name: INDEX idx_aut_sol_autorizador_resp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_autorizador_resp IS 'Acelera la búsqueda de solicitudes respondidas por un autorizador específico.';


--
-- Name: idx_aut_sol_doc_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_doc_origen ON public.autorizaciones_solicitudes USING btree (documento_origen_id);


--
-- Name: INDEX idx_aut_sol_doc_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_doc_origen IS 'Acelera la búsqueda de solicitudes existentes para un documento origen concreto; usado al verificar si ya existe una solicitud pendiente antes de crear una nueva.';


--
-- Name: idx_aut_sol_empresa_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_empresa_estado ON public.autorizaciones_solicitudes USING btree (empresa_id, estado);


--
-- Name: INDEX idx_aut_sol_empresa_estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_empresa_estado IS 'Acelera la consulta de solicitudes por empresa y estado; cubre el filtro principal de la bandeja (empresa_id + estado=pendiente) y de Mis Solicitudes.';


--
-- Name: idx_aut_sol_solicitante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_solicitante ON public.autorizaciones_solicitudes USING btree (usuario_solicitante_id);


--
-- Name: INDEX idx_aut_sol_solicitante; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_solicitante IS 'Acelera la vista "Mis Solicitudes", que filtra por usuario_solicitante_id.';


--
-- Name: idx_cd_cp_sat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cd_cp_sat ON public.contactos_domicilios USING btree (cp_sat);


--
-- Name: idx_conceptos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conceptos_empresa ON public.conceptos USING btree (empresa_id);


--
-- Name: idx_conceptos_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conceptos_orden ON public.conceptos USING btree (empresa_id, orden);


--
-- Name: idx_conceptos_rubro_presupuesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conceptos_rubro_presupuesto ON public.conceptos USING btree (empresa_id, rubro_presupuesto_id);


--
-- Name: idx_contactos_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_email_trgm ON public.contactos USING gin (email sat.gin_trgm_ops) WHERE (email IS NOT NULL);


--
-- Name: idx_contactos_nombre_contacto_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_nombre_contacto_trgm ON public.contactos USING gin (nombre_contacto sat.gin_trgm_ops) WHERE (nombre_contacto IS NOT NULL);


--
-- Name: idx_contactos_nombre_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_nombre_trgm ON public.contactos USING gin (nombre sat.gin_trgm_ops);


--
-- Name: idx_contactos_precio_lista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_precio_lista ON public.contactos USING btree (precio_lista_id);


--
-- Name: idx_contactos_telefono_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_telefono_trgm ON public.contactos USING gin (telefono sat.gin_trgm_ops) WHERE (telefono IS NOT NULL);


--
-- Name: idx_dc_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dc_documento ON public.documentos_campos USING btree (documento_id);


--
-- Name: INDEX idx_dc_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_dc_documento IS 'Optimiza consultas de campos dinámicos por documento.';


--
-- Name: idx_dc_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dc_empresa ON public.documentos_campos USING btree (empresa_id);


--
-- Name: INDEX idx_dc_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_dc_empresa IS 'Optimiza consultas de campos dinámicos filtradas por empresa.';


--
-- Name: idx_dci_documento_empresa_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dci_documento_empresa_estado ON public.documentos_cancelacion_intentos USING btree (documento_id, empresa_id, estado);


--
-- Name: idx_doc_partidas_vinculos_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_destino ON public.documentos_partidas_vinculos USING btree (partida_destino_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_destino IS 'Índice para consultas por partida destino.';


--
-- Name: idx_doc_partidas_vinculos_doc_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_doc_destino ON public.documentos_partidas_vinculos USING btree (documento_destino_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_doc_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_doc_destino IS 'Índice para consultas por documento destino.';


--
-- Name: idx_doc_partidas_vinculos_doc_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_doc_origen ON public.documentos_partidas_vinculos USING btree (documento_origen_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_doc_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_doc_origen IS 'Índice para consultas por documento origen.';


--
-- Name: idx_doc_partidas_vinculos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_empresa ON public.documentos_partidas_vinculos USING btree (empresa_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_empresa IS 'Índice para consultas por empresa.';


--
-- Name: idx_doc_partidas_vinculos_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_origen ON public.documentos_partidas_vinculos USING btree (partida_origen_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_origen IS 'Índice para consultas por partida origen.';


--
-- Name: idx_documentos_almacen_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_almacen_id ON public.documentos USING btree (almacen_id);


--
-- Name: idx_documentos_campos_empresa_documento_campo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_documentos_campos_empresa_documento_campo ON public.documentos_campos USING btree (empresa_id, documento_id, campo_id);


--
-- Name: INDEX idx_documentos_campos_empresa_documento_campo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_documentos_campos_empresa_documento_campo IS 'Índice único que soporta el UPSERT del motor de campos dinámicos sobre documentos (empresa_id, documento_id, campo_id).';


--
-- Name: idx_documentos_cfdi_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_cfdi_estado ON public.documentos_cfdi USING btree (estado_sat);


--
-- Name: idx_documentos_cfdi_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_cfdi_uuid ON public.documentos_cfdi USING btree (uuid);


--
-- Name: idx_documentos_concepto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_concepto_id ON public.documentos USING btree (concepto_id);


--
-- Name: idx_documentos_estado_seguimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_estado_seguimiento ON public.documentos USING btree (estado_seguimiento);


--
-- Name: idx_documentos_factura_global_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_factura_global_id ON public.documentos USING btree (factura_global_id) WHERE (factura_global_id IS NOT NULL);


--
-- Name: idx_documentos_motivo_nc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_motivo_nc ON public.documentos USING btree (motivo_nc);


--
-- Name: idx_documentos_numero_externo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_numero_externo ON public.documentos USING btree (empresa_id, numero_externo) WHERE (((tipo_documento)::text = ANY ((ARRAY['factura_compra'::character varying, 'nota_credito_compra'::character varying])::text[])) AND (numero_externo IS NOT NULL));


--
-- Name: idx_documentos_oportunidad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_oportunidad_id ON public.documentos USING btree (oportunidad_id);


--
-- Name: idx_documentos_partidas_almacen_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_almacen_id ON public.documentos_partidas USING btree (almacen_id);


--
-- Name: idx_documentos_partidas_campos_empresa_partida_campo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_documentos_partidas_campos_empresa_partida_campo ON public.documentos_partidas_campos USING btree (empresa_id, partida_id, campo_id);


--
-- Name: INDEX idx_documentos_partidas_campos_empresa_partida_campo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_documentos_partidas_campos_empresa_partida_campo IS 'Índice único que soporta el UPSERT del motor de campos dinámicos sobre partidas (empresa_id, partida_id, campo_id).';


--
-- Name: idx_documentos_partidas_comentarios_internos_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_comentarios_internos_trgm ON public.documentos_partidas USING gin (comentarios_internos sat.gin_trgm_ops) WHERE (comentarios_internos IS NOT NULL);


--
-- Name: idx_documentos_partidas_descripcion_alterna_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_descripcion_alterna_trgm ON public.documentos_partidas USING gin (descripcion_alterna sat.gin_trgm_ops) WHERE (descripcion_alterna IS NOT NULL);


--
-- Name: idx_documentos_partidas_impuestos_partida_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_impuestos_partida_id ON public.documentos_partidas_impuestos USING btree (partida_id);


--
-- Name: INDEX idx_documentos_partidas_impuestos_partida_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_documentos_partidas_impuestos_partida_id IS 'Optimiza consultas que filtran por partida_id (cálculo y lectura de impuestos por partida).';


--
-- Name: idx_documentos_partidas_observaciones_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_observaciones_trgm ON public.documentos_partidas USING gin (observaciones sat.gin_trgm_ops) WHERE (observaciones IS NOT NULL);


--
-- Name: idx_documentos_partidas_precio_editado_manual; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_precio_editado_manual ON public.documentos_partidas USING btree (precio_editado_manual);


--
-- Name: idx_documentos_partidas_precio_lista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_precio_lista ON public.documentos_partidas USING btree (precio_lista_id);


--
-- Name: idx_documentos_publico_general_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_publico_general_pendiente ON public.documentos USING btree (empresa_id, tratamiento_impuestos, es_publico_general, factura_global_id) WHERE (((tipo_documento)::text = 'factura'::text) AND ((tratamiento_impuestos)::text = 'venta_publico_general'::text) AND (es_publico_general = true) AND (factura_global_id IS NULL));


--
-- Name: idx_documentos_ref_externa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_ref_externa ON public.documentos USING btree (empresa_id, serie_externa, numero_externo) WHERE ((tipo_documento)::text = ANY ((ARRAY['factura_compra'::character varying, 'nota_credito_compra'::character varying])::text[]));


--
-- Name: idx_dpc_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpc_empresa ON public.documentos_partidas_campos USING btree (empresa_id);


--
-- Name: INDEX idx_dpc_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_dpc_empresa IS 'Optimiza consultas de campos dinámicos filtradas por empresa.';


--
-- Name: idx_dpc_partida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dpc_partida ON public.documentos_partidas_campos USING btree (partida_id);


--
-- Name: INDEX idx_dpc_partida; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_dpc_partida IS 'Optimiza consultas de campos dinámicos por partida.';


--
-- Name: idx_fa_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_documento ON public.finanzas_aplicaciones USING btree (documento_id);


--
-- Name: INDEX idx_fa_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_fa_documento IS 'Permite localizar rápidamente los pagos aplicados a un documento.';


--
-- Name: idx_fa_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_empresa ON public.finanzas_aplicaciones USING btree (empresa_id);


--
-- Name: INDEX idx_fa_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_fa_empresa IS 'Optimiza consultas multiempresa en aplicaciones financieras.';


--
-- Name: idx_fa_operacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_operacion ON public.finanzas_aplicaciones USING btree (operacion_id);


--
-- Name: INDEX idx_fa_operacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_fa_operacion IS 'Permite localizar rápidamente las aplicaciones de una operación financiera.';


--
-- Name: idx_finanzas_metodos_pago_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finanzas_metodos_pago_empresa ON public.finanzas_metodos_pago USING btree (empresa_id);


--
-- Name: idx_finanzas_operaciones_documento_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finanzas_operaciones_documento_origen ON public.finanzas_operaciones USING btree (documento_origen_id);


--
-- Name: idx_finanzas_operaciones_empresa_naturaleza; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finanzas_operaciones_empresa_naturaleza ON public.finanzas_operaciones USING btree (empresa_id, naturaleza_operacion);


--
-- Name: idx_finanzas_operaciones_metodo_pago; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finanzas_operaciones_metodo_pago ON public.finanzas_operaciones USING btree (metodo_pago_id) WHERE (metodo_pago_id IS NOT NULL);


--
-- Name: idx_fo_concepto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fo_concepto ON public.finanzas_operaciones USING btree (concepto_id);


--
-- Name: idx_partida_impuestos_partida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partida_impuestos_partida ON public.documentos_partidas_impuestos USING btree (partida_id);


--
-- Name: idx_plantillas_documento_empresa_tipo_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plantillas_documento_empresa_tipo_activo ON public.plantillas_documento USING btree (empresa_id, tipo_documento, activo);


--
-- Name: idx_plantillas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plantillas_empresa ON public.plantillas_documento USING btree (empresa_id);


--
-- Name: INDEX idx_plantillas_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_plantillas_empresa IS 'Optimiza búsquedas de plantillas por empresa';


--
-- Name: idx_precios_contacto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_contacto ON public.precios USING btree (contacto_id);


--
-- Name: idx_precios_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_empresa ON public.precios USING btree (empresa_id);


--
-- Name: idx_precios_lista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_lista ON public.precios USING btree (precio_lista_id);


--
-- Name: idx_precios_listas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_listas_empresa ON public.precios_listas USING btree (empresa_id);


--
-- Name: idx_precios_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_producto ON public.precios USING btree (producto_id);


--
-- Name: idx_productos_clave_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_clave_trgm ON public.productos USING gin (clave sat.gin_trgm_ops);


--
-- Name: idx_productos_descripcion_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_descripcion_trgm ON public.productos USING gin (descripcion sat.gin_trgm_ops);


--
-- Name: idx_productos_impuestos_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_impuestos_producto ON public.productos_impuestos USING btree (producto_id);


--
-- Name: idx_prog_pagos_det_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_det_documento ON public.finanzas_programacion_pagos_detalle USING btree (documento_id);


--
-- Name: idx_prog_pagos_det_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_det_empresa ON public.finanzas_programacion_pagos_detalle USING btree (empresa_id);


--
-- Name: idx_prog_pagos_det_programacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_det_programacion ON public.finanzas_programacion_pagos_detalle USING btree (programacion_id);


--
-- Name: idx_prog_pagos_doc_pago; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_doc_pago ON public.finanzas_programacion_pagos USING btree (documento_pago_id) WHERE (documento_pago_id IS NOT NULL);


--
-- Name: idx_prog_pagos_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_documento ON public.finanzas_programacion_pagos USING btree (documento_id);


--
-- Name: idx_prog_pagos_empresa_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_empresa_fecha ON public.finanzas_programacion_pagos USING btree (empresa_id, fecha_programada);


--
-- Name: idx_prog_pagos_estatus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_estatus ON public.finanzas_programacion_pagos USING btree (empresa_id, estatus);


--
-- Name: idx_prog_pagos_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prog_pagos_proveedor ON public.finanzas_programacion_pagos USING btree (empresa_id, proveedor_id) WHERE (proveedor_id IS NOT NULL);


--
-- Name: idx_reglas_tratamiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_tratamiento ON public.reglas_tratamiento_impuestos USING btree (tratamiento);


--
-- Name: idx_series_documento_empresa_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_documento_empresa_tipo ON public.series_documento USING btree (empresa_id, tipo_documento);


--
-- Name: INDEX idx_series_documento_empresa_tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_series_documento_empresa_tipo IS 'Optimiza búsquedas de series por empresa y tipo de documento';


--
-- Name: idx_series_documento_empresa_tipo_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_documento_empresa_tipo_activa ON public.series_documento USING btree (empresa_id, tipo_documento, activa);


--
-- Name: idx_series_documento_layout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_documento_layout ON public.series_documento USING btree (layout_id);


--
-- Name: INDEX idx_series_documento_layout; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_series_documento_layout IS 'Optimiza consultas por plantilla asociada';


--
-- Name: idx_usuarios_series_documento_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_series_documento_usuario ON public.usuarios_series_documento USING btree (usuario_id);


--
-- Name: ix_contactos_codigo_legacy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_codigo_legacy ON public.contactos USING btree (empresa_id, codigo_legacy) WHERE (codigo_legacy IS NOT NULL);


--
-- Name: ix_contactos_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_email ON public.contactos USING btree (empresa_id, email) WHERE (email IS NOT NULL);


--
-- Name: ix_contactos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa ON public.contactos USING btree (empresa_id);


--
-- Name: ix_contactos_empresa_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_activo ON public.contactos USING btree (empresa_id) WHERE (activo = true);


--
-- Name: ix_contactos_empresa_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_nombre ON public.contactos USING btree (empresa_id, nombre);


--
-- Name: ix_contactos_empresa_rfc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_rfc ON public.contactos USING btree (empresa_id, rfc) WHERE (rfc IS NOT NULL);


--
-- Name: ix_contactos_empresa_tel_sec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_tel_sec ON public.contactos USING btree (empresa_id, telefono_secundario) WHERE (telefono_secundario IS NOT NULL);


--
-- Name: ix_contactos_empresa_telefono; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_telefono ON public.contactos USING btree (empresa_id, telefono) WHERE (telefono IS NOT NULL);


--
-- Name: ix_contactos_empresa_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_tipo ON public.contactos USING btree (empresa_id, tipo_contacto);


--
-- Name: ix_contactos_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_nombre ON public.contactos USING btree (nombre);


--
-- Name: ix_contactos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_tipo ON public.contactos USING btree (tipo_contacto);


--
-- Name: ix_productos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_productos_empresa ON public.productos USING btree (empresa_id);


--
-- Name: ix_productos_pais_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_productos_pais_origen ON public.productos USING btree (pais_origen_id);


--
-- Name: ix_productos_proveedor_preferido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_productos_proveedor_preferido ON public.productos USING btree (proveedor_preferido_id);


--
-- Name: ux_contactos_domicilios_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_contactos_domicilios_principal ON public.contactos_domicilios USING btree (contacto_id) WHERE (es_principal = true);


--
-- Name: ux_contactos_empresa_codigo_legacy; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_contactos_empresa_codigo_legacy ON public.contactos USING btree (empresa_id, codigo_legacy) WHERE (codigo_legacy IS NOT NULL);


--
-- Name: ux_plantilla_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_plantilla_activa ON public.plantillas_documento USING btree (empresa_id, tipo_documento) WHERE (activo = true);


--
-- Name: ux_precios_empresa_producto_lista_contacto; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_precios_empresa_producto_lista_contacto ON public.precios USING btree (empresa_id, producto_id, precio_lista_id, COALESCE(contacto_id, (0)::bigint));


--
-- Name: ux_precios_listas_empresa_tipo_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_precios_listas_empresa_tipo_default ON public.precios_listas USING btree (empresa_id, tipo_precio) WHERE (es_default = true);


--
-- Name: ux_precios_listas_empresa_tipo_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_precios_listas_empresa_tipo_nombre ON public.precios_listas USING btree (empresa_id, tipo_precio, nombre);


--
-- Name: ux_roles_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_roles_nombre ON public.roles USING btree (nombre);


--
-- Name: idx_claves_unidades_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_claves_unidades_search ON sat.claves_unidades USING gin (search_vector);


--
-- Name: idx_claves_unidades_texto_trgm; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_claves_unidades_texto_trgm ON sat.claves_unidades USING gin (texto sat.gin_trgm_ops);


--
-- Name: idx_codigos_postales_estado; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_codigos_postales_estado ON sat.codigos_postales USING btree (estado);


--
-- Name: idx_colonias_cp; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_colonias_cp ON sat.colonias USING btree (codigo_postal);


--
-- Name: idx_colonias_cp_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_colonias_cp_texto ON sat.colonias USING btree (codigo_postal, texto);


--
-- Name: idx_colonias_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_colonias_search ON sat.colonias USING gin (search_vector);


--
-- Name: idx_formas_pago_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_formas_pago_texto ON sat.formas_pago USING btree (texto);


--
-- Name: idx_localidades_estado; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_localidades_estado ON sat.localidades USING btree (estado);


--
-- Name: idx_localidades_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_localidades_search ON sat.localidades USING gin (search_vector);


--
-- Name: idx_metodos_pago_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_metodos_pago_texto ON sat.metodos_pago USING btree (texto);


--
-- Name: idx_municipios_estado; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_municipios_estado ON sat.municipios USING btree (estado);


--
-- Name: idx_municipios_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_municipios_search ON sat.municipios USING gin (search_vector);


--
-- Name: idx_productos_servicios_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_productos_servicios_search ON sat.productos_servicios USING gin (search_vector);


--
-- Name: idx_productos_servicios_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_productos_servicios_texto ON sat.productos_servicios USING btree (texto);


--
-- Name: idx_productos_servicios_texto_trgm; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_productos_servicios_texto_trgm ON sat.productos_servicios USING gin (texto sat.gin_trgm_ops);


--
-- Name: idx_regimenes_fiscales_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_regimenes_fiscales_texto ON sat.regimenes_fiscales USING btree (texto);


--
-- Name: idx_reglas_tasa_cuota_impuesto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_reglas_tasa_cuota_impuesto ON sat.reglas_tasa_cuota USING btree (impuesto);


--
-- Name: idx_usos_cfdi_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_usos_cfdi_texto ON sat.usos_cfdi USING btree (texto);


--
-- Name: config_empresa_id_idx; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX config_empresa_id_idx ON whatsapp.config USING btree (empresa_id);


--
-- Name: intentos_contacto_dedupe_idx; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX intentos_contacto_dedupe_idx ON whatsapp.intentos_contacto USING btree (session_id, pagina_origen, tipo_intento, creado_en DESC);


--
-- Name: whatsapp_plantillas_default_uk; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE UNIQUE INDEX whatsapp_plantillas_default_uk ON whatsapp.plantillas USING btree (empresa_id, tipo) WHERE (es_default IS TRUE);


--
-- Name: whatsapp_plantillas_empresa_id_idx; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX whatsapp_plantillas_empresa_id_idx ON whatsapp.plantillas USING btree (empresa_id);


--
-- Name: whatsapp_plantillas_empresa_tipo_idx; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX whatsapp_plantillas_empresa_tipo_idx ON whatsapp.plantillas USING btree (empresa_id, tipo);


--
-- Name: usuarios trg_usuarios_vendedor_contacto; Type: TRIGGER; Schema: core; Owner: -
--

CREATE TRIGGER trg_usuarios_vendedor_contacto BEFORE INSERT OR UPDATE OF vendedor_contacto_id ON core.usuarios FOR EACH ROW EXECUTE FUNCTION core.validar_usuario_vendedor_contacto();


--
-- Name: actividades trg_actividades_updated_at; Type: TRIGGER; Schema: crm; Owner: -
--

CREATE TRIGGER trg_actividades_updated_at BEFORE UPDATE ON crm.actividades FOR EACH ROW EXECUTE FUNCTION crm.set_actividades_updated_at();


--
-- Name: etapas trg_produccion_etapas_updated_at; Type: TRIGGER; Schema: produccion; Owner: -
--

CREATE TRIGGER trg_produccion_etapas_updated_at BEFORE UPDATE ON produccion.etapas FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: seguimientos trg_produccion_seguimientos_updated_at; Type: TRIGGER; Schema: produccion; Owner: -
--

CREATE TRIGGER trg_produccion_seguimientos_updated_at BEFORE UPDATE ON produccion.seguimientos FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: contactos trg_contactos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contactos_updated_at BEFORE UPDATE ON public.contactos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: plantillas_documento trg_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.plantillas_documento FOR EACH ROW EXECUTE FUNCTION whatsapp.set_updated_at();


--
-- Name: catalogos catalogos_tipo_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos
    ADD CONSTRAINT catalogos_tipo_catalogo_id_fkey FOREIGN KEY (tipo_catalogo_id) REFERENCES core.catalogos_tipos(id);


--
-- Name: catalogos_tipos catalogos_tipos_entidad_tipo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos_tipos
    ADD CONSTRAINT catalogos_tipos_entidad_tipo_id_fkey FOREIGN KEY (entidad_tipo_id) REFERENCES core.entidades_tipos(id);


--
-- Name: entidades_catalogos entidades_catalogos_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_catalogos
    ADD CONSTRAINT entidades_catalogos_catalogo_id_fkey FOREIGN KEY (catalogo_id) REFERENCES core.catalogos(id);


--
-- Name: entidades_catalogos entidades_catalogos_entidad_tipo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_catalogos
    ADD CONSTRAINT entidades_catalogos_entidad_tipo_id_fkey FOREIGN KEY (entidad_tipo_id) REFERENCES core.entidades_tipos(id);


--
-- Name: campos_configuracion fk_campos_configuracion_catalogo; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_catalogo FOREIGN KEY (catalogo_tipo_id) REFERENCES core.catalogos_tipos(id);


--
-- Name: campos_configuracion fk_campos_configuracion_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: campos_configuracion fk_campos_configuracion_entidad; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_entidad FOREIGN KEY (entidad_tipo_id) REFERENCES core.entidades_tipos(id);


--
-- Name: campos_configuracion fk_campos_configuracion_padre; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_padre FOREIGN KEY (campo_padre_id) REFERENCES core.campos_configuracion(id);


--
-- Name: catalogos fk_catalogos_padre; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos
    ADD CONSTRAINT fk_catalogos_padre FOREIGN KEY (catalogo_padre_id) REFERENCES core.catalogos(id) ON DELETE SET NULL;


--
-- Name: catalogos fk_catalogos_precio_lista; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos
    ADD CONSTRAINT fk_catalogos_precio_lista FOREIGN KEY (precio_lista_id) REFERENCES public.precios_listas(id);


--
-- Name: empresas_assets fk_empresas_assets_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_assets
    ADD CONSTRAINT fk_empresas_assets_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: empresas fk_empresas_colonia; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_colonia FOREIGN KEY (codigo_postal_id, colonia_id) REFERENCES sat.colonias(codigo_postal, colonia);


--
-- Name: empresas fk_empresas_cp; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_cp FOREIGN KEY (codigo_postal_id) REFERENCES sat.codigos_postales(id);


--
-- Name: empresas fk_empresas_estado; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_estado FOREIGN KEY (estado_id) REFERENCES sat.estados(estado);


--
-- Name: empresas_impuestos_default fk_empresas_impuestos_default_impuesto; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default
    ADD CONSTRAINT fk_empresas_impuestos_default_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- Name: empresas fk_empresas_localidad; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_localidad FOREIGN KEY (estado_id, localidad_id) REFERENCES sat.localidades(estado, localidad);


--
-- Name: empresas fk_empresas_regimen; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_regimen FOREIGN KEY (regimen_fiscal_id) REFERENCES sat.regimenes_fiscales(id);


--
-- Name: empresas_tipos_documento fk_empresas_tipos_documento_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT fk_empresas_tipos_documento_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE CASCADE;


--
-- Name: empresas_tipos_documento fk_empresas_tipos_documento_tipo; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT fk_empresas_tipos_documento_tipo FOREIGN KEY (tipo_documento_id) REFERENCES core.tipos_documento(id) ON DELETE CASCADE;


--
-- Name: empresas_tipos_documento fk_empresas_tipos_documento_whatsapp_plantilla; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT fk_empresas_tipos_documento_whatsapp_plantilla FOREIGN KEY (whatsapp_plantilla_default_id) REFERENCES whatsapp.plantillas(id);


--
-- Name: empresas_tipos_documento_transiciones fk_etdt_destino; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT fk_etdt_destino FOREIGN KEY (tipo_documento_destino_id) REFERENCES core.tipos_documento(id) ON DELETE CASCADE;


--
-- Name: empresas_tipos_documento_transiciones fk_etdt_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT fk_etdt_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE CASCADE;


--
-- Name: empresas_tipos_documento_transiciones fk_etdt_origen; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT fk_etdt_origen FOREIGN KEY (tipo_documento_origen_id) REFERENCES core.tipos_documento(id) ON DELETE CASCADE;


--
-- Name: parametros_empresa fk_parametros_empresa_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_empresa
    ADD CONSTRAINT fk_parametros_empresa_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE CASCADE;


--
-- Name: parametros_empresa fk_parametros_empresa_parametro; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_empresa
    ADD CONSTRAINT fk_parametros_empresa_parametro FOREIGN KEY (parametro_id) REFERENCES core.parametros(parametro_id) ON DELETE CASCADE;


--
-- Name: parametros_modulos fk_parametros_modulos_modulo; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_modulos
    ADD CONSTRAINT fk_parametros_modulos_modulo FOREIGN KEY (modulo_id) REFERENCES core.modulos(modulo_id) ON DELETE CASCADE;


--
-- Name: parametros_modulos fk_parametros_modulos_parametro; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_modulos
    ADD CONSTRAINT fk_parametros_modulos_parametro FOREIGN KEY (parametro_id) REFERENCES core.parametros(parametro_id) ON DELETE CASCADE;


--
-- Name: parametros_opciones fk_parametros_opciones_parametro; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones
    ADD CONSTRAINT fk_parametros_opciones_parametro FOREIGN KEY (parametro_id) REFERENCES core.parametros(parametro_id) ON DELETE CASCADE;


--
-- Name: parametros fk_parametros_padre; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros
    ADD CONSTRAINT fk_parametros_padre FOREIGN KEY (parametro_padre_id) REFERENCES core.parametros(parametro_id) ON DELETE SET NULL;


--
-- Name: usuarios fk_usuarios_vendedor_contacto; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios
    ADD CONSTRAINT fk_usuarios_vendedor_contacto FOREIGN KEY (vendedor_contacto_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: grid_preferences grid_preferences_empresa_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: grid_preferences grid_preferences_usuario_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: roles roles_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: usuarios_empresas usuarios_empresas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: usuarios_empresas usuarios_empresas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- Name: usuarios_roles usuarios_roles_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: usuarios_roles usuarios_roles_rol_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES core.roles(id);


--
-- Name: usuarios_roles usuarios_roles_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- Name: configuracion_email_empresa configuracion_email_empresa_empresa_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa
    ADD CONSTRAINT configuracion_email_empresa_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_empresa_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_usuario_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- Name: email_plantillas email_plantillas_empresa_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas
    ADD CONSTRAINT email_plantillas_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: actividades fk_actividades_contacto; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE RESTRICT;


--
-- Name: actividades fk_actividades_empresa; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: actividades fk_actividades_oportunidad; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_oportunidad FOREIGN KEY (oportunidad_id) REFERENCES crm.oportunidades_venta(id) ON DELETE SET NULL;


--
-- Name: actividades fk_actividades_usuario_asignado; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_usuario_asignado FOREIGN KEY (usuario_asignado_id) REFERENCES core.usuarios(id) ON DELETE RESTRICT;


--
-- Name: actividades fk_actividades_usuario_creador; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_usuario_creador FOREIGN KEY (usuario_creador_id) REFERENCES core.usuarios(id) ON DELETE RESTRICT;


--
-- Name: conversacion_etiquetas fk_conversacion_etiquetas_conversaciones; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT fk_conversacion_etiquetas_conversaciones FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id) ON DELETE CASCADE;


--
-- Name: conversacion_etiquetas fk_conversacion_etiquetas_etiquetas; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT fk_conversacion_etiquetas_etiquetas FOREIGN KEY (etiqueta_id) REFERENCES crm.etiquetas(id) ON DELETE CASCADE;


--
-- Name: conversaciones fk_conversaciones_contactos; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversaciones
    ADD CONSTRAINT fk_conversaciones_contactos FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: mensajes fk_mensajes_contactos; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.mensajes
    ADD CONSTRAINT fk_mensajes_contactos FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: mensajes fk_mensajes_conversaciones; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.mensajes
    ADD CONSTRAINT fk_mensajes_conversaciones FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id);


--
-- Name: existencias fk_inv_exist_empresa; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT fk_inv_exist_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: existencias fk_inv_exist_producto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT fk_inv_exist_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: movimientos fk_inv_mov_documento; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT fk_inv_mov_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- Name: movimientos fk_inv_mov_empresa; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT fk_inv_mov_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: movimientos fk_inv_mov_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT fk_inv_mov_usuario FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- Name: movimientos_partidas fk_inv_part_doc_partida; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_doc_partida FOREIGN KEY (documento_partida_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: movimientos_partidas fk_inv_part_empresa; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: movimientos_partidas fk_inv_part_movimiento; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_movimiento FOREIGN KEY (movimiento_id) REFERENCES inventario.movimientos(id) ON DELETE CASCADE;


--
-- Name: movimientos_partidas fk_inv_part_producto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: almacenes fk_inventario_almacenes_empresa; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.almacenes
    ADD CONSTRAINT fk_inventario_almacenes_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: seguimientos fk_produccion_seguimientos_etapa; Type: FK CONSTRAINT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.seguimientos
    ADD CONSTRAINT fk_produccion_seguimientos_etapa FOREIGN KEY (etapa_id) REFERENCES produccion.etapas(id) ON DELETE SET NULL;


--
-- Name: autorizaciones_reglas autorizaciones_reglas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_rol_autorizador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_rol_autorizador_id_fkey FOREIGN KEY (rol_autorizador_id) REFERENCES core.roles(id);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_transicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_transicion_id_fkey FOREIGN KEY (transicion_id) REFERENCES core.empresas_tipos_documento_transiciones(id);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_usuario_autorizador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_usuario_autorizador_id_fkey FOREIGN KEY (usuario_autorizador_id) REFERENCES core.usuarios(id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_documento_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_documento_origen_id_fkey FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.autorizaciones_reglas(id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_usuario_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_usuario_solicitante_id_fkey FOREIGN KEY (usuario_solicitante_id) REFERENCES core.usuarios(id);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- Name: documentos documentos_finanzas_operacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_finanzas_operacion_id_fkey FOREIGN KEY (finanzas_operacion_id) REFERENCES public.finanzas_operaciones(id);


--
-- Name: finanzas_operaciones finanzas_operaciones_metodo_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT finanzas_operaciones_metodo_pago_id_fkey FOREIGN KEY (metodo_pago_id) REFERENCES public.finanzas_metodos_pago(id) ON DELETE SET NULL;


--
-- Name: finanzas_programacion_pagos finanzas_programacion_pagos_cuenta_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos
    ADD CONSTRAINT finanzas_programacion_pagos_cuenta_origen_id_fkey FOREIGN KEY (cuenta_origen_id) REFERENCES public.finanzas_cuentas(id) ON DELETE SET NULL;


--
-- Name: finanzas_programacion_pagos_detalle finanzas_programacion_pagos_detalle_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos_detalle
    ADD CONSTRAINT finanzas_programacion_pagos_detalle_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: finanzas_programacion_pagos_detalle finanzas_programacion_pagos_detalle_programacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos_detalle
    ADD CONSTRAINT finanzas_programacion_pagos_detalle_programacion_id_fkey FOREIGN KEY (programacion_id) REFERENCES public.finanzas_programacion_pagos(id) ON DELETE CASCADE;


--
-- Name: finanzas_programacion_pagos finanzas_programacion_pagos_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos
    ADD CONSTRAINT finanzas_programacion_pagos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: finanzas_programacion_pagos finanzas_programacion_pagos_documento_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos
    ADD CONSTRAINT finanzas_programacion_pagos_documento_pago_id_fkey FOREIGN KEY (documento_pago_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- Name: finanzas_programacion_pagos finanzas_programacion_pagos_finanzas_operacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos
    ADD CONSTRAINT finanzas_programacion_pagos_finanzas_operacion_id_fkey FOREIGN KEY (finanzas_operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE SET NULL;


--
-- Name: finanzas_programacion_pagos finanzas_programacion_pagos_metodo_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_programacion_pagos
    ADD CONSTRAINT finanzas_programacion_pagos_metodo_pago_id_fkey FOREIGN KEY (metodo_pago_id) REFERENCES public.finanzas_metodos_pago(id) ON DELETE SET NULL;


--
-- Name: aplicaciones_saldo fk_aplicaciones_doc_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_doc_destino FOREIGN KEY (documento_destino_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones_saldo fk_aplicaciones_doc_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_doc_origen FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: aplicaciones_saldo fk_aplicaciones_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones_saldo fk_aplicaciones_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_operacion FOREIGN KEY (finanzas_operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE;


--
-- Name: contactos_domicilios fk_cd_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT fk_cd_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE;


--
-- Name: contactos_domicilios fk_cd_cp_sat; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT fk_cd_cp_sat FOREIGN KEY (cp_sat) REFERENCES sat.codigos_postales(id);


--
-- Name: contactos_datos_fiscales fk_cdf_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales
    ADD CONSTRAINT fk_cdf_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE;


--
-- Name: contactos fk_contactos_precio_lista; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT fk_contactos_precio_lista FOREIGN KEY (precio_lista_id) REFERENCES public.precios_listas(id);


--
-- Name: contactos fk_contactos_vendedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT fk_contactos_vendedor FOREIGN KEY (vendedor_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: credito_operaciones fk_credito_operaciones_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones
    ADD CONSTRAINT fk_credito_operaciones_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE RESTRICT;


--
-- Name: credito_operaciones fk_credito_operaciones_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones
    ADD CONSTRAINT fk_credito_operaciones_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- Name: crm_ruteo_leads fk_crl_ultimo_vendedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT fk_crl_ultimo_vendedor FOREIGN KEY (ultimo_vendedor_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: crm_ruteo_leads fk_crl_vendedor_fijo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT fk_crl_vendedor_fijo FOREIGN KEY (vendedor_fijo_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: documentos_campos fk_dc_campo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT fk_dc_campo FOREIGN KEY (campo_id) REFERENCES core.campos_configuracion(id);


--
-- Name: documentos_campos fk_dc_catalogo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT fk_dc_catalogo FOREIGN KEY (catalogo_id) REFERENCES core.catalogos(id);


--
-- Name: documentos_campos fk_dc_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT fk_dc_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_destino FOREIGN KEY (partida_destino_id) REFERENCES public.documentos_partidas(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_doc_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_doc_destino FOREIGN KEY (documento_destino_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_doc_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_doc_origen FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_origen FOREIGN KEY (partida_origen_id) REFERENCES public.documentos_partidas(id) ON DELETE CASCADE;


--
-- Name: documentos fk_documentos_almacen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_almacen FOREIGN KEY (almacen_id) REFERENCES inventario.almacenes(id) ON DELETE RESTRICT;


--
-- Name: documentos_cfdi fk_documentos_cfdi_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cfdi
    ADD CONSTRAINT fk_documentos_cfdi_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- Name: documentos fk_documentos_concepto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_concepto FOREIGN KEY (concepto_id) REFERENCES public.conceptos(id) ON DELETE RESTRICT;


--
-- Name: documentos fk_documentos_factura_global; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_factura_global FOREIGN KEY (factura_global_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- Name: documentos fk_documentos_forma_pago; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_forma_pago FOREIGN KEY (forma_pago) REFERENCES sat.formas_pago(id);


--
-- Name: documentos fk_documentos_metodo_pago; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_metodo_pago FOREIGN KEY (metodo_pago) REFERENCES sat.metodos_pago(id);


--
-- Name: documentos_partidas fk_documentos_partidas_almacen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_documentos_partidas_almacen FOREIGN KEY (almacen_id) REFERENCES inventario.almacenes(id) ON DELETE RESTRICT;


--
-- Name: documentos_partidas fk_documentos_partidas_precio_lista; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_documentos_partidas_precio_lista FOREIGN KEY (precio_lista_id) REFERENCES public.precios_listas(id);


--
-- Name: documentos fk_documentos_regimen_fiscal; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_regimen_fiscal FOREIGN KEY (regimen_fiscal_receptor) REFERENCES sat.regimenes_fiscales(id);


--
-- Name: documentos fk_documentos_uso_cfdi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_uso_cfdi FOREIGN KEY (uso_cfdi) REFERENCES sat.usos_cfdi(id);


--
-- Name: documentos fk_documentos_usuario_cancelacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_usuario_cancelacion FOREIGN KEY (usuario_cancelacion_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- Name: documentos_partidas_campos fk_dpc_campo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_campos
    ADD CONSTRAINT fk_dpc_campo FOREIGN KEY (campo_id) REFERENCES core.campos_configuracion(id);


--
-- Name: documentos_partidas_campos fk_dpc_partida; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_campos
    ADD CONSTRAINT fk_dpc_partida FOREIGN KEY (partida_id) REFERENCES public.documentos_partidas(id) ON DELETE CASCADE;


--
-- Name: finanzas_aplicaciones fk_fa_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones
    ADD CONSTRAINT fk_fa_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: finanzas_aplicaciones fk_fa_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones
    ADD CONSTRAINT fk_fa_operacion FOREIGN KEY (operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE;


--
-- Name: finanzas_conciliaciones fk_fc_cuenta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones
    ADD CONSTRAINT fk_fc_cuenta FOREIGN KEY (cuenta_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- Name: finanzas_conciliaciones_operaciones fk_fco_conciliacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT fk_fco_conciliacion FOREIGN KEY (conciliacion_id) REFERENCES public.finanzas_conciliaciones(id) ON DELETE CASCADE;


--
-- Name: finanzas_conciliaciones_operaciones fk_fco_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT fk_fco_operacion FOREIGN KEY (operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE;


--
-- Name: finanzas_operaciones fk_finanzas_operaciones_documento_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT fk_finanzas_operaciones_documento_origen FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- Name: finanzas_operaciones fk_fo_concepto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT fk_fo_concepto FOREIGN KEY (concepto_id) REFERENCES public.conceptos(id) ON DELETE SET NULL;


--
-- Name: finanzas_operaciones fk_fo_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT fk_fo_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: finanzas_operaciones fk_fo_cuenta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT fk_fo_cuenta FOREIGN KEY (cuenta_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- Name: finanzas_transferencias fk_ft_cuenta_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias
    ADD CONSTRAINT fk_ft_cuenta_destino FOREIGN KEY (cuenta_destino_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- Name: finanzas_transferencias fk_ft_cuenta_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias
    ADD CONSTRAINT fk_ft_cuenta_origen FOREIGN KEY (cuenta_origen_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- Name: credito_operaciones_aplicaciones fk_oca_aplicada; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones
    ADD CONSTRAINT fk_oca_aplicada FOREIGN KEY (operacion_aplicada_id) REFERENCES public.credito_operaciones(id) ON DELETE RESTRICT;


--
-- Name: credito_operaciones_aplicaciones fk_oca_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones
    ADD CONSTRAINT fk_oca_origen FOREIGN KEY (operacion_origen_id) REFERENCES public.credito_operaciones(id) ON DELETE RESTRICT;


--
-- Name: credito_operaciones_items fk_oci_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- Name: credito_operaciones_items fk_oci_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_operacion FOREIGN KEY (operacion_credito_id) REFERENCES public.credito_operaciones(id) ON DELETE CASCADE;


--
-- Name: credito_operaciones_items fk_oci_partida; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_partida FOREIGN KEY (partida_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: credito_operaciones_items fk_oci_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE SET NULL;


--
-- Name: documentos_partidas_impuestos fk_partida_impuesto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_impuestos
    ADD CONSTRAINT fk_partida_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- Name: documentos_partidas fk_partida_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partida_origen FOREIGN KEY (partida_origen_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: documentos_partidas fk_partida_padre; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partida_padre FOREIGN KEY (partida_padre_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: documentos_partidas fk_partidas_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partidas_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas fk_partidas_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partidas_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: plantillas_documento fk_plantillas_documento_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_documento
    ADD CONSTRAINT fk_plantillas_documento_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: precios fk_precios_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: precios fk_precios_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: precios fk_precios_lista; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_lista FOREIGN KEY (precio_lista_id) REFERENCES public.precios_listas(id);


--
-- Name: precios_listas fk_precios_listas_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_listas
    ADD CONSTRAINT fk_precios_listas_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: precios fk_precios_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: productos fk_producto_unidad_inventario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_producto_unidad_inventario FOREIGN KEY (unidad_inventario_id) REFERENCES public.unidades(id);


--
-- Name: productos fk_producto_unidad_venta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_producto_unidad_venta FOREIGN KEY (unidad_venta_id) REFERENCES public.unidades(id);


--
-- Name: productos_archivos fk_productos_archivos_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_archivos
    ADD CONSTRAINT fk_productos_archivos_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: productos_impuestos fk_productos_impuestos_impuesto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_impuestos
    ADD CONSTRAINT fk_productos_impuestos_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- Name: productos fk_productos_pais_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_productos_pais_origen FOREIGN KEY (pais_origen_id) REFERENCES sat.paises(id) ON DELETE SET NULL;


--
-- Name: productos fk_productos_proveedor_preferido; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_productos_proveedor_preferido FOREIGN KEY (proveedor_preferido_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: reglas_tratamiento_impuestos fk_regla_impuesto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_tratamiento_impuestos
    ADD CONSTRAINT fk_regla_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- Name: series_documento fk_series_documento_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT fk_series_documento_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: series_documento fk_series_documento_layout; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT fk_series_documento_layout FOREIGN KEY (layout_id) REFERENCES public.plantillas_documento(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: unidades fk_unidad_sat; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades
    ADD CONSTRAINT fk_unidad_sat FOREIGN KEY (unidad_sat_id) REFERENCES sat.unidades(id);


--
-- Name: usuarios_series_documento fk_usuarios_series_documento_serie; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT fk_usuarios_series_documento_serie FOREIGN KEY (serie_documento_id) REFERENCES public.series_documento(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuarios_series_documento fk_usuarios_series_documento_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT fk_usuarios_series_documento_usuario FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: config config_empresa_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config
    ADD CONSTRAINT config_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: contacto_mapeo contacto_mapeo_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.contacto_mapeo
    ADD CONSTRAINT contacto_mapeo_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: intentos_contacto intentos_contacto_empresa_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.intentos_contacto
    ADD CONSTRAINT intentos_contacto_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: plantillas whatsapp_plantillas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.plantillas
    ADD CONSTRAINT whatsapp_plantillas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 0bIZzGRrWQiaVG6AkDiscTXvmf7Qo6c9bCRmWUbYymNnqWUfVgI8iCfPkMq2v4V

