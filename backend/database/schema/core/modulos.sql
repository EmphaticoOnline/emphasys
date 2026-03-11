-- Schema: core
-- Table: modulos
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
-- Name: modulos modulo_id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.modulos ALTER COLUMN modulo_id SET DEFAULT nextval('core.modulos_modulo_id_seq'::regclass);


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
-- PostgreSQL database dump complete
--

