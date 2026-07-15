-- Schema: core
-- Table: cfdi_pac_config
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict ACwBBkYqbMArYdaHjMDPxRRhZGh3xAW3X32dpbbfNM6HiMdOhhXwfMjxlUXxeb9

-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
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
-- Name: cfdi_pac_config; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_pac_config (
    id integer NOT NULL,
    pac character varying(50) DEFAULT 'facturama'::character varying NOT NULL,
    modo character varying(20) DEFAULT 'sandbox'::character varying NOT NULL,
    base_url text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    stamp_path text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT cfdi_pac_config_modo_chk CHECK (((modo)::text = ANY ((ARRAY['sandbox'::character varying, 'produccion'::character varying])::text[])))
);


--
-- Name: cfdi_pac_config_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_pac_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_pac_config_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_pac_config_id_seq OWNED BY core.cfdi_pac_config.id;


--
-- Name: cfdi_pac_config id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_pac_config ALTER COLUMN id SET DEFAULT nextval('core.cfdi_pac_config_id_seq'::regclass);


--
-- Name: cfdi_pac_config cfdi_pac_config_pac_modo_unique; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_pac_config
    ADD CONSTRAINT cfdi_pac_config_pac_modo_unique UNIQUE (pac, modo);


--
-- Name: cfdi_pac_config cfdi_pac_config_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_pac_config
    ADD CONSTRAINT cfdi_pac_config_pkey PRIMARY KEY (id);


--
-- Name: ux_cfdi_pac_config_activo_modo; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_cfdi_pac_config_activo_modo ON core.cfdi_pac_config USING btree (modo) WHERE (activo = true);


--
-- PostgreSQL database dump complete
--

\unrestrict ACwBBkYqbMArYdaHjMDPxRRhZGh3xAW3X32dpbbfNM6HiMdOhhXwfMjxlUXxeb9

