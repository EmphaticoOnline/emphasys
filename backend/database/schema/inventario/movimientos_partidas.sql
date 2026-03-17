-- Schema: inventario
-- Table: movimientos_partidas
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
-- Name: movimientos_partidas; Type: TABLE; Schema: inventario; Owner: -
--

CREATE TABLE inventario.movimientos_partidas (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    movimiento_id bigint NOT NULL,
    documento_partida_id integer,
    producto_id integer NOT NULL,
    almacen_id integer NOT NULL,
    almacen_destino_id integer,
    fecha_movimiento timestamp with time zone NOT NULL,
    cantidad numeric(18,6) NOT NULL,
    signo smallint NOT NULL,
    tipo_partida character varying(25) DEFAULT 'normal'::character varying NOT NULL,
    costo_unitario numeric(18,6),
    existencia_resultante numeric(18,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_inv_part_cantidad CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT chk_inv_part_signo CHECK ((signo = ANY (ARRAY['-1'::integer, 1]))),
    CONSTRAINT chk_inv_part_tipo CHECK (((tipo_partida)::text = ANY ((ARRAY['normal'::character varying, 'salida_transferencia'::character varying, 'entrada_transferencia'::character varying])::text[])))
);


--
-- Name: TABLE movimientos_partidas; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON TABLE inventario.movimientos_partidas IS 'Detalle de movimientos de inventario. Cada fila representa una afectación física en el kardex de un producto y un almacén.';


--
-- Name: COLUMN movimientos_partidas.id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.id IS 'Identificador único de la partida del movimiento.';


--
-- Name: COLUMN movimientos_partidas.empresa_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.empresa_id IS 'Empresa propietaria de la partida.';


--
-- Name: COLUMN movimientos_partidas.movimiento_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.movimiento_id IS 'Referencia al encabezado del movimiento de inventario.';


--
-- Name: COLUMN movimientos_partidas.documento_partida_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.documento_partida_id IS 'Referencia opcional a la partida del documento que originó la afectación.';


--
-- Name: COLUMN movimientos_partidas.producto_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.producto_id IS 'Producto afectado por la partida.';


--
-- Name: COLUMN movimientos_partidas.almacen_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.almacen_id IS 'Almacén afectado por esta partida. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';


--
-- Name: COLUMN movimientos_partidas.almacen_destino_id; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.almacen_destino_id IS 'Almacén destino relacionado. Se usa principalmente en transferencias. La tabla de almacenes no se referencia aquí porque no quedó confirmada en el schema compartido.';


--
-- Name: COLUMN movimientos_partidas.fecha_movimiento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.fecha_movimiento IS 'Fecha efectiva usada para ordenar el kardex y recalcular existencias históricas.';


--
-- Name: COLUMN movimientos_partidas.cantidad; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.cantidad IS 'Cantidad del producto afectada por la partida.';


--
-- Name: COLUMN movimientos_partidas.signo; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.signo IS 'Naturaleza del movimiento: +1 entrada, -1 salida.';


--
-- Name: COLUMN movimientos_partidas.tipo_partida; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.tipo_partida IS 'Tipo de partida: normal, salida_transferencia o entrada_transferencia.';


--
-- Name: COLUMN movimientos_partidas.costo_unitario; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.costo_unitario IS 'Costo unitario del producto al momento del movimiento.';


--
-- Name: COLUMN movimientos_partidas.existencia_resultante; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.existencia_resultante IS 'Existencia del producto en el almacén inmediatamente después de aplicar esta partida.';


--
-- Name: COLUMN movimientos_partidas.created_at; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON COLUMN inventario.movimientos_partidas.created_at IS 'Fecha y hora de creación del registro.';


--
-- Name: movimientos_partidas_id_seq; Type: SEQUENCE; Schema: inventario; Owner: -
--

CREATE SEQUENCE inventario.movimientos_partidas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_partidas_id_seq; Type: SEQUENCE OWNED BY; Schema: inventario; Owner: -
--

ALTER SEQUENCE inventario.movimientos_partidas_id_seq OWNED BY inventario.movimientos_partidas.id;


--
-- Name: movimientos_partidas id; Type: DEFAULT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas ALTER COLUMN id SET DEFAULT nextval('inventario.movimientos_partidas_id_seq'::regclass);


--
-- Name: movimientos_partidas movimientos_partidas_pkey; Type: CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT movimientos_partidas_pkey PRIMARY KEY (id);


--
-- Name: idx_inv_part_kardex; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_kardex ON inventario.movimientos_partidas USING btree (empresa_id, producto_id, almacen_id, fecha_movimiento, id);


--
-- Name: INDEX idx_inv_part_kardex; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_part_kardex IS 'Índice principal para recorridos de kardex y recalculo histórico por empresa, producto y almacén.';


--
-- Name: idx_inv_part_movimiento; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_movimiento ON inventario.movimientos_partidas USING btree (movimiento_id);


--
-- Name: INDEX idx_inv_part_movimiento; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_part_movimiento IS 'Índice para recuperar rápidamente las partidas de un movimiento.';


--
-- Name: idx_inv_part_recalculo; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_recalculo ON inventario.movimientos_partidas USING btree (empresa_id, producto_id, almacen_id, id);


--
-- Name: idx_inv_part_transferencia_destino; Type: INDEX; Schema: inventario; Owner: -
--

CREATE INDEX idx_inv_part_transferencia_destino ON inventario.movimientos_partidas USING btree (empresa_id, producto_id, almacen_destino_id, fecha_movimiento, id);


--
-- Name: INDEX idx_inv_part_transferencia_destino; Type: COMMENT; Schema: inventario; Owner: -
--

COMMENT ON INDEX inventario.idx_inv_part_transferencia_destino IS 'Índice auxiliar para rastrear transferencias hacia un almacén destino.';


--
-- Name: movimientos_partidas fk_inv_part_doc_partida; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_doc_partida FOREIGN KEY (documento_partida_id) REFERENCES public.documentos_partidas(id) ON DELETE SET NULL;


--
-- Name: movimientos_partidas fk_inv_part_empresa; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: movimientos_partidas fk_inv_part_movimiento; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_movimiento FOREIGN KEY (movimiento_id) REFERENCES inventario.movimientos(id) ON DELETE CASCADE;


--
-- Name: movimientos_partidas fk_inv_part_producto; Type: FK CONSTRAINT; Schema: inventario; Owner: -
--

ALTER TABLE ONLY inventario.movimientos_partidas
    ADD CONSTRAINT fk_inv_part_producto FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

