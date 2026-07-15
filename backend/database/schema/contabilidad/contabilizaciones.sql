-- Schema: contabilidad
-- Table: contabilizaciones
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict bcoMqnc4obvFqMfe8kq1wBeT5PC07c8tIbu5eD5pZGldhT5tr9Hf6bXsoqePjZi

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
-- Name: contabilizaciones; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.contabilizaciones (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    poliza_id bigint NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    tipo_documento character varying(30) NOT NULL,
    documento_id bigint,
    operacion_dinero_id integer,
    movimiento_inventario_id bigint,
    evento_contable character varying(20) NOT NULL,
    modo_contabilizacion character varying(20) NOT NULL,
    fecha_documento date NOT NULL,
    fecha_contabilizacion timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id integer,
    es_reversa boolean DEFAULT false NOT NULL,
    contabilizacion_origen_id bigint,
    comentario character varying(500),
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_contabilizaciones_evento_contable CHECK (((evento_contable)::text = ANY ((ARRAY['emision'::character varying, 'recepcion'::character varying, 'cobro'::character varying, 'pago'::character varying, 'entrada_inventario'::character varying, 'salida_inventario'::character varying, 'cancelacion'::character varying, 'devolucion'::character varying, 'ajuste'::character varying, 'traspaso'::character varying])::text[]))),
    CONSTRAINT chk_contabilizaciones_modo CHECK (((modo_contabilizacion)::text = ANY ((ARRAY['individual'::character varying, 'lote_individual'::character varying, 'lote_concentrado'::character varying, 'automatico'::character varying])::text[]))),
    CONSTRAINT chk_contabilizaciones_reversa_origen CHECK ((((es_reversa = false) AND (contabilizacion_origen_id IS NULL)) OR ((es_reversa = true) AND (contabilizacion_origen_id IS NOT NULL)))),
    CONSTRAINT chk_contabilizaciones_tipo_movimiento CHECK (((tipo_movimiento)::text = ANY ((ARRAY['venta'::character varying, 'compra'::character varying, 'inventario'::character varying, 'tesoreria'::character varying, 'cobranza'::character varying, 'pago'::character varying, 'ajuste'::character varying])::text[]))),
    CONSTRAINT chk_contabilizaciones_una_referencia CHECK ((((((documento_id IS NOT NULL))::integer + ((operacion_dinero_id IS NOT NULL))::integer) + ((movimiento_inventario_id IS NOT NULL))::integer) = 1))
);


--
-- Name: TABLE contabilizaciones; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.contabilizaciones IS 'Registro de control de la contabilización operativa: liga entidades operativas reales del ERP (documentos de public.documentos, operaciones de dinero de public.finanzas_operaciones o movimientos de inventario de inventario.movimientos) con la póliza contable generada para ellas. No genera pólizas por sí misma; solo documenta el resultado de un proceso de contabilización controlado (individual, lote o concentrado).';


--
-- Name: COLUMN contabilizaciones.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.id IS 'Identificador interno único del registro de contabilización.';


--
-- Name: COLUMN contabilizaciones.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.empresa_id IS 'Empresa propietaria de la contabilización.';


--
-- Name: COLUMN contabilizaciones.poliza_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.poliza_id IS 'Póliza contable generada. Varias filas pueden compartir la misma póliza cuando la contabilización fue concentrada.';


--
-- Name: COLUMN contabilizaciones.tipo_movimiento; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.tipo_movimiento IS 'Familia principal del movimiento: venta, compra, inventario, tesoreria, cobranza, pago o ajuste. No expresa el documento ni el evento (ver tipo_documento y evento_contable).';


--
-- Name: COLUMN contabilizaciones.tipo_documento; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.tipo_documento IS 'Clasificador descriptivo/operativo del origen (por ejemplo factura, nota_credito, cobro, pago, anticipo, transferencia, ajuste_inventario). No es la relación real: la relación real está en documento_id, operacion_dinero_id o movimiento_inventario_id.';


--
-- Name: COLUMN contabilizaciones.documento_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.documento_id IS 'Documento operativo contabilizado. Cubre facturas de venta y compra, notas de crédito, cobros, pagos, anticipos, devoluciones documentadas y ajustes documentales, todos ellos representados en public.documentos.';


