-- Schema: inventario
-- Table: movimientos
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
-- Name: movimientos; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimientos (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    documento_id bigint,
    usuario_id bigint,
    tipo_movimiento character varying(30) NOT NULL,
    fecha timestamp with time zone NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    es_reversion boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE movimientos; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.movimientos IS 'Encabezado de movimientos de inventario. Representa una transacción que afecta existencias, ya sea originada por documento o por captura independiente.';


--
-- Name: COLUMN movimientos.id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.id IS 'Identificador único del movimiento de inventario.';


--
-- Name: COLUMN movimientos.empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.empresa_id IS 'Empresa propietaria del movimiento.';


--
-- Name: COLUMN movimientos.documento_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.documento_id IS 'Documento origen que generó el movimiento. Puede ser NULL para ajustes, transferencias, conteos u otros movimientos independientes.';


--
-- Name: COLUMN movimientos.usuario_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.usuario_id IS 'Usuario que registró o confirmó el movimiento.';


--
-- Name: COLUMN movimientos.tipo_movimiento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.tipo_movimiento IS 'Tipo general del movimiento: compra, venta, ajuste, transferencia, conteo, merma, devolución, etc.';


--
-- Name: COLUMN movimientos.fecha; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.fecha IS 'Fecha efectiva del movimiento de inventario.';


--
-- Name: COLUMN movimientos.observaciones; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.observaciones IS 'Notas u observaciones generales relacionadas con el movimiento.';


--
-- Name: COLUMN movimientos.created_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.created_at IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN movimientos.updated_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.updated_at IS 'Fecha y hora de última actualización del registro.';


--
-- Name: COLUMN movimientos.es_reversion; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos.es_reversion IS 'Indica si el movimiento fue generado como reverso por cancelación de documento.';


--
-- Name: movimientos_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.movimientos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.movimientos_id_seq OWNED BY inventario.movimientos.id;


--
-- Name: movimientos id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos ALTER COLUMN id SET DEFAULT nextval('inventario.movimientos_id_seq'::regclass);


--
-- Name: movimientos movimientos_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT movimientos_pkey PRIMARY KEY (id);


--
-- Name: idx_inv_mov_documento; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_mov_documento ON inventario.movimientos USING btree (documento_id);


--
-- Name: INDEX idx_inv_mov_documento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_mov_documento IS 'Índice para localizar movimientos originados por documentos.';


--
-- Name: idx_inv_mov_empresa; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_mov_empresa ON inventario.movimientos USING btree (empresa_id);


--
-- Name: INDEX idx_inv_mov_empresa; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_mov_empresa IS 'Índice para consultas de movimientos por empresa.';


--
-- Name: idx_inv_mov_tipo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_mov_tipo ON inventario.movimientos USING btree (empresa_id, tipo_movimiento);


--
-- Name: INDEX idx_inv_mov_tipo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_mov_tipo IS 'Índice para consultas de movimientos por empresa y tipo de movimiento.';


--
-- Name: movimientos fk_inv_mov_documento; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT fk_inv_mov_documento FOREIGN KEY (documento_id) REFERENCES public.documentos(id);


--
-- Name: movimientos fk_inv_mov_empresa; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT fk_inv_mov_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: movimientos fk_inv_mov_usuario; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos
    ADD CONSTRAINT fk_inv_mov_usuario FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

