-- Schema: whatsapp
-- Table: contacto_estado
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
-- Name: contacto_estado; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.contacto_estado (
    empresa_id integer NOT NULL,
    telefono character varying(20) NOT NULL,
    opt_in boolean DEFAULT false NOT NULL,
    opt_out boolean DEFAULT false NOT NULL,
    ultimo_in timestamp with time zone,
    ultimo_out timestamp with time zone,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contacto_estado_telefono_check CHECK (((telefono)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: TABLE contacto_estado; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.contacto_estado IS 'Controla ventana 24h y consentimiento por empresa.';


--
-- Name: COLUMN contacto_estado.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.contacto_estado.empresa_id IS 'Empresa a la que pertenece el telefono.';


--
-- Name: contacto_estado contacto_estado_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.contacto_estado
    ADD CONSTRAINT contacto_estado_pkey PRIMARY KEY (empresa_id, telefono);


--
-- PostgreSQL database dump complete
--

