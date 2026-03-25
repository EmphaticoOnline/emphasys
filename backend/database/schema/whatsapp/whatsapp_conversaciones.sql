-- Schema: whatsapp
-- Table: whatsapp_conversaciones
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
-- Name: whatsapp_conversaciones; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_conversaciones (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer NOT NULL,
    estado character varying(20) DEFAULT 'abierta'::character varying NOT NULL,
    asignado_a integer,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_mensaje_en timestamp with time zone DEFAULT now() NOT NULL,
    cerrada_en timestamp with time zone,
    prioridad character varying(10) DEFAULT 'media'::character varying NOT NULL,
    siguiente_accion character varying(30) DEFAULT 'responder'::character varying NOT NULL,
    etapa_oportunidad character varying(30) DEFAULT 'nuevo'::character varying NOT NULL,
    CONSTRAINT chk_etapa_oportunidad CHECK (((etapa_oportunidad)::text = ANY ((ARRAY['nuevo'::character varying, 'contactado'::character varying, 'interesado'::character varying, 'cotizado'::character varying, 'negociacion'::character varying, 'ganado'::character varying, 'perdido'::character varying])::text[]))),
    CONSTRAINT whatsapp_conversaciones_estado_check CHECK (((estado)::text = ANY (ARRAY[('abierta'::character varying)::text, ('cerrada'::character varying)::text])))
);


--
-- Name: TABLE whatsapp_conversaciones; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.whatsapp_conversaciones IS 'Agrupa mensajes en ciclos comerciales por empresa.';


--
-- Name: COLUMN whatsapp_conversaciones.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_conversaciones.empresa_id IS 'Empresa propietaria de la conversacion.';


--
-- Name: COLUMN whatsapp_conversaciones.contacto_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_conversaciones.contacto_id IS 'Contacto asociado a la conversacion.';


--
-- Name: whatsapp_conversaciones_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

ALTER TABLE whatsapp.whatsapp_conversaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME whatsapp.whatsapp_conversaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: whatsapp_conversaciones whatsapp_conversaciones_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_conversaciones
    ADD CONSTRAINT whatsapp_conversaciones_pkey PRIMARY KEY (id);


--
-- Name: ix_whatsapp_conv_empresa_estado; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX ix_whatsapp_conv_empresa_estado ON whatsapp.whatsapp_conversaciones USING btree (empresa_id, estado);


--
-- Name: whatsapp_conversaciones whatsapp_conversaciones_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_conversaciones
    ADD CONSTRAINT whatsapp_conversaciones_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- PostgreSQL database dump complete
--

