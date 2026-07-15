-- Schema: core
-- Table: cfdi_sat_autorizaciones
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict aMqIgKrhukteznU3Y1ZUK7a6Gpcb6cGoC1c8qszg7DJB0RzGhYUWmKI6OTjEoKP

-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
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
-- Name: cfdi_sat_autorizaciones; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_sat_autorizaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    usuario_id integer NOT NULL,
    version_texto character varying(20) NOT NULL,
    aceptado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE cfdi_sat_autorizaciones; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.cfdi_sat_autorizaciones IS 'Registro append-only de aceptación expresa del uso de la e.firma para descarga de CFDIs del SAT. La versión vigente se define en el backend (cfdi-sat-autorizacion-texto.ts).';


--
-- Name: cfdi_sat_autorizaciones_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_sat_autorizaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_sat_autorizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_sat_autorizaciones_id_seq OWNED BY core.cfdi_sat_autorizaciones.id;


--
-- Name: cfdi_sat_autorizaciones id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_autorizaciones ALTER COLUMN id SET DEFAULT nextval('core.cfdi_sat_autorizaciones_id_seq'::regclass);


--
-- Name: cfdi_sat_autorizaciones cfdi_sat_autorizaciones_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_autorizaciones
    ADD CONSTRAINT cfdi_sat_autorizaciones_pkey PRIMARY KEY (id);


--
-- Name: ix_cfdi_sat_autorizaciones_empresa_version; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_cfdi_sat_autorizaciones_empresa_version ON core.cfdi_sat_autorizaciones USING btree (empresa_id, version_texto, aceptado_en DESC);


--
-- Name: cfdi_sat_autorizaciones cfdi_sat_autorizaciones_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_autorizaciones
    ADD CONSTRAINT cfdi_sat_autorizaciones_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: cfdi_sat_autorizaciones cfdi_sat_autorizaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_autorizaciones
    ADD CONSTRAINT cfdi_sat_autorizaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict aMqIgKrhukteznU3Y1ZUK7a6Gpcb6cGoC1c8qszg7DJB0RzGhYUWmKI6OTjEoKP

