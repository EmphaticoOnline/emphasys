-- Schema: core
-- Table: catalogos
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
-- Name: catalogos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.catalogos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_catalogo_id integer NOT NULL,
    clave character varying(40),
    descripcion character varying(150) NOT NULL,
    orden integer,
    activo boolean DEFAULT true,
    extra jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE catalogos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.catalogos IS 'Valores de cada tipo de catálogo configurable';


--
-- Name: COLUMN catalogos.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.id IS 'Identificador interno del registro del catálogo';


--
-- Name: COLUMN catalogos.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.empresa_id IS 'Empresa propietaria del catálogo';


--
-- Name: COLUMN catalogos.tipo_catalogo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.tipo_catalogo_id IS 'Tipo de catálogo al que pertenece el registro';


--
-- Name: COLUMN catalogos.clave; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.clave IS 'Clave corta opcional del elemento del catálogo';


--
-- Name: COLUMN catalogos.descripcion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.descripcion IS 'Descripción visible del elemento del catálogo';


--
-- Name: COLUMN catalogos.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.orden IS 'Orden sugerido de aparición en listas';


--
-- Name: COLUMN catalogos.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.activo IS 'Indica si el elemento del catálogo está activo';


--
-- Name: COLUMN catalogos.extra; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.extra IS 'Información adicional flexible en formato JSON';


--
-- Name: COLUMN catalogos.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos.created_at IS 'Fecha de creación del registro';


--
-- Name: catalogos_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.catalogos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogos_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.catalogos_id_seq OWNED BY core.catalogos.id;


--
-- Name: catalogos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos ALTER COLUMN id SET DEFAULT nextval('core.catalogos_id_seq'::regclass);


--
-- Name: catalogos catalogos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos
    ADD CONSTRAINT catalogos_pkey PRIMARY KEY (id);


--
-- Name: idx_catalogos_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_empresa ON core.catalogos USING btree (empresa_id);


--
-- Name: INDEX idx_catalogos_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_catalogos_empresa IS 'Optimiza consultas de catálogos filtradas por empresa';


--
-- Name: idx_catalogos_tipo; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_tipo ON core.catalogos USING btree (empresa_id, tipo_catalogo_id);


--
-- Name: INDEX idx_catalogos_tipo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_catalogos_tipo IS 'Optimiza consultas por tipo de catálogo';


--
-- Name: catalogos catalogos_tipo_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos
    ADD CONSTRAINT catalogos_tipo_catalogo_id_fkey FOREIGN KEY (tipo_catalogo_id) REFERENCES core.catalogos_tipos(id);


--
-- PostgreSQL database dump complete
--

