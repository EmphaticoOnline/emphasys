-- Schema: public
-- Table: precios
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 4BWOeSplGfTWQofRfnhsRxJjYEonBNxT911ip8yrvsLxipa19mPcZ2pJbpMbWVx

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
-- Name: precios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precios (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    producto_id bigint NOT NULL,
    precio_lista_id bigint NOT NULL,
    contacto_id bigint,
    precio numeric(18,6) DEFAULT 0 NOT NULL,
    moneda_id bigint,
    vigencia_desde timestamp without time zone,
    vigencia_hasta timestamp without time zone,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE precios; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.precios IS 'Precios de productos por lista, con posibilidad futura de precio específico por contacto.';


--
-- Name: precios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.precios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: precios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.precios_id_seq OWNED BY public.precios.id;


--
-- Name: precios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios ALTER COLUMN id SET DEFAULT nextval('public.precios_id_seq'::regclass);


--
-- Name: precios precios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT precios_pkey PRIMARY KEY (id);


--
-- Name: idx_precios_contacto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_contacto ON public.precios USING btree (contacto_id);


--
-- Name: idx_precios_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_empresa ON public.precios USING btree (empresa_id);


--
-- Name: idx_precios_lista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_lista ON public.precios USING btree (precio_lista_id);


--
-- Name: idx_precios_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_precios_producto ON public.precios USING btree (producto_id);


--
-- Name: ux_precios_empresa_producto_lista_contacto; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_precios_empresa_producto_lista_contacto ON public.precios USING btree (empresa_id, producto_id, precio_lista_id, COALESCE(contacto_id, (0)::bigint));


--
-- Name: precios fk_precios_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);


--
-- Name: precios fk_precios_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: precios fk_precios_lista; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_lista FOREIGN KEY (precio_lista_id) REFERENCES public.precios_listas(id);


--
-- Name: precios fk_precios_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precios
    ADD CONSTRAINT fk_precios_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 4BWOeSplGfTWQofRfnhsRxJjYEonBNxT911ip8yrvsLxipa19mPcZ2pJbpMbWVx

