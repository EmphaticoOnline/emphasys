-- Schema: public
-- Table: finanzas_conciliaciones_operaciones
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
-- Name: finanzas_conciliaciones_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_conciliaciones_operaciones (
    id integer NOT NULL,
    conciliacion_id integer NOT NULL,
    operacion_id integer NOT NULL
);


--
-- Name: finanzas_conciliaciones_operaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_conciliaciones_operaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_conciliaciones_operaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_conciliaciones_operaciones_id_seq OWNED BY public.finanzas_conciliaciones_operaciones.id;


--
-- Name: finanzas_conciliaciones_operaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_conciliaciones_operaciones_id_seq'::regclass);


--
-- Name: finanzas_conciliaciones_operaciones finanzas_conciliaciones_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT finanzas_conciliaciones_operaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_conciliaciones_operaciones ux_fco_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT ux_fco_unique UNIQUE (conciliacion_id, operacion_id);


--
-- Name: finanzas_conciliaciones_operaciones fk_fco_conciliacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT fk_fco_conciliacion FOREIGN KEY (conciliacion_id) REFERENCES public.finanzas_conciliaciones(id) ON DELETE CASCADE;


--
-- Name: finanzas_conciliaciones_operaciones fk_fco_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones_operaciones
    ADD CONSTRAINT fk_fco_operacion FOREIGN KEY (operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

