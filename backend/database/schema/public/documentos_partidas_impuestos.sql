-- Schema: public
-- Table: documentos_partidas_impuestos
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
-- Name: documentos_partidas_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_partidas_impuestos (
    id integer NOT NULL,
    partida_id integer NOT NULL,
    impuesto_id character varying(30) NOT NULL,
    tasa numeric(9,4) NOT NULL,
    base numeric(15,2) NOT NULL,
    monto numeric(15,2) NOT NULL
);


--
-- Name: TABLE documentos_partidas_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_partidas_impuestos IS 'Impuestos aplicados a cada partida de documento. Permite múltiples impuestos por partida (IVA, IEPS, retenciones).';


--
-- Name: COLUMN documentos_partidas_impuestos.partida_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.partida_id IS 'Referencia a la partida del documento.';


--
-- Name: COLUMN documentos_partidas_impuestos.impuesto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.impuesto_id IS 'Impuesto aplicado a la partida.';


--
-- Name: COLUMN documentos_partidas_impuestos.tasa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.tasa IS 'Tasa del impuesto utilizada al momento del cálculo.';


--
-- Name: COLUMN documentos_partidas_impuestos.base; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.base IS 'Base sobre la cual se calcula el impuesto.';


--
-- Name: COLUMN documentos_partidas_impuestos.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_impuestos.monto IS 'Monto calculado del impuesto.';


--
-- Name: documentos_partidas_impuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_partidas_impuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_partidas_impuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_partidas_impuestos_id_seq OWNED BY public.documentos_partidas_impuestos.id;


--
-- Name: documentos_partidas_impuestos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_impuestos ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_impuestos_id_seq'::regclass);


--
-- Name: documentos_partidas_impuestos documentos_partidas_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_impuestos
    ADD CONSTRAINT documentos_partidas_impuestos_pkey PRIMARY KEY (id);


--
-- Name: idx_documentos_partidas_impuestos_partida_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_partidas_impuestos_partida_id ON public.documentos_partidas_impuestos USING btree (partida_id);


--
-- Name: INDEX idx_documentos_partidas_impuestos_partida_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_documentos_partidas_impuestos_partida_id IS 'Optimiza consultas que filtran por partida_id (cálculo y lectura de impuestos por partida).';


--
-- Name: idx_partida_impuestos_partida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partida_impuestos_partida ON public.documentos_partidas_impuestos USING btree (partida_id);


--
-- Name: documentos_partidas_impuestos fk_partida_impuesto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_impuestos
    ADD CONSTRAINT fk_partida_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- PostgreSQL database dump complete
--

