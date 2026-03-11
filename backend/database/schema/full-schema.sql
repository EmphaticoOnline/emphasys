-- Full schema export
-- Database: emphasys
-- Generated at: 2026-03-11T04:06:57.348Z
--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3
-- Dumped by pg_dump version 17.3

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
    'Otro'
);


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
    created_at timestamp without time zone DEFAULT now()
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
    catalogo_padre_id integer
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
    regimen_fiscal character varying(10)
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
-- Name: modulos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.modulos (
    modulo_id integer NOT NULL,
    clave character varying(50) NOT NULL,
    nombre character varying(100) NOT NULL,
    orden integer DEFAULT 0,
    activo boolean DEFAULT true
);


--
-- Name: TABLE modulos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.modulos IS 'Módulos funcionales del ERP utilizados para agrupar parámetros.';


--
-- Name: COLUMN modulos.clave; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.modulos.clave IS 'Clave técnica del módulo (inventarios, ventas, etc).';


--
-- Name: COLUMN modulos.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.modulos.nombre IS 'Nombre visible del módulo en la interfaz del sistema.';


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
    clave character varying(100) NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    tipo_dato character varying(20) NOT NULL,
    tipo_control character varying(20) NOT NULL,
    valor_default text,
    orden integer DEFAULT 0,
    activo boolean DEFAULT true
);


--
-- Name: TABLE parametros; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.parametros IS 'Catálogo global de parámetros configurables del sistema ERP.';


--
-- Name: COLUMN parametros.clave; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.parametros.clave IS 'Clave técnica del parámetro utilizada por el sistema.';


--
-- Name: COLUMN parametros.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.parametros.nombre IS 'Caption mostrado al usuario en la pantalla de configuración.';


--
-- Name: COLUMN parametros.tipo_dato; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.parametros.tipo_dato IS 'Tipo de dato esperado del parámetro.';


