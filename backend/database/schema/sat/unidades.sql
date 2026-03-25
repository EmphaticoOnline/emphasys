-- Schema: sat
-- Table: unidades
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
-- Name: unidades; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.unidades (
    id integer NOT NULL,
    clave character varying(10) NOT NULL,
    descripcion character varying(150) NOT NULL,
    vigente boolean DEFAULT true NOT NULL
);


--
-- Name: unidades_id_seq; Type: SEQUENCE; Schema: sat; Owner: -
--

CREATE SEQUENCE sat.unidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unidades_id_seq; Type: SEQUENCE OWNED BY; Schema: sat; Owner: -
--

ALTER SEQUENCE sat.unidades_id_seq OWNED BY sat.unidades.id;


--
-- Name: unidades id; Type: DEFAULT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.unidades ALTER COLUMN id SET DEFAULT nextval('sat.unidades_id_seq'::regclass);


--
-- Name: unidades unidades_clave_key; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.unidades
    ADD CONSTRAINT unidades_clave_key UNIQUE (clave);


--
-- Name: unidades unidades_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.unidades
    ADD CONSTRAINT unidades_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

