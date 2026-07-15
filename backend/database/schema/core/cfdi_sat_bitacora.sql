-- Schema: core
-- Table: cfdi_sat_bitacora
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict mxx7XnWAsopKRQQ1O9WbBjFr9MhYypZMEiere0fv2ZrVDW6SeVETi0HL4DqijCw

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
-- Name: cfdi_sat_bitacora; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_sat_bitacora (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    usuario_id integer NOT NULL,
    accion character varying(40) NOT NULL,
    resultado character varying(10) DEFAULT 'ok'::character varying NOT NULL,
    detalle text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_cfdi_sat_bitacora_accion CHECK (((accion)::text = ANY ((ARRAY['credencial_subida'::character varying, 'credencial_eliminada'::character varying, 'autorizacion_aceptada'::character varying, 'solicitud_creada'::character varying, 'verificacion'::character varying, 'descarga_paquete'::character varying, 'importado_compras'::character varying, 'verificacion_automatica'::character varying, 'descarga_automatica'::character varying, 'automatizacion_error'::character varying, 'vinculacion_documento'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT ck_cfdi_sat_bitacora_resultado CHECK (((resultado)::text = ANY ((ARRAY['ok'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: TABLE cfdi_sat_bitacora; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.cfdi_sat_bitacora IS 'Bitácora de auditoría de la funcionalidad de descarga masiva de CFDIs del SAT. No debe registrar contraseñas ni contenido de certificados.';


--
-- Name: cfdi_sat_bitacora_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_sat_bitacora_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_sat_bitacora_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_sat_bitacora_id_seq OWNED BY core.cfdi_sat_bitacora.id;


--
-- Name: cfdi_sat_bitacora id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_bitacora ALTER COLUMN id SET DEFAULT nextval('core.cfdi_sat_bitacora_id_seq'::regclass);


--
-- Name: cfdi_sat_bitacora cfdi_sat_bitacora_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_bitacora
    ADD CONSTRAINT cfdi_sat_bitacora_pkey PRIMARY KEY (id);


--
-- Name: ix_cfdi_sat_bitacora_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_cfdi_sat_bitacora_empresa ON core.cfdi_sat_bitacora USING btree (empresa_id, creado_en DESC);


--
-- Name: cfdi_sat_bitacora cfdi_sat_bitacora_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_bitacora
    ADD CONSTRAINT cfdi_sat_bitacora_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: cfdi_sat_bitacora cfdi_sat_bitacora_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_bitacora
    ADD CONSTRAINT cfdi_sat_bitacora_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict mxx7XnWAsopKRQQ1O9WbBjFr9MhYypZMEiere0fv2ZrVDW6SeVETi0HL4DqijCw

