-- Schema: contabilidad
-- Table: polizas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict jGsjySqcbfQc0BbmpQN33yAbOeTSPfCcAcgTsMM69zixWKGBvka2EumJjGrdaQi

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
-- Name: polizas; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.polizas (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    codigo_legacy character varying(16),
    tipo_poliza_id bigint NOT NULL,
    ejercicio integer NOT NULL,
    periodo smallint NOT NULL,
    numero integer NOT NULL,
    fecha date NOT NULL,
    estatus character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    referencia character varying(100),
    observaciones text,
    total_cargos numeric(19,2) DEFAULT 0 NOT NULL,
    total_abonos numeric(19,2) DEFAULT 0 NOT NULL,
    modulo_origen character varying(30),
    almacen_id bigint,
    uuid_cfdi uuid,
    creada_por_id bigint,
    modificada_por_id bigint,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_polizas_estatus CHECK (((estatus)::text = ANY ((ARRAY['borrador'::character varying, 'aplicada'::character varying, 'cancelada'::character varying])::text[]))),
    CONSTRAINT chk_polizas_numero CHECK ((numero > 0)),
    CONSTRAINT chk_polizas_periodo CHECK (((periodo >= 1) AND (periodo <= 12))),
    CONSTRAINT chk_polizas_totales CHECK (((total_cargos >= (0)::numeric) AND (total_abonos >= (0)::numeric)))
);


--
-- Name: TABLE polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.polizas IS 'Encabezado de pólizas contables.';


--
-- Name: COLUMN polizas.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.id IS 'Identificador interno de la póliza contable.';


--
-- Name: COLUMN polizas.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.empresa_id IS 'Empresa a la que pertenece la póliza.';


--
-- Name: COLUMN polizas.codigo_legacy; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.codigo_legacy IS 'Código de póliza heredado del sistema anterior, usado solo para importación o auditoría histórica.';


--
-- Name: COLUMN polizas.tipo_poliza_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.tipo_poliza_id IS 'Tipo de póliza contable.';


--
-- Name: COLUMN polizas.ejercicio; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.ejercicio IS 'Ejercicio contable de la póliza.';


--
-- Name: COLUMN polizas.periodo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.periodo IS 'Periodo contable mensual de la póliza, del 1 al 12.';


--
-- Name: COLUMN polizas.numero; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.numero IS 'Número consecutivo de la póliza dentro de empresa, tipo, ejercicio y periodo.';


--
-- Name: COLUMN polizas.fecha; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.fecha IS 'Fecha contable de la póliza.';


--
-- Name: COLUMN polizas.estatus; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.estatus IS 'Estatus operativo de la póliza: borrador, aplicada o cancelada.';


--
-- Name: COLUMN polizas.referencia; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.referencia IS 'Referencia externa o interna de la póliza.';


--
-- Name: COLUMN polizas.observaciones; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.observaciones IS 'Observaciones libres de la póliza.';


--
-- Name: COLUMN polizas.total_cargos; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.total_cargos IS 'Total de cargos de la póliza.';


--
-- Name: COLUMN polizas.total_abonos; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.total_abonos IS 'Total de abonos de la póliza.';


--
-- Name: COLUMN polizas.modulo_origen; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.modulo_origen IS 'Módulo que generó la póliza, cuando aplique.';


--
-- Name: COLUMN polizas.almacen_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.almacen_id IS 'Almacén relacionado con la póliza, cuando aplique.';


--
-- Name: COLUMN polizas.uuid_cfdi; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.uuid_cfdi IS 'UUID fiscal relacionado con la póliza, cuando aplique.';


--
-- Name: COLUMN polizas.creada_por_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.creada_por_id IS 'Usuario que creó la póliza.';


--
-- Name: COLUMN polizas.modificada_por_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.modificada_por_id IS 'Usuario que modificó por última vez la póliza.';


--
-- Name: COLUMN polizas.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN polizas.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: CONSTRAINT chk_polizas_estatus ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_polizas_estatus ON contabilidad.polizas IS 'Limita los estatus permitidos de la póliza.';


--
-- Name: CONSTRAINT chk_polizas_numero ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_polizas_numero ON contabilidad.polizas IS 'Garantiza que el número de póliza sea mayor que cero.';


--
-- Name: CONSTRAINT chk_polizas_periodo ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_polizas_periodo ON contabilidad.polizas IS 'Garantiza que el periodo esté entre 1 y 12.';


--
-- Name: CONSTRAINT chk_polizas_totales ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_polizas_totales ON contabilidad.polizas IS 'Garantiza que los totales de cargos y abonos no sean negativos.';


--
-- Name: polizas_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.polizas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: polizas_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.polizas_id_seq OWNED BY contabilidad.polizas.id;


--
-- Name: polizas id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas ALTER COLUMN id SET DEFAULT nextval('contabilidad.polizas_id_seq'::regclass);


--
-- Name: polizas polizas_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas
    ADD CONSTRAINT polizas_pkey PRIMARY KEY (id);


--
-- Name: polizas uq_polizas_empresa_codigo_legacy; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas
    ADD CONSTRAINT uq_polizas_empresa_codigo_legacy UNIQUE (empresa_id, codigo_legacy);


--
-- Name: CONSTRAINT uq_polizas_empresa_codigo_legacy ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_polizas_empresa_codigo_legacy ON contabilidad.polizas IS 'Evita duplicar códigos heredados de póliza por empresa durante la importación histórica.';


--
-- Name: polizas uq_polizas_empresa_tipo_ejercicio_periodo_numero; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas
    ADD CONSTRAINT uq_polizas_empresa_tipo_ejercicio_periodo_numero UNIQUE (empresa_id, tipo_poliza_id, ejercicio, periodo, numero);


--
-- Name: CONSTRAINT uq_polizas_empresa_tipo_ejercicio_periodo_numero ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_polizas_empresa_tipo_ejercicio_periodo_numero ON contabilidad.polizas IS 'Evita duplicar números de póliza por empresa, tipo, ejercicio y periodo.';


--
-- Name: polizas fk_polizas_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas
    ADD CONSTRAINT fk_polizas_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_polizas_empresa ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_polizas_empresa ON contabilidad.polizas IS 'Relaciona la póliza con su empresa.';


--
-- Name: polizas fk_polizas_tipo; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas
    ADD CONSTRAINT fk_polizas_tipo FOREIGN KEY (tipo_poliza_id) REFERENCES contabilidad.tipos_poliza(id);


--
-- Name: CONSTRAINT fk_polizas_tipo ON polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_polizas_tipo ON contabilidad.polizas IS 'Relaciona la póliza con su tipo de póliza.';


--
-- PostgreSQL database dump complete
--

\unrestrict jGsjySqcbfQc0BbmpQN33yAbOeTSPfCcAcgTsMM69zixWKGBvka2EumJjGrdaQi

