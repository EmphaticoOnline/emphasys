-- Schema: sat
-- Table: municipios
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
-- Name: municipios; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.municipios (
    municipio text NOT NULL,
    estado text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    search_vector tsvector
);


--
-- Name: municipios municipios_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.municipios
    ADD CONSTRAINT municipios_pkey PRIMARY KEY (estado, municipio);


--
-- Name: idx_municipios_estado; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_municipios_estado ON sat.municipios USING btree (estado);


--
-- Name: idx_municipios_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_municipios_search ON sat.municipios USING gin (search_vector);


--
-- PostgreSQL database dump complete
--

