-- Schema: core
-- Table: entidades_tipos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict TYGQyJwm9rkWvm4btV2lbNbZStTF6OMbPzFqZ5iZfPWOUiOGuin70bxqnzDOpxZ

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

SET default_table_access_method = heap;

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
-- Name: entidades_tipos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_tipos ALTER COLUMN id SET DEFAULT nextval('core.entidades_tipos_id_seq'::regclass);


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
-- PostgreSQL database dump complete
--

\unrestrict TYGQyJwm9rkWvm4btV2lbNbZStTF6OMbPzFqZ5iZfPWOUiOGuin70bxqnzDOpxZ

