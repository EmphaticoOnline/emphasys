-- Schema: sat
-- Table: claves_unidades
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
-- Name: claves_unidades; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.claves_unidades (
    id text NOT NULL,
    texto text NOT NULL,
    descripcion text NOT NULL,
    notas text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    simbolo text NOT NULL,
    search_vector tsvector
);


--
-- Name: claves_unidades claves_unidades_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.claves_unidades
    ADD CONSTRAINT claves_unidades_pkey PRIMARY KEY (id);


--
-- Name: idx_claves_unidades_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_claves_unidades_search ON sat.claves_unidades USING gin (search_vector);


--
-- Name: idx_claves_unidades_texto_trgm; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_claves_unidades_texto_trgm ON sat.claves_unidades USING gin (texto sat.gin_trgm_ops);


--
-- PostgreSQL database dump complete
--

