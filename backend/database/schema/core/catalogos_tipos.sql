-- Schema: core
-- Table: catalogos_tipos
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
-- Name: catalogos_tipos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.catalogos_tipos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    entidad_tipo_id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    permite_multiple boolean DEFAULT false,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE catalogos_tipos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.catalogos_tipos IS 'Tipos de catálogos configurables por empresa y por tipo de entidad';


--
-- Name: COLUMN catalogos_tipos.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.id IS 'Identificador interno del tipo de catálogo';


--
-- Name: COLUMN catalogos_tipos.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.empresa_id IS 'Empresa propietaria del tipo de catálogo';


--
-- Name: COLUMN catalogos_tipos.entidad_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.entidad_tipo_id IS 'Tipo de entidad al que aplica el catálogo';


--
-- Name: COLUMN catalogos_tipos.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.nombre IS 'Nombre visible del tipo de catálogo';


--
-- Name: COLUMN catalogos_tipos.permite_multiple; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.permite_multiple IS 'Indica si la entidad puede tener múltiples valores de este tipo';


--
-- Name: COLUMN catalogos_tipos.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.activo IS 'Indica si el tipo de catálogo está activo';


--
-- Name: COLUMN catalogos_tipos.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.catalogos_tipos.created_at IS 'Fecha de creación del registro';


--
-- Name: catalogos_tipos_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.catalogos_tipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: catalogos_tipos_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.catalogos_tipos_id_seq OWNED BY core.catalogos_tipos.id;


--
-- Name: catalogos_tipos id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos_tipos ALTER COLUMN id SET DEFAULT nextval('core.catalogos_tipos_id_seq'::regclass);


--
-- Name: catalogos_tipos catalogos_tipos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos_tipos
    ADD CONSTRAINT catalogos_tipos_pkey PRIMARY KEY (id);


--
-- Name: idx_catalogos_tipos_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_catalogos_tipos_empresa ON core.catalogos_tipos USING btree (empresa_id);


--
-- Name: INDEX idx_catalogos_tipos_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_catalogos_tipos_empresa IS 'Optimiza consultas de tipos de catálogo por empresa';


--
-- Name: ux_catalogos_tipos_empresa_nombre; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_catalogos_tipos_empresa_nombre ON core.catalogos_tipos USING btree (empresa_id, nombre);


--
-- Name: INDEX ux_catalogos_tipos_empresa_nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.ux_catalogos_tipos_empresa_nombre IS 'Evita duplicar nombres de catálogo dentro de una empresa';


--
-- Name: catalogos_tipos catalogos_tipos_entidad_tipo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.catalogos_tipos
    ADD CONSTRAINT catalogos_tipos_entidad_tipo_id_fkey FOREIGN KEY (entidad_tipo_id) REFERENCES core.entidades_tipos(id);


--
-- PostgreSQL database dump complete
--

