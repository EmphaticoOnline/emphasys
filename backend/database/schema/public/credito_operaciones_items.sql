-- Schema: public
-- Table: credito_operaciones_items
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict qEno0hvEfBUC9VvH0eShifOjQISZgbweSvurtTQhqTkQME81APYo06Rhwu2qF4J

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
-- Name: credito_operaciones_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credito_operaciones_items (
    id integer NOT NULL,
    operacion_credito_id integer NOT NULL,
    documento_id integer,
    partida_id integer,
    producto_id integer,
    cantidad numeric(15,6),
    monto numeric(15,2) NOT NULL,
    observaciones text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: operaciones_credito_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operaciones_credito_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operaciones_credito_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operaciones_credito_items_id_seq OWNED BY public.credito_operaciones_items.id;


--
-- Name: credito_operaciones_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items ALTER COLUMN id SET DEFAULT nextval('public.operaciones_credito_items_id_seq'::regclass);


--
-- Name: credito_operaciones_items operaciones_credito_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT operaciones_credito_items_pkey PRIMARY KEY (id);


--
-- Name: credito_operaciones_items fk_oci_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- Name: credito_operaciones_items fk_oci_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_operacion FOREIGN KEY (operacion_credito_id) REFERENCES public.credito_operaciones(id) ON DELETE CASCADE;


--
-- Name: credito_operaciones_items fk_oci_partida; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_partida FOREIGN KEY (partida_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: credito_operaciones_items fk_oci_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credito_operaciones_items
    ADD CONSTRAINT fk_oci_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qEno0hvEfBUC9VvH0eShifOjQISZgbweSvurtTQhqTkQME81APYo06Rhwu2qF4J

