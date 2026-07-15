-- Schema: contabilidad
-- Table: polizas_detalle
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict fDPR4Edfn6oHRYgAn8RbdzHIiSQ1pi8H3j6wDWihX2l3Qwq4PaT4FOGcQca3ile

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
-- Name: polizas_detalle; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.polizas_detalle (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    poliza_id bigint NOT NULL,
    renglon integer NOT NULL,
    cuenta_id bigint NOT NULL,
    concepto_id bigint,
    cargo numeric(19,2) DEFAULT 0 NOT NULL,
    abono numeric(19,2) DEFAULT 0 NOT NULL,
    fecha date,
    uuid_cfdi uuid,
    rfc character varying(13),
    cuenta_legacy character varying(64),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    concepto_texto character varying(200),
    CONSTRAINT chk_polizas_detalle_cargo_o_abono CHECK ((((cargo > (0)::numeric) AND (abono = (0)::numeric)) OR ((cargo = (0)::numeric) AND (abono > (0)::numeric)))),
    CONSTRAINT chk_polizas_detalle_importes CHECK (((cargo >= (0)::numeric) AND (abono >= (0)::numeric)))
);


--
-- Name: TABLE polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.polizas_detalle IS 'Detalle de movimientos contables de cada póliza.';


--
-- Name: COLUMN polizas_detalle.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.id IS 'Identificador interno del movimiento contable.';


--
-- Name: COLUMN polizas_detalle.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.empresa_id IS 'Empresa a la que pertenece el movimiento contable.';


--
-- Name: COLUMN polizas_detalle.poliza_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.poliza_id IS 'Póliza a la que pertenece el movimiento contable.';


--
-- Name: COLUMN polizas_detalle.renglon; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.renglon IS 'Número de renglón o partida dentro de la póliza.';


--
-- Name: COLUMN polizas_detalle.cuenta_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.cuenta_id IS 'Cuenta contable afectada por el movimiento.';


--
-- Name: COLUMN polizas_detalle.concepto_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.concepto_id IS 'Concepto asociado al movimiento contable. Puede ser nulo.';


--
-- Name: COLUMN polizas_detalle.cargo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.cargo IS 'Importe cargado en la cuenta contable.';


--
-- Name: COLUMN polizas_detalle.abono; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.abono IS 'Importe abonado en la cuenta contable.';


--
-- Name: COLUMN polizas_detalle.fecha; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.fecha IS 'Fecha del movimiento contable, cuando difiera o se requiera a nivel partida.';


--
-- Name: COLUMN polizas_detalle.uuid_cfdi; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.uuid_cfdi IS 'UUID fiscal relacionado con el movimiento contable, cuando aplique.';


--
-- Name: COLUMN polizas_detalle.rfc; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.rfc IS 'RFC relacionado con el movimiento contable, cuando aplique.';


--
-- Name: COLUMN polizas_detalle.cuenta_legacy; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.cuenta_legacy IS 'Cuenta heredada del sistema anterior, usada para importación o auditoría histórica.';


--
-- Name: COLUMN polizas_detalle.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN polizas_detalle.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: COLUMN polizas_detalle.concepto_texto; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.polizas_detalle.concepto_texto IS 'Concepto descriptivo libre del renglón, generado por procesos de contabilización automática (ej. factura de venta) o capturado manualmente. Independiente de concepto_id (catálogo genérico de public.conceptos).';


--
-- Name: CONSTRAINT chk_polizas_detalle_cargo_o_abono ON polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_polizas_detalle_cargo_o_abono ON contabilidad.polizas_detalle IS 'Garantiza que cada movimiento tenga cargo o abono, pero no ambos.';


--
-- Name: CONSTRAINT chk_polizas_detalle_importes ON polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_polizas_detalle_importes ON contabilidad.polizas_detalle IS 'Garantiza que cargo y abono no sean negativos.';


--
-- Name: polizas_detalle_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.polizas_detalle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: polizas_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.polizas_detalle_id_seq OWNED BY contabilidad.polizas_detalle.id;


--
-- Name: polizas_detalle id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas_detalle ALTER COLUMN id SET DEFAULT nextval('contabilidad.polizas_detalle_id_seq'::regclass);


--
-- Name: polizas_detalle polizas_detalle_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas_detalle
    ADD CONSTRAINT polizas_detalle_pkey PRIMARY KEY (id);


--
-- Name: polizas_detalle uq_polizas_detalle_poliza_renglon; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas_detalle
    ADD CONSTRAINT uq_polizas_detalle_poliza_renglon UNIQUE (poliza_id, renglon);


--
-- Name: CONSTRAINT uq_polizas_detalle_poliza_renglon ON polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT uq_polizas_detalle_poliza_renglon ON contabilidad.polizas_detalle IS 'Evita duplicar renglones dentro de una misma póliza.';


--
-- Name: polizas_detalle fk_polizas_detalle_concepto; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas_detalle
    ADD CONSTRAINT fk_polizas_detalle_concepto FOREIGN KEY (concepto_id) REFERENCES public.conceptos(id);


--
-- Name: CONSTRAINT fk_polizas_detalle_concepto ON polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_polizas_detalle_concepto ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con el catálogo general de conceptos.';


--
-- Name: polizas_detalle fk_polizas_detalle_cuenta; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas_detalle
    ADD CONSTRAINT fk_polizas_detalle_cuenta FOREIGN KEY (cuenta_id) REFERENCES contabilidad.cuentas(id);


--
-- Name: CONSTRAINT fk_polizas_detalle_cuenta ON polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_polizas_detalle_cuenta ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con la cuenta afectada.';


--
-- Name: polizas_detalle fk_polizas_detalle_empresa; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas_detalle
    ADD CONSTRAINT fk_polizas_detalle_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: CONSTRAINT fk_polizas_detalle_empresa ON polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_polizas_detalle_empresa ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con su empresa.';


--
-- Name: polizas_detalle fk_polizas_detalle_poliza; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.polizas_detalle
    ADD CONSTRAINT fk_polizas_detalle_poliza FOREIGN KEY (poliza_id) REFERENCES contabilidad.polizas(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT fk_polizas_detalle_poliza ON polizas_detalle; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT fk_polizas_detalle_poliza ON contabilidad.polizas_detalle IS 'Relaciona el movimiento contable con su póliza y lo elimina si se borra la póliza.';


--
-- PostgreSQL database dump complete
--

\unrestrict fDPR4Edfn6oHRYgAn8RbdzHIiSQ1pi8H3j6wDWihX2l3Qwq4PaT4FOGcQca3ile

