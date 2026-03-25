-- Schema: sat
-- Table: productos_servicios
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
-- Name: productos_servicios; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.productos_servicios (
    id text NOT NULL,
    texto text NOT NULL,
    iva_trasladado integer NOT NULL,
    ieps_trasladado integer NOT NULL,
    complemento text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    estimulo_frontera integer NOT NULL,
    similares text NOT NULL,
    search_vector tsvector
);


--
-- Name: productos_servicios productos_servicios_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.productos_servicios
    ADD CONSTRAINT productos_servicios_pkey PRIMARY KEY (id);


--
-- Name: idx_productos_servicios_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_productos_servicios_search ON sat.productos_servicios USING gin (search_vector);


--
-- Name: idx_productos_servicios_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_productos_servicios_texto ON sat.productos_servicios USING btree (texto);


--
-- Name: idx_productos_servicios_texto_trgm; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_productos_servicios_texto_trgm ON sat.productos_servicios USING gin (texto sat.gin_trgm_ops);


--
-- PostgreSQL database dump complete
--

