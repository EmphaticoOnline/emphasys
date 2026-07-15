-- Schema: contabilidad
-- Table: documentos_polizas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 7woaP4buHtTaVFDNvkNnvWL49hUaalSL4Jkq0jG9PMnihYTCx9nw7mrqikxOIAd

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
-- Name: documentos_polizas; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.documentos_polizas (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    documento_id bigint NOT NULL,
    poliza_id bigint NOT NULL,
    tipo character varying(20) DEFAULT 'original'::character varying NOT NULL,
    documento_poliza_original_id bigint,
    codigo_poliza_legacy character varying(16),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_documentos_polizas_tipo CHECK (((tipo)::text = ANY ((ARRAY['original'::character varying, 'cancelacion'::character varying, 'reversa'::character varying, 'ajuste'::character varying])::text[])))
);


--
-- Name: TABLE documentos_polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.documentos_polizas IS 'Relación entre documentos operativos del ERP y las pólizas contables generadas.';


--
-- Name: COLUMN documentos_polizas.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.id IS 'Identificador interno de la relación entre documento y póliza.';


--
-- Name: COLUMN documentos_polizas.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.empresa_id IS 'Empresa a la que pertenece la relación.';


--
-- Name: COLUMN documentos_polizas.documento_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.documento_id IS 'Documento operativo relacionado con la póliza.';


--
-- Name: COLUMN documentos_polizas.poliza_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.poliza_id IS 'Póliza contable relacionada con el documento.';


--
-- Name: COLUMN documentos_polizas.tipo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.tipo IS 'Tipo de relación entre documento y póliza: original, cancelacion, reversa o ajuste.';


--
-- Name: COLUMN documentos_polizas.documento_poliza_original_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.documento_poliza_original_id IS 'Relación original asociada cuando este registro corresponde a una cancelación, reversa o ajuste.';


--
-- Name: COLUMN documentos_polizas.codigo_poliza_legacy; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.codigo_poliza_legacy IS 'Código de póliza heredado del sistema anterior, usado para importación o auditoría histórica.';


--
-- Name: COLUMN documentos_polizas.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.documentos_polizas.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: CONSTRAINT chk_documentos_polizas_tipo ON documentos_polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_documentos_polizas_tipo ON contabilidad.documentos_polizas IS 'Limita los tipos permitidos de relación entre documento y póliza.';


--
-- Name: documentos_polizas_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.documentos_polizas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_polizas_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.documentos_polizas_id_seq OWNED BY contabilidad.documentos_polizas.id;


--
-- Name: documentos_polizas id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.documentos_polizas ALTER COLUMN id SET DEFAULT nextval('contabilidad.documentos_polizas_id_seq'::regclass);


--
-- Name: documentos_polizas documentos_polizas_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.documentos_polizas
    ADD CONSTRAINT documentos_polizas_pkey PRIMARY KEY (id);


--
-- Name: idx_documentos_polizas_documento; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_documentos_polizas_documento ON contabilidad.documentos_polizas USING btree (documento_id);


--
-- Name: INDEX idx_documentos_polizas_documento; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.idx_documentos_polizas_documento IS 'Índice para consultar pólizas relacionadas a un documento operativo.';


--
-- Name: idx_documentos_polizas_empresa_documento_tipo; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_documentos_polizas_empresa_documento_tipo ON contabilidad.documentos_polizas USING btree (empresa_id, documento_id, tipo);


--
-- Name: INDEX idx_documentos_polizas_empresa_documento_tipo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.idx_documentos_polizas_empresa_documento_tipo IS 'Índice para determinar rápidamente si un documento de una empresa tiene póliza original, cancelación, reversa o ajuste.';


--
-- Name: idx_documentos_polizas_poliza; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_documentos_polizas_poliza ON contabilidad.documentos_polizas USING btree (poliza_id);


--
-- Name: INDEX idx_documentos_polizas_poliza; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.idx_documentos_polizas_poliza IS 'Índice para consultar documentos relacionados a una póliza contable.';


--
-- Name: uq_documentos_polizas_documento_poliza_tipo; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE UNIQUE INDEX uq_documentos_polizas_documento_poliza_tipo ON contabilidad.documentos_polizas USING btree (documento_id, poliza_id, tipo);


--
-- Name: INDEX uq_documentos_polizas_documento_poliza_tipo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.uq_documentos_polizas_documento_poliza_tipo IS 'Evita duplicar una misma relación entre documento, póliza y tipo.';


--
-- Name: documentos_polizas fk_documentos_polizas_documento; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.documentos_polizas
    ADD CONSTRAINT fk_documentos_polizas_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT fk_documentos_polizas_documento ON documentos_polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_documentos_polizas_documento ON contabilidad.documentos_polizas IS 'Relaciona la póliza con el documento operativo y elimina el enlace si se borra el documento.';


--
-- Name: documentos_polizas fk_documentos_polizas_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.documentos_polizas
    ADD CONSTRAINT fk_documentos_polizas_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_documentos_polizas_empresa ON documentos_polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_documentos_polizas_empresa ON contabilidad.documentos_polizas IS 'Relaciona la relación documento-póliza con su empresa.';


--
-- Name: documentos_polizas fk_documentos_polizas_original; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.documentos_polizas
    ADD CONSTRAINT fk_documentos_polizas_original FOREIGN KEY (documento_poliza_original_id) REFERENCES contabilidad.documentos_polizas(id);


--
-- Name: CONSTRAINT fk_documentos_polizas_original ON documentos_polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_documentos_polizas_original ON contabilidad.documentos_polizas IS 'Permite ligar una póliza de cancelación, reversa o ajuste con la relación original.';


--
-- Name: documentos_polizas fk_documentos_polizas_poliza; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.documentos_polizas
    ADD CONSTRAINT fk_documentos_polizas_poliza FOREIGN KEY (poliza_id) REFERENCES contabilidad.polizas(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT fk_documentos_polizas_poliza ON documentos_polizas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_documentos_polizas_poliza ON contabilidad.documentos_polizas IS 'Relaciona el documento con la póliza y elimina el enlace si se borra la póliza.';


--
-- PostgreSQL database dump complete
--

\unrestrict 7woaP4buHtTaVFDNvkNnvWL49hUaalSL4Jkq0jG9PMnihYTCx9nw7mrqikxOIAd

