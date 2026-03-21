-- Schema: whatsapp
-- Table: whatsapp_contacto_mapeo
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict PvthSMZBE8yFXBLfmkVyGC6EebNHSOtv7GYW42BW4UmZIZDiDumafnZiDLIB3ug

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
-- Name: whatsapp_contacto_mapeo; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_contacto_mapeo (
    numero_telefono character varying(20) NOT NULL,
    contacto_id integer,
    verificado boolean DEFAULT false NOT NULL,
    observado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_contacto_mapeo_numero_telefono_check CHECK (((numero_telefono)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: whatsapp_contacto_mapeo whatsapp_contacto_mapeo_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_contacto_mapeo
    ADD CONSTRAINT whatsapp_contacto_mapeo_pkey PRIMARY KEY (numero_telefono);


--
-- Name: whatsapp_contacto_mapeo whatsapp_contacto_mapeo_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_contacto_mapeo
    ADD CONSTRAINT whatsapp_contacto_mapeo_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- PostgreSQL database dump complete
--

\unrestrict PvthSMZBE8yFXBLfmkVyGC6EebNHSOtv7GYW42BW4UmZIZDiDumafnZiDLIB3ug

