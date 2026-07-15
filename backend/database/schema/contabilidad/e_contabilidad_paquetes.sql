-- Schema: contabilidad
-- Table: e_contabilidad_paquetes
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict EaCOhEdVXSfbUKIkzkUfSsn2VtX0DrFVOIXFLkAkzSTV9BJjratDVRvNuFnLbQu

-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
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

SET default_table_access_method = heap;

--
-- Name: e_contabilidad_paquetes; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.e_contabilidad_paquetes (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    ejercicio integer NOT NULL,
    periodo smallint NOT NULL,
    nombre_zip character varying(255) NOT NULL,
    archivos_incluidos jsonb NOT NULL,
    parametros jsonb NOT NULL,
    resumen jsonb NOT NULL,
    hash_zip character varying(128),
    hash_algoritmo character varying(20) DEFAULT 'SHA-256'::character varying,
    generado_por bigint,
    generado_en timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    estatus character varying(30) DEFAULT 'generado'::character varying NOT NULL,
    enviado_sat boolean DEFAULT false NOT NULL,
    enviado_sat_en timestamp with time zone,
    acuse_sat text,
    CONSTRAINT chk_e_contabilidad_paquetes_ejercicio CHECK ((ejercicio >= 2000)),
    CONSTRAINT chk_e_contabilidad_paquetes_estatus CHECK (((estatus)::text = ANY ((ARRAY['generado'::character varying, 'enviado'::character varying, 'aceptado'::character varying, 'rechazado'::character varying])::text[]))),
    CONSTRAINT chk_e_contabilidad_paquetes_periodo CHECK (((periodo >= 1) AND (periodo <= 12)))
);


--
-- Name: TABLE e_contabilidad_paquetes; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.e_contabilidad_paquetes IS 'Bitácora interna de paquetes ZIP de e-contabilidad generados/descargados (Catálogo, Balanza, Pólizas, Auxiliares). Registra trazabilidad (parámetros, archivos incluidos, resumen, hash) pero NO almacena el ZIP ni los XML; cada descarga exitosa agrega un renglón nuevo, sin límite de regeneraciones por ejercicio/periodo.';


--
-- Name: COLUMN e_contabilidad_paquetes.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.id IS 'Identificador interno del registro de bitácora.';


--
-- Name: COLUMN e_contabilidad_paquetes.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.empresa_id IS 'Empresa para la que se generó el paquete.';


--
-- Name: COLUMN e_contabilidad_paquetes.ejercicio; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.ejercicio IS 'Ejercicio contable del paquete generado.';


--
-- Name: COLUMN e_contabilidad_paquetes.periodo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.periodo IS 'Periodo (mes, 1-12) del paquete generado.';


--
-- Name: COLUMN e_contabilidad_paquetes.nombre_zip; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.nombre_zip IS 'Nombre del archivo ZIP generado (convención RFC+Año+Mes+"_econtabilidad.zip").';


--
-- Name: COLUMN e_contabilidad_paquetes.archivos_incluidos; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.archivos_incluidos IS 'Arreglo JSON con los archivos incluidos en el paquete: clave, título, nombre de archivo XML, ok, errores y advertencias por archivo (mismo detalle que expone el preview del paquete).';


--
-- Name: COLUMN e_contabilidad_paquetes.parametros; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.parametros IS 'Parámetros usados para generar el paquete: ejercicio, periodo, qué XML se incluyeron, TipoEnvio/FechaModBal de Balanza si aplica, TipoSolicitud/NumOrden/NumTramite si aplica.';


--
-- Name: COLUMN e_contabilidad_paquetes.resumen; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.resumen IS 'Resumen agregado del paquete al momento de generarse: archivos seleccionados, correctos, con error, total de errores y advertencias.';


--
-- Name: COLUMN e_contabilidad_paquetes.hash_zip; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.hash_zip IS 'Hash del buffer ZIP generado (hexadecimal), para detectar si una regeneración produjo un archivo idéntico o distinto.';


--
-- Name: COLUMN e_contabilidad_paquetes.hash_algoritmo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.hash_algoritmo IS 'Algoritmo usado para hash_zip (por ahora siempre SHA-256).';


--
-- Name: COLUMN e_contabilidad_paquetes.generado_por; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.generado_por IS 'Usuario que generó/descargó el paquete (sin FK a core.usuarios, mismo criterio que contabilidad.polizas.creada_por_id).';


