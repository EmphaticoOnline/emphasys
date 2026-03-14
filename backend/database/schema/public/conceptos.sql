-- Schema: public
-- Table: conceptos
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
-- Name: conceptos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conceptos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre_concepto character varying(60) NOT NULL,
    es_gasto boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    rubro_presupuesto_id integer,
    observaciones text,
    cuenta_contable character varying(30),
    orden integer DEFAULT 0,
    color character varying(20)
);


--
-- Name: COLUMN conceptos.cuenta_contable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conceptos.cuenta_contable IS 'Cuenta contable asociada al concepto. Se utilizará en el módulo de contabilidad.';


--
-- Name: COLUMN conceptos.orden; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conceptos.orden IS 'Orden de presentación del concepto en listas y dropdowns.';


--
-- Name: COLUMN conceptos.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conceptos.color IS 'Color opcional para representar el concepto en reportes o gráficos.';


--
-- Name: conceptos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conceptos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conceptos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conceptos_id_seq OWNED BY public.conceptos.id;


--
-- Name: conceptos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conceptos ALTER COLUMN id SET DEFAULT nextval('public.conceptos_id_seq'::regclass);


--
-- Name: conceptos conceptos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conceptos
    ADD CONSTRAINT conceptos_pkey PRIMARY KEY (id);


--
-- Name: conceptos ux_concepto_empresa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conceptos
    ADD CONSTRAINT ux_concepto_empresa UNIQUE (empresa_id, nombre_concepto);


--
-- Name: idx_conceptos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conceptos_empresa ON public.conceptos USING btree (empresa_id);


--
-- Name: idx_conceptos_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conceptos_orden ON public.conceptos USING btree (empresa_id, orden);


--
-- Name: idx_conceptos_rubro_presupuesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conceptos_rubro_presupuesto ON public.conceptos USING btree (empresa_id, rubro_presupuesto_id);


--
-- PostgreSQL database dump complete
--

