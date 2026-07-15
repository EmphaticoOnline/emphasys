-- Schema: core
-- Table: cfdi_sat_comprobantes
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict H3H8HZYCkCyiehLcNVCkhIg5KKxJhSGDmET7JxTzweqmN3V4BvsJwtKXBR5Qpkv

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
-- Name: cfdi_sat_comprobantes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_sat_comprobantes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    solicitud_id integer NOT NULL,
    paquete_id integer NOT NULL,
    uuid character varying(36) NOT NULL,
    rfc_emisor character varying(13) NOT NULL,
    rfc_receptor character varying(13) NOT NULL,
    nombre_emisor character varying(300),
    nombre_receptor character varying(300),
    fecha_emision timestamp without time zone,
    tipo_comprobante character varying(1),
    total numeric(15,2),
    moneda character varying(3),
    estatus_sat character varying(10),
    tipo_descarga character varying(10) NOT NULL,
    xml_path character varying(500),
    importado_compras boolean DEFAULT false NOT NULL,
    documento_id integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_cfdi_sat_comprobantes_estatus_sat CHECK (((estatus_sat IS NULL) OR ((estatus_sat)::text = ANY ((ARRAY['vigente'::character varying, 'cancelado'::character varying])::text[])))),
    CONSTRAINT ck_cfdi_sat_comprobantes_tipo_comprobante CHECK (((tipo_comprobante IS NULL) OR ((tipo_comprobante)::text = ANY ((ARRAY['I'::character varying, 'E'::character varying, 'T'::character varying, 'N'::character varying, 'P'::character varying])::text[])))),
    CONSTRAINT ck_cfdi_sat_comprobantes_tipo_descarga CHECK (((tipo_descarga)::text = ANY ((ARRAY['emitidos'::character varying, 'recibidos'::character varying])::text[])))
);


--
-- Name: TABLE cfdi_sat_comprobantes; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.cfdi_sat_comprobantes IS 'CFDIs descargados del SAT (XML o solo metadata, según el tipo de solicitud). Fase 3: solo registro, sin importación a compras.';


--
-- Name: COLUMN cfdi_sat_comprobantes.estatus_sat; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_comprobantes.estatus_sat IS 'Vigente/cancelado según el SAT. Solo se conoce de forma confiable en solicitudes de tipo metadata; en tipo xml puede quedar NULL.';


--
-- Name: COLUMN cfdi_sat_comprobantes.xml_path; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_comprobantes.xml_path IS 'Ruta relativa dentro de CFDI_SAT_STORAGE_DIR (storage privado). NULL cuando la solicitud fue de tipo metadata (no hay XML disponible).';


--
-- Name: COLUMN cfdi_sat_comprobantes.importado_compras; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_comprobantes.importado_compras IS 'Placeholder para una fase futura que importe los comprobantes recibidos al módulo de compras. No se usa todavía.';


--
-- Name: cfdi_sat_comprobantes_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_sat_comprobantes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_sat_comprobantes_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_sat_comprobantes_id_seq OWNED BY core.cfdi_sat_comprobantes.id;


--
-- Name: cfdi_sat_comprobantes id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_comprobantes ALTER COLUMN id SET DEFAULT nextval('core.cfdi_sat_comprobantes_id_seq'::regclass);


--
-- Name: cfdi_sat_comprobantes cfdi_sat_comprobantes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_comprobantes
    ADD CONSTRAINT cfdi_sat_comprobantes_pkey PRIMARY KEY (id);


--
-- Name: cfdi_sat_comprobantes ux_cfdi_sat_comprobantes_empresa_uuid; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_comprobantes
    ADD CONSTRAINT ux_cfdi_sat_comprobantes_empresa_uuid UNIQUE (empresa_id, uuid);


--
-- Name: ix_cfdi_sat_comprobantes_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_cfdi_sat_comprobantes_empresa ON core.cfdi_sat_comprobantes USING btree (empresa_id, creado_en DESC);


--
-- Name: ix_cfdi_sat_comprobantes_solicitud; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_cfdi_sat_comprobantes_solicitud ON core.cfdi_sat_comprobantes USING btree (solicitud_id);


--
-- Name: cfdi_sat_comprobantes cfdi_sat_comprobantes_documento_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_comprobantes
    ADD CONSTRAINT cfdi_sat_comprobantes_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- Name: cfdi_sat_comprobantes cfdi_sat_comprobantes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_comprobantes
    ADD CONSTRAINT cfdi_sat_comprobantes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: cfdi_sat_comprobantes cfdi_sat_comprobantes_paquete_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_comprobantes
    ADD CONSTRAINT cfdi_sat_comprobantes_paquete_id_fkey FOREIGN KEY (paquete_id) REFERENCES core.cfdi_sat_paquetes(id);


--
-- Name: cfdi_sat_comprobantes cfdi_sat_comprobantes_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_comprobantes
    ADD CONSTRAINT cfdi_sat_comprobantes_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES core.cfdi_sat_solicitudes(id);


--
-- PostgreSQL database dump complete
--

\unrestrict H3H8HZYCkCyiehLcNVCkhIg5KKxJhSGDmET7JxTzweqmN3V4BvsJwtKXBR5Qpkv

