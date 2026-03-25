-- Schema: whatsapp
-- Table: whatsapp_estadisticas
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
-- Name: whatsapp_estadisticas; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_estadisticas (
    empresa_id integer NOT NULL,
    fecha date NOT NULL,
    mensajes_enviados integer DEFAULT 0 NOT NULL,
    mensajes_recibidos integer DEFAULT 0 NOT NULL,
    plantillas_usadas integer DEFAULT 0 NOT NULL,
    errores_envio integer DEFAULT 0 NOT NULL
);


--
-- Name: TABLE whatsapp_estadisticas; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.whatsapp_estadisticas IS 'Estadisticas diarias de WhatsApp por empresa.';


--
-- Name: COLUMN whatsapp_estadisticas.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_estadisticas.empresa_id IS 'Empresa a la que pertenecen las metricas.';


--
-- Name: whatsapp_estadisticas whatsapp_estadisticas_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_estadisticas
    ADD CONSTRAINT whatsapp_estadisticas_pkey PRIMARY KEY (empresa_id, fecha);


--
-- PostgreSQL database dump complete
--

