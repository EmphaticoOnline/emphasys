-- Schema: public
-- Table: aplicaciones_saldo
-- Generated automatically

--
-- PostgreSQL database dump
--

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 17.3

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
-- Name: aplicaciones_saldo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aplicaciones_saldo (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    finanzas_operacion_id integer,
    documento_origen_id integer,
    documento_destino_id integer NOT NULL,
    monto numeric(15,2) NOT NULL,
    monto_moneda_documento numeric(15,2) NOT NULL,
    fecha_aplicacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_aplicaciones_saldo_origen CHECK ((((finanzas_operacion_id IS NOT NULL) AND (documento_origen_id IS NULL)) OR ((finanzas_operacion_id IS NULL) AND (documento_origen_id IS NOT NULL))))
);


--
-- Name: TABLE aplicaciones_saldo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.aplicaciones_saldo IS 'Registra aplicaciones de saldo desde pagos o notas de crédito hacia documentos destino (por ejemplo facturas). Soporta multimoneda.';


--
-- Name: COLUMN aplicaciones_saldo.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.id IS 'Identificador único de la aplicación.';


--
-- Name: COLUMN aplicaciones_saldo.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.empresa_id IS 'Empresa a la que pertenece la aplicación (soporte multiempresa).';


--
-- Name: COLUMN aplicaciones_saldo.finanzas_operacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.finanzas_operacion_id IS 'Origen de la aplicación cuando proviene de una operación financiera (pago de banco o caja).';


--
-- Name: COLUMN aplicaciones_saldo.documento_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.documento_origen_id IS 'Origen de la aplicación cuando proviene de un documento (por ejemplo una nota de crédito).';


--
-- Name: COLUMN aplicaciones_saldo.documento_destino_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.documento_destino_id IS 'Documento que recibe la aplicación de saldo (normalmente una factura).';


--
-- Name: COLUMN aplicaciones_saldo.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.monto IS 'Monto aplicado en moneda base del sistema (por ejemplo MXN). Se descuenta del saldo del origen.';


--
-- Name: COLUMN aplicaciones_saldo.monto_moneda_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.monto_moneda_documento IS 'Monto aplicado expresado en la moneda del documento destino. Se utiliza para calcular el saldo del documento destino.';


--
-- Name: COLUMN aplicaciones_saldo.fecha_aplicacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.fecha_aplicacion IS 'Fecha efectiva en la que se realiza la aplicación del saldo.';


--
-- Name: COLUMN aplicaciones_saldo.fecha_creacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.aplicaciones_saldo.fecha_creacion IS 'Fecha en que se creó el registro de la aplicación en el sistema.';


--
-- Name: aplicaciones_saldo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aplicaciones_saldo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aplicaciones_saldo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aplicaciones_saldo_id_seq OWNED BY public.aplicaciones_saldo.id;


--
-- Name: aplicaciones_saldo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo ALTER COLUMN id SET DEFAULT nextval('public.aplicaciones_saldo_id_seq'::regclass);


--
-- Name: aplicaciones_saldo aplicaciones_saldo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT aplicaciones_saldo_pkey PRIMARY KEY (id);


--
-- Name: idx_aplicaciones_saldo_doc_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_saldo_doc_destino ON public.aplicaciones_saldo USING btree (documento_destino_id);


--
-- Name: INDEX idx_aplicaciones_saldo_doc_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_saldo_doc_destino IS 'Optimiza consultas para calcular saldo pendiente de documentos destino (facturas).';


--
-- Name: idx_aplicaciones_saldo_doc_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_saldo_doc_origen ON public.aplicaciones_saldo USING btree (documento_origen_id);


--
-- Name: INDEX idx_aplicaciones_saldo_doc_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_saldo_doc_origen IS 'Optimiza consultas para calcular saldo disponible de notas de crédito.';


--
-- Name: idx_aplicaciones_saldo_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_saldo_empresa ON public.aplicaciones_saldo USING btree (empresa_id);


--
-- Name: INDEX idx_aplicaciones_saldo_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_saldo_empresa IS 'Permite filtrar rápidamente aplicaciones por empresa.';


--
-- Name: idx_aplicaciones_saldo_operacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_saldo_operacion ON public.aplicaciones_saldo USING btree (finanzas_operacion_id);


--
-- Name: INDEX idx_aplicaciones_saldo_operacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aplicaciones_saldo_operacion IS 'Optimiza consultas para calcular saldo de operaciones financieras (pagos).';


--
-- Name: idx_aplicaciones_saldo_operacion_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aplicaciones_saldo_operacion_empresa ON public.aplicaciones_saldo USING btree (empresa_id, finanzas_operacion_id);


--
-- Name: aplicaciones_saldo fk_aplicaciones_saldo_doc_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_saldo_doc_destino FOREIGN KEY (documento_destino_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones_saldo fk_aplicaciones_saldo_doc_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_saldo_doc_origen FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones_saldo fk_aplicaciones_saldo_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_saldo_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: aplicaciones_saldo fk_aplicaciones_saldo_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_saldo
    ADD CONSTRAINT fk_aplicaciones_saldo_operacion FOREIGN KEY (finanzas_operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--