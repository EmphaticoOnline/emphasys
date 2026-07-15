-- Schema: core
-- Table: cfdi_sat_credenciales
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict SEeBqIYszX6qrKImnzO8FJrFf8d0QcHbWrMRdrfjfwMZB3KmVkcDYoU8e57FK6u

-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
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
-- Name: cfdi_sat_credenciales; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_sat_credenciales (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    rfc_certificado character varying(13) NOT NULL,
    cer_content_encrypted text NOT NULL,
    key_content_encrypted text NOT NULL,
    vigencia_desde timestamp with time zone NOT NULL,
    vigencia_hasta timestamp with time zone NOT NULL,
    cargado_por integer NOT NULL,
    cargado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE cfdi_sat_credenciales; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.cfdi_sat_credenciales IS 'Credencial e.firma (FIEL) por empresa para el Servicio de Descarga Masiva del SAT. No almacena la contraseña de la FIEL.';


--
-- Name: COLUMN cfdi_sat_credenciales.rfc_certificado; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_credenciales.rfc_certificado IS 'RFC extraído del certificado .cer, validado contra el RFC de la empresa al momento de subir.';


--
-- Name: COLUMN cfdi_sat_credenciales.cer_content_encrypted; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_credenciales.cer_content_encrypted IS 'Contenido binario del .cer (base64) cifrado con AES-256-GCM (utils/secret-crypto.ts). Nunca se sirve por rutas públicas.';


--
-- Name: COLUMN cfdi_sat_credenciales.key_content_encrypted; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_credenciales.key_content_encrypted IS 'Contenido binario del .key (base64) cifrado con AES-256-GCM (utils/secret-crypto.ts). Nunca se sirve por rutas públicas.';


--
-- Name: COLUMN cfdi_sat_credenciales.vigencia_desde; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_credenciales.vigencia_desde IS 'notBefore del certificado X.509.';


--
-- Name: COLUMN cfdi_sat_credenciales.vigencia_hasta; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_credenciales.vigencia_hasta IS 'notAfter del certificado X.509. Se usa para marcar la credencial como vencida.';


--
-- Name: cfdi_sat_credenciales_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_sat_credenciales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_sat_credenciales_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_sat_credenciales_id_seq OWNED BY core.cfdi_sat_credenciales.id;


--
-- Name: cfdi_sat_credenciales id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_credenciales ALTER COLUMN id SET DEFAULT nextval('core.cfdi_sat_credenciales_id_seq'::regclass);


--
-- Name: cfdi_sat_credenciales cfdi_sat_credenciales_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_credenciales
    ADD CONSTRAINT cfdi_sat_credenciales_pkey PRIMARY KEY (id);


--
-- Name: cfdi_sat_credenciales ux_cfdi_sat_credenciales_empresa; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_credenciales
    ADD CONSTRAINT ux_cfdi_sat_credenciales_empresa UNIQUE (empresa_id);


--
-- Name: cfdi_sat_credenciales cfdi_sat_credenciales_cargado_por_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_credenciales
    ADD CONSTRAINT cfdi_sat_credenciales_cargado_por_fkey FOREIGN KEY (cargado_por) REFERENCES core.usuarios(id);


--
-- Name: cfdi_sat_credenciales cfdi_sat_credenciales_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_credenciales
    ADD CONSTRAINT cfdi_sat_credenciales_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict SEeBqIYszX6qrKImnzO8FJrFf8d0QcHbWrMRdrfjfwMZB3KmVkcDYoU8e57FK6u

