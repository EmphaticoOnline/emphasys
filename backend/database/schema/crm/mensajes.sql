-- Schema: crm
-- Table: mensajes
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict qg05EDSmrfefoMAM3B9m8IiHzMVaiIeVT7g7JJLVfndzyp6Ezmi5gP8mOKZCWKw

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
-- Name: mensajes; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.mensajes (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer,
    conversacion_id bigint,
    telefono character varying(20),
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
    tipo_contenido character varying(20) DEFAULT 'text'::character varying NOT NULL,
    media_url text,
    mime_type character varying(100),
    caption text,
    email_from character varying(150),
    email_to character varying(150),
    email_subject character varying(200),
    email_cc character varying(200),
    email_bcc character varying(200),
    in_reply_to character varying(150),
    CONSTRAINT mensajes_status_check CHECK ((((status)::text = ANY (ARRAY[('queued'::character varying)::text, ('sent'::character varying)::text, ('delivered'::character varying)::text, ('read'::character varying)::text, ('failed'::character varying)::text, ('received'::character varying)::text])) OR (status IS NULL))),
    CONSTRAINT mensajes_telefono_check CHECK (((telefono)::text ~ '^[+0-9]{8,20}$'::text)),
    CONSTRAINT mensajes_tipo_contenido_chk CHECK (((tipo_contenido)::text = ANY ((ARRAY['text'::character varying, 'image'::character varying, 'audio'::character varying, 'document'::character varying])::text[]))),
    CONSTRAINT mensajes_tipo_mensaje_check CHECK (((tipo_mensaje)::text = ANY (ARRAY[('saliente'::character varying)::text, ('entrante'::character varying)::text])))
);


--
-- Name: TABLE mensajes; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.mensajes IS 'Registro historico de mensajes por empresa.';


--
-- Name: COLUMN mensajes.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.empresa_id IS 'Empresa propietaria del mensaje.';


--
-- Name: COLUMN mensajes.tipo_contenido; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.tipo_contenido IS 'Tipo de contenido del mensaje: text, image, audio, document';


--
-- Name: COLUMN mensajes.media_url; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.media_url IS 'URL del archivo multimedia asociado al mensaje (si aplica)';


--
-- Name: COLUMN mensajes.mime_type; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.mime_type IS 'MIME type del archivo multimedia (si aplica)';


--
-- Name: COLUMN mensajes.caption; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.caption IS 'Texto/caption asociado a mensajes multimedia (imagen, audio, documento)';


--
-- Name: COLUMN mensajes.email_from; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_from IS 'Remitente para mensajes de correo dentro del canal CRM.';


--
-- Name: COLUMN mensajes.email_to; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_to IS 'Destinatario principal para mensajes de correo dentro del canal CRM.';


--
-- Name: COLUMN mensajes.email_subject; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_subject IS 'Asunto del correo asociado al mensaje CRM.';


--
-- Name: COLUMN mensajes.email_cc; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_cc IS 'Destinatarios en copia para mensajes de correo del CRM.';


--
-- Name: COLUMN mensajes.email_bcc; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.email_bcc IS 'Destinatarios en copia oculta para mensajes de correo del CRM.';


--
-- Name: COLUMN mensajes.in_reply_to; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.mensajes.in_reply_to IS 'Identificador externo del mensaje al que responde un correo.';


--
-- Name: mensajes_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

ALTER TABLE crm.mensajes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME crm.mensajes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mensajes mensajes_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.mensajes
    ADD CONSTRAINT mensajes_pkey PRIMARY KEY (id);


--
-- Name: ix_mensajes_empresa_fecha; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX ix_mensajes_empresa_fecha ON crm.mensajes USING btree (empresa_id, fecha_envio DESC);


--
-- Name: ux_mensaje_externo; Type: INDEX; Schema: crm; Owner: -
--

CREATE UNIQUE INDEX ux_mensaje_externo ON crm.mensajes USING btree (empresa_id, id_externo) WHERE (id_externo IS NOT NULL);


--
-- Name: mensajes fk_mensajes_contactos; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.mensajes
    ADD CONSTRAINT fk_mensajes_contactos FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: mensajes fk_mensajes_conversaciones; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.mensajes
    ADD CONSTRAINT fk_mensajes_conversaciones FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id);


--
-- PostgreSQL database dump complete
--

\unrestrict qg05EDSmrfefoMAM3B9m8IiHzMVaiIeVT7g7JJLVfndzyp6Ezmi5gP8mOKZCWKw

