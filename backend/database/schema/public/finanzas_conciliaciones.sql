-- Schema: public
-- Table: finanzas_conciliaciones
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict pZml5aWTeOn5pztmFJaoiox1g7DmfeMojSDxrW86Xpkp7YYymIoTnOdh5qQxIAR

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
-- Name: finanzas_conciliaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_conciliaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cuenta_id integer NOT NULL,
    fecha_corte date NOT NULL,
    saldo_banco numeric(15,2) NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id integer
);


--
-- Name: finanzas_conciliaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_conciliaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_conciliaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_conciliaciones_id_seq OWNED BY public.finanzas_conciliaciones.id;


--
-- Name: finanzas_conciliaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_conciliaciones_id_seq'::regclass);


--
-- Name: finanzas_conciliaciones finanzas_conciliaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones
    ADD CONSTRAINT finanzas_conciliaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_conciliaciones fk_fc_cuenta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_conciliaciones
    ADD CONSTRAINT fk_fc_cuenta FOREIGN KEY (cuenta_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict pZml5aWTeOn5pztmFJaoiox1g7DmfeMojSDxrW86Xpkp7YYymIoTnOdh5qQxIAR

