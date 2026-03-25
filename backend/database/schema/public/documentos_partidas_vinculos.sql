-- Schema: public
-- Table: documentos_partidas_vinculos
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
-- Name: documentos_partidas_vinculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_partidas_vinculos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    documento_origen_id integer NOT NULL,
    documento_destino_id integer NOT NULL,
    partida_origen_id integer NOT NULL,
    partida_destino_id integer NOT NULL,
    cantidad numeric(15,6) NOT NULL,
    usuario_creacion_id integer,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE documentos_partidas_vinculos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documentos_partidas_vinculos IS 'Tabla que registra vínculos entre partidas de documentos permitiendo relaciones muchos-a-muchos y control de cantidades aplicadas entre documentos (pedido, factura, entrega, recepción, etc.).';


--
-- Name: COLUMN documentos_partidas_vinculos.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.id IS 'Identificador único del vínculo entre partidas.';


--
-- Name: COLUMN documentos_partidas_vinculos.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.empresa_id IS 'Empresa a la que pertenece el vínculo entre partidas.';


--
-- Name: COLUMN documentos_partidas_vinculos.documento_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.documento_origen_id IS 'Documento del cual proviene la partida origen.';


--
-- Name: COLUMN documentos_partidas_vinculos.documento_destino_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.documento_destino_id IS 'Documento que recibe o consume la cantidad.';


--
-- Name: COLUMN documentos_partidas_vinculos.partida_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.partida_origen_id IS 'Partida que origina la cantidad (ejemplo: partida del pedido o requisición).';


--
-- Name: COLUMN documentos_partidas_vinculos.partida_destino_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.partida_destino_id IS 'Partida que consume o aplica la cantidad (ejemplo: partida de factura, entrega o recepción).';


--
-- Name: COLUMN documentos_partidas_vinculos.cantidad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.cantidad IS 'Cantidad aplicada desde la partida origen hacia la partida destino.';


--
-- Name: COLUMN documentos_partidas_vinculos.usuario_creacion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.usuario_creacion_id IS 'Usuario que registró la creación del vínculo entre partidas.';


--
-- Name: COLUMN documentos_partidas_vinculos.fecha_creacion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documentos_partidas_vinculos.fecha_creacion IS 'Fecha y hora de creación del vínculo.';


--
-- Name: documentos_partidas_vinculos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentos_partidas_vinculos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentos_partidas_vinculos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentos_partidas_vinculos_id_seq OWNED BY public.documentos_partidas_vinculos.id;


--
-- Name: documentos_partidas_vinculos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos ALTER COLUMN id SET DEFAULT nextval('public.documentos_partidas_vinculos_id_seq'::regclass);


--
-- Name: documentos_partidas_vinculos documentos_partidas_vinculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT documentos_partidas_vinculos_pkey PRIMARY KEY (id);


--
-- Name: documentos_partidas_vinculos uq_doc_partidas_vinculos; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT uq_doc_partidas_vinculos UNIQUE (partida_origen_id, partida_destino_id);


--
-- Name: idx_doc_partidas_vinculos_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_destino ON public.documentos_partidas_vinculos USING btree (partida_destino_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_destino IS 'Índice para consultas por partida destino.';


--
-- Name: idx_doc_partidas_vinculos_doc_destino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_doc_destino ON public.documentos_partidas_vinculos USING btree (documento_destino_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_doc_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_doc_destino IS 'Índice para consultas por documento destino.';


--
-- Name: idx_doc_partidas_vinculos_doc_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_doc_origen ON public.documentos_partidas_vinculos USING btree (documento_origen_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_doc_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_doc_origen IS 'Índice para consultas por documento origen.';


--
-- Name: idx_doc_partidas_vinculos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_empresa ON public.documentos_partidas_vinculos USING btree (empresa_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_empresa IS 'Índice para consultas por empresa.';


--
-- Name: idx_doc_partidas_vinculos_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_partidas_vinculos_origen ON public.documentos_partidas_vinculos USING btree (partida_origen_id);


--
-- Name: INDEX idx_doc_partidas_vinculos_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_doc_partidas_vinculos_origen IS 'Índice para consultas por partida origen.';


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_destino FOREIGN KEY (partida_destino_id) REFERENCES public.documentos_partidas(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_doc_destino; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_doc_destino FOREIGN KEY (documento_destino_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_doc_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_doc_origen FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id) ON DELETE CASCADE;


--
-- Name: documentos_partidas_vinculos fk_doc_partidas_vinculos_origen; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_partidas_vinculos
    ADD CONSTRAINT fk_doc_partidas_vinculos_origen FOREIGN KEY (partida_origen_id) REFERENCES public.documentos_partidas(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

