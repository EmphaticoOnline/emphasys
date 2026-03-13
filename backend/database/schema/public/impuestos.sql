-- Schema: public
-- Table: impuestos
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
-- Name: impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.impuestos (
    id character varying(30) NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(20) NOT NULL,
    tasa numeric(9,4) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.impuestos IS 'Catálogo general de impuestos que pueden aplicarse en documentos y partidas (IVA, IEPS, retenciones, etc).';


--
-- Name: COLUMN impuestos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.id IS 'Identificador único del impuesto (ej. iva_16, iva_8, ret_iva).';


--
-- Name: COLUMN impuestos.nombre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.nombre IS 'Nombre descriptivo del impuesto.';


--
-- Name: COLUMN impuestos.tipo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.tipo IS 'Tipo de impuesto: traslado o retencion.';


--
-- Name: COLUMN impuestos.tasa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.tasa IS 'Porcentaje del impuesto.';


--
-- Name: COLUMN impuestos.activo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.impuestos.activo IS 'Indica si el impuesto está activo.';


--
-- Name: impuestos impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.impuestos
    ADD CONSTRAINT impuestos_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

