-- Schema: core
-- Table: empresas_impuestos_default
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
-- Name: empresas_impuestos_default; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_impuestos_default (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    impuesto_id character varying(30) NOT NULL,
    orden integer DEFAULT 0
);


--
-- Name: TABLE empresas_impuestos_default; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_impuestos_default IS 'Impuestos predeterminados de una empresa. Se aplican cuando un producto no tiene impuestos definidos.';


--
-- Name: COLUMN empresas_impuestos_default.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_impuestos_default.empresa_id IS 'Empresa a la que pertenecen los impuestos predeterminados.';


--
-- Name: COLUMN empresas_impuestos_default.impuesto_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_impuestos_default.impuesto_id IS 'Impuesto que se aplicará por defecto a los productos sin impuestos definidos.';


--
-- Name: COLUMN empresas_impuestos_default.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_impuestos_default.orden IS 'Orden de aplicación del impuesto cuando existen múltiples impuestos.';


--
-- Name: empresas_impuestos_default_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_impuestos_default_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_impuestos_default_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_impuestos_default_id_seq OWNED BY core.empresas_impuestos_default.id;


--
-- Name: empresas_impuestos_default id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default ALTER COLUMN id SET DEFAULT nextval('core.empresas_impuestos_default_id_seq'::regclass);


--
-- Name: empresas_impuestos_default empresas_impuestos_default_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default
    ADD CONSTRAINT empresas_impuestos_default_pkey PRIMARY KEY (id);


--
-- Name: empresas_impuestos_default uq_empresas_impuestos_default; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default
    ADD CONSTRAINT uq_empresas_impuestos_default UNIQUE (empresa_id, impuesto_id);


--
-- Name: idx_empresas_impuestos_default_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_impuestos_default_empresa ON core.empresas_impuestos_default USING btree (empresa_id);


--
-- Name: idx_empresas_impuestos_default_impuesto; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_impuestos_default_impuesto ON core.empresas_impuestos_default USING btree (impuesto_id);


--
-- Name: empresas_impuestos_default fk_empresas_impuestos_default_impuesto; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_impuestos_default
    ADD CONSTRAINT fk_empresas_impuestos_default_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- PostgreSQL database dump complete
--

