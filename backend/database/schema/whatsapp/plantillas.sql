-- Schema: whatsapp
-- Table: plantillas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict e8SwG8grY2ZMJNUktGIVMmjPPefKJWEkjg2JYOoRtuDoHQl8KIFMEQvHJdDQl0E

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
-- Name: plantillas; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.plantillas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nombre_interno character varying(120) NOT NULL,
    tipo character varying(50) NOT NULL,
    proveedor character varying(50) NOT NULL,
    provider_template_id character varying(120) NOT NULL,
    es_default boolean DEFAULT false NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone
);


--
-- Name: TABLE plantillas; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.plantillas IS 'Plantillas de WhatsApp definidas por empresa. Permiten desacoplar el ERP del proveedor (ej. Gupshup) y controlar el uso por tipo de mensaje (ej. reactivación).';


--
-- Name: COLUMN plantillas.id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.id IS 'Identificador único de la plantilla.';


--
-- Name: COLUMN plantillas.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.empresa_id IS 'Empresa a la que pertenece la plantilla.';


--
-- Name: COLUMN plantillas.nombre_interno; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.nombre_interno IS 'Nombre descriptivo interno para identificar la plantilla dentro del ERP.';


--
-- Name: COLUMN plantillas.tipo; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.tipo IS 'Tipo o propósito de la plantilla (ej. reactivacion, seguimiento, cierre).';


--
-- Name: COLUMN plantillas.proveedor; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.proveedor IS 'Proveedor de mensajería (ej. gupshup). Permite soportar múltiples integraciones en el futuro.';


--
-- Name: COLUMN plantillas.provider_template_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.provider_template_id IS 'Identificador de la plantilla en el proveedor (ej. template_id en Gupshup).';


--
-- Name: COLUMN plantillas.es_default; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.es_default IS 'Indica si esta plantilla es la predeterminada para su empresa y tipo. Solo puede existir una por empresa + tipo.';


--
-- Name: COLUMN plantillas.activa; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.activa IS 'Indica si la plantilla está disponible para uso.';


--
-- Name: COLUMN plantillas.creado_en; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.creado_en IS 'Fecha de creación del registro.';


--
-- Name: COLUMN plantillas.actualizado_en; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.plantillas.actualizado_en IS 'Fecha de última actualización del registro.';


--
-- Name: plantillas_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

CREATE SEQUENCE whatsapp.plantillas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantillas_id_seq; Type: SEQUENCE OWNED BY; Schema: whatsapp; Owner: -
--

ALTER SEQUENCE whatsapp.plantillas_id_seq OWNED BY whatsapp.plantillas.id;


--
-- Name: plantillas id; Type: DEFAULT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.plantillas ALTER COLUMN id SET DEFAULT nextval('whatsapp.plantillas_id_seq'::regclass);


--
-- Name: plantillas plantillas_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.plantillas
    ADD CONSTRAINT plantillas_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_plantillas_default_uk; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE UNIQUE INDEX whatsapp_plantillas_default_uk ON whatsapp.plantillas USING btree (empresa_id, tipo) WHERE (es_default IS TRUE);


--
-- Name: whatsapp_plantillas_empresa_id_idx; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX whatsapp_plantillas_empresa_id_idx ON whatsapp.plantillas USING btree (empresa_id);


--
-- Name: whatsapp_plantillas_empresa_tipo_idx; Type: INDEX; Schema: whatsapp; Owner: -
--

CREATE INDEX whatsapp_plantillas_empresa_tipo_idx ON whatsapp.plantillas USING btree (empresa_id, tipo);


--
-- Name: plantillas whatsapp_plantillas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.plantillas
    ADD CONSTRAINT whatsapp_plantillas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict e8SwG8grY2ZMJNUktGIVMmjPPefKJWEkjg2JYOoRtuDoHQl8KIFMEQvHJdDQl0E

