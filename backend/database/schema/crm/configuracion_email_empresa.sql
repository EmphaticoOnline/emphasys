-- Schema: crm
-- Table: configuracion_email_empresa
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 5TV7YkOJ60WKARdErqXsEf0boglCn4H2N3pLgnjLl4nNbZJxgvQ1NOvtu9ojBpj

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
-- Name: configuracion_email_empresa; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.configuracion_email_empresa (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    smtp_host character varying(255) NOT NULL,
    smtp_port integer NOT NULL,
    smtp_user character varying(255) NOT NULL,
    smtp_password text,
    smtp_secure boolean DEFAULT false NOT NULL,
    email_remitente character varying(255),
    nombre_remitente character varying(255),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT configuracion_email_empresa_smtp_port_chk CHECK (((smtp_port >= 1) AND (smtp_port <= 65535)))
);


--
-- Name: configuracion_email_empresa_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.configuracion_email_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_email_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.configuracion_email_empresa_id_seq OWNED BY crm.configuracion_email_empresa.id;


--
-- Name: configuracion_email_empresa id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa ALTER COLUMN id SET DEFAULT nextval('crm.configuracion_email_empresa_id_seq'::regclass);


--
-- Name: configuracion_email_empresa configuracion_email_empresa_empresa_uk; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa
    ADD CONSTRAINT configuracion_email_empresa_empresa_uk UNIQUE (empresa_id);


--
-- Name: configuracion_email_empresa configuracion_email_empresa_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa
    ADD CONSTRAINT configuracion_email_empresa_pkey PRIMARY KEY (id);


--
-- Name: configuracion_email_empresa configuracion_email_empresa_empresa_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_empresa
    ADD CONSTRAINT configuracion_email_empresa_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 5TV7YkOJ60WKARdErqXsEf0boglCn4H2N3pLgnjLl4nNbZJxgvQ1NOvtu9ojBpj

