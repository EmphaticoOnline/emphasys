-- Schema: sat
-- Table: reglas_tasa_cuota
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict Z9N4uCYCy4BqzPgexQkLjwWAPIe4GArg02sp0x09EN7fsM2pKTv1LkXIFC7IJh6

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
-- Name: reglas_tasa_cuota; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.reglas_tasa_cuota (
    tipo text NOT NULL,
    minimo text NOT NULL,
    valor text NOT NULL,
    impuesto text NOT NULL,
    factor text NOT NULL,
    traslado integer NOT NULL,
    retencion integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: reglas_tasa_cuota reglas_tasa_cuota_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.reglas_tasa_cuota
    ADD CONSTRAINT reglas_tasa_cuota_pkey PRIMARY KEY (tipo, impuesto, factor, minimo, valor);


--
-- Name: idx_reglas_tasa_cuota_impuesto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_reglas_tasa_cuota_impuesto ON sat.reglas_tasa_cuota USING btree (impuesto);


--
-- PostgreSQL database dump complete
--

\unrestrict Z9N4uCYCy4BqzPgexQkLjwWAPIe4GArg02sp0x09EN7fsM2pKTv1LkXIFC7IJh6

