-- Schema: sat
-- Table: numeros_pedimento_aduana
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict DWyzapzV9YBHx9hbzD5Yi4apwyg2Sy6fhEwfnUgmMiOQWitbmxmi0zrZo0S3h5Y

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
-- Name: numeros_pedimento_aduana; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.numeros_pedimento_aduana (
    aduana text NOT NULL,
    patente text NOT NULL,
    ejercicio integer NOT NULL,
    cantidad integer NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: numeros_pedimento_aduana numeros_pedimento_aduana_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.numeros_pedimento_aduana
    ADD CONSTRAINT numeros_pedimento_aduana_pkey PRIMARY KEY (aduana, patente, ejercicio);


--
-- PostgreSQL database dump complete
--

\unrestrict DWyzapzV9YBHx9hbzD5Yi4apwyg2Sy6fhEwfnUgmMiOQWitbmxmi0zrZo0S3h5Y

