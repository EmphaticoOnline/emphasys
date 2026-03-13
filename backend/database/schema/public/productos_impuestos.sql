-- Schema: public
-- Table: productos_impuestos
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
-- Name: productos_impuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos_impuestos (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    impuesto_id character varying(30) NOT NULL
);


--
-- Name: TABLE productos_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.productos_impuestos IS 'Relación entre productos e impuestos aplicables. Permite que cada producto tenga uno o varios impuestos.';


--
-- Name: COLUMN productos_impuestos.producto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.productos_impuestos.producto_id IS 'Identificador del producto al que se le aplica el impuesto.';


--
-- Name: COLUMN productos_impuestos.impuesto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.productos_impuestos.impuesto_id IS 'Impuesto que aplica al producto.';


--
-- Name: productos_impuestos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_impuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_impuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_impuestos_id_seq OWNED BY public.productos_impuestos.id;


--
-- Name: productos_impuestos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_impuestos ALTER COLUMN id SET DEFAULT nextval('public.productos_impuestos_id_seq'::regclass);


--
-- Name: productos_impuestos productos_impuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_impuestos
    ADD CONSTRAINT productos_impuestos_pkey PRIMARY KEY (id);


--
-- Name: idx_productos_impuestos_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_impuestos_producto ON public.productos_impuestos USING btree (producto_id);


--
-- Name: productos_impuestos fk_productos_impuestos_impuesto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_impuestos
    ADD CONSTRAINT fk_productos_impuestos_impuesto FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id);


--
-- PostgreSQL database dump complete
--