--
-- Name: COLUMN parametros.tipo_control; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.parametros.tipo_control IS 'Tipo de control de interfaz utilizado para editar el parámetro.';


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
-- Name: TABLE parametros_modulos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.parametros_modulos IS 'Relación muchos-a-muchos entre parámetros del sistema y módulos del ERP.';


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
    codigo character varying(50) NOT NULL,
    nombre character varying(120) NOT NULL,
    nombre_plural character varying(120) NOT NULL,
    icono character varying(50),
    orden integer DEFAULT 0,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
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
    created_at timestamp without time zone DEFAULT now()
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
    codigo_legacy character varying(20)
);


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
    codigo_postal character varying(10),
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
    CONSTRAINT chk_credito_operaciones_tipo CHECK (((tipo_operacion)::text = ANY ((ARRAY['cargo'::character varying, 'abono'::character varying, 'ajuste'::character varying])::text[])))
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
    CONSTRAINT chk_crl_modo_asignacion CHECK (((modo_asignacion)::text = ANY ((ARRAY['round_robin'::character varying, 'fijo'::character varying, 'prioridad'::character varying])::text[])))
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
    moneda character varying(10) NOT NULL,
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
    es_nota boolean DEFAULT false NOT NULL,
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
    codigo_postal_receptor character varying(10)
);


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
    fecha_modificacion timestamp with time zone
);


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
    usuario_id integer
);


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
    CONSTRAINT chk_fc_moneda CHECK (((moneda)::text = ANY ((ARRAY['MXN'::character varying, 'USD'::character varying, 'EUR'::character varying])::text[]))),
    CONSTRAINT chk_fc_tipo CHECK (((tipo_cuenta)::text = ANY ((ARRAY['Disponibilidad'::character varying, 'Seguimiento'::character varying])::text[])))
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
    CONSTRAINT chk_fo_conciliacion CHECK (((estado_conciliacion)::text = ANY ((ARRAY['pendiente'::character varying, 'cotejado'::character varying, 'conciliado'::character varying])::text[]))),
    CONSTRAINT chk_fo_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['Deposito'::character varying, 'Retiro'::character varying])::text[])))
);


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
    clave_unidad_sat character varying(10)
);


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
-- Name: usuarios_empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios_empresas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    rol_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    fecha_alta timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios_empresas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_empresas_id_seq OWNED BY public.usuarios_empresas.id;


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
    iva_trasladado integer NOT NULL,
    ieps_trasladado integer NOT NULL,
    complemento text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    estimulo_frontera integer NOT NULL,
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
-- Name: whatsapp_contacto_estado; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_contacto_estado (
    empresa_id integer NOT NULL,
    telefono character varying(20) NOT NULL,
    opt_in boolean DEFAULT false NOT NULL,
    opt_out boolean DEFAULT false NOT NULL,
    ultimo_in timestamp with time zone,
    ultimo_out timestamp with time zone,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_contacto_estado_telefono_check CHECK (((telefono)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: TABLE whatsapp_contacto_estado; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.whatsapp_contacto_estado IS 'Controla ventana 24h y consentimiento por empresa.';


--
-- Name: COLUMN whatsapp_contacto_estado.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_contacto_estado.empresa_id IS 'Empresa a la que pertenece el telefono.';


--
-- Name: whatsapp_contacto_mapeo; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_contacto_mapeo (
    numero_telefono character varying(20) NOT NULL,
    contacto_id integer,
    verificado boolean DEFAULT false NOT NULL,
    observado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_contacto_mapeo_numero_telefono_check CHECK (((numero_telefono)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: whatsapp_conversaciones; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_conversaciones (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer NOT NULL,
    estado character varying(20) DEFAULT 'abierta'::character varying NOT NULL,
    asignado_a integer,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_mensaje_en timestamp with time zone DEFAULT now() NOT NULL,
    cerrada_en timestamp with time zone,
    CONSTRAINT whatsapp_conversaciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'cerrada'::character varying])::text[])))
);


--
-- Name: TABLE whatsapp_conversaciones; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.whatsapp_conversaciones IS 'Agrupa mensajes en ciclos comerciales por empresa.';


--
-- Name: COLUMN whatsapp_conversaciones.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_conversaciones.empresa_id IS 'Empresa propietaria de la conversacion.';


--
-- Name: COLUMN whatsapp_conversaciones.contacto_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_conversaciones.contacto_id IS 'Contacto asociado a la conversacion.';


--
-- Name: whatsapp_conversaciones_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

ALTER TABLE whatsapp.whatsapp_conversaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME whatsapp.whatsapp_conversaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: whatsapp_estadisticas; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_estadisticas (
    empresa_id integer NOT NULL,
    fecha date NOT NULL,
    mensajes_enviados integer DEFAULT 0 NOT NULL,
    mensajes_recibidos integer DEFAULT 0 NOT NULL,
    plantillas_usadas integer DEFAULT 0 NOT NULL,
    errores_envio integer DEFAULT 0 NOT NULL
);


--
-- Name: TABLE whatsapp_estadisticas; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.whatsapp_estadisticas IS 'Estadisticas diarias de WhatsApp por empresa.';


--
-- Name: COLUMN whatsapp_estadisticas.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_estadisticas.empresa_id IS 'Empresa a la que pertenecen las metricas.';


--
-- Name: whatsapp_mensajes; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_mensajes (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer,
    conversacion_id bigint,
    telefono character varying(20) NOT NULL,
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
    CONSTRAINT whatsapp_mensajes_status_check CHECK ((((status)::text = ANY ((ARRAY['queued'::character varying, 'sent'::character varying, 'delivered'::character varying, 'read'::character varying, 'failed'::character varying, 'received'::character varying])::text[])) OR (status IS NULL))),
    CONSTRAINT whatsapp_mensajes_telefono_check CHECK (((telefono)::text ~ '^[+0-9]{8,20}$'::text)),
    CONSTRAINT whatsapp_mensajes_tipo_mensaje_check CHECK (((tipo_mensaje)::text = ANY ((ARRAY['saliente'::character varying, 'entrante'::character varying])::text[])))
);


--
-- Name: TABLE whatsapp_mensajes; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.whatsapp_mensajes IS 'Registro historico de mensajes por empresa.';


--
-- Name: COLUMN whatsapp_mensajes.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_mensajes.empresa_id IS 'Empresa propietaria del mensaje.';


--
-- Name: whatsapp_mensajes_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

ALTER TABLE whatsapp.whatsapp_mensajes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME whatsapp.whatsapp_mensajes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: campos_configuracion id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion ALTER COLUMN id SET DEFAULT nextval('core.campos_configuracion_id_seq'::regclass);


--
-- Name: catalogos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos ALTER COLUMN id SET DEFAULT nextval('core.catalogos_id_seq'::regclass);


--
-- Name: catalogos_tipos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos_tipos ALTER COLUMN id SET DEFAULT nextval('core.catalogos_tipos_id_seq'::regclass);


--
-- Name: empresas id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas ALTER COLUMN id SET DEFAULT nextval('core.empresas_id_seq'::regclass);


--
-- Name: entidades_tipos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_tipos ALTER COLUMN id SET DEFAULT nextval('core.entidades_tipos_id_seq'::regclass);


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
-- Name: documentos_partidas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_id_seq'::regclass);


--
-- Name: documentos_partidas_campos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_campos ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_campos_id_seq'::regclass);


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
-- Name: finanzas_operaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_operaciones_id_seq'::regclass);


--
-- Name: finanzas_transferencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias ALTER COLUMN id SET DEFAULT nextval('public.finanzas_transferencias_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: unidades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades ALTER COLUMN id SET DEFAULT nextval('public.unidades_id_seq'::regclass);


--
-- Name: usuarios_empresas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas ALTER COLUMN id SET DEFAULT nextval('public.usuarios_empresas_id_seq'::regclass);


--
-- Name: unidades id; Type: DEFAULT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.unidades ALTER COLUMN id SET DEFAULT nextval('sat.unidades_id_seq'::regclass);


--
-- Name: campos_configuracion campos_configuracion_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT campos_configuracion_pkey PRIMARY KEY (id);


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
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


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
-- Name: tipos_documento tipos_documento_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.tipos_documento
    ADD CONSTRAINT tipos_documento_pkey PRIMARY KEY (id);


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
-- Name: documentos_partidas documentos_partidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT documentos_partidas_pkey PRIMARY KEY (id);


--
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (id);


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
-- Name: finanzas_operaciones finanzas_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT finanzas_operaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_transferencias finanzas_transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias
    ADD CONSTRAINT finanzas_transferencias_pkey PRIMARY KEY (id);


--
-- Name: credito_operaciones_items operaciones_credito_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT operaciones_credito_items_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


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
-- Name: productos uq_productos_empresa_clave; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT uq_productos_empresa_clave UNIQUE (empresa_id, clave);


--
-- Name: unidades uq_unidad_empresa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades
    ADD CONSTRAINT uq_unidad_empresa UNIQUE (empresa_id, clave);


--
-- Name: usuarios_empresas usuarios_empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_pkey PRIMARY KEY (id);


--
-- Name: contactos_domicilios ux_cd_identificador; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT ux_cd_identificador UNIQUE (contacto_id, identificador);


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
-- Name: usuarios_empresas ux_ue_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas
    ADD CONSTRAINT ux_ue_unico UNIQUE (usuario_id, empresa_id);


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
-- Name: whatsapp_contacto_estado whatsapp_contacto_estado_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_contacto_estado
    ADD CONSTRAINT whatsapp_contacto_estado_pkey PRIMARY KEY (empresa_id, telefono);


--
-- Name: whatsapp_contacto_mapeo whatsapp_contacto_mapeo_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_contacto_mapeo
    ADD CONSTRAINT whatsapp_contacto_mapeo_pkey PRIMARY KEY (numero_telefono);


--
-- Name: whatsapp_conversaciones whatsapp_conversaciones_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_conversaciones
    ADD CONSTRAINT whatsapp_conversaciones_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_estadisticas whatsapp_estadisticas_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_estadisticas
    ADD CONSTRAINT whatsapp_estadisticas_pkey PRIMARY KEY (empresa_id, fecha);


--
-- Name: whatsapp_mensajes whatsapp_mensajes_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_mensajes
    ADD CONSTRAINT whatsapp_mensajes_pkey PRIMARY KEY (id);


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
-- Name: idx_entidades_catalogos_entidad; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_entidades_catalogos_entidad ON core.entidades_catalogos USING btree (empresa_id, entidad_tipo_id, entidad_id);


--
-- Name: INDEX idx_entidades_catalogos_entidad; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_entidades_catalogos_entidad IS 'Optimiza consultas de catálogos asociados a una entidad';


--
-- Name: idx_parametros_empresa_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_empresa_empresa ON core.parametros_empresa USING btree (empresa_id);


--
-- Name: idx_parametros_opciones_parametro; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_opciones_parametro ON core.parametros_opciones USING btree (parametro_id);


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
-- Name: ux_catalogos_tipos_empresa_nombre; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_catalogos_tipos_empresa_nombre ON core.catalogos_tipos USING btree (empresa_id, nombre);


--
-- Name: INDEX ux_catalogos_tipos_empresa_nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.ux_catalogos_tipos_empresa_nombre IS 'Evita duplicar nombres de catálogo dentro de una empresa';


--
-- Name: documentos_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documentos_unico ON public.documentos USING btree (empresa_id, lower((tipo_documento)::text), COALESCE(serie, ''::character varying), numero);


--
-- Name: idx_cd_cp_sat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cd_cp_sat ON public.contactos_domicilios USING btree (cp_sat);


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
-- Name: idx_documentos_partidas_campos_empresa_partida_campo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_documentos_partidas_campos_empresa_partida_campo ON public.documentos_partidas_campos USING btree (empresa_id, partida_id, campo_id);


--
-- Name: INDEX idx_documentos_partidas_campos_empresa_partida_campo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_documentos_partidas_campos_empresa_partida_campo IS 'Índice único que soporta el UPSERT del motor de campos dinámicos sobre partidas (empresa_id, partida_id, campo_id).';


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
-- Name: ix_contactos_empresa_tel_sec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_tel_sec ON public.contactos USING btree (empresa_id, telefono_secundario) WHERE (telefono_secundario IS NOT NULL);


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
-- Name: ix_ue_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ue_empresa ON public.usuarios_empresas USING btree (empresa_id);


--
-- Name: ix_ue_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ue_usuario ON public.usuarios_empresas USING btree (usuario_id);


--
-- Name: ux_contactos_domicilios_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_contactos_domicilios_principal ON public.contactos_domicilios USING btree (contacto_id) WHERE (es_principal = true);


--
-- Name: ux_contactos_empresa_telefono; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_contactos_empresa_telefono ON public.contactos USING btree (empresa_id, telefono) WHERE (telefono IS NOT NULL);


--
-- Name: ux_contactos_rfc_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_contactos_rfc_empresa ON public.contactos USING btree (empresa_id, rfc) WHERE (rfc IS NOT NULL);


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
-- Name: ix_whatsapp_conv_empresa_estado; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX ix_whatsapp_conv_empresa_estado ON whatsapp.whatsapp_conversaciones USING btree (empresa_id, estado);


--
-- Name: ix_whatsapp_mensajes_empresa_fecha; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX ix_whatsapp_mensajes_empresa_fecha ON whatsapp.whatsapp_mensajes USING btree (empresa_id, fecha_envio DESC);


--
-- Name: ux_whatsapp_mensaje_externo; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE UNIQUE INDEX ux_whatsapp_mensaje_externo ON whatsapp.whatsapp_mensajes USING btree (empresa_id, id_externo) WHERE (id_externo IS NOT NULL);


--
-- Name: contactos trg_contactos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contactos_updated_at BEFORE UPDATE ON public.contactos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


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
-- Name: parametros_empresa fk_parametro_empresa_parametro; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_empresa
    ADD CONSTRAINT fk_parametro_empresa_parametro FOREIGN KEY (parametro_id) REFERENCES core.parametros(parametro_id) ON DELETE CASCADE;


--
-- Name: parametros_opciones fk_parametro_opciones; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones
    ADD CONSTRAINT fk_parametro_opciones FOREIGN KEY (parametro_id) REFERENCES core.parametros(parametro_id) ON DELETE CASCADE;


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
-- Name: documentos_cfdi fk_documentos_cfdi_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cfdi
    ADD CONSTRAINT fk_documentos_cfdi_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


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
-- Name: usuarios_empresas fk_ue_rol; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas
    ADD CONSTRAINT fk_ue_rol FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: unidades fk_unidad_sat; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades
    ADD CONSTRAINT fk_unidad_sat FOREIGN KEY (unidad_sat_id) REFERENCES sat.unidades(id);


--
-- Name: whatsapp_contacto_mapeo whatsapp_contacto_mapeo_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_contacto_mapeo
    ADD CONSTRAINT whatsapp_contacto_mapeo_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: whatsapp_conversaciones whatsapp_conversaciones_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_conversaciones
    ADD CONSTRAINT whatsapp_conversaciones_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: whatsapp_mensajes whatsapp_mensajes_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_mensajes
    ADD CONSTRAINT whatsapp_mensajes_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: whatsapp_mensajes whatsapp_mensajes_conversacion_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_mensajes
    ADD CONSTRAINT whatsapp_mensajes_conversacion_id_fkey FOREIGN KEY (conversacion_id) REFERENCES whatsapp.whatsapp_conversaciones(id);


--
-- PostgreSQL database dump complete
--