--
-- Name: COLUMN e_contabilidad_paquetes.generado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.generado_en IS 'Fecha y hora en que se generó/descargó el paquete.';


--
-- Name: COLUMN e_contabilidad_paquetes.observaciones; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.observaciones IS 'Notas libres sobre el paquete generado (uso futuro; no capturadas desde la pantalla en esta fase).';


--
-- Name: COLUMN e_contabilidad_paquetes.estatus; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.estatus IS 'Estatus del paquete respecto a un futuro envío al SAT. En esta fase siempre queda en ''generado''.';


--
-- Name: COLUMN e_contabilidad_paquetes.enviado_sat; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.enviado_sat IS 'Preparado para una fase futura de envío al SAT; no usado todavía (siempre false).';


--
-- Name: COLUMN e_contabilidad_paquetes.enviado_sat_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.enviado_sat_en IS 'Preparado para una fase futura de envío al SAT; no usado todavía.';


--
-- Name: COLUMN e_contabilidad_paquetes.acuse_sat; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.e_contabilidad_paquetes.acuse_sat IS 'Preparado para una fase futura de envío al SAT (acuse de recepción); no usado todavía.';


--
-- Name: CONSTRAINT chk_e_contabilidad_paquetes_ejercicio ON e_contabilidad_paquetes; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_e_contabilidad_paquetes_ejercicio ON contabilidad.e_contabilidad_paquetes IS 'Descarta ejercicios claramente inválidos (antes del año 2000).';


--
-- Name: CONSTRAINT chk_e_contabilidad_paquetes_estatus ON e_contabilidad_paquetes; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_e_contabilidad_paquetes_estatus ON contabilidad.e_contabilidad_paquetes IS 'Limita el estatus a los valores reconocidos por el sistema.';


--
-- Name: CONSTRAINT chk_e_contabilidad_paquetes_periodo ON e_contabilidad_paquetes; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_e_contabilidad_paquetes_periodo ON contabilidad.e_contabilidad_paquetes IS 'El periodo debe ser un mes válido (1-12).';


--
-- Name: e_contabilidad_paquetes_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.e_contabilidad_paquetes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: e_contabilidad_paquetes_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.e_contabilidad_paquetes_id_seq OWNED BY contabilidad.e_contabilidad_paquetes.id;


--
-- Name: e_contabilidad_paquetes id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.e_contabilidad_paquetes ALTER COLUMN id SET DEFAULT nextval('contabilidad.e_contabilidad_paquetes_id_seq'::regclass);


--
-- Name: e_contabilidad_paquetes e_contabilidad_paquetes_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.e_contabilidad_paquetes
    ADD CONSTRAINT e_contabilidad_paquetes_pkey PRIMARY KEY (id);


--
-- Name: idx_e_contabilidad_paquetes_empresa_ejercicio_periodo; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_e_contabilidad_paquetes_empresa_ejercicio_periodo ON contabilidad.e_contabilidad_paquetes USING btree (empresa_id, ejercicio, periodo);


--
-- Name: INDEX idx_e_contabilidad_paquetes_empresa_ejercicio_periodo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.idx_e_contabilidad_paquetes_empresa_ejercicio_periodo IS 'Índice para consultar la bitácora de una empresa filtrando por ejercicio/periodo.';


--
-- Name: idx_e_contabilidad_paquetes_generado_en; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_e_contabilidad_paquetes_generado_en ON contabilidad.e_contabilidad_paquetes USING btree (generado_en DESC);


--
-- Name: INDEX idx_e_contabilidad_paquetes_generado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.idx_e_contabilidad_paquetes_generado_en IS 'Índice para listar la bitácora ordenada por fecha de generación más reciente.';


--
-- Name: e_contabilidad_paquetes fk_e_contabilidad_paquetes_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.e_contabilidad_paquetes
    ADD CONSTRAINT fk_e_contabilidad_paquetes_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_e_contabilidad_paquetes_empresa ON e_contabilidad_paquetes; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_e_contabilidad_paquetes_empresa ON contabilidad.e_contabilidad_paquetes IS 'Relaciona el paquete generado con su empresa.';


--
-- PostgreSQL database dump complete
--

\unrestrict EaCOhEdVXSfbUKIkzkUfSsn2VtX0DrFVOIXFLkAkzSTV9BJjratDVRvNuFnLbQu

