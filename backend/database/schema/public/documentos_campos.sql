-- Schema: public
-- Table: documentos_campos
-- Generated automatically

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3
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
-- Name: documentos_campos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_campos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    documento_id integer NOT NULL,
    campo_id integer NOT NULL,
    catalogo_id integer,
    valor_texto text,
    valor_numero numeric,
    valor_fecha date,
    valor_boolean boolean,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE documentos_campos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_campos IS 'Almacena los valores capturados de campos dinámicos asociados al encabezado de documentos.';


--
-- Name: COLUMN documentos_campos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.id IS 'Identificador único del registro.';


--
-- Name: COLUMN documentos_campos.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.empresa_id IS 'Empresa propietaria del registro.';


--
-- Name: COLUMN documentos_campos.documento_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.documento_id IS 'Referencia al documento donde se capturó el valor dinámico.';


--
-- Name: COLUMN documentos_campos.campo_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.campo_id IS 'Referencia al campo configurado en core.campos_configuracion.';


--
-- Name: COLUMN documentos_campos.catalogo_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.catalogo_id IS 'Referencia al valor del catálogo cuando el campo dinámico es tipo lista.';


--
-- Name: COLUMN documentos_campos.valor_texto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_texto IS 'Valor capturado cuando el tipo de dato es texto.';


--
-- Name: COLUMN documentos_campos.valor_numero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_numero IS 'Valor capturado cuando el tipo de dato es numérico.';


--
-- Name: COLUMN documentos_campos.valor_fecha; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_fecha IS 'Valor capturado cuando el tipo de dato es fecha.';


--
-- Name: COLUMN documentos_campos.valor_boolean; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.valor_boolean IS 'Valor capturado cuando el tipo de dato es booleano.';


--
-- Name: COLUMN documentos_campos.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_campos.created_at IS 'Fecha de creación del registro.';


--
-- Name: documentos_campos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_campos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_campos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_campos_id_seq OWNED BY public.documentos_campos.id;


--
-- Name: documentos_campos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos ALTER COLUMN id SET DEFAULT nextval('public.documentos_campos_id_seq'::regclass);


--
-- Name: documentos_campos documentos_campos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT documentos_campos_pkey PRIMARY KEY (id);


--
-- Name: idx_dc_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dc_documento ON public.documentos_campos USING btree (documento_id);


--
-- Name: INDEX idx_dc_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_dc_documento IS 'Optimiza consultas de campos dinámicos por documento.';


--
-- Name: idx_dc_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dc_empresa ON public.documentos_campos USING btree (empresa_id);


--
-- Name: INDEX idx_dc_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_dc_empresa IS 'Optimiza consultas de campos dinámicos filtradas por empresa.';


--
-- Name: idx_documentos_campos_empresa_documento_campo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_documentos_campos_empresa_documento_campo ON public.documentos_campos USING btree (empresa_id, documento_id, campo_id);


--
-- Name: INDEX idx_documentos_campos_empresa_documento_campo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_documentos_campos_empresa_documento_campo IS 'Índice único que soporta el UPSERT del motor de campos dinámicos sobre documentos (empresa_id, documento_id, campo_id).';


--
-- Name: documentos_campos fk_dc_campo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT fk_dc_campo FOREIGN KEY (campo_id) REFERENCES core.campos_configuracion(id);


--
-- Name: documentos_campos fk_dc_catalogo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT fk_dc_catalogo FOREIGN KEY (catalogo_id) REFERENCES core.catalogos(id);


--
-- Name: documentos_campos fk_dc_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_campos
    ADD CONSTRAINT fk_dc_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

