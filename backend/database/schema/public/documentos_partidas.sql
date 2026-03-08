-- Schema: public
-- Table: documentos_partidas
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
-- Name: documentos_partidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_partidas (
    id integer NOT NULL,
    documento_id integer NOT NULL,
    numero_partida integer NOT NULL,
    producto_id integer,
    descripcion_alterna character varying(255),
    cantidad numeric(15,6) NOT NULL,
    unidad character varying(20),
    factor_conversion numeric(11,4),
    cantidad_inventariable numeric(15,6),
    precio_unitario numeric(15,6) NOT NULL,
    descuento numeric(9,4),
    subtotal_partida numeric(15,2) NOT NULL,
    iva_porcentaje numeric(9,4),
    iva_monto numeric(15,2),
    ieps_porcentaje numeric(9,4),
    ieps_monto numeric(15,2),
    retencion_iva_porcentaje numeric(9,4),
    retencion_iva_monto numeric(15,2),
    retencion_isr_porcentaje numeric(9,4),
    retencion_isr_monto numeric(15,2),
    total_partida numeric(15,2) NOT NULL,
    costo numeric(15,6),
    costo_indirecto numeric(15,6),
    cantidad_entregada numeric(15,6),
    cantidad_facturada numeric(15,6),
    cantidad_cancelada numeric(15,6),
    cantidad_devuelta numeric(15,6),
    cantidad_en_entrada numeric(15,6),
    saldo_cantidad numeric(15,6),
    es_gasto boolean DEFAULT false NOT NULL,
    es_componente boolean DEFAULT false NOT NULL,
    partida_padre_id integer,
    partida_origen_id integer,
    titulo_agrupador character varying(70),
    archivo_imagen_1 character varying(255),
    archivo_imagen_2 character varying(255),
    observaciones text,
    comentarios_internos text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_modificacion timestamp with time zone
);


--
-- Name: documentos_partidas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_partidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_partidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_partidas_id_seq OWNED BY public.documentos_partidas.id;


--
-- Name: documentos_partidas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_id_seq'::regclass);


--
-- Name: documentos_partidas documentos_partidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT documentos_partidas_pkey PRIMARY KEY (id);


--
-- Name: documentos_partidas fk_partida_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partida_origen FOREIGN KEY (partida_origen_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: documentos_partidas fk_partida_padre; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partida_padre FOREIGN KEY (partida_padre_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: documentos_partidas fk_partidas_documento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partidas_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas fk_partidas_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas
    ADD CONSTRAINT fk_partidas_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

