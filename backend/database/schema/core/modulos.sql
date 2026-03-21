-- Schema: core
-- Table: modulos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict n18xf5VrYM1OHf9PmEJXTaOOwn8U1Fe5CGefvfWd8a2hxWCUatehIcuFsa8qxVz

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

\unrestrict n18xf5VrYM1OHf9PmEJXTaOOwn8U1Fe5CGefvfWd8a2hxWCUatehIcuFsa8qxVz

