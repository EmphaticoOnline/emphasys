-- Schema: crm
-- Table: etiquetas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict m5tfcWYtnUrCv3wk5z7JK6ZpfF8XHC1JxuI5yKbCMFJDACeGx2qxxTuDgVUSutd

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
-- Name: etiquetas; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.etiquetas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre text NOT NULL,
    color text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_whatsapp_etiquetas_color_hex CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text))
);


--
-- Name: TABLE etiquetas; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.etiquetas IS 'Catálogo de etiquetas para clasificar conversaciones de WhatsApp por empresa';


--
-- Name: COLUMN etiquetas.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.empresa_id IS 'Empresa a la que pertenece la etiqueta';


--
-- Name: COLUMN etiquetas.nombre; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.nombre IS 'Nombre de la etiqueta (ej: Cotizado, Urgente, Seguimiento)';


--
-- Name: COLUMN etiquetas.color; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.color IS 'Color en formato HEX (#RRGGBB), sin transparencia';


--
-- Name: COLUMN etiquetas.activo; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.activo IS 'Indica si la etiqueta está disponible para uso';


--
-- Name: COLUMN etiquetas.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.created_at IS 'Fecha de creación del registro';


--
-- Name: COLUMN etiquetas.updated_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.etiquetas.updated_at IS 'Fecha de última actualización';


--
-- Name: etiquetas_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.etiquetas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: etiquetas_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.etiquetas_id_seq OWNED BY crm.etiquetas.id;


--
-- Name: etiquetas id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.etiquetas ALTER COLUMN id SET DEFAULT nextval('crm.etiquetas_id_seq'::regclass);


--
-- Name: etiquetas etiquetas_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.etiquetas
    ADD CONSTRAINT etiquetas_pkey PRIMARY KEY (id);


--
-- Name: idx_whatsapp_etiquetas_empresa_activo; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_whatsapp_etiquetas_empresa_activo ON crm.etiquetas USING btree (empresa_id, activo);


--
-- Name: INDEX idx_whatsapp_etiquetas_empresa_activo; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.idx_whatsapp_etiquetas_empresa_activo IS 'Optimiza consultas de etiquetas activas por empresa';


--
-- Name: ux_whatsapp_etiquetas_empresa_nombre; Type: INDEX; Schema: crm; Owner: -
--

CREATE UNIQUE INDEX ux_whatsapp_etiquetas_empresa_nombre ON crm.etiquetas USING btree (empresa_id, lower(nombre));


--
-- Name: INDEX ux_whatsapp_etiquetas_empresa_nombre; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON INDEX crm.ux_whatsapp_etiquetas_empresa_nombre IS 'Evita duplicados de nombre de etiqueta por empresa (case-insensitive)';


--
-- PostgreSQL database dump complete
--

\unrestrict m5tfcWYtnUrCv3wk5z7JK6ZpfF8XHC1JxuI5yKbCMFJDACeGx2qxxTuDgVUSutd

