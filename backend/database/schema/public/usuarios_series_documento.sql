-- Schema: public
-- Table: usuarios_series_documento
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict OOuiPghVR4ebgjh7uP33x0edCtHh7ZUSZmx8JFBatVpag2oZOquaUUKUtARgfqv

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
-- Name: usuarios_series_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios_series_documento (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    serie_documento_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios_series_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_series_documento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_series_documento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_series_documento_id_seq OWNED BY public.usuarios_series_documento.id;


--
-- Name: usuarios_series_documento id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento ALTER COLUMN id SET DEFAULT nextval('public.usuarios_series_documento_id_seq'::regclass);


--
-- Name: usuarios_series_documento uq_usuarios_series_documento; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT uq_usuarios_series_documento UNIQUE (usuario_id, serie_documento_id);


--
-- Name: usuarios_series_documento usuarios_series_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT usuarios_series_documento_pkey PRIMARY KEY (id);


--
-- Name: idx_usuarios_series_documento_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_series_documento_usuario ON public.usuarios_series_documento USING btree (usuario_id);


--
-- Name: usuarios_series_documento fk_usuarios_series_documento_serie; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT fk_usuarios_series_documento_serie FOREIGN KEY (serie_documento_id) REFERENCES public.series_documento(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuarios_series_documento fk_usuarios_series_documento_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_series_documento
    ADD CONSTRAINT fk_usuarios_series_documento_usuario FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict OOuiPghVR4ebgjh7uP33x0edCtHh7ZUSZmx8JFBatVpag2oZOquaUUKUtARgfqv

