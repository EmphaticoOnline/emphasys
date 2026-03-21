-- Schema: core
-- Table: empresas_tipos_documento
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict PO0pPYtEcegszeiITgEBIPgFFwE56EDvmRg3hVGK1R1fNklEVa7wdX5WqWPm9dQ

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
-- Name: empresas_tipos_documento; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_tipos_documento (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0,
    usuario_creacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE empresas_tipos_documento; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_tipos_documento IS 'Tabla que define qué tipos de documentos utiliza cada empresa y permite habilitarlos o deshabilitarlos.';


--
-- Name: COLUMN empresas_tipos_documento.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.empresa_id IS 'Empresa a la que aplica el tipo de documento.';


--
-- Name: COLUMN empresas_tipos_documento.tipo_documento_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.tipo_documento_id IS 'Tipo de documento habilitado para la empresa.';


--
-- Name: COLUMN empresas_tipos_documento.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.activo IS 'Indica si el tipo de documento está habilitado para la empresa.';


--
-- Name: COLUMN empresas_tipos_documento.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.orden IS 'Orden de aparición en la interfaz del ERP para esa empresa.';


--
-- Name: COLUMN empresas_tipos_documento.usuario_creacion_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.usuario_creacion_id IS 'Usuario que creó el registro.';


--
-- Name: COLUMN empresas_tipos_documento.fecha_creacion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento.fecha_creacion IS 'Fecha de creación del registro.';


--
-- Name: empresas_tipos_documento_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_tipos_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_tipos_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_tipos_documento_id_seq OWNED BY core.empresas_tipos_documento.id;


--
-- Name: empresas_tipos_documento id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento ALTER COLUMN id SET DEFAULT nextval('core.empresas_tipos_documento_id_seq'::regclass);


--
-- Name: empresas_tipos_documento empresas_tipos_documento_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT empresas_tipos_documento_pkey PRIMARY KEY (id);


--
-- Name: empresas_tipos_documento uq_empresas_tipos_documento; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT uq_empresas_tipos_documento UNIQUE (empresa_id, tipo_documento_id);


--
-- Name: idx_empresas_tipos_documento_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_tipos_documento_empresa ON core.empresas_tipos_documento USING btree (empresa_id);


--
-- Name: idx_empresas_tipos_documento_tipo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_tipos_documento_tipo ON core.empresas_tipos_documento USING btree (tipo_documento_id);


--
-- Name: INDEX idx_empresas_tipos_documento_tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_tipos_documento_tipo IS 'Índice para consultas por tipo de documento.';


--
-- Name: empresas_tipos_documento fk_empresas_tipos_documento_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT fk_empresas_tipos_documento_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE CASCADE;


--
-- Name: empresas_tipos_documento fk_empresas_tipos_documento_tipo; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento
    ADD CONSTRAINT fk_empresas_tipos_documento_tipo FOREIGN KEY (tipo_documento_id) REFERENCES core.tipos_documento(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict PO0pPYtEcegszeiITgEBIPgFFwE56EDvmRg3hVGK1R1fNklEVa7wdX5WqWPm9dQ

