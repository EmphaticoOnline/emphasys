-- Schema: core
-- Table: parametros_empresa
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict bctniucKnZsIFmZFd3C46sFymtOfR8LvagqWKvTaDj8w5TDb77Vu4KKbmQwmqm9

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
-- Name: parametros_empresa parametros_empresa_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_empresa
    ADD CONSTRAINT parametros_empresa_pkey PRIMARY KEY (empresa_id, parametro_id);


--
-- Name: idx_parametros_empresa_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_empresa_empresa ON core.parametros_empresa USING btree (empresa_id);


--
-- Name: idx_parametros_empresa_parametro; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_parametros_empresa_parametro ON core.parametros_empresa USING btree (parametro_id);


--
-- Name: parametros_empresa fk_parametros_empresa_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_empresa
    ADD CONSTRAINT fk_parametros_empresa_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE CASCADE;


--
-- Name: parametros_empresa fk_parametros_empresa_parametro; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.parametros_empresa
    ADD CONSTRAINT fk_parametros_empresa_parametro FOREIGN KEY (parametro_id) REFERENCES core.parametros(parametro_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict bctniucKnZsIFmZFd3C46sFymtOfR8LvagqWKvTaDj8w5TDb77Vu4KKbmQwmqm9

