-- Schema: public
-- Table: finanzas_aplicaciones
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict 86pyHf7yF2SOkCqM1ryHwUaIJe4LyyLXzjmcVr1vOLxkjQiP35RzgF2vgbNVx5V

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
-- Name: finanzas_aplicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finanzas_aplicaciones (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    operacion_id integer NOT NULL,
    documento_id integer NOT NULL,
    monto numeric(15,2) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE finanzas_aplicaciones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.finanzas_aplicaciones IS 'Relación entre operaciones financieras y documentos. Permite aplicar pagos o cobros a facturas, pedidos u otros documentos.';


--
-- Name: COLUMN finanzas_aplicaciones.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.empresa_id IS 'Empresa propietaria del registro.';


--
-- Name: COLUMN finanzas_aplicaciones.operacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.operacion_id IS 'Operación financiera que aplica el pago o cobro.';


--
-- Name: COLUMN finanzas_aplicaciones.documento_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.documento_id IS 'Documento al que se aplica el monto (ej. factura).';


--
-- Name: COLUMN finanzas_aplicaciones.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.monto IS 'Monto aplicado del pago o cobro al documento.';


--
-- Name: COLUMN finanzas_aplicaciones.fecha_creacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.finanzas_aplicaciones.fecha_creacion IS 'Fecha de creación del registro.';


--
-- Name: finanzas_aplicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finanzas_aplicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finanzas_aplicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finanzas_aplicaciones_id_seq OWNED BY public.finanzas_aplicaciones.id;


--
-- Name: finanzas_aplicaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones ALTER COLUMN id SET DEFAULT nextval('public.finanzas_aplicaciones_id_seq'::regclass);


--
-- Name: finanzas_aplicaciones finanzas_aplicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones
    ADD CONSTRAINT finanzas_aplicaciones_pkey PRIMARY KEY (id);


--
-- Name: idx_fa_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_documento ON public.finanzas_aplicaciones USING btree (documento_id);


--
-- Name: INDEX idx_fa_documento; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_fa_documento IS 'Permite localizar rápidamente los pagos aplicados a un documento.';


--
-- Name: idx_fa_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_empresa ON public.finanzas_aplicaciones USING btree (empresa_id);


--
-- Name: INDEX idx_fa_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_fa_empresa IS 'Optimiza consultas multiempresa en aplicaciones financieras.';


--
-- Name: idx_fa_operacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fa_operacion ON public.finanzas_aplicaciones USING btree (operacion_id);


--
-- Name: INDEX idx_fa_operacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_fa_operacion IS 'Permite localizar rápidamente las aplicaciones de una operación financiera.';


--
-- Name: finanzas_aplicaciones fk_fa_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones
    ADD CONSTRAINT fk_fa_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE RESTRICT;


--
-- Name: finanzas_aplicaciones fk_fa_operacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finanzas_aplicaciones
    ADD CONSTRAINT fk_fa_operacion FOREIGN KEY (operacion_id) REFERENCES public.finanzas_operaciones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 86pyHf7yF2SOkCqM1ryHwUaIJe4LyyLXzjmcVr1vOLxkjQiP35RzgF2vgbNVx5V

