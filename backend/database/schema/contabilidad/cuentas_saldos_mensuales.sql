-- Schema: contabilidad
-- Table: cuentas_saldos_mensuales
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict dKXUKqIjK1RYUAbXbnrIQVPa6oe6PyKYS6enKg3nswj3DslDYTLpIVLwpQNnDFr

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
-- Name: cuentas_saldos_mensuales; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.cuentas_saldos_mensuales (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    cuenta_id bigint NOT NULL,
    ejercicio integer NOT NULL,
    periodo smallint NOT NULL,
    cargos numeric(19,2) DEFAULT 0 NOT NULL,
    abonos numeric(19,2) DEFAULT 0 NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_cuentas_saldos_mensuales_abonos CHECK ((abonos >= (0)::numeric)),
    CONSTRAINT chk_cuentas_saldos_mensuales_cargos CHECK ((cargos >= (0)::numeric)),
    CONSTRAINT chk_cuentas_saldos_mensuales_periodo CHECK (((periodo >= 1) AND (periodo <= 12)))
);


--
-- Name: TABLE cuentas_saldos_mensuales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.cuentas_saldos_mensuales IS 'Acumulados mensuales de cargos y abonos por cuenta contable.';


--
-- Name: COLUMN cuentas_saldos_mensuales.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.id IS 'Identificador interno del acumulado mensual.';


--
-- Name: COLUMN cuentas_saldos_mensuales.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.empresa_id IS 'Empresa a la que pertenece el acumulado mensual.';


--
-- Name: COLUMN cuentas_saldos_mensuales.cuenta_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.cuenta_id IS 'Cuenta contable a la que pertenece el acumulado.';


--
-- Name: COLUMN cuentas_saldos_mensuales.ejercicio; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.ejercicio IS 'Ejercicio contable del acumulado.';


--
-- Name: COLUMN cuentas_saldos_mensuales.periodo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.periodo IS 'Periodo contable mensual del acumulado, del 1 al 12.';


--
-- Name: COLUMN cuentas_saldos_mensuales.cargos; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.cargos IS 'Total de cargos acumulados de la cuenta en el periodo.';


--
-- Name: COLUMN cuentas_saldos_mensuales.abonos; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.abonos IS 'Total de abonos acumulados de la cuenta en el periodo.';


--
-- Name: COLUMN cuentas_saldos_mensuales.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN cuentas_saldos_mensuales.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas_saldos_mensuales.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: CONSTRAINT chk_cuentas_saldos_mensuales_abonos ON cuentas_saldos_mensuales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_cuentas_saldos_mensuales_abonos ON contabilidad.cuentas_saldos_mensuales IS 'Garantiza que los abonos no sean negativos.';


--
-- Name: CONSTRAINT chk_cuentas_saldos_mensuales_cargos ON cuentas_saldos_mensuales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_cuentas_saldos_mensuales_cargos ON contabilidad.cuentas_saldos_mensuales IS 'Garantiza que los cargos no sean negativos.';


--
-- Name: CONSTRAINT chk_cuentas_saldos_mensuales_periodo ON cuentas_saldos_mensuales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_cuentas_saldos_mensuales_periodo ON contabilidad.cuentas_saldos_mensuales IS 'Garantiza que el periodo esté entre 1 y 12.';


--
-- Name: cuentas_saldos_mensuales_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.cuentas_saldos_mensuales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuentas_saldos_mensuales_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.cuentas_saldos_mensuales_id_seq OWNED BY contabilidad.cuentas_saldos_mensuales.id;


--
-- Name: cuentas_saldos_mensuales id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_mensuales ALTER COLUMN id SET DEFAULT nextval('contabilidad.cuentas_saldos_mensuales_id_seq'::regclass);


--
-- Name: cuentas_saldos_mensuales cuentas_saldos_mensuales_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_mensuales
    ADD CONSTRAINT cuentas_saldos_mensuales_pkey PRIMARY KEY (id);


--
-- Name: cuentas_saldos_mensuales uq_cuentas_saldos_mensuales; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_mensuales
    ADD CONSTRAINT uq_cuentas_saldos_mensuales UNIQUE (empresa_id, cuenta_id, ejercicio, periodo);


--
-- Name: CONSTRAINT uq_cuentas_saldos_mensuales ON cuentas_saldos_mensuales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_cuentas_saldos_mensuales ON contabilidad.cuentas_saldos_mensuales IS 'Evita duplicar acumulados por empresa, cuenta, ejercicio y periodo.';


--
-- Name: cuentas_saldos_mensuales fk_cuentas_saldos_mensuales_cuenta; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_mensuales
    ADD CONSTRAINT fk_cuentas_saldos_mensuales_cuenta FOREIGN KEY (cuenta_id) REFERENCES contabilidad.cuentas(id);


--
-- Name: CONSTRAINT fk_cuentas_saldos_mensuales_cuenta ON cuentas_saldos_mensuales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_cuentas_saldos_mensuales_cuenta ON contabilidad.cuentas_saldos_mensuales IS 'Relaciona el acumulado mensual con su cuenta contable.';


--
-- Name: cuentas_saldos_mensuales fk_cuentas_saldos_mensuales_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas_saldos_mensuales
    ADD CONSTRAINT fk_cuentas_saldos_mensuales_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_cuentas_saldos_mensuales_empresa ON cuentas_saldos_mensuales; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_cuentas_saldos_mensuales_empresa ON contabilidad.cuentas_saldos_mensuales IS 'Relaciona el acumulado mensual con su empresa.';


--
-- PostgreSQL database dump complete
--

\unrestrict dKXUKqIjK1RYUAbXbnrIQVPa6oe6PyKYS6enKg3nswj3DslDYTLpIVLwpQNnDFr

