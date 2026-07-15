-- Schema: contabilidad
-- Table: cuentas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict XeqCIVeHBNNp6Rl5gmZSUgeEIewdtFPK6mdaHmcpQWVghK04w9SpeoP9ivnF7en

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
-- Name: cuentas; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.cuentas (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    cuenta character varying(64) NOT NULL,
    descripcion character varying(200) NOT NULL,
    afectable boolean DEFAULT true NOT NULL,
    cuenta_padre_id bigint,
    nivel smallint DEFAULT 1 NOT NULL,
    subgrupo character varying(60),
    codigo_agrupador_sat character varying(10),
    rubro_presupuesto character varying(80),
    no_considerar_presupuesto boolean DEFAULT true NOT NULL,
    observaciones character varying(500),
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    rango_cuenta_id bigint,
    CONSTRAINT chk_cuentas_nivel CHECK ((nivel > 0))
);


--
-- Name: TABLE cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.cuentas IS 'Catálogo de cuentas contables por empresa.';


--
-- Name: COLUMN cuentas.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.id IS 'Identificador interno de la cuenta contable.';


--
-- Name: COLUMN cuentas.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.empresa_id IS 'Empresa a la que pertenece la cuenta contable.';


--
-- Name: COLUMN cuentas.cuenta; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.cuenta IS 'Número o clave visible de la cuenta contable.';


--
-- Name: COLUMN cuentas.descripcion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.descripcion IS 'Nombre descriptivo de la cuenta contable.';


--
-- Name: COLUMN cuentas.afectable; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.afectable IS 'Indica si la cuenta puede recibir movimientos contables directamente.';


--
-- Name: COLUMN cuentas.cuenta_padre_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.cuenta_padre_id IS 'Cuenta contable superior dentro de la jerarquía.';


--
-- Name: COLUMN cuentas.nivel; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.nivel IS 'Nivel jerárquico de la cuenta dentro del catálogo contable.';


--
-- Name: COLUMN cuentas.subgrupo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.subgrupo IS 'Subgrupo adicional de clasificación contable.';


--
-- Name: COLUMN cuentas.codigo_agrupador_sat; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.codigo_agrupador_sat IS 'Código agrupador SAT asociado a la cuenta contable.';


--
-- Name: COLUMN cuentas.rubro_presupuesto; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.rubro_presupuesto IS 'Rubro presupuestal asociado a la cuenta.';


--
-- Name: COLUMN cuentas.no_considerar_presupuesto; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.no_considerar_presupuesto IS 'Indica si la cuenta debe excluirse de procesos presupuestales.';


--
-- Name: COLUMN cuentas.observaciones; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.observaciones IS 'Observaciones internas de la cuenta contable.';


--
-- Name: COLUMN cuentas.activa; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.activa IS 'Indica si la cuenta está activa para uso operativo.';


--
-- Name: COLUMN cuentas.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN cuentas.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: COLUMN cuentas.rango_cuenta_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.cuentas.rango_cuenta_id IS 'Rango contable asignado automáticamente a la cuenta. Referencia al identificador técnico de contabilidad.rangos_cuentas.';


--
-- Name: CONSTRAINT chk_cuentas_nivel ON cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_cuentas_nivel ON contabilidad.cuentas IS 'Garantiza que el nivel jerárquico sea mayor que cero.';


--
-- Name: cuentas_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.cuentas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuentas_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.cuentas_id_seq OWNED BY contabilidad.cuentas.id;


--
-- Name: cuentas id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas ALTER COLUMN id SET DEFAULT nextval('contabilidad.cuentas_id_seq'::regclass);


--
-- Name: cuentas cuentas_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas
    ADD CONSTRAINT cuentas_pkey PRIMARY KEY (id);


--
-- Name: cuentas uq_cuentas_empresa_cuenta; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas
    ADD CONSTRAINT uq_cuentas_empresa_cuenta UNIQUE (empresa_id, cuenta);


--
-- Name: CONSTRAINT uq_cuentas_empresa_cuenta ON cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_cuentas_empresa_cuenta ON contabilidad.cuentas IS 'Evita duplicar números de cuenta dentro de una empresa.';


--
-- Name: idx_cuentas_rango_cuenta_id; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_cuentas_rango_cuenta_id ON contabilidad.cuentas USING btree (rango_cuenta_id);


--
-- Name: cuentas fk_cuentas_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas
    ADD CONSTRAINT fk_cuentas_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_cuentas_empresa ON cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_cuentas_empresa ON contabilidad.cuentas IS 'Relaciona la cuenta contable con su empresa.';


--
-- Name: cuentas fk_cuentas_padre; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas
    ADD CONSTRAINT fk_cuentas_padre FOREIGN KEY (cuenta_padre_id) REFERENCES contabilidad.cuentas(id);


--
-- Name: CONSTRAINT fk_cuentas_padre ON cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_cuentas_padre ON contabilidad.cuentas IS 'Relaciona una cuenta con su cuenta padre dentro del árbol contable.';


--
-- Name: cuentas fk_cuentas_rango; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.cuentas
    ADD CONSTRAINT fk_cuentas_rango FOREIGN KEY (rango_cuenta_id) REFERENCES contabilidad.rangos_cuentas(id);


--
-- Name: CONSTRAINT fk_cuentas_rango ON cuentas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_cuentas_rango ON contabilidad.cuentas IS 'Relaciona la cuenta contable con su rango contable técnico.';


--
-- PostgreSQL database dump complete
--

\unrestrict XeqCIVeHBNNp6Rl5gmZSUgeEIewdtFPK6mdaHmcpQWVghK04w9SpeoP9ivnF7en

