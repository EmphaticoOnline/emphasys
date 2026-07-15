-- Schema: contabilidad
-- Table: configuracion
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict bdAsapJ9EbR6k8HjHiIdmUGpFGKHqTEAlVyvGTCYond1oQYvKGlFah5ycIXc5rn

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
-- Name: configuracion; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.configuracion (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    caracter_separador character varying(1) DEFAULT '-'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    estructura_cuentas character varying(30) DEFAULT '3-4-3'::character varying NOT NULL,
    permitir_venta_no_timbrada boolean DEFAULT false NOT NULL,
    tipo_poliza_venta_factura_id bigint,
    tipo_poliza_venta_cancelacion_id bigint,
    CONSTRAINT chk_contabilidad_configuracion_caracter_separador CHECK ((char_length((caracter_separador)::text) = 1))
);


--
-- Name: TABLE configuracion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.configuracion IS 'Configuración general del módulo de contabilidad por empresa.';


--
-- Name: COLUMN configuracion.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.id IS 'Identificador interno de la configuración contable.';


--
-- Name: COLUMN configuracion.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.empresa_id IS 'Empresa a la que pertenece la configuración contable.';


--
-- Name: COLUMN configuracion.caracter_separador; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.caracter_separador IS 'Caracter utilizado para separar segmentos visibles de cuentas contables. Puede ser espacio, guion, punto u otro carácter único.';


--
-- Name: COLUMN configuracion.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN configuracion.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: COLUMN configuracion.estructura_cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.estructura_cuentas IS 'Estructura de segmentos del número de cuenta contable, expresada como longitudes separadas por guion (ej. 3-4-3, 3-4-3-3, 4-3-3).';


--
-- Name: COLUMN configuracion.permitir_venta_no_timbrada; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.permitir_venta_no_timbrada IS 'Permite contabilizar facturas de venta estándar (tratamiento_impuestos = normal) que aún no están timbradas ante el SAT. Default false: solo se contabilizan facturas ya timbradas.';


--
-- Name: COLUMN configuracion.tipo_poliza_venta_factura_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.tipo_poliza_venta_factura_id IS 'Tipo de póliza que debe usar el motor de contabilización automática al contabilizar la emisión de una factura de venta (individual o en lote). NULL = no configurado; en ese caso no se genera póliza y se informa al usuario.';


--
-- Name: COLUMN configuracion.tipo_poliza_venta_cancelacion_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion.tipo_poliza_venta_cancelacion_id IS 'Tipo de póliza que debe usar el motor de contabilización automática al generar la reversa por cancelación de una factura de venta ya contabilizada. NULL = no configurado; en ese caso no se genera la reversa y se informa al usuario.';


--
-- Name: CONSTRAINT chk_contabilidad_configuracion_caracter_separador ON configuracion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_contabilidad_configuracion_caracter_separador ON contabilidad.configuracion IS 'Garantiza que el separador sea exactamente un carácter.';


--
-- Name: configuracion_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.configuracion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.configuracion_id_seq OWNED BY contabilidad.configuracion.id;


--
-- Name: configuracion id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion ALTER COLUMN id SET DEFAULT nextval('contabilidad.configuracion_id_seq'::regclass);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: configuracion uq_contabilidad_configuracion_empresa; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion
    ADD CONSTRAINT uq_contabilidad_configuracion_empresa UNIQUE (empresa_id);


--
-- Name: CONSTRAINT uq_contabilidad_configuracion_empresa ON configuracion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_contabilidad_configuracion_empresa ON contabilidad.configuracion IS 'Evita que una empresa tenga más de una configuración contable.';


--
-- Name: configuracion configuracion_tipo_poliza_venta_cancelacion_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion
    ADD CONSTRAINT configuracion_tipo_poliza_venta_cancelacion_id_fkey FOREIGN KEY (tipo_poliza_venta_cancelacion_id) REFERENCES contabilidad.tipos_poliza(id);


--
-- Name: configuracion configuracion_tipo_poliza_venta_factura_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion
    ADD CONSTRAINT configuracion_tipo_poliza_venta_factura_id_fkey FOREIGN KEY (tipo_poliza_venta_factura_id) REFERENCES contabilidad.tipos_poliza(id);


--
-- Name: configuracion fk_contabilidad_configuracion_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion
    ADD CONSTRAINT fk_contabilidad_configuracion_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_contabilidad_configuracion_empresa ON configuracion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_contabilidad_configuracion_empresa ON contabilidad.configuracion IS 'Relaciona la configuración contable con su empresa.';


--
-- PostgreSQL database dump complete
--

\unrestrict bdAsapJ9EbR6k8HjHiIdmUGpFGKHqTEAlVyvGTCYond1oQYvKGlFah5ycIXc5rn

