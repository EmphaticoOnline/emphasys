-- Schema: public
-- Table: finanzas_operaciones
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
-- Name: finanzas_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_operaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    fecha date NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    monto numeric(15,2) NOT NULL,
    referencia character varying(100),
    observaciones text,
    cuenta_id integer NOT NULL,
    contacto_id integer,
    factura_id integer,
    es_transferencia boolean DEFAULT false NOT NULL,
    transferencia_id integer,
    estado_conciliacion character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    saldo numeric(15,2),
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_fo_conciliacion CHECK (((estado_conciliacion)::text = ANY ((ARRAY['pendiente'::character varying, 'cotejado'::character varying, 'conciliado'::character varying])::text[]))),
    CONSTRAINT chk_fo_tipo CHECK (((tipo_movimiento)::text = ANY ((ARRAY['Deposito'::character varying, 'Retiro'::character varying])::text[])))
);


--
-- Name: finanzas_operaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_operaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_operaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_operaciones_id_seq OWNED BY public.finanzas_operaciones.id;


--
-- Name: finanzas_operaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_operaciones_id_seq'::regclass);


--
-- Name: finanzas_operaciones finanzas_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT finanzas_operaciones_pkey PRIMARY KEY (id);


--
-- Name: finanzas_operaciones fk_fo_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT fk_fo_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- Name: finanzas_operaciones fk_fo_cuenta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT fk_fo_cuenta FOREIGN KEY (cuenta_id) REFERENCES public.finanzas_cuentas(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

