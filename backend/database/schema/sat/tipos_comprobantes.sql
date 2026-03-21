-- Schema: sat
-- Table: tipos_comprobantes
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 82hhL0zVisAbPJScLFR3aPctI1VCMn4tBBPSG390MYvBUlTDEW5PawwGJrFeebr

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
-- Name: tipos_comprobantes; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.tipos_comprobantes (
    id text NOT NULL,
    texto text NOT NULL,
    valor_maximo text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: tipos_comprobantes tipos_comprobantes_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.tipos_comprobantes
    ADD CONSTRAINT tipos_comprobantes_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict 82hhL0zVisAbPJScLFR3aPctI1VCMn4tBBPSG390MYvBUlTDEW5PawwGJrFeebr

