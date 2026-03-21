-- Schema: sat
-- Table: localidades
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict RnrpegiZH8hR0pZ1gOt9te5RR7GeOYUtq2NTlff6p0ie8pepWfnC92I4Qd8g6va

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
-- Name: localidades; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.localidades (
    localidad text NOT NULL,
    estado text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    search_vector tsvector
);


--
-- Name: localidades localidades_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.localidades
    ADD CONSTRAINT localidades_pkey PRIMARY KEY (estado, localidad);


--
-- Name: idx_localidades_estado; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_localidades_estado ON sat.localidades USING btree (estado);


--
-- Name: idx_localidades_search; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_localidades_search ON sat.localidades USING gin (search_vector);


--
-- PostgreSQL database dump complete
--

\unrestrict RnrpegiZH8hR0pZ1gOt9te5RR7GeOYUtq2NTlff6p0ie8pepWfnC92I4Qd8g6va

