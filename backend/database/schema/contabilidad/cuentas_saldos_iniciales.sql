-- Schema: contabilidad
-- Table: cuentas_saldos_iniciales
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 1FfKuZtFgEAGgrgdXDuYXsIv2pNIpaWRZX2KcwF4BclDMJ3krRRlvDl5dxTxifk

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
-- Name: cuentas_saldos_iniciales; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.cuentas_saldos_iniciales (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    ejercicio integer NOT NULL,
    cuenta_id bigint NOT NULL,
    saldo_inicial numeric(19,2) DEFAULT 0 NOT NULL,
    origen character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    observaciones text,
    creado_por bigint,
    actualizado_por bigint,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_cuentas_saldos_iniciales_ejercicio CHECK ((ejercicio >= 2000)),
    CONSTRAINT chk_cuentas_saldos_iniciales_origen CHECK (((origen)::text = ANY ((ARRAY['manual'::character varying, 'importacion'::character varying, 'migracion'::character varying])::text[])))
);


--
-- Name: TABLE cuentas_saldos_iniciales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.cuentas_saldos_iniciales IS 'Saldo contable de arranque (apertura) de una cuenta para un ejercicio, capturado o migrado desde fuera de Emphasys. No representa movimientos ni pólizas; no se toca desde la lógica de cargos/abonos mensuales.';


--
-- Name: COLUMN cuentas_saldos_iniciales.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.id IS 'Identificador interno del saldo inicial.';


--
-- Name: COLUMN cuentas_saldos_iniciales.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.empresa_id IS 'Empresa a la que pertenece el saldo inicial.';


--
-- Name: COLUMN cuentas_saldos_iniciales.ejercicio; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.ejercicio IS 'Ejercicio contable al que corresponde el saldo de arranque.';


--
-- Name: COLUMN cuentas_saldos_iniciales.cuenta_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.cuenta_id IS 'Cuenta contable a la que pertenece el saldo inicial.';


--
-- Name: COLUMN cuentas_saldos_iniciales.saldo_inicial; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.saldo_inicial IS 'Saldo firmado de arranque del ejercicio: positivo = saldo deudor, negativo = saldo acreedor, independientemente de la naturaleza de la cuenta.';


--
-- Name: COLUMN cuentas_saldos_iniciales.origen; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.origen IS 'Origen del dato: manual (capturado a mano), importacion o migracion (cargado desde el sistema anterior).';


--
-- Name: COLUMN cuentas_saldos_iniciales.observaciones; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.observaciones IS 'Notas libres sobre el origen o justificación del saldo inicial, por ejemplo referencia al sistema anterior.';


--
-- Name: COLUMN cuentas_saldos_iniciales.creado_por; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.creado_por IS 'Usuario que capturó el saldo inicial por primera vez.';


--
-- Name: COLUMN cuentas_saldos_iniciales.actualizado_por; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.actualizado_por IS 'Usuario que modificó por última vez el saldo inicial.';


--
-- Name: COLUMN cuentas_saldos_iniciales.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN cuentas_saldos_iniciales.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: CONSTRAINT chk_cuentas_saldos_iniciales_ejercicio ON cuentas_saldos_iniciales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_cuentas_saldos_iniciales_ejercicio ON contabilidad.cuentas_saldos_iniciales IS 'Descarta ejercicios claramente inválidos (antes del año 2000).';


--
-- Name: CONSTRAINT chk_cuentas_saldos_iniciales_origen ON cuentas_saldos_iniciales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_cuentas_saldos_iniciales_origen ON contabilidad.cuentas_saldos_iniciales IS 'Limita el origen del dato a los valores reconocidos por el sistema.';


--
-- Name: cuentas_saldos_iniciales_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.cuentas_saldos_iniciales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuentas_saldos_iniciales_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.cuentas_saldos_iniciales_id_seq OWNED BY contabilidad.cuentas_saldos_iniciales.id;


--
-- Name: cuentas_saldos_iniciales id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_iniciales ALTER COLUMN id SET DEFAULT nextval('contabilidad.cuentas_saldos_iniciales_id_seq'::regclass);


--
-- Name: cuentas_saldos_iniciales cuentas_saldos_iniciales_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_iniciales
    ADD CONSTRAINT cuentas_saldos_iniciales_pkey PRIMARY KEY (id);


--
-- Name: cuentas_saldos_iniciales uq_cuentas_saldos_iniciales; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_iniciales
    ADD CONSTRAINT uq_cuentas_saldos_iniciales UNIQUE (empresa_id, ejercicio, cuenta_id);


--
-- Name: CONSTRAINT uq_cuentas_saldos_iniciales ON cuentas_saldos_iniciales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_cuentas_saldos_iniciales ON contabilidad.cuentas_saldos_iniciales IS 'Evita duplicar el saldo inicial de una misma cuenta en un mismo ejercicio para la misma empresa.';


--
-- Name: idx_cuentas_saldos_iniciales_empresa_ejercicio; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_cuentas_saldos_iniciales_empresa_ejercicio ON contabilidad.cuentas_saldos_iniciales USING btree (empresa_id, ejercicio);


--
-- Name: INDEX idx_cuentas_saldos_iniciales_empresa_ejercicio; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.idx_cuentas_saldos_iniciales_empresa_ejercicio IS 'Índice para consultar todos los saldos iniciales de una empresa en un ejercicio (pantalla de captura y validador de e-contabilidad).';


--
-- Name: cuentas_saldos_iniciales fk_cuentas_saldos_iniciales_cuenta; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_iniciales
    ADD CONSTRAINT fk_cuentas_saldos_iniciales_cuenta FOREIGN KEY (cuenta_id) REFERENCES contabilidad.cuentas(id);


--
-- Name: CONSTRAINT fk_cuentas_saldos_iniciales_cuenta ON cuentas_saldos_iniciales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_cuentas_saldos_iniciales_cuenta ON contabilidad.cuentas_saldos_iniciales IS 'Relaciona el saldo inicial con la cuenta contable.';


--
-- Name: cuentas_saldos_iniciales fk_cuentas_saldos_iniciales_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_iniciales
    ADD CONSTRAINT fk_cuentas_saldos_iniciales_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_cuentas_saldos_iniciales_empresa ON cuentas_saldos_iniciales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_cuentas_saldos_iniciales_empresa ON contabilidad.cuentas_saldos_iniciales IS 'Relaciona el saldo inicial con su empresa.';


--
-- PostgreSQL database dump complete
--

\unrestrict 1FfKuZtFgEAGgrgdXDuYXsIv2pNIpaWRZX2KcwF4BclDMJ3krRRlvDl5dxTxifk

