-- Schema: sat
-- Table: paises
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
-- Name: paises; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.paises (
    id text NOT NULL,
    texto text NOT NULL,
    patron_codigo_postal text NOT NULL,
    patron_identidad_tributaria text NOT NULL,
    validacion_identidad_tributaria text NOT NULL,
    agrupaciones text NOT NULL
);


--
-- Name: paises paises_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.paises
    ADD CONSTRAINT paises_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

