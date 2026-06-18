-- Schema: migrate
-- Table: productos_legacy_supplier_json
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict i4TdUdoMIgffP4WjyNHckccF8GUWfRkpaS8H4pvXmXbkRzyfcXkERIXSHIet8DU

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
-- Name: productos_legacy_supplier_json; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.productos_legacy_supplier_json (
    id bigint NOT NULL,
    data jsonb NOT NULL,
    fecha_importacion timestamp with time zone DEFAULT now()
);


--
-- Name: productos_legacy_supplier_json_id_seq; Type: SEQUENCE; Schema: migrate; Owner: -
--

CREATE SEQUENCE migrate.productos_legacy_supplier_json_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_legacy_supplier_json_id_seq; Type: SEQUENCE OWNED BY; Schema: migrate; Owner: -
--

ALTER SEQUENCE migrate.productos_legacy_supplier_json_id_seq OWNED BY migrate.productos_legacy_supplier_json.id;


--
-- Name: productos_legacy_supplier_json id; Type: DEFAULT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.productos_legacy_supplier_json ALTER COLUMN id SET DEFAULT nextval('migrate.productos_legacy_supplier_json_id_seq'::regclass);


--
-- Name: productos_legacy_supplier_json productos_legacy_supplier_json_pkey; Type: CONSTRAINT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.productos_legacy_supplier_json
    ADD CONSTRAINT productos_legacy_supplier_json_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict i4TdUdoMIgffP4WjyNHckccF8GUWfRkpaS8H4pvXmXbkRzyfcXkERIXSHIet8DU

