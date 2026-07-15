-- Schema: contabilidad
-- Table: tipos_poliza
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict Ux4F1M8Yq7uLxRb9Vqyz3armWz6vea9r1CBdjpvfRtCScgeP8AEcj7beGk0pUDG

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
-- Name: tipos_poliza; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.tipos_poliza (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    identificador character varying(50) NOT NULL,
    poliza_inicial integer DEFAULT 1 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE tipos_poliza; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.tipos_poliza IS 'Catálogo de tipos de póliza contable por empresa.';


--
-- Name: COLUMN tipos_poliza.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.tipos_poliza.id IS 'Identificador interno del tipo de póliza.';


--
-- Name: COLUMN tipos_poliza.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.tipos_poliza.empresa_id IS 'Empresa a la que pertenece el tipo de póliza.';


--
-- Name: COLUMN tipos_poliza.identificador; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.tipos_poliza.identificador IS 'Nombre o identificador visible del tipo de póliza, por ejemplo Diario, Ingresos o Egresos.';


--
-- Name: COLUMN tipos_poliza.poliza_inicial; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.tipos_poliza.poliza_inicial IS 'Número inicial sugerido para pólizas de este tipo.';


--
-- Name: COLUMN tipos_poliza.activo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.tipos_poliza.activo IS 'Indica si el tipo de póliza está activo para uso operativo.';


--
-- Name: COLUMN tipos_poliza.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.tipos_poliza.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN tipos_poliza.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.tipos_poliza.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: tipos_poliza_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.tipos_poliza_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tipos_poliza_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.tipos_poliza_id_seq OWNED BY contabilidad.tipos_poliza.id;


--
-- Name: tipos_poliza id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.tipos_poliza ALTER COLUMN id SET DEFAULT nextval('contabilidad.tipos_poliza_id_seq'::regclass);


--
-- Name: tipos_poliza tipos_poliza_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.tipos_poliza
    ADD CONSTRAINT tipos_poliza_pkey PRIMARY KEY (id);


--
-- Name: tipos_poliza uq_tipos_poliza_empresa_identificador; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.tipos_poliza
    ADD CONSTRAINT uq_tipos_poliza_empresa_identificador UNIQUE (empresa_id, identificador);


--
-- Name: CONSTRAINT uq_tipos_poliza_empresa_identificador ON tipos_poliza; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_tipos_poliza_empresa_identificador ON contabilidad.tipos_poliza IS 'Evita duplicar identificadores de tipo de póliza dentro de una misma empresa.';


--
-- Name: tipos_poliza fk_tipos_poliza_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.tipos_poliza
    ADD CONSTRAINT fk_tipos_poliza_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_tipos_poliza_empresa ON tipos_poliza; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_tipos_poliza_empresa ON contabilidad.tipos_poliza IS 'Relaciona el tipo de póliza con su empresa.';


--
-- PostgreSQL database dump complete
--

\unrestrict Ux4F1M8Yq7uLxRb9Vqyz3armWz6vea9r1CBdjpvfRtCScgeP8AEcj7beGk0pUDG

