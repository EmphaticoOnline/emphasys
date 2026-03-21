-- Schema: public
-- Table: reglas_tratamiento_impuestos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict hfLJpXahKppphcb1dMy1Dndstf79vuAS1ajm4t7swt9JF6jVCAdZuQOOd9Ro3Zv

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
-- Name: reglas_tratamiento_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_tratamiento_impuestos (
    id integer NOT NULL,
    tratamiento character varying(20) NOT NULL,
    impuesto_id character varying(30) NOT NULL
);


--
-- Name: TABLE reglas_tratamiento_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reglas_tratamiento_impuestos IS 'Define qué impuestos se aplican dependiendo del tratamiento_impuestos del documento (normal, sin_iva, tasa_cero, exento).';


--
-- Name: COLUMN reglas_tratamiento_impuestos.tratamiento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_tratamiento_impuestos.tratamiento IS 'Tratamiento fiscal definido en el documento.';


--
-- Name: COLUMN reglas_tratamiento_impuestos.impuesto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reglas_tratamiento_impuestos.impuesto_id IS 'Impuesto que debe aplicarse cuando el documento tiene ese tratamiento.';


--
-- Name: reglas_tratamiento_impuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_tratamiento_impuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_tratamiento_impuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_tratamiento_impuestos_id_seq OWNED BY public.reglas_tratamiento_impuestos.id;


--
-- Name: reglas_tratamiento_impuestos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_tratamiento_impuestos ALTER COLUMN id SET DEFAULT nextval('public.reglas_tratamiento_impuestos_id_seq'::regclass);


--
-- Name: reglas_tratamiento_impuestos reglas_tratamiento_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_tratamiento_impuestos
    ADD CONSTRAINT reglas_tratamiento_impuestos_pkey PRIMARY KEY (id);


--
-- Name: idx_reglas_tratamiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reglas_tratamiento ON public.reglas_tratamiento_impuestos USING btree (tratamiento);


--
-- Name: reglas_tratamiento_impuestos fk_regla_impuesto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_tratamiento_impuestos
    ADD CONSTRAINT fk_regla_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- PostgreSQL database dump complete
--

\unrestrict hfLJpXahKppphcb1dMy1Dndstf79vuAS1ajm4t7swt9JF6jVCAdZuQOOd9Ro3Zv

