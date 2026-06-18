-- Schema: crm
-- Table: conversaciones
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict n6bn7gUJYqGn7VqO8rrqWfSeKwLF5vQgGP2hVyLfmdZbdGOehc1hMHV89X7VeK7

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
-- Name: conversaciones; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.conversaciones (
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
    CONSTRAINT chk_etapa_oportunidad CHECK (((etapa_oportunidad)::text = ANY ((ARRAY['nuevo'::character varying, 'contactado'::character varying, 'interesado'::character varying, 'cotizado'::character varying, 'negociacion'::character varying, 'convertida'::character varying, 'perdida'::character varying])::text[]))),
    CONSTRAINT conversaciones_estado_check CHECK (((estado)::text = ANY (ARRAY[('abierta'::character varying)::text, ('cerrada'::character varying)::text])))
);


--
-- Name: TABLE conversaciones; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.conversaciones IS 'Agrupa mensajes en ciclos comerciales por empresa.';


--
-- Name: COLUMN conversaciones.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversaciones.empresa_id IS 'Empresa propietaria de la conversacion.';


--
-- Name: COLUMN conversaciones.contacto_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversaciones.contacto_id IS 'Contacto asociado a la conversacion.';


--
-- Name: COLUMN conversaciones.etapa_oportunidad; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversaciones.etapa_oportunidad IS 'Etapa comercial del lead: nuevo, contactado, interesado, cotizado, negociacion, convertida o perdida.';


--
-- Name: conversaciones_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

ALTER TABLE crm.conversaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME crm.conversaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conversaciones conversaciones_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversaciones
    ADD CONSTRAINT conversaciones_pkey PRIMARY KEY (id);


--
-- Name: ix_conv_empresa_estado; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX ix_conv_empresa_estado ON crm.conversaciones USING btree (empresa_id, estado);


--
-- Name: conversaciones fk_conversaciones_contactos; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversaciones
    ADD CONSTRAINT fk_conversaciones_contactos FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- PostgreSQL database dump complete
--

\unrestrict n6bn7gUJYqGn7VqO8rrqWfSeKwLF5vQgGP2hVyLfmdZbdGOehc1hMHV89X7VeK7

