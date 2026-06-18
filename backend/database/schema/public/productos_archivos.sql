-- Schema: public
-- Table: productos_archivos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict fdh6N9osTbOkK6bgfF4gQK3JFs0kLvFhHDe5gd0P9RYJQgqfAQ0xsrKA2zmqQDB

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
-- Name: productos_archivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos_archivos (
    id integer NOT NULL,
    producto_id integer NOT NULL,
    tipo_archivo character varying(30) NOT NULL,
    archivo character varying(255) NOT NULL,
    descripcion character varying(150),
    orden_visual integer DEFAULT 1 NOT NULL,
    principal boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: productos_archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_archivos_id_seq OWNED BY public.productos_archivos.id;


--
-- Name: productos_archivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_archivos ALTER COLUMN id SET DEFAULT nextval('public.productos_archivos_id_seq'::regclass);


--
-- Name: productos_archivos productos_archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_archivos
    ADD CONSTRAINT productos_archivos_pkey PRIMARY KEY (id);


--
-- Name: productos_archivos fk_productos_archivos_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_archivos
    ADD CONSTRAINT fk_productos_archivos_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict fdh6N9osTbOkK6bgfF4gQK3JFs0kLvFhHDe5gd0P9RYJQgqfAQ0xsrKA2zmqQDB

