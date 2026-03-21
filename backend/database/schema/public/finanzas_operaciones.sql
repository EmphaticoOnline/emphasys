-- Schema: public
-- Table: finanzas_operaciones
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict HjyY2vmX4STS1GQO0uNeFEwzg23eEMAbvUnsMuK2Fcvfu6ektEb15Mp5LujSlOw

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
    concepto_id integer,
    CONSTRAINT chk_fo_conciliacion CHECK (((estado_conciliacion)::text = ANY (ARRAY[('pendiente'::character varying)::text, ('cotejado'::character varying)::text, ('conciliado'::character varying)::text]))),
    CONSTRAINT chk_fo_tipo CHECK (((tipo_movimiento)::text = ANY (ARRAY[('Deposito'::character varying)::text, ('Retiro'::character varying)::text])))
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
-- Name: idx_fo_concepto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fo_concepto ON public.finanzas_operaciones USING btree (concepto_id);


--
-- Name: finanzas_operaciones fk_fo_concepto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_operaciones
    ADD CONSTRAINT fk_fo_concepto FOREIGN KEY (concepto_id) REFERENCES public.conceptos(id) ON DELETE SET NULL;


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

\unrestrict HjyY2vmX4STS1GQO0uNeFEwzg23eEMAbvUnsMuK2Fcvfu6ektEb15Mp5LujSlOw

