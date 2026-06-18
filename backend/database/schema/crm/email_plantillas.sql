-- Schema: crm
-- Table: email_plantillas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict GRpVOVIYUaE0CZm8d8NOCebu1M5FWH6pYoLnDmUdOARsCyub5Xe7aGwH7WTxZtx

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
-- Name: email_plantillas; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.email_plantillas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(100) NOT NULL,
    asunto text NOT NULL,
    html text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_plantillas_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.email_plantillas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_plantillas_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.email_plantillas_id_seq OWNED BY crm.email_plantillas.id;


--
-- Name: email_plantillas id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas ALTER COLUMN id SET DEFAULT nextval('crm.email_plantillas_id_seq'::regclass);


--
-- Name: email_plantillas email_plantillas_empresa_tipo_uk; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas
    ADD CONSTRAINT email_plantillas_empresa_tipo_uk UNIQUE (empresa_id, tipo);


--
-- Name: email_plantillas email_plantillas_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas
    ADD CONSTRAINT email_plantillas_pkey PRIMARY KEY (id);


--
-- Name: email_plantillas email_plantillas_empresa_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.email_plantillas
    ADD CONSTRAINT email_plantillas_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict GRpVOVIYUaE0CZm8d8NOCebu1M5FWH6pYoLnDmUdOARsCyub5Xe7aGwH7WTxZtx

