-- Schema: whatsapp
-- Table: config
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
-- Name: config; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.config (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    phone_number character varying(20) NOT NULL,
    api_key character varying(255) NOT NULL,
    app_name character varying(100) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT config_phone_number_chk CHECK (((phone_number)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: TABLE config; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.config IS 'Configuración del canal WhatsApp por empresa (API key, número, app de Gupshup)';


--
-- Name: config_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

CREATE SEQUENCE whatsapp.config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: config_id_seq; Type: SEQUENCE OWNED BY; Schema: whatsapp; Owner: -
--

ALTER SEQUENCE whatsapp.config_id_seq OWNED BY whatsapp.config.id;


--
-- Name: config id; Type: DEFAULT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config ALTER COLUMN id SET DEFAULT nextval('whatsapp.config_id_seq'::regclass);


--
-- Name: config config_empresa_id_uk; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config
    ADD CONSTRAINT config_empresa_id_uk UNIQUE (empresa_id);


--
-- Name: config config_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (id);


--
-- Name: config_empresa_id_idx; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX config_empresa_id_idx ON whatsapp.config USING btree (empresa_id);


--
-- Name: config config_empresa_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.config
    ADD CONSTRAINT config_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

