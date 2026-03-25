-- Schema: public
-- Table: credito_operaciones_aplicaciones
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
-- Name: credito_operaciones_aplicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito_operaciones_aplicaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    operacion_origen_id integer NOT NULL,
    operacion_aplicada_id integer NOT NULL,
    fecha date NOT NULL,
    monto_aplicado numeric(15,2) NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_oca_monto CHECK ((monto_aplicado > (0)::numeric))
);


--
-- Name: operaciones_credito_aplicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operaciones_credito_aplicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operaciones_credito_aplicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operaciones_credito_aplicaciones_id_seq OWNED BY public.credito_operaciones_aplicaciones.id;


--
-- Name: credito_operaciones_aplicaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones ALTER COLUMN id SET DEFAULT nextval('public.operaciones_credito_aplicaciones_id_seq'::regclass);


--
-- Name: credito_operaciones_aplicaciones credito_operaciones_aplicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones
    ADD CONSTRAINT credito_operaciones_aplicaciones_pkey PRIMARY KEY (id);


--
-- Name: credito_operaciones_aplicaciones fk_oca_aplicada; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones
    ADD CONSTRAINT fk_oca_aplicada FOREIGN KEY (operacion_aplicada_id) REFERENCES public.credito_operaciones(id) ON DELETE RESTRICT;


--
-- Name: credito_operaciones_aplicaciones fk_oca_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_aplicaciones
    ADD CONSTRAINT fk_oca_origen FOREIGN KEY (operacion_origen_id) REFERENCES public.credito_operaciones(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

