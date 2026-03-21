-- Schema: sat
-- Table: colonias
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 7BWZwTetnrxxzCTbhBDCf0IQTwO0pgpP1Zf8QHO2ceW1wm4Q1G0AjSbKU6pZ8bU

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
-- Name: colonias; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.colonias (
    colonia text NOT NULL,
    codigo_postal text NOT NULL,
    texto text NOT NULL,
    search_vector tsvector
);


--
-- Name: colonias colonias_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.colonias
    ADD CONSTRAINT colonias_pkey PRIMARY KEY (codigo_postal, colonia);


--
-- Name: idx_colonias_cp; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_colonias_cp ON sat.colonias USING btree (codigo_postal);


--
-- Name: idx_colonias_cp_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_colonias_cp_texto ON sat.colonias USING btree (codigo_postal, texto);


--
-- Name: idx_colonias_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_colonias_search ON sat.colonias USING gin (search_vector);


--
-- PostgreSQL database dump complete
--

\unrestrict 7BWZwTetnrxxzCTbhBDCf0IQTwO0pgpP1Zf8QHO2ceW1wm4Q1G0AjSbKU6pZ8bU