--
-- Name: COLUMN contabilizaciones.operacion_dinero_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.operacion_dinero_id IS 'Operación de dinero contabilizada (depósito o retiro de banco/caja) cuando no está representada por un documento en public.documentos. Apunta a public.finanzas_operaciones.';


--
-- Name: COLUMN contabilizaciones.movimiento_inventario_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.movimiento_inventario_id IS 'Movimiento de inventario contabilizado (entrada, salida, traspaso, ajuste o merma) cuando no está representado por un documento en public.documentos. Apunta a inventario.movimientos.';


--
-- Name: COLUMN contabilizaciones.evento_contable; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.evento_contable IS 'Evento contable específico que originó la póliza: emision, recepcion, cobro, pago, entrada_inventario, salida_inventario, cancelacion, devolucion, ajuste o traspaso.';


--
-- Name: COLUMN contabilizaciones.modo_contabilizacion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.modo_contabilizacion IS 'Modo en que se generó la contabilización: individual, lote_individual (una póliza por documento dentro de un proceso por lote), lote_concentrado (una póliza para varios documentos) o automatico (reservado para una fase futura).';


--
-- Name: COLUMN contabilizaciones.fecha_documento; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.fecha_documento IS 'Fecha del documento u operación original, para reportes y validaciones por rango de fechas.';


--
-- Name: COLUMN contabilizaciones.fecha_contabilizacion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.fecha_contabilizacion IS 'Fecha y hora en que se ejecutó el proceso de contabilización.';


--
-- Name: COLUMN contabilizaciones.usuario_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.usuario_id IS 'Usuario que ejecutó la contabilización. Nulo si no se pudo determinar o se generó de forma automática.';


--
-- Name: COLUMN contabilizaciones.es_reversa; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.es_reversa IS 'Indica si esta fila es una reversa contable de otra contabilización (ligada mediante contabilizacion_origen_id) en lugar de una contabilización original.';


--
-- Name: COLUMN contabilizaciones.contabilizacion_origen_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.contabilizacion_origen_id IS 'Contabilización original que esta fila reversa. Obligatorio cuando es_reversa es true; debe ser nulo en caso contrario.';


--
-- Name: COLUMN contabilizaciones.comentario; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.comentario IS 'Comentario libre sobre la contabilización o la reversa, por ejemplo el motivo de la cancelación.';


--
-- Name: COLUMN contabilizaciones.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN contabilizaciones.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.contabilizaciones.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: CONSTRAINT chk_contabilizaciones_una_referencia ON contabilizaciones; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON CONSTRAINT chk_contabilizaciones_una_referencia ON contabilidad.contabilizaciones IS 'Obliga a que cada fila tenga exactamente una referencia operativa: documento_id, operacion_dinero_id o movimiento_inventario_id.';


--
-- Name: contabilizaciones_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.contabilizaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contabilizaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.contabilizaciones_id_seq OWNED BY contabilidad.contabilizaciones.id;


--
-- Name: contabilizaciones id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones ALTER COLUMN id SET DEFAULT nextval('contabilidad.contabilizaciones_id_seq'::regclass);


--
-- Name: contabilizaciones contabilizaciones_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_pkey PRIMARY KEY (id);


--
-- Name: idx_contabilizaciones_documento; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_documento ON contabilidad.contabilizaciones USING btree (documento_id) WHERE (documento_id IS NOT NULL);


--
-- Name: idx_contabilizaciones_empresa; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_empresa ON contabilidad.contabilizaciones USING btree (empresa_id);


--
-- Name: idx_contabilizaciones_evento_contable; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_evento_contable ON contabilidad.contabilizaciones USING btree (evento_contable);


--
-- Name: idx_contabilizaciones_fecha_contabilizacion; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_fecha_contabilizacion ON contabilidad.contabilizaciones USING btree (fecha_contabilizacion);


--
-- Name: idx_contabilizaciones_fecha_documento; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_fecha_documento ON contabilidad.contabilizaciones USING btree (fecha_documento);


--
-- Name: idx_contabilizaciones_movimiento_inventario; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_movimiento_inventario ON contabilidad.contabilizaciones USING btree (movimiento_inventario_id) WHERE (movimiento_inventario_id IS NOT NULL);


--
-- Name: idx_contabilizaciones_operacion_dinero; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_operacion_dinero ON contabilidad.contabilizaciones USING btree (operacion_dinero_id) WHERE (operacion_dinero_id IS NOT NULL);


