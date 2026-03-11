-- Schema: core
-- Table: parametros
-- Generated automatically

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

SET default_table_access_method = heap;

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
-- Name: parametros parametro_id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros ALTER COLUMN parametro_id SET DEFAULT nextval('core.parametros_parametro_id_seq'::regclass);


--
-- Name: parametros parametros_clave_key; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros
    ADD CONSTRAINT parametros_clave_key UNIQUE (clave);


--
-- Name: parametros parametros_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros
    ADD CONSTRAINT parametros_pkey PRIMARY KEY (parametro_id);


--
-- PostgreSQL database dump complete
--

