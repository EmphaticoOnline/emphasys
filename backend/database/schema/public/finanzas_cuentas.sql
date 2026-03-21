-- Schema: public
-- Table: finanzas_cuentas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict pLMKazjYmhcqCjBbKK4zdvxzcGp5ddTeHN5cJYMoWOnlP5rmn3yiaMXExY67AtO

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
-- Name: finanzas_cuentas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_cuentas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    identificador character varying(40) NOT NULL,
    numero_cuenta character varying(30),
    tipo_cuenta character varying(20) NOT NULL,
    moneda character varying(3) DEFAULT 'MXN'::character varying NOT NULL,
    saldo numeric(15,2) DEFAULT 0 NOT NULL,
    saldo_inicial numeric(15,2) DEFAULT 0 NOT NULL,
    saldo_conciliado numeric(15,2) DEFAULT 0 NOT NULL,
    fecha_ultima_conciliacion timestamp with time zone,
    es_cuenta_efectivo boolean DEFAULT false NOT NULL,
    afecta_total_disponible boolean DEFAULT true NOT NULL,
    cuenta_cerrada boolean DEFAULT false NOT NULL,
    observaciones text,
    CONSTRAINT chk_fc_moneda CHECK (((moneda)::text = ANY (ARRAY[('MXN'::character varying)::text, ('USD'::character varying)::text, ('EUR'::character varying)::text]))),
    CONSTRAINT chk_fc_tipo CHECK (((tipo_cuenta)::text = ANY (ARRAY[('Disponibilidad'::character varying)::text, ('Seguimiento'::character varying)::text])))
);


--
-- Name: finanzas_cuentas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_cuentas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_cuentas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_cuentas_id_seq OWNED BY public.finanzas_cuentas.id;


--
-- Name: finanzas_cuentas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_cuentas ALTER COLUMN id SET DEFAULT nextval('public.finanzas_cuentas_id_seq'::regclass);


--
-- Name: finanzas_cuentas finanzas_cuentas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_cuentas
    ADD CONSTRAINT finanzas_cuentas_pkey PRIMARY KEY (id);


--
-- Name: finanzas_cuentas ux_fc_identificador; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_cuentas
    ADD CONSTRAINT ux_fc_identificador UNIQUE (empresa_id, identificador);


--
-- PostgreSQL database dump complete
--

\unrestrict pLMKazjYmhcqCjBbKK4zdvxzcGp5ddTeHN5cJYMoWOnlP5rmn3yiaMXExY67AtO

