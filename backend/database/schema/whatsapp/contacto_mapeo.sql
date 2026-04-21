-- Schema: whatsapp
-- Table: contacto_mapeo
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
-- Name: contacto_mapeo; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.contacto_mapeo (
    numero_telefono character varying(20) NOT NULL,
    contacto_id integer,
    verificado boolean DEFAULT false NOT NULL,
    observado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contacto_mapeo_numero_telefono_check CHECK (((numero_telefono)::text ~ '^[+0-9]{8,20}$'::text))
);


--
-- Name: contacto_mapeo contacto_mapeo_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.contacto_mapeo
    ADD CONSTRAINT contacto_mapeo_pkey PRIMARY KEY (numero_telefono);


--
-- Name: contacto_mapeo contacto_mapeo_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.contacto_mapeo
    ADD CONSTRAINT contacto_mapeo_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- PostgreSQL database dump complete
--

