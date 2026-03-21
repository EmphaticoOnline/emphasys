-- Schema: core
-- Table: parametros
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict h2oyOaPFrnstcIjwuHzIuUxUVnpXfbeAGHySay5zl2flGEK9uzbeivvBys6TnRc

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
-- Name: idx_parametros_padre; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_padre ON core.parametros USING btree (parametro_padre_id);


--
-- Name: parametros fk_parametros_padre; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros
    ADD CONSTRAINT fk_parametros_padre FOREIGN KEY (parametro_padre_id) REFERENCES core.parametros(parametro_id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict h2oyOaPFrnstcIjwuHzIuUxUVnpXfbeAGHySay5zl2flGEK9uzbeivvBys6TnRc

