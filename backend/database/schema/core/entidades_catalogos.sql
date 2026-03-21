-- Schema: core
-- Table: entidades_catalogos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict DEe3aRi9BMmfFVd7bMwKCGnQsB6LMocbDTHgTz1r632ALk8NmfEQsO55cijxYjv

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
-- Name: entidades_catalogos; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.entidades_catalogos (
    empresa_id integer NOT NULL,
    entidad_tipo_id integer NOT NULL,
    entidad_id integer NOT NULL,
    catalogo_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE entidades_catalogos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.entidades_catalogos IS 'Relación entre entidades del sistema y valores de catálogo';


--
-- Name: COLUMN entidades_catalogos.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.empresa_id IS 'Empresa propietaria de la entidad';


--
-- Name: COLUMN entidades_catalogos.entidad_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.entidad_tipo_id IS 'Tipo de entidad relacionada';


--
-- Name: COLUMN entidades_catalogos.entidad_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.entidad_id IS 'Identificador de la entidad';


--
-- Name: COLUMN entidades_catalogos.catalogo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.catalogo_id IS 'Valor de catálogo asignado a la entidad';


--
-- Name: COLUMN entidades_catalogos.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.entidades_catalogos.created_at IS 'Fecha de creación de la relación';


--
-- Name: entidades_catalogos entidades_catalogos_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_catalogos
    ADD CONSTRAINT entidades_catalogos_pkey PRIMARY KEY (empresa_id, entidad_tipo_id, entidad_id, catalogo_id);


--
-- Name: idx_entidades_catalogos_entidad; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_entidades_catalogos_entidad ON core.entidades_catalogos USING btree (empresa_id, entidad_tipo_id, entidad_id);


--
-- Name: INDEX idx_entidades_catalogos_entidad; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_entidades_catalogos_entidad IS 'Optimiza consultas de catálogos asociados a una entidad';


--
-- Name: entidades_catalogos entidades_catalogos_catalogo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_catalogos
    ADD CONSTRAINT entidades_catalogos_catalogo_id_fkey FOREIGN KEY (catalogo_id) REFERENCES core.catalogos(id);


--
-- Name: entidades_catalogos entidades_catalogos_entidad_tipo_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.entidades_catalogos
    ADD CONSTRAINT entidades_catalogos_entidad_tipo_id_fkey FOREIGN KEY (entidad_tipo_id) REFERENCES core.entidades_tipos(id);


--
-- PostgreSQL database dump complete
--

\unrestrict DEe3aRi9BMmfFVd7bMwKCGnQsB6LMocbDTHgTz1r632ALk8NmfEQsO55cijxYjv

