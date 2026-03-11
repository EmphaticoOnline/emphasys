-- Schema: core
-- Table: parametros_modulos
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
-- Name: parametros_modulos parametros_modulos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_modulos
    ADD CONSTRAINT parametros_modulos_pkey PRIMARY KEY (parametro_id, modulo_id);


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
-- PostgreSQL database dump complete
--

