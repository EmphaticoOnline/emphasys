-- Schema: public
-- Table: credito_operaciones
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
-- Name: credito_operaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito_operaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    contacto_id integer NOT NULL,
    documento_id integer,
    tipo_operacion character varying(20) NOT NULL,
    fecha date NOT NULL,
    monto numeric(15,2) NOT NULL,
    referencia character varying(100),
    observaciones text,
    usuario_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_credito_operaciones_tipo CHECK (((tipo_operacion)::text = ANY ((ARRAY['cargo'::character varying, 'abono'::character varying, 'ajuste'::character varying])::text[])))
);


--
-- Name: operaciones_credito_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operaciones_credito_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operaciones_credito_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operaciones_credito_id_seq OWNED BY public.credito_operaciones.id;


--
-- Name: credito_operaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones ALTER COLUMN id SET DEFAULT nextval('public.operaciones_credito_id_seq'::regclass);


--
-- Name: credito_operaciones credito_operaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones
    ADD CONSTRAINT credito_operaciones_pkey PRIMARY KEY (id);


--
-- Name: credito_operaciones fk_credito_operaciones_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones
    ADD CONSTRAINT fk_credito_operaciones_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE RESTRICT;


--
-- Name: credito_operaciones fk_credito_operaciones_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones
    ADD CONSTRAINT fk_credito_operaciones_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

