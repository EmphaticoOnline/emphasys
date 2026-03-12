-- Schema: core
-- Table: empresas_tipos_documento_transiciones
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
-- Name: empresas_tipos_documento_transiciones; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas_tipos_documento_transiciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento_origen_id integer NOT NULL,
    tipo_documento_destino_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0,
    usuario_creacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE empresas_tipos_documento_transiciones; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas_tipos_documento_transiciones IS 'Define, por empresa, qué tipos de documento pueden generarse a partir de otros dentro del ERP.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.empresa_id IS 'Empresa a la que aplica la transición entre tipos de documento.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.tipo_documento_origen_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.tipo_documento_origen_id IS 'Tipo de documento desde el cual se genera otro documento.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.tipo_documento_destino_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.tipo_documento_destino_id IS 'Tipo de documento que puede generarse a partir del documento origen.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.activo IS 'Indica si la transición está habilitada para la empresa.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.orden IS 'Orden en que aparecerá la opción en la interfaz.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.usuario_creacion_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.usuario_creacion_id IS 'Usuario que registró la transición.';


--
-- Name: COLUMN empresas_tipos_documento_transiciones.fecha_creacion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas_tipos_documento_transiciones.fecha_creacion IS 'Fecha de creación del registro.';


--
-- Name: empresas_tipos_documento_transiciones_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_tipos_documento_transiciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_tipos_documento_transiciones_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_tipos_documento_transiciones_id_seq OWNED BY core.empresas_tipos_documento_transiciones.id;


--
-- Name: empresas_tipos_documento_transiciones id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones ALTER COLUMN id SET DEFAULT nextval('core.empresas_tipos_documento_transiciones_id_seq'::regclass);


--
-- Name: empresas_tipos_documento_transiciones empresas_tipos_documento_transiciones_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT empresas_tipos_documento_transiciones_pkey PRIMARY KEY (id);


--
-- Name: empresas_tipos_documento_transiciones uq_empresas_tipos_documento_transiciones; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT uq_empresas_tipos_documento_transiciones UNIQUE (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id);


--
-- Name: idx_etdt_destino; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_etdt_destino ON core.empresas_tipos_documento_transiciones USING btree (tipo_documento_destino_id);


--
-- Name: INDEX idx_etdt_destino; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_etdt_destino IS 'Índice para consultas por tipo de documento destino.';


--
-- Name: idx_etdt_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_etdt_empresa ON core.empresas_tipos_documento_transiciones USING btree (empresa_id);


--
-- Name: INDEX idx_etdt_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_etdt_empresa IS 'Índice para consultas por empresa.';


--
-- Name: idx_etdt_origen; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_etdt_origen ON core.empresas_tipos_documento_transiciones USING btree (tipo_documento_origen_id);


--
-- Name: INDEX idx_etdt_origen; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_etdt_origen IS 'Índice para consultas por tipo de documento origen.';


--
-- Name: empresas_tipos_documento_transiciones fk_etdt_destino; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT fk_etdt_destino FOREIGN KEY (tipo_documento_destino_id) REFERENCES core.tipos_documento(id) ON DELETE CASCADE;


--
-- Name: empresas_tipos_documento_transiciones fk_etdt_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT fk_etdt_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE CASCADE;


--
-- Name: empresas_tipos_documento_transiciones fk_etdt_origen; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas_tipos_documento_transiciones
    ADD CONSTRAINT fk_etdt_origen FOREIGN KEY (tipo_documento_origen_id) REFERENCES core.tipos_documento(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

