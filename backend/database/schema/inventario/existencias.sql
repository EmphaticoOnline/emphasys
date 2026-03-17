-- Schema: inventario
-- Table: existencias
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
-- Name: existencias; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.existencias (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    producto_id integer NOT NULL,
    almacen_id integer NOT NULL,
    existencia numeric(18,6) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE existencias; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.existencias IS 'Existencias actuales por producto y almacén. Permite consultas rápidas sin recorrer todo el kardex.';


--
-- Name: COLUMN existencias.id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.id IS 'Identificador único del registro de existencias.';


--
-- Name: COLUMN existencias.empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.empresa_id IS 'Empresa propietaria del registro de existencias.';


--
-- Name: COLUMN existencias.producto_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.producto_id IS 'Producto al que corresponde la existencia.';


--
-- Name: COLUMN existencias.almacen_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.almacen_id IS 'Almacén donde se controla la existencia. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';


--
-- Name: COLUMN existencias.existencia; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.existencia IS 'Cantidad actual disponible del producto en el almacén.';


--
-- Name: COLUMN existencias.updated_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.existencias.updated_at IS 'Fecha y hora de última actualización del registro de existencias.';


--
-- Name: existencias_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.existencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: existencias_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.existencias_id_seq OWNED BY inventario.existencias.id;


--
-- Name: existencias id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias ALTER COLUMN id SET DEFAULT nextval('inventario.existencias_id_seq'::regclass);


--
-- Name: existencias existencias_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT existencias_pkey PRIMARY KEY (id);


--
-- Name: existencias uq_inv_existencias_empresa_producto_almacen; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT uq_inv_existencias_empresa_producto_almacen UNIQUE (empresa_id, producto_id, almacen_id);


--
-- Name: idx_inv_existencias_lookup; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_existencias_lookup ON inventario.existencias USING btree (empresa_id, producto_id, almacen_id);


--
-- Name: INDEX idx_inv_existencias_lookup; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_existencias_lookup IS 'Índice para consultas rápidas de existencias por empresa, producto y almacén.';


--
-- Name: existencias fk_inv_exist_empresa; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT fk_inv_exist_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: existencias fk_inv_exist_producto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.existencias
    ADD CONSTRAINT fk_inv_exist_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

