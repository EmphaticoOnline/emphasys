-- Schema: contabilidad
-- Table: rangos_cuentas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict kNtU07RjaYK6NHV4svrGeqTe1xM8e2mdc06OfDZWhLqiatf41F4GtX457FLCF5W

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
-- Name: rangos_cuentas; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.rangos_cuentas (
    empresa_id bigint NOT NULL,
    limite_superior smallint NOT NULL,
    naturaleza_saldo character varying(1) NOT NULL,
    descripcion character varying(80) NOT NULL,
    rango character varying(30),
    grupo character varying(40),
    subgrupo character varying(60),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    id bigint NOT NULL,
    CONSTRAINT chk_rangos_cuentas_naturaleza CHECK (((naturaleza_saldo)::text = ANY ((ARRAY['D'::character varying, 'A'::character varying])::text[])))
);


--
-- Name: TABLE rangos_cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.rangos_cuentas IS 'Catálogo de rangos o rubros de cuentas contables por empresa. Cada rango define un límite superior funcional para clasificar cuentas.';


--
-- Name: COLUMN rangos_cuentas.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.empresa_id IS 'Empresa a la que pertenece el rango de cuentas.';


--
-- Name: COLUMN rangos_cuentas.limite_superior; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.limite_superior IS 'Límite superior funcional del rango de cuentas. Se compara contra el primer segmento numérico de la cuenta contable.';


--
-- Name: COLUMN rangos_cuentas.naturaleza_saldo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.naturaleza_saldo IS 'Naturaleza normal del saldo del rango: D para deudora, A para acreedora.';


--
-- Name: COLUMN rangos_cuentas.descripcion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.descripcion IS 'Descripción del rango o rubro contable.';


--
-- Name: COLUMN rangos_cuentas.rango; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.rango IS 'Texto descriptivo del rango de cuentas.';


--
-- Name: COLUMN rangos_cuentas.grupo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.grupo IS 'Grupo contable al que pertenece el rango.';


--
-- Name: COLUMN rangos_cuentas.subgrupo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.subgrupo IS 'Subgrupo contable al que pertenece el rango.';


--
-- Name: COLUMN rangos_cuentas.activo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.activo IS 'Indica si el rango está activo.';


--
-- Name: COLUMN rangos_cuentas.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN rangos_cuentas.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: COLUMN rangos_cuentas.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.rangos_cuentas.id IS 'Identificador técnico interno del rango de cuentas.';


--
-- Name: CONSTRAINT chk_rangos_cuentas_naturaleza ON rangos_cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_rangos_cuentas_naturaleza ON contabilidad.rangos_cuentas IS 'Limita la naturaleza del saldo a deudora o acreedora.';


--
-- Name: rangos_cuentas_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.rangos_cuentas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rangos_cuentas_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.rangos_cuentas_id_seq OWNED BY contabilidad.rangos_cuentas.id;


--
-- Name: rangos_cuentas id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.rangos_cuentas ALTER COLUMN id SET DEFAULT nextval('contabilidad.rangos_cuentas_id_seq'::regclass);


--
-- Name: rangos_cuentas pk_rangos_cuentas; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.rangos_cuentas
    ADD CONSTRAINT pk_rangos_cuentas PRIMARY KEY (id);


--
-- Name: CONSTRAINT pk_rangos_cuentas ON rangos_cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT pk_rangos_cuentas ON contabilidad.rangos_cuentas IS 'Llave primaria técnica del catálogo de rangos de cuentas.';


--
-- Name: rangos_cuentas uq_rangos_cuentas_empresa_limite_superior; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.rangos_cuentas
    ADD CONSTRAINT uq_rangos_cuentas_empresa_limite_superior UNIQUE (empresa_id, limite_superior);


--
-- Name: CONSTRAINT uq_rangos_cuentas_empresa_limite_superior ON rangos_cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_rangos_cuentas_empresa_limite_superior ON contabilidad.rangos_cuentas IS 'Evita duplicar límites superiores de rango dentro de una misma empresa.';


--
-- Name: idx_rangos_cuentas_empresa_limite_superior; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_rangos_cuentas_empresa_limite_superior ON contabilidad.rangos_cuentas USING btree (empresa_id, limite_superior);


--
-- Name: rangos_cuentas fk_rangos_cuentas_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.rangos_cuentas
    ADD CONSTRAINT fk_rangos_cuentas_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_rangos_cuentas_empresa ON rangos_cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_rangos_cuentas_empresa ON contabilidad.rangos_cuentas IS 'Relaciona el rango de cuentas con su empresa.';


--
-- PostgreSQL database dump complete
--

\unrestrict kNtU07RjaYK6NHV4svrGeqTe1xM8e2mdc06OfDZWhLqiatf41F4GtX457FLCF5W

