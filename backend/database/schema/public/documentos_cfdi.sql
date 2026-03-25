-- Schema: public
-- Table: documentos_cfdi
-- Generated automatically

--
-- PostgreSQL database dump
--

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
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
-- Name: documentos_cfdi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_cfdi (
    documento_id integer NOT NULL,
    uuid character varying(36) NOT NULL,
    fecha_timbrado timestamp with time zone NOT NULL,
    version_cfdi character varying(10),
    serie_cfdi character varying(10),
    folio_cfdi character varying(20),
    no_certificado character varying(30),
    no_certificado_sat character varying(30),
    sello_cfdi text,
    sello_sat text,
    cadena_original text,
    xml_timbrado text,
    qr_url text,
    estado_sat character varying(20),
    fecha_cancelacion timestamp with time zone,
    xml_cancelacion text,
    fecha_emision timestamp with time zone,
    rfc_proveedor_certificacion character varying(20),
    pac character varying(20),
    pac_id character varying(50),
    rfc_emisor text,
    rfc_receptor text,
    total numeric(14,2)
);


--
-- Name: documentos_cfdi documentos_cfdi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cfdi
    ADD CONSTRAINT documentos_cfdi_pkey PRIMARY KEY (documento_id);


--
-- Name: idx_documentos_cfdi_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_cfdi_estado ON public.documentos_cfdi USING btree (estado_sat);


--
-- Name: idx_documentos_cfdi_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_cfdi_uuid ON public.documentos_cfdi USING btree (uuid);


--
-- Name: documentos_cfdi fk_documentos_cfdi_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cfdi
    ADD CONSTRAINT fk_documentos_cfdi_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- PostgreSQL database dump complete
--

