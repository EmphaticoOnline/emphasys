-- Schema: sat
-- Table: usos_cfdi
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
-- Name: usos_cfdi; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.usos_cfdi (
    id text NOT NULL,
    texto text NOT NULL,
    aplica_fisica integer NOT NULL,
    aplica_moral integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    regimenes_fiscales_receptores text NOT NULL
);


--
-- Name: usos_cfdi usos_cfdi_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.usos_cfdi
    ADD CONSTRAINT usos_cfdi_pkey PRIMARY KEY (id);


--
-- Name: idx_usos_cfdi_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_usos_cfdi_texto ON sat.usos_cfdi USING btree (texto);


--
-- PostgreSQL database dump complete
--

