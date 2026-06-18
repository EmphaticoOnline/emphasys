-- Schema: public
-- Table: precios_listas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict N5lTEWbzwprYghyJldvzsuFQwlo734S6YUKUSj3aBeevBfMOewl7B5FZSNFfgFO

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
-- Name: precios_listas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precios_listas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    tipo_precio character varying(20) DEFAULT 'VENTA'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    orden integer,
    es_default boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE precios_listas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.precios_listas IS 'Define listas de precios de venta o compra por empresa.';


--
-- Name: COLUMN precios_listas.tipo_precio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.precios_listas.tipo_precio IS 'Tipo de lista de precio. Valores esperados: VENTA o COMPRA.';


--
-- Name: precios_listas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.precios_listas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: precios_listas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.precios_listas_id_seq OWNED BY public.precios_listas.id;


--
-- Name: precios_listas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_listas ALTER COLUMN id SET DEFAULT nextval('public.precios_listas_id_seq'::regclass);


--
-- Name: precios_listas precios_listas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_listas
    ADD CONSTRAINT precios_listas_pkey PRIMARY KEY (id);


--
-- Name: idx_precios_listas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_listas_empresa ON public.precios_listas USING btree (empresa_id);


--
-- Name: ux_precios_listas_empresa_tipo_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_precios_listas_empresa_tipo_default ON public.precios_listas USING btree (empresa_id, tipo_precio) WHERE (es_default = true);


--
-- Name: ux_precios_listas_empresa_tipo_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_precios_listas_empresa_tipo_nombre ON public.precios_listas USING btree (empresa_id, tipo_precio, nombre);


--
-- Name: precios_listas fk_precios_listas_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios_listas
    ADD CONSTRAINT fk_precios_listas_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict N5lTEWbzwprYghyJldvzsuFQwlo734S6YUKUSj3aBeevBfMOewl7B5FZSNFfgFO

