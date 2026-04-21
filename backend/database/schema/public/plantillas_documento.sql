-- Schema: public
-- Table: plantillas_documento
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
-- Name: plantillas_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantillas_documento (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento text NOT NULL,
    nombre text NOT NULL,
    contenido_html text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    configuracion jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE plantillas_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.plantillas_documento IS 'Plantillas de layout configurables para documentos (PDF), por empresa.';


--
-- Name: COLUMN plantillas_documento.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.id IS 'Identificador único de la plantilla';


--
-- Name: COLUMN plantillas_documento.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.empresa_id IS 'Empresa propietaria de la plantilla';


--
-- Name: COLUMN plantillas_documento.tipo_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.tipo_documento IS 'Tipo de documento (factura, cotizacion, etc.) asociado a la plantilla (uso legado o fallback)';


--
-- Name: COLUMN plantillas_documento.nombre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.nombre IS 'Nombre descriptivo de la plantilla';


--
-- Name: COLUMN plantillas_documento.contenido_html; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.contenido_html IS 'Contenido HTML de la plantilla (uso legado si aplica)';


--
-- Name: COLUMN plantillas_documento.activo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.activo IS 'Indica si la plantilla está activa';


--
-- Name: COLUMN plantillas_documento.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.created_at IS 'Fecha de creación de la plantilla';


--
-- Name: COLUMN plantillas_documento.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.updated_at IS 'Fecha de última actualización de la plantilla';


--
-- Name: COLUMN plantillas_documento.configuracion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plantillas_documento.configuracion IS 'Configuración del layout en formato JSON (colores, visibilidad de secciones, etc.)';


--
-- Name: plantillas_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plantillas_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantillas_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plantillas_documento_id_seq OWNED BY public.plantillas_documento.id;


--
-- Name: plantillas_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_documento ALTER COLUMN id SET DEFAULT nextval('public.plantillas_documento_id_seq'::regclass);


--
-- Name: plantillas_documento plantillas_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_documento
    ADD CONSTRAINT plantillas_documento_pkey PRIMARY KEY (id);


--
-- Name: idx_plantillas_documento_empresa_tipo_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plantillas_documento_empresa_tipo_activo ON public.plantillas_documento USING btree (empresa_id, tipo_documento, activo);


--
-- Name: idx_plantillas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plantillas_empresa ON public.plantillas_documento USING btree (empresa_id);


--
-- Name: INDEX idx_plantillas_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_plantillas_empresa IS 'Optimiza búsquedas de plantillas por empresa';


--
-- Name: ux_plantilla_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_plantilla_activa ON public.plantillas_documento USING btree (empresa_id, tipo_documento) WHERE (activo = true);


--
-- Name: plantillas_documento trg_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.plantillas_documento FOR EACH ROW EXECUTE FUNCTION whatsapp.set_updated_at();


--
-- Name: plantillas_documento fk_plantillas_documento_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_documento
    ADD CONSTRAINT fk_plantillas_documento_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

