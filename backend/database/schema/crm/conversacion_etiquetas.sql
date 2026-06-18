-- Schema: crm
-- Table: conversacion_etiquetas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict VdOAkAhWEenxqDG4SpUOOmKjHDh3Kop5cJZEBc2EWWc48gSis3iCfc5pmzMnBBo

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
-- Name: conversacion_etiquetas; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.conversacion_etiquetas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    conversacion_id integer NOT NULL,
    etiqueta_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE conversacion_etiquetas; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.conversacion_etiquetas IS 'Tabla puente que relaciona conversaciones con múltiples etiquetas';


--
-- Name: COLUMN conversacion_etiquetas.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.empresa_id IS 'Empresa propietaria de la relación';


--
-- Name: COLUMN conversacion_etiquetas.conversacion_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.conversacion_id IS 'ID de la conversación de WhatsApp';


--
-- Name: COLUMN conversacion_etiquetas.etiqueta_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.etiqueta_id IS 'ID de la etiqueta asignada a la conversación';


--
-- Name: COLUMN conversacion_etiquetas.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.conversacion_etiquetas.created_at IS 'Fecha en que se asignó la etiqueta a la conversación';


--
-- Name: conversacion_etiquetas_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.conversacion_etiquetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversacion_etiquetas_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.conversacion_etiquetas_id_seq OWNED BY crm.conversacion_etiquetas.id;


--
-- Name: conversacion_etiquetas id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas ALTER COLUMN id SET DEFAULT nextval('crm.conversacion_etiquetas_id_seq'::regclass);


--
-- Name: conversacion_etiquetas conversacion_etiquetas_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT conversacion_etiquetas_pkey PRIMARY KEY (id);


--
-- Name: conversacion_etiquetas uq_whatsapp_conversacion_etiquetas; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT uq_whatsapp_conversacion_etiquetas UNIQUE (conversacion_id, etiqueta_id);


--
-- Name: idx_whatsapp_conversacion_etiquetas_empresa_conversacion; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_whatsapp_conversacion_etiquetas_empresa_conversacion ON crm.conversacion_etiquetas USING btree (empresa_id, conversacion_id);


--
-- Name: INDEX idx_whatsapp_conversacion_etiquetas_empresa_conversacion; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.idx_whatsapp_conversacion_etiquetas_empresa_conversacion IS 'Optimiza búsqueda de etiquetas por conversación y empresa';


--
-- Name: idx_whatsapp_conversacion_etiquetas_etiqueta; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_whatsapp_conversacion_etiquetas_etiqueta ON crm.conversacion_etiquetas USING btree (etiqueta_id);


--
-- Name: INDEX idx_whatsapp_conversacion_etiquetas_etiqueta; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.idx_whatsapp_conversacion_etiquetas_etiqueta IS 'Optimiza consultas de conversaciones por etiqueta';


--
-- Name: conversacion_etiquetas fk_conversacion_etiquetas_conversaciones; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT fk_conversacion_etiquetas_conversaciones FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id) ON DELETE CASCADE;


--
-- Name: conversacion_etiquetas fk_conversacion_etiquetas_etiquetas; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.conversacion_etiquetas
    ADD CONSTRAINT fk_conversacion_etiquetas_etiquetas FOREIGN KEY (etiqueta_id) REFERENCES crm.etiquetas(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict VdOAkAhWEenxqDG4SpUOOmKjHDh3Kop5cJZEBc2EWWc48gSis3iCfc5pmzMnBBo

