-- Schema: public
-- Table: documentos
-- Generated automatically

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3
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
    moneda character varying(10) NOT NULL,
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
    es_nota boolean DEFAULT false NOT NULL,
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
    codigo_postal_receptor character varying(10)
);


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
-- PostgreSQL database dump complete
--

