-- Schema: crm
-- Table: configuracion_email_usuario
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict kLUYg0c2iYLnuw8zZVsLEUq3d0ZHapLe7tYc46qfW88sueA1l7FHc019cHN6OvW

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
-- Name: configuracion_email_usuario; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.configuracion_email_usuario (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
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
    CONSTRAINT configuracion_email_usuario_smtp_port_chk CHECK (((smtp_port >= 1) AND (smtp_port <= 65535)))
);


--
-- Name: configuracion_email_usuario_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.configuracion_email_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_email_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.configuracion_email_usuario_id_seq OWNED BY crm.configuracion_email_usuario.id;


--
-- Name: configuracion_email_usuario id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario ALTER COLUMN id SET DEFAULT nextval('crm.configuracion_email_usuario_id_seq'::regclass);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_pkey PRIMARY KEY (id);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_usuario_empresa_uk; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_usuario_empresa_uk UNIQUE (usuario_id, empresa_id);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_empresa_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: configuracion_email_usuario configuracion_email_usuario_usuario_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.configuracion_email_usuario
    ADD CONSTRAINT configuracion_email_usuario_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict kLUYg0c2iYLnuw8zZVsLEUq3d0ZHapLe7tYc46qfW88sueA1l7FHc019cHN6OvW

