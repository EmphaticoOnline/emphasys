-- Schema: public
-- Table: aplicaciones
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
-- Name: aplicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aplicaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    finanzas_operacion_id integer,
    documento_origen_id integer,
    documento_destino_id integer NOT NULL,
    monto numeric(15,2) NOT NULL,
    fecha_aplicacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_aplicacion_origen CHECK ((((finanzas_operacion_id IS NOT NULL) AND (documento_origen_id IS NULL)) OR ((finanzas_operacion_id IS NULL) AND (documento_origen_id IS NOT NULL))))
);


--
-- Name: aplicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aplicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aplicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aplicaciones_id_seq OWNED BY public.aplicaciones.id;


--
-- Name: aplicaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_id_seq'::regclass);


--
-- Name: aplicaciones aplicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones
    ADD CONSTRAINT aplicaciones_pkey PRIMARY KEY (id);


--
-- Name: idx_aplicaciones_doc_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_doc_destino ON public.aplicaciones USING btree (documento_destino_id);


--
-- Name: idx_aplicaciones_doc_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_doc_origen ON public.aplicaciones USING btree (documento_origen_id);


--
-- Name: idx_aplicaciones_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_empresa ON public.aplicaciones USING btree (empresa_id);


--
-- Name: idx_aplicaciones_operacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_operacion ON public.aplicaciones USING btree (finanzas_operacion_id);


--
-- Name: aplicaciones fk_aplicaciones_doc_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones
    ADD CONSTRAINT fk_aplicaciones_doc_destino FOREIGN KEY (documento_destino_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones fk_aplicaciones_doc_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones
    ADD CONSTRAINT fk_aplicaciones_doc_origen FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones fk_aplicaciones_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones
    ADD CONSTRAINT fk_aplicaciones_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones fk_aplicaciones_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones
    ADD CONSTRAINT fk_aplicaciones_operacion FOREIGN KEY (finanzas_operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

