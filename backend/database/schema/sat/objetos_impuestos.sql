-- Schema: sat
-- Table: objetos_impuestos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 6K0RC5go9aRXl8Wobd9b6KLzhLqNmfxy4uGsQCjGjOMdt1J8JDnA6NWqTLWsacW

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
-- Name: objetos_impuestos; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.objetos_impuestos (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: objetos_impuestos objetos_impuestos_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.objetos_impuestos
    ADD CONSTRAINT objetos_impuestos_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict 6K0RC5go9aRXl8Wobd9b6KLzhLqNmfxy4uGsQCjGjOMdt1J8JDnA6NWqTLWsacW

