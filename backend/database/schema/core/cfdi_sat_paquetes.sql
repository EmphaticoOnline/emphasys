-- Schema: core
-- Table: cfdi_sat_paquetes
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict LXpXSYyJw9GSlPTEewRQuykZgjGdyNyqBnhK3C4E52a3cj3m3aRWTiKgJ1VYOS0

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
-- Name: cfdi_sat_paquetes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_sat_paquetes (
    id integer NOT NULL,
    solicitud_id integer NOT NULL,
    sat_package_id character varying(80) NOT NULL,
    estatus character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    zip_path character varying(500),
    descargado_en timestamp with time zone,
    mensaje_error text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_cfdi_sat_paquetes_estatus CHECK (((estatus)::text = ANY ((ARRAY['pendiente'::character varying, 'descargado'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: TABLE cfdi_sat_paquetes; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.cfdi_sat_paquetes IS 'Paquetes (ZIP) devueltos por la verificación de una solicitud al SAT. Uno o más por solicitud.';


--
-- Name: COLUMN cfdi_sat_paquetes.zip_path; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_paquetes.zip_path IS 'Ruta relativa dentro de CFDI_SAT_STORAGE_DIR (storage privado, fuera de uploads/) donde se guardó el ZIP crudo descargado del SAT.';


--
-- Name: cfdi_sat_paquetes_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_sat_paquetes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_sat_paquetes_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_sat_paquetes_id_seq OWNED BY core.cfdi_sat_paquetes.id;


--
-- Name: cfdi_sat_paquetes id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_paquetes ALTER COLUMN id SET DEFAULT nextval('core.cfdi_sat_paquetes_id_seq'::regclass);


--
-- Name: cfdi_sat_paquetes cfdi_sat_paquetes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_paquetes
    ADD CONSTRAINT cfdi_sat_paquetes_pkey PRIMARY KEY (id);


--
-- Name: cfdi_sat_paquetes ux_cfdi_sat_paquetes_solicitud_package; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_paquetes
    ADD CONSTRAINT ux_cfdi_sat_paquetes_solicitud_package UNIQUE (solicitud_id, sat_package_id);


--
-- Name: ix_cfdi_sat_paquetes_solicitud; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_cfdi_sat_paquetes_solicitud ON core.cfdi_sat_paquetes USING btree (solicitud_id);


--
-- Name: cfdi_sat_paquetes cfdi_sat_paquetes_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_paquetes
    ADD CONSTRAINT cfdi_sat_paquetes_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES core.cfdi_sat_solicitudes(id);


--
-- PostgreSQL database dump complete
--

\unrestrict LXpXSYyJw9GSlPTEewRQuykZgjGdyNyqBnhK3C4E52a3cj3m3aRWTiKgJ1VYOS0

