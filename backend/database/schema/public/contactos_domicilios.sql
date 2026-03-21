-- Schema: public
-- Table: contactos_domicilios
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict YrdG0J4eUeFjf0nE4Evzc6GaVyt0WMwtFxTXXGKXnDOGwloBrbhOrkl8Jt88yJv

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
-- Name: contactos_domicilios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos_domicilios (
    id integer NOT NULL,
    contacto_id integer NOT NULL,
    identificador character varying(60) NOT NULL,
    es_principal boolean DEFAULT false NOT NULL,
    responsable character varying(100),
    calle character varying(100),
    numero_exterior character varying(20),
    numero_interior character varying(20),
    colonia character varying(60),
    ciudad character varying(60),
    estado character varying(40),
    cp character varying(10),
    pais character varying(40) DEFAULT 'México'::character varying,
    cruces text,
    recibe character varying(100),
    telefono_recibe character varying(20),
    telefono character varying(20),
    fax character varying(20),
    observaciones text,
    cp_sat text,
    colonia_sat text
);


--
-- Name: contactos_domicilios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contactos_domicilios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contactos_domicilios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contactos_domicilios_id_seq OWNED BY public.contactos_domicilios.id;


--
-- Name: contactos_domicilios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios ALTER COLUMN id SET DEFAULT nextval('public.contactos_domicilios_id_seq'::regclass);


--
-- Name: contactos_domicilios contactos_domicilios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT contactos_domicilios_pkey PRIMARY KEY (id);


--
-- Name: contactos_domicilios ux_cd_identificador; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT ux_cd_identificador UNIQUE (contacto_id, identificador);


--
-- Name: idx_cd_cp_sat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cd_cp_sat ON public.contactos_domicilios USING btree (cp_sat);


--
-- Name: ux_contactos_domicilios_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_contactos_domicilios_principal ON public.contactos_domicilios USING btree (contacto_id) WHERE (es_principal = true);


--
-- Name: contactos_domicilios fk_cd_contacto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT fk_cd_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE;


--
-- Name: contactos_domicilios fk_cd_cp_sat; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos_domicilios
    ADD CONSTRAINT fk_cd_cp_sat FOREIGN KEY (cp_sat) REFERENCES sat.codigos_postales(id);


--
-- PostgreSQL database dump complete
--

\unrestrict YrdG0J4eUeFjf0nE4Evzc6GaVyt0WMwtFxTXXGKXnDOGwloBrbhOrkl8Jt88yJv

