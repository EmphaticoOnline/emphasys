-- Schema: migrate
-- Table: productos_raw
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 2x1zLMl1KeKrSC0kXXd3YosOeaCymdzcwH5myAThGyx9VJ04WSNmBshDU1ysITK

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
-- Name: productos_raw; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.productos_raw (
    empresa_id integer NOT NULL,
    data jsonb NOT NULL,
    fecha_importacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- PostgreSQL database dump complete
--

\unrestrict 2x1zLMl1KeKrSC0kXXd3YosOeaCymdzcwH5myAThGyx9VJ04WSNmBshDU1ysITK

