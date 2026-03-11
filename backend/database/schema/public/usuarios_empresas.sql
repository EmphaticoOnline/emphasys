-- Schema: public
-- Table: usuarios_empresas
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
-- Name: usuarios_empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios_empresas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    rol_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    fecha_alta timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios_empresas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_empresas_id_seq OWNED BY public.usuarios_empresas.id;


--
-- Name: usuarios_empresas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas ALTER COLUMN id SET DEFAULT nextval('public.usuarios_empresas_id_seq'::regclass);


--
-- Name: usuarios_empresas usuarios_empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_pkey PRIMARY KEY (id);


--
-- Name: usuarios_empresas ux_ue_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas
    ADD CONSTRAINT ux_ue_unico UNIQUE (usuario_id, empresa_id);


--
-- Name: ix_ue_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ue_empresa ON public.usuarios_empresas USING btree (empresa_id);


--
-- Name: ix_ue_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ue_usuario ON public.usuarios_empresas USING btree (usuario_id);


--
-- Name: usuarios_empresas fk_ue_rol; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_empresas
    ADD CONSTRAINT fk_ue_rol FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