--
-- Name: idx_contabilizaciones_origen; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_origen ON contabilidad.contabilizaciones USING btree (contabilizacion_origen_id);


--
-- Name: idx_contabilizaciones_poliza; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_poliza ON contabilidad.contabilizaciones USING btree (poliza_id);


--
-- Name: idx_contabilizaciones_tipo_documento; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_tipo_documento ON contabilidad.contabilizaciones USING btree (tipo_documento);


--
-- Name: idx_contabilizaciones_tipo_movimiento; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_contabilizaciones_tipo_movimiento ON contabilidad.contabilizaciones USING btree (tipo_movimiento);


--
-- Name: ux_contabilizaciones_documento_evento_activa; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE UNIQUE INDEX ux_contabilizaciones_documento_evento_activa ON contabilidad.contabilizaciones USING btree (empresa_id, documento_id, evento_contable) WHERE ((documento_id IS NOT NULL) AND (es_reversa = false));


--
-- Name: INDEX ux_contabilizaciones_documento_evento_activa; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.ux_contabilizaciones_documento_evento_activa IS 'Impide duplicar una contabilización activa (no reversa) para el mismo documento y evento contable dentro de una empresa.';


--
-- Name: ux_contabilizaciones_movimiento_inventario_evento_activa; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE UNIQUE INDEX ux_contabilizaciones_movimiento_inventario_evento_activa ON contabilidad.contabilizaciones USING btree (empresa_id, movimiento_inventario_id, evento_contable) WHERE ((movimiento_inventario_id IS NOT NULL) AND (es_reversa = false));


--
-- Name: INDEX ux_contabilizaciones_movimiento_inventario_evento_activa; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.ux_contabilizaciones_movimiento_inventario_evento_activa IS 'Impide duplicar una contabilización activa (no reversa) para el mismo movimiento de inventario y evento contable dentro de una empresa.';


--
-- Name: ux_contabilizaciones_operacion_dinero_evento_activa; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE UNIQUE INDEX ux_contabilizaciones_operacion_dinero_evento_activa ON contabilidad.contabilizaciones USING btree (empresa_id, operacion_dinero_id, evento_contable) WHERE ((operacion_dinero_id IS NOT NULL) AND (es_reversa = false));


--
-- Name: INDEX ux_contabilizaciones_operacion_dinero_evento_activa; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.ux_contabilizaciones_operacion_dinero_evento_activa IS 'Impide duplicar una contabilización activa (no reversa) para la misma operación de dinero y evento contable dentro de una empresa.';


--
-- Name: ux_contabilizaciones_origen_reversa; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE UNIQUE INDEX ux_contabilizaciones_origen_reversa ON contabilidad.contabilizaciones USING btree (contabilizacion_origen_id) WHERE (es_reversa = true);


--
-- Name: INDEX ux_contabilizaciones_origen_reversa; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON INDEX contabilidad.ux_contabilizaciones_origen_reversa IS 'Impide registrar más de una reversa para la misma contabilización original.';


--
-- Name: contabilizaciones contabilizaciones_contabilizacion_origen_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_contabilizacion_origen_id_fkey FOREIGN KEY (contabilizacion_origen_id) REFERENCES contabilidad.contabilizaciones(id);


--
-- Name: contabilizaciones contabilizaciones_documento_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- Name: contabilizaciones contabilizaciones_empresa_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: contabilizaciones contabilizaciones_movimiento_inventario_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_movimiento_inventario_id_fkey FOREIGN KEY (movimiento_inventario_id) REFERENCES inventario.movimientos(id);


--
-- Name: contabilizaciones contabilizaciones_operacion_dinero_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_operacion_dinero_id_fkey FOREIGN KEY (operacion_dinero_id) REFERENCES public.finanzas_operaciones(id);


--
-- Name: contabilizaciones contabilizaciones_poliza_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_poliza_id_fkey FOREIGN KEY (poliza_id) REFERENCES contabilidad.polizas(id);


--
-- Name: contabilizaciones contabilizaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.contabilizaciones
    ADD CONSTRAINT contabilizaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict bcoMqnc4obvFqMfe8kq1wBeT5PC07c8tIbu5eD5pZGldhT5tr9Hf6bXsoqePjZi

