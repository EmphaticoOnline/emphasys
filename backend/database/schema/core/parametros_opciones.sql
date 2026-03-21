-- Schema: core
-- Table: parametros_opciones
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict idnE2cnMlPQLmWioivuhQ9tIOB65bQh0OWYzQ3TUaXcbHE7K55h6IgJMhkKmC3y

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
-- Name: parametros_opciones opcion_id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones ALTER COLUMN opcion_id SET DEFAULT nextval('core.parametros_opciones_opcion_id_seq'::regclass);


--
-- Name: parametros_opciones parametros_opciones_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones
    ADD CONSTRAINT parametros_opciones_pkey PRIMARY KEY (opcion_id);


--
-- Name: parametros_opciones uq_parametro_opcion; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones
    ADD CONSTRAINT uq_parametro_opcion UNIQUE (parametro_id, valor);


--
-- Name: idx_parametros_opciones_parametro; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_opciones_parametro ON core.parametros_opciones USING btree (parametro_id);


--
-- Name: parametros_opciones fk_parametros_opciones_parametro; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_opciones
    ADD CONSTRAINT fk_parametros_opciones_parametro FOREIGN KEY (parametro_id) REFERENCES core.parametros(parametro_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict idnE2cnMlPQLmWioivuhQ9tIOB65bQh0OWYzQ3TUaXcbHE7K55h6IgJMhkKmC3y

