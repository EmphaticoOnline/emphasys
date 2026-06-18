-- Schema: produccion
-- Table: etapas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict Auq79gKvSa1pO4FJIwzXC1peFbHgC0X6ftsRcIPreoXQ3uIjOaaUAttaSJ1wHMR

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
-- Name: etapas; Type: TABLE; Schema: produccion; Owner: -
--

CREATE TABLE produccion.etapas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    color character varying(20),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: etapas_id_seq; Type: SEQUENCE; Schema: produccion; Owner: -
--

CREATE SEQUENCE produccion.etapas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: etapas_id_seq; Type: SEQUENCE OWNED BY; Schema: produccion; Owner: -
--

ALTER SEQUENCE produccion.etapas_id_seq OWNED BY produccion.etapas.id;


--
-- Name: etapas id; Type: DEFAULT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.etapas ALTER COLUMN id SET DEFAULT nextval('produccion.etapas_id_seq'::regclass);


--
-- Name: etapas etapas_pkey; Type: CONSTRAINT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.etapas
    ADD CONSTRAINT etapas_pkey PRIMARY KEY (id);


--
-- Name: idx_produccion_etapas_empresa; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_etapas_empresa ON produccion.etapas USING btree (empresa_id);


--
-- Name: idx_produccion_etapas_empresa_orden; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_etapas_empresa_orden ON produccion.etapas USING btree (empresa_id, orden);


--
-- Name: etapas trg_produccion_etapas_updated_at; Type: TRIGGER; Schema: produccion; Owner: -
--

CREATE TRIGGER trg_produccion_etapas_updated_at BEFORE UPDATE ON produccion.etapas FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- PostgreSQL database dump complete
--

\unrestrict Auq79gKvSa1pO4FJIwzXC1peFbHgC0X6ftsRcIPreoXQ3uIjOaaUAttaSJ1wHMR

