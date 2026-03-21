-- Schema: public
-- Table: crm_ruteo_leads
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict hvatigbcZx2REfl50dTS4py759jZ4QSlxdDemi8yUiXS9ZwW8sZotHx3o7tiVNG

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
-- Name: crm_ruteo_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_ruteo_leads (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    origen character varying(50) NOT NULL,
    modo_asignacion character varying(20) NOT NULL,
    vendedor_fijo_id integer,
    ultimo_vendedor_id integer,
    prioridad integer DEFAULT 1,
    activo boolean DEFAULT true NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp with time zone,
    CONSTRAINT chk_crl_modo_asignacion CHECK (((modo_asignacion)::text = ANY (ARRAY[('round_robin'::character varying)::text, ('fijo'::character varying)::text, ('prioridad'::character varying)::text])))
);


--
-- Name: crm_ruteo_leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_ruteo_leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_ruteo_leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_ruteo_leads_id_seq OWNED BY public.crm_ruteo_leads.id;


--
-- Name: crm_ruteo_leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads ALTER COLUMN id SET DEFAULT nextval('public.crm_ruteo_leads_id_seq'::regclass);


--
-- Name: crm_ruteo_leads crm_ruteo_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT crm_ruteo_leads_pkey PRIMARY KEY (id);


--
-- Name: crm_ruteo_leads uq_crl_empresa_origen; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT uq_crl_empresa_origen UNIQUE (empresa_id, origen);


--
-- Name: crm_ruteo_leads fk_crl_ultimo_vendedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT fk_crl_ultimo_vendedor FOREIGN KEY (ultimo_vendedor_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: crm_ruteo_leads fk_crl_vendedor_fijo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_ruteo_leads
    ADD CONSTRAINT fk_crl_vendedor_fijo FOREIGN KEY (vendedor_fijo_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict hvatigbcZx2REfl50dTS4py759jZ4QSlxdDemi8yUiXS9ZwW8sZotHx3o7tiVNG

