-- Schema: core
-- Table: empresas_assets
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
-- Name: empresas_assets; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_assets (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    ruta character varying(500) NOT NULL,
    mime_type character varying(100),
    tamano_bytes bigint,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE empresas_assets; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_assets IS 'Archivos asociados a empresas (logos, firmas, documentos u otros assets corporativos).';


--
-- Name: COLUMN empresas_assets.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.id IS 'Identificador interno del asset';


--
-- Name: COLUMN empresas_assets.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.empresa_id IS 'Empresa propietaria del archivo';


--
-- Name: COLUMN empresas_assets.tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.tipo IS 'Tipo de asset (logo_default, logo_factura, firma, marca_agua, etc.)';


--
-- Name: COLUMN empresas_assets.nombre_archivo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.nombre_archivo IS 'Nombre original del archivo subido por el usuario';


--
-- Name: COLUMN empresas_assets.ruta; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.ruta IS 'Ruta física o URL donde se encuentra almacenado el archivo';


--
-- Name: COLUMN empresas_assets.mime_type; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.mime_type IS 'Tipo MIME del archivo';


--
-- Name: COLUMN empresas_assets.tamano_bytes; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.tamano_bytes IS 'Tamaño del archivo en bytes';


--
-- Name: COLUMN empresas_assets.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.activo IS 'Indica si el asset está activo';


--
-- Name: COLUMN empresas_assets.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_assets.created_at IS 'Fecha de creación del registro';


--
-- Name: empresas_assets_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_assets_id_seq OWNED BY core.empresas_assets.id;


--
-- Name: empresas_assets id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_assets ALTER COLUMN id SET DEFAULT nextval('core.empresas_assets_id_seq'::regclass);


--
-- Name: empresas_assets empresas_assets_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_assets
    ADD CONSTRAINT empresas_assets_pkey PRIMARY KEY (id);


--
-- Name: idx_empresas_assets_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_assets_empresa ON core.empresas_assets USING btree (empresa_id);


--
-- Name: INDEX idx_empresas_assets_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_assets_empresa IS 'Optimiza consultas de assets por empresa';


--
-- Name: idx_empresas_assets_tipo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_assets_tipo ON core.empresas_assets USING btree (empresa_id, tipo);


--
-- Name: INDEX idx_empresas_assets_tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_assets_tipo IS 'Optimiza consultas de assets por empresa y tipo';


--
-- Name: empresas_assets fk_empresas_assets_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_assets
    ADD CONSTRAINT fk_empresas_assets_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

