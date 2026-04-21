-- Schema: public
-- Table: series_documento
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
-- Name: series_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_documento (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_documento text NOT NULL,
    serie character varying(10) NOT NULL,
    layout_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_series_tipo_lower CHECK ((tipo_documento = lower(tipo_documento)))
);


--
-- Name: TABLE series_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.series_documento IS 'Define series de documentos por empresa, permitiendo asociar plantillas específicas de layout por serie.';


--
-- Name: COLUMN series_documento.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.id IS 'Identificador único de la serie';


--
-- Name: COLUMN series_documento.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.empresa_id IS 'Empresa a la que pertenece la serie';


--
-- Name: COLUMN series_documento.tipo_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.tipo_documento IS 'Tipo de documento (factura, cotizacion, etc.)';


--
-- Name: COLUMN series_documento.serie; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.serie IS 'Nombre o clave de la serie (ej. A, B, MOSTRADOR)';


--
-- Name: COLUMN series_documento.layout_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.layout_id IS 'Plantilla de layout asociada a la serie (opcional)';


--
-- Name: COLUMN series_documento.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.created_at IS 'Fecha de creación de la serie';


--
-- Name: COLUMN series_documento.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series_documento.updated_at IS 'Fecha de última actualización de la serie';


--
-- Name: CONSTRAINT chk_series_tipo_lower ON series_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_series_tipo_lower ON public.series_documento IS 'Asegura que tipo_documento esté en minúsculas para evitar inconsistencias';


--
-- Name: series_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.series_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: series_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.series_documento_id_seq OWNED BY public.series_documento.id;


--
-- Name: series_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento ALTER COLUMN id SET DEFAULT nextval('public.series_documento_id_seq'::regclass);


--
-- Name: series_documento series_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT series_documento_pkey PRIMARY KEY (id);


--
-- Name: series_documento uq_series_documento_empresa_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT uq_series_documento_empresa_nombre UNIQUE (empresa_id, serie);


--
-- Name: series_documento uq_series_documento_empresa_tipo_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT uq_series_documento_empresa_tipo_nombre UNIQUE (empresa_id, tipo_documento, serie);


--
-- Name: CONSTRAINT uq_series_documento_empresa_tipo_nombre ON series_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT uq_series_documento_empresa_tipo_nombre ON public.series_documento IS 'Evita duplicar nombres de serie por empresa y tipo de documento';


--
-- Name: series_documento uq_series_documento_empresa_tipo_serie; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT uq_series_documento_empresa_tipo_serie UNIQUE (empresa_id, tipo_documento, serie);


--
-- Name: idx_series_documento_empresa_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_documento_empresa_tipo ON public.series_documento USING btree (empresa_id, tipo_documento);


--
-- Name: INDEX idx_series_documento_empresa_tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_series_documento_empresa_tipo IS 'Optimiza búsquedas de series por empresa y tipo de documento';


--
-- Name: idx_series_documento_layout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_series_documento_layout ON public.series_documento USING btree (layout_id);


--
-- Name: INDEX idx_series_documento_layout; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_series_documento_layout IS 'Optimiza consultas por plantilla asociada';


--
-- Name: series_documento fk_series_documento_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT fk_series_documento_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: series_documento fk_series_documento_layout; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_documento
    ADD CONSTRAINT fk_series_documento_layout FOREIGN KEY (layout_id) REFERENCES public.plantillas_documento(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

