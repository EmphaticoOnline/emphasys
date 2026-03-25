-- Schema: public
-- Table: contactos_datos_fiscales
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
-- Name: contactos_datos_fiscales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos_datos_fiscales (
    id integer NOT NULL,
    contacto_id integer NOT NULL,
    rfc character varying(20) NOT NULL,
    curp character varying(18),
    regimen_fiscal character varying(10),
    uso_cfdi character varying(10),
    forma_pago character varying(10),
    metodo_pago character varying(10),
    enviar_cfd boolean DEFAULT true NOT NULL,
    enviar_cfd_agente boolean DEFAULT false NOT NULL,
    es_publico_general boolean DEFAULT false NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contactos_datos_fiscales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contactos_datos_fiscales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contactos_datos_fiscales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contactos_datos_fiscales_id_seq OWNED BY public.contactos_datos_fiscales.id;


--
-- Name: contactos_datos_fiscales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales ALTER COLUMN id SET DEFAULT nextval('public.contactos_datos_fiscales_id_seq'::regclass);


--
-- Name: contactos_datos_fiscales contactos_datos_fiscales_contacto_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales
    ADD CONSTRAINT contactos_datos_fiscales_contacto_id_key UNIQUE (contacto_id);


--
-- Name: contactos_datos_fiscales contactos_datos_fiscales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales
    ADD CONSTRAINT contactos_datos_fiscales_pkey PRIMARY KEY (id);


--
-- Name: contactos_datos_fiscales fk_cdf_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_datos_fiscales
    ADD CONSTRAINT fk_cdf_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

