-- Schema: public
-- Table: productos
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
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    clave character varying(50) NOT NULL,
    descripcion character varying(150) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    clasificacion character varying(50),
    tipo_producto character varying(30) NOT NULL,
    familia character varying(50),
    linea character varying(50),
    presentacion character varying(50),
    unidad_compra character varying(20),
    factor_conversion numeric(15,6),
    existencia_actual numeric(15,4),
    minimo_inventario numeric(15,4),
    costo_estandar numeric(19,6),
    costo_promedio numeric(19,6),
    ultimo_costo numeric(19,6),
    precio_publico numeric(15,2),
    precio_mayoreo numeric(15,2),
    precio_menudeo numeric(15,2),
    precio_distribuidor numeric(15,2),
    iva_porcentaje numeric(5,2),
    ieps_porcentaje numeric(5,2),
    retiene_iva boolean DEFAULT false,
    retiene_isr boolean DEFAULT false,
    clave_producto_sat character varying(20),
    fraccion_arancelaria character varying(15),
    largo numeric(9,3),
    ancho numeric(9,3),
    alto numeric(9,3),
    espesor numeric(9,3),
    diametro numeric(9,3),
    peso_unitario numeric(9,3),
    equivalente_m2 numeric(9,3),
    piezas_por_empaque numeric(9,2),
    peso_por_empaque numeric(9,2),
    unidad_peso_empaque character varying(20),
    ubicacion_almacen character varying(50),
    proveedor_principal_id integer,
    proveedor_alternativo_1_id integer,
    proveedor_alternativo_2_id integer,
    archivo_fotografia_1 character varying(255),
    archivo_fotografia_2 character varying(255),
    archivo_ficha_tecnica character varying(255),
    archivo_certificado character varying(255),
    es_estacional boolean DEFAULT false,
    demanda_mensual_estimado numeric(11,2),
    factor_demanda numeric(7,2),
    observaciones text,
    observaciones_compras text,
    observaciones_diseno text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    empresa_id integer NOT NULL,
    unidad_venta_id integer,
    unidad_inventario_id integer,
    clave_unidad_sat character varying(10)
);


--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: productos uq_productos_empresa_clave; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT uq_productos_empresa_clave UNIQUE (empresa_id, clave);


--
-- Name: ix_productos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_productos_empresa ON public.productos USING btree (empresa_id);


--
-- Name: productos fk_producto_unidad_inventario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_producto_unidad_inventario FOREIGN KEY (unidad_inventario_id) REFERENCES public.unidades(id);


--
-- Name: productos fk_producto_unidad_venta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_producto_unidad_venta FOREIGN KEY (unidad_venta_id) REFERENCES public.unidades(id);


--
-- PostgreSQL database dump complete
--

