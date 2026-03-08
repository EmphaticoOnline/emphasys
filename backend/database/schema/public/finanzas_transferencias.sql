-- Schema: public
-- Table: finanzas_transferencias
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
-- Name: finanzas_transferencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_transferencias (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    cuenta_origen_id integer NOT NULL,
    cuenta_destino_id integer NOT NULL,
    monto numeric(15,2) NOT NULL,
    fecha date NOT NULL,
    referencia character varying(100),
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id integer,
    CONSTRAINT chk_ft_cuentas_distintas CHECK ((cuenta_origen_id <> cuenta_destino_id))
);


--
-- Name: finanzas_transferencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_transferencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_transferencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_transferencias_id_seq OWNED BY public.finanzas_transferencias.id;


--
-- Name: finanzas_transferencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias ALTER COLUMN id SET DEFAULT nextval('public.finanzas_transferencias_id_seq'::regclass);


--
-- Name: finanzas_transferencias finanzas_transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias
    ADD CONSTRAINT finanzas_transferencias_pkey PRIMARY KEY (id);


--
-- Name: finanzas_transferencias fk_ft_cuenta_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias
    ADD CONSTRAINT fk_ft_cuenta_destino FOREIGN KEY (cuenta_destino_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- Name: finanzas_transferencias fk_ft_cuenta_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_transferencias
    ADD CONSTRAINT fk_ft_cuenta_origen FOREIGN KEY (cuenta_origen_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

