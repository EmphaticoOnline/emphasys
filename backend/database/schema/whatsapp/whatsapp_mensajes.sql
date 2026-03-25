-- Schema: whatsapp
-- Table: whatsapp_mensajes
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
-- Name: whatsapp_mensajes; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.whatsapp_mensajes (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer,
    conversacion_id bigint,
    telefono character varying(20) NOT NULL,
    tipo_mensaje character varying(20),
    canal character varying(50),
    contenido text,
    plantilla_nombre character varying(100),
    fecha_envio timestamp with time zone,
    status character varying(20),
    id_externo character varying(100),
    intentos_envio integer DEFAULT 0 NOT NULL,
    respuesta_json jsonb,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_mensajes_status_check CHECK ((((status)::text = ANY (ARRAY[('queued'::character varying)::text, ('sent'::character varying)::text, ('delivered'::character varying)::text, ('read'::character varying)::text, ('failed'::character varying)::text, ('received'::character varying)::text])) OR (status IS NULL))),
    CONSTRAINT whatsapp_mensajes_telefono_check CHECK (((telefono)::text ~ '^[+0-9]{8,20}$'::text)),
    CONSTRAINT whatsapp_mensajes_tipo_mensaje_check CHECK (((tipo_mensaje)::text = ANY (ARRAY[('saliente'::character varying)::text, ('entrante'::character varying)::text])))
);


--
-- Name: TABLE whatsapp_mensajes; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.whatsapp_mensajes IS 'Registro historico de mensajes por empresa.';


--
-- Name: COLUMN whatsapp_mensajes.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.whatsapp_mensajes.empresa_id IS 'Empresa propietaria del mensaje.';


--
-- Name: whatsapp_mensajes_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

ALTER TABLE whatsapp.whatsapp_mensajes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME whatsapp.whatsapp_mensajes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: whatsapp_mensajes whatsapp_mensajes_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_mensajes
    ADD CONSTRAINT whatsapp_mensajes_pkey PRIMARY KEY (id);


--
-- Name: ix_whatsapp_mensajes_empresa_fecha; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX ix_whatsapp_mensajes_empresa_fecha ON whatsapp.whatsapp_mensajes USING btree (empresa_id, fecha_envio DESC);


--
-- Name: ux_whatsapp_mensaje_externo; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE UNIQUE INDEX ux_whatsapp_mensaje_externo ON whatsapp.whatsapp_mensajes USING btree (empresa_id, id_externo) WHERE (id_externo IS NOT NULL);


--
-- Name: whatsapp_mensajes whatsapp_mensajes_contacto_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_mensajes
    ADD CONSTRAINT whatsapp_mensajes_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: whatsapp_mensajes whatsapp_mensajes_conversacion_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.whatsapp_mensajes
    ADD CONSTRAINT whatsapp_mensajes_conversacion_id_fkey FOREIGN KEY (conversacion_id) REFERENCES whatsapp.whatsapp_conversaciones(id);


--
-- PostgreSQL database dump complete
--

