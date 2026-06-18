-- Schema: public
-- Table: documentos_cancelacion_intentos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict vUTyzakpucE6585AkOeuHZ9LFU3sdsCfWuG6V4kc0WnshctHmfmv41kzcjUmMLa

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
-- Name: documentos_cancelacion_intentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_cancelacion_intentos (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    documento_id integer NOT NULL,
    usuario_id integer NOT NULL,
    estado character varying(40) NOT NULL,
    motivo_cancelacion text,
    motivo_sat character varying(2),
    uuid_sustitucion character varying(36),
    cfdi_uuid character varying(36),
    facturama_respuesta jsonb,
    error_externo_mensaje text,
    error_interno_mensaje text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documentos_cancelacion_intentos_estado_check CHECK (((estado)::text = ANY ((ARRAY['iniciado'::character varying, 'error_externo'::character varying, 'externo_ok'::character varying, 'completado'::character varying, 'externo_ok_interno_pendiente'::character varying, 'error_interno'::character varying])::text[])))
);


--
-- Name: TABLE documentos_cancelacion_intentos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_cancelacion_intentos IS 'Seguimiento de intentos de cancelación de documentos (saga corta)';


--
-- Name: COLUMN documentos_cancelacion_intentos.estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.estado IS 'iniciado | error_externo | externo_ok | completado | externo_ok_interno_pendiente | error_interno';


--
-- Name: COLUMN documentos_cancelacion_intentos.cfdi_uuid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.cfdi_uuid IS 'UUID del CFDI que fue cancelado en Facturama (NULL si el documento no tenía CFDI timbrado)';


--
-- Name: COLUMN documentos_cancelacion_intentos.facturama_respuesta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.facturama_respuesta IS 'Respuesta JSON devuelta por Facturama al cancelar el CFDI';


--
-- Name: COLUMN documentos_cancelacion_intentos.error_externo_mensaje; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.error_externo_mensaje IS 'Mensaje de error cuando Facturama rechazó la cancelación';


--
-- Name: COLUMN documentos_cancelacion_intentos.error_interno_mensaje; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_cancelacion_intentos.error_interno_mensaje IS 'Mensaje de error cuando la transacción interna falló';


--
-- Name: documentos_cancelacion_intentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_cancelacion_intentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_cancelacion_intentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_cancelacion_intentos_id_seq OWNED BY public.documentos_cancelacion_intentos.id;


--
-- Name: documentos_cancelacion_intentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos ALTER COLUMN id SET DEFAULT nextval('public.documentos_cancelacion_intentos_id_seq'::regclass);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_pkey PRIMARY KEY (id);


--
-- Name: idx_dci_documento_empresa_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dci_documento_empresa_estado ON public.documentos_cancelacion_intentos USING btree (documento_id, empresa_id, estado);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: documentos_cancelacion_intentos documentos_cancelacion_intentos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_cancelacion_intentos
    ADD CONSTRAINT documentos_cancelacion_intentos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict vUTyzakpucE6585AkOeuHZ9LFU3sdsCfWuG6V4kc0WnshctHmfmv41kzcjUmMLa

