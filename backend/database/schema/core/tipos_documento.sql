-- Schema: core
-- Table: tipos_documento
-- Generated automatically

--
-- PostgreSQL database dump
--

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
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

SET default_table_access_method = heap;

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
    modulo character varying(30)
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
-- Name: tipos_documento id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.tipos_documento ALTER COLUMN id SET DEFAULT nextval('core.tipos_documento_id_seq'::regclass);


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
-- Name: idx_tipos_documento_modulo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_tipos_documento_modulo ON core.tipos_documento USING btree (modulo);


--
-- Name: INDEX idx_tipos_documento_modulo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_tipos_documento_modulo IS 'Permite filtrar rápidamente tipos de documento por módulo (ventas o compras).';


--
-- PostgreSQL database dump complete
--

