-- Schema: core
-- Table: cfdi_sat_solicitudes
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 0Z3wNJBE7MIHKNtm2nXfkW0ap6aGGzcvVL1lArDGdJ9Pq6zNHax16AfKn0yvdsf

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
-- Name: cfdi_sat_solicitudes; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_sat_solicitudes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    usuario_id integer NOT NULL,
    tipo_descarga character varying(10) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    tipo_solicitud character varying(10) NOT NULL,
    estatus_comprobante character varying(10),
    sat_request_id character varying(80),
    estatus character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    mensaje_error text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    solicitado_en timestamp with time zone,
    cfdis_encontrados integer,
    verificado_en timestamp with time zone,
    CONSTRAINT ck_cfdi_sat_solicitudes_estatus CHECK (((estatus)::text = ANY ((ARRAY['pendiente'::character varying, 'solicitado'::character varying, 'en_proceso'::character varying, 'terminado'::character varying, 'sin_resultados'::character varying, 'error'::character varying, 'expirado'::character varying, 'rechazado'::character varying])::text[]))),
    CONSTRAINT ck_cfdi_sat_solicitudes_estatus_comprobante CHECK (((estatus_comprobante IS NULL) OR ((estatus_comprobante)::text = ANY ((ARRAY['activos'::character varying, 'cancelados'::character varying, 'todos'::character varying])::text[])))),
    CONSTRAINT ck_cfdi_sat_solicitudes_fechas CHECK ((fecha_fin >= fecha_inicio)),
    CONSTRAINT ck_cfdi_sat_solicitudes_tipo_descarga CHECK (((tipo_descarga)::text = ANY ((ARRAY['emitidos'::character varying, 'recibidos'::character varying])::text[]))),
    CONSTRAINT ck_cfdi_sat_solicitudes_tipo_solicitud CHECK (((tipo_solicitud)::text = ANY ((ARRAY['xml'::character varying, 'metadata'::character varying])::text[])))
);


--
-- Name: TABLE cfdi_sat_solicitudes; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.cfdi_sat_solicitudes IS 'Solicitudes al Servicio Web de Descarga Masiva del SAT. Fase 2: solo llega hasta el paso de solicitud creada (sin verificación ni descarga de paquetes).';


--
-- Name: COLUMN cfdi_sat_solicitudes.sat_request_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_solicitudes.sat_request_id IS 'RequestId devuelto por el SAT cuando la solicitud es aceptada (query() exitoso).';


--
-- Name: COLUMN cfdi_sat_solicitudes.estatus; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_solicitudes.estatus IS 'Estado interno del flujo: pendiente (creada, aún sin llamar al SAT), solicitado (SAT aceptó), error (fallo técnico/de comunicación), rechazado (SAT respondió pero rechazó la solicitud).';


--
-- Name: COLUMN cfdi_sat_solicitudes.mensaje_error; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_solicitudes.mensaje_error IS 'Mensaje de error legible cuando estatus es error o rechazado. Nunca debe contener la contraseña de la FIEL.';


--
-- Name: COLUMN cfdi_sat_solicitudes.solicitado_en; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_solicitudes.solicitado_en IS 'Fecha y hora en que el SAT aceptó la solicitud (query() exitoso).';


--
-- Name: COLUMN cfdi_sat_solicitudes.cfdis_encontrados; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_solicitudes.cfdis_encontrados IS 'Número de CFDIs reportado por el SAT en la última verificación (VerifyResult.getNumberCfdis()).';


--
-- Name: COLUMN cfdi_sat_solicitudes.verificado_en; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_solicitudes.verificado_en IS 'Fecha y hora de la última llamada exitosa a verify() contra el SAT.';


--
-- Name: cfdi_sat_solicitudes_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.cfdi_sat_solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cfdi_sat_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.cfdi_sat_solicitudes_id_seq OWNED BY core.cfdi_sat_solicitudes.id;


--
-- Name: cfdi_sat_solicitudes id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_solicitudes ALTER COLUMN id SET DEFAULT nextval('core.cfdi_sat_solicitudes_id_seq'::regclass);


--
-- Name: cfdi_sat_solicitudes cfdi_sat_solicitudes_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_solicitudes
    ADD CONSTRAINT cfdi_sat_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: ix_cfdi_sat_solicitudes_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_cfdi_sat_solicitudes_empresa ON core.cfdi_sat_solicitudes USING btree (empresa_id, creado_en DESC);


--
-- Name: cfdi_sat_solicitudes cfdi_sat_solicitudes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_solicitudes
    ADD CONSTRAINT cfdi_sat_solicitudes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: cfdi_sat_solicitudes cfdi_sat_solicitudes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_solicitudes
    ADD CONSTRAINT cfdi_sat_solicitudes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 0Z3wNJBE7MIHKNtm2nXfkW0ap6aGGzcvVL1lArDGdJ9Pq6zNHax16AfKn0yvdsf

