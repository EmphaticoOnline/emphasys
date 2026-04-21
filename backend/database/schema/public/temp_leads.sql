-- Schema: public
-- Table: temp_leads
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
-- Name: temp_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_leads (
    nombre text,
    correo text,
    telefono text,
    empresa text,
    estado text,
    producto_servicio text,
    vendedor text,
    seguimiento text,
    estatus text,
    "NÚMERO DE TELÉFONO" bigint,
    "Column4" bigint,
    "FRECUENCIA" character varying(50),
    "PRODUCTO/SERVICIO" character varying(50),
    "Column12" character varying(50),
    "Column13" character varying(50),
    "Column14" character varying(50),
    "Column15" character varying(50),
    "Column16" character varying(50),
    "Column17" character varying(50),
    "Column18" character varying(50),
    "Column19" character varying(50),
    "Column20" character varying(50),
    "Column21" character varying(50),
    "Column22" character varying(50),
    "Column23" character varying(50),
    "Column24" character varying(50),
    "Column25" character varying(50),
    "Column26" character varying(50),
    "Column27" character varying(50),
    "Column28" character varying(50),
    "Column29" character varying(50),
    "Column30" character varying(50)
);


--
-- PostgreSQL database dump complete
--

