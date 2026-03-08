-- Schema: sat
-- Table: codigos_postales
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
-- Name: codigos_postales; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.codigos_postales (
    id text NOT NULL,
    estado text NOT NULL,
    municipio text NOT NULL,
    localidad text NOT NULL,
    estimulo_frontera integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL,
    huso_descripcion text NOT NULL,
    huso_verano_mes_inicio text NOT NULL,
    huso_verano_dia_inicio text NOT NULL,
    huso_verano_hora_inicio text NOT NULL,
    huso_verano_diferencia text NOT NULL,
    huso_invierno_mes_inicio text NOT NULL,
    huso_invierno_dia_inicio text NOT NULL,
    huso_invierno_hora_inicio text NOT NULL,
    huso_invierno_diferencia text NOT NULL
);


--
-- Name: codigos_postales codigos_postales_cp_key; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.codigos_postales
    ADD CONSTRAINT codigos_postales_cp_key UNIQUE (id);


--
-- Name: codigos_postales codigos_postales_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.codigos_postales
    ADD CONSTRAINT codigos_postales_pkey PRIMARY KEY (id);


--
-- Name: idx_codigos_postales_estado; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_codigos_postales_estado ON sat.codigos_postales USING btree (estado);


--
-- PostgreSQL database dump complete
--

