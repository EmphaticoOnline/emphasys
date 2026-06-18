-- Schema: public
-- Table: documentos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict jn26wNz1jqMuGSRncziEAW1gyHPLL52DdAfCo7saGwtX0L8JDXvbGhSjOpkzYTk

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
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
-- Name: documentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos (
    id integer NOT NULL,
    tipo_documento character varying(30) NOT NULL,
    estatus_documento character varying(30) NOT NULL,
    serie character varying(10),
    numero integer,
    empresa_id integer NOT NULL,
    almacen_id integer,
    contacto_principal_id integer NOT NULL,
    contacto_facturacion_id integer,
    contacto_entrega_id integer,
    agente_id integer,
    fecha_documento date NOT NULL,
    fecha_vencimiento date,
    fecha_entrega date,
    fecha_cancelacion date,
    moneda character varying(10) DEFAULT 'MXN'::character varying NOT NULL,
    tipo_cambio numeric(9,4),
    subtotal numeric(15,2) NOT NULL,
    descuento_global numeric(9,4),
    descuento numeric(15,2),
    iva numeric(15,2),
    ieps numeric(15,2),
    retencion_iva numeric(15,2),
    retencion_isr numeric(15,2),
    total numeric(15,2) NOT NULL,
    saldo numeric(15,2),
    domicilio_entrega_id integer,
    fletera_id integer,
    observaciones text,
    comentarios_internos text,
    documento_origen_id integer,
    documento_padre_id integer,
    documento_relacionado_id integer,
    es_restitucion boolean DEFAULT false NOT NULL,
    es_publico_general boolean DEFAULT false NOT NULL,
    usuario_creacion_id integer NOT NULL,
    usuario_modificacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_modificacion timestamp with time zone,
    rfc_receptor character varying(13),
    nombre_receptor text,
    regimen_fiscal_receptor text,
    uso_cfdi text,
    forma_pago text,
    metodo_pago text,
    codigo_postal_receptor character varying(10),
    tratamiento_impuestos character varying(30) DEFAULT 'normal'::character varying NOT NULL,
    estado_seguimiento text DEFAULT 'borrador'::text,
    comentario_seguimiento text,
    producto_resumen text,
    oportunidad_id integer,
    motivo_nc character varying(20),
    concepto_id integer,
    finanzas_operacion_id integer,
    periodicidad_global character varying(2) DEFAULT NULL::character varying,
    meses_global character varying(2) DEFAULT NULL::character varying,
    anio_global smallint,
    factura_global_id integer,
    usuario_cancelacion_id integer,
    motivo_cancelacion text,
    motivo_sat character varying(2),
    uuid_sustitucion character varying(36),
    estado_autorizacion character varying(20) DEFAULT 'no_requerida'::character varying,
    CONSTRAINT chk_documentos_motivo_nc CHECK (((motivo_nc IS NULL) OR ((motivo_nc)::text = ANY ((ARRAY['devolucion'::character varying, 'bonificacion'::character varying, 'otro'::character varying])::text[])))),
    CONSTRAINT documentos_estado_autorizacion_check CHECK (((estado_autorizacion)::text = ANY ((ARRAY['no_requerida'::character varying, 'pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying])::text[])))
);


--
-- Name: TABLE documentos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos IS 'Tabla universal de documentos del ERP (cotizaciones, pedidos, facturas, etc.).';


--
-- Name: COLUMN documentos.tratamiento_impuestos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.tratamiento_impuestos IS 'Define el tratamiento fiscal del documento. Valores esperados: normal, sin_iva, tasa_cero, exento, venta_publico_general, factura_global. Determina cómo se calculan los impuestos y el tratamiento fiscal/operativo del documento.';


--
-- Name: COLUMN documentos.motivo_nc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.motivo_nc IS 'Motivo de la nota de crédito. Valores esperados: devolucion, bonificacion, otro.';


--
-- Name: COLUMN documentos.concepto_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.concepto_id IS 'Concepto contable/comercial asociado al documento. Utilizado para contabilización y clasificación.';


--
-- Name: COLUMN documentos.periodicidad_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.periodicidad_global IS 'Código SAT de periodicidad para factura global: 01=Diario, 02=Semanal, 03=Quincenal, 04=Mensual, 05=Bimestral';


--
-- Name: COLUMN documentos.meses_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.meses_global IS 'Código SAT de mes(es) para factura global: 01-12 mensual, 13-18 bimestral';


--
-- Name: COLUMN documentos.anio_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.anio_global IS 'Año de la factura global (4 dígitos)';


--
-- Name: COLUMN documentos.factura_global_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.factura_global_id IS 'Para ventas publico_general: ID de la factura global que las incluye. Evita doble agrupación.';


--
-- Name: COLUMN documentos.usuario_cancelacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.usuario_cancelacion_id IS 'Usuario que ejecutó la cancelación del documento';


--
-- Name: COLUMN documentos.motivo_cancelacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.motivo_cancelacion IS 'Motivo interno de cancelación capturado por el usuario';


--
-- Name: COLUMN documentos.motivo_sat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.motivo_sat IS 'Motivo SAT de cancelación CFDI (ejemplo: 01, 02, 03, 04)';


--
-- Name: COLUMN documentos.uuid_sustitucion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.uuid_sustitucion IS 'UUID del CFDI sustituto cuando el motivo SAT requiere sustitución';


--
-- Name: COLUMN documentos.estado_autorizacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos.estado_autorizacion IS 'Ciclo de vida de autorización del documento. Valores: no_requerida (sin política activa o modo ninguna/directa), pendiente (solicitud de flujo creada y en espera), aprobada (autorizador aprobó; habilita re-ejecución de la transición), rechazada (autorizador rechazó). Solo modo=flujo transiciona entre pendiente/aprobada/rechazada; los otros modos permanecen en no_requerida.';


--
-- Name: documentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_id_seq OWNED BY public.documentos.id;


--
-- Name: documentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos ALTER COLUMN id SET DEFAULT nextval('public.documentos_id_seq'::regclass);


--
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (id);


--
-- Name: documentos_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documentos_unico ON public.documentos USING btree (empresa_id, lower((tipo_documento)::text), COALESCE(serie, ''::character varying), numero);


--
-- Name: idx_documentos_concepto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_concepto_id ON public.documentos USING btree (concepto_id);


--
-- Name: idx_documentos_estado_seguimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_estado_seguimiento ON public.documentos USING btree (estado_seguimiento);


--
-- Name: idx_documentos_factura_global_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_factura_global_id ON public.documentos USING btree (factura_global_id) WHERE (factura_global_id IS NOT NULL);


--
-- Name: idx_documentos_motivo_nc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_motivo_nc ON public.documentos USING btree (motivo_nc);


--
-- Name: idx_documentos_oportunidad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_oportunidad_id ON public.documentos USING btree (oportunidad_id);


--
-- Name: idx_documentos_publico_general_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_publico_general_pendiente ON public.documentos USING btree (empresa_id, tratamiento_impuestos, es_publico_general, factura_global_id) WHERE (((tipo_documento)::text = 'factura'::text) AND ((tratamiento_impuestos)::text = 'venta_publico_general'::text) AND (es_publico_general = true) AND (factura_global_id IS NULL));


--
-- Name: documentos documentos_finanzas_operacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_finanzas_operacion_id_fkey FOREIGN KEY (finanzas_operacion_id) REFERENCES public.finanzas_operaciones(id);


--
-- Name: documentos fk_documentos_concepto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_concepto FOREIGN KEY (concepto_id) REFERENCES public.conceptos(id) ON DELETE RESTRICT;


--
-- Name: documentos fk_documentos_factura_global; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_factura_global FOREIGN KEY (factura_global_id) REFERENCES public.documentos(id) ON DELETE SET NULL;


--
-- Name: documentos fk_documentos_forma_pago; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_forma_pago FOREIGN KEY (forma_pago) REFERENCES sat.formas_pago(id);


--
-- Name: documentos fk_documentos_metodo_pago; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_metodo_pago FOREIGN KEY (metodo_pago) REFERENCES sat.metodos_pago(id);


--
-- Name: documentos fk_documentos_regimen_fiscal; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_regimen_fiscal FOREIGN KEY (regimen_fiscal_receptor) REFERENCES sat.regimenes_fiscales(id);


--
-- Name: documentos fk_documentos_uso_cfdi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_uso_cfdi FOREIGN KEY (uso_cfdi) REFERENCES sat.usos_cfdi(id);


--
-- Name: documentos fk_documentos_usuario_cancelacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_usuario_cancelacion FOREIGN KEY (usuario_cancelacion_id) REFERENCES core.usuarios(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict jn26wNz1jqMuGSRncziEAW1gyHPLL52DdAfCo7saGwtX0L8JDXvbGhSjOpkzYTk

