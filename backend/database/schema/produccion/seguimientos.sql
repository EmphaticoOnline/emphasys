-- Schema: produccion
-- Table: seguimientos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict lgEotGcbrB6x9a1EwVwKZsTQ9iwEwBRwxPck0txnW0RPR9yS1OHRzbDVP8MEEhO

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
-- Name: seguimientos; Type: TABLE; Schema: produccion; Owner: -
--

CREATE TABLE produccion.seguimientos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    documento_id integer NOT NULL,
    etapa_id integer,
    fecha_promesa date,
    comentarios text,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: seguimientos_id_seq; Type: SEQUENCE; Schema: produccion; Owner: -
--

CREATE SEQUENCE produccion.seguimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: produccion; Owner: -
--

ALTER SEQUENCE produccion.seguimientos_id_seq OWNED BY produccion.seguimientos.id;


--
-- Name: seguimientos id; Type: DEFAULT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.seguimientos ALTER COLUMN id SET DEFAULT nextval('produccion.seguimientos_id_seq'::regclass);


--
-- Name: seguimientos seguimientos_pkey; Type: CONSTRAINT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.seguimientos
    ADD CONSTRAINT seguimientos_pkey PRIMARY KEY (id);


--
-- Name: idx_produccion_seguimientos_documento; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_seguimientos_documento ON produccion.seguimientos USING btree (documento_id);


--
-- Name: idx_produccion_seguimientos_empresa; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_seguimientos_empresa ON produccion.seguimientos USING btree (empresa_id);


--
-- Name: idx_produccion_seguimientos_etapa; Type: INDEX; Schema: produccion; Owner: -
--

CREATE INDEX idx_produccion_seguimientos_etapa ON produccion.seguimientos USING btree (etapa_id);


--
-- Name: seguimientos trg_produccion_seguimientos_updated_at; Type: TRIGGER; Schema: produccion; Owner: -
--

CREATE TRIGGER trg_produccion_seguimientos_updated_at BEFORE UPDATE ON produccion.seguimientos FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


--
-- Name: seguimientos fk_produccion_seguimientos_etapa; Type: FK CONSTRAINT; Schema: produccion; Owner: -
--

ALTER TABLE ONLY produccion.seguimientos
    ADD CONSTRAINT fk_produccion_seguimientos_etapa FOREIGN KEY (etapa_id) REFERENCES produccion.etapas(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict lgEotGcbrB6x9a1EwVwKZsTQ9iwEwBRwxPck0txnW0RPR9yS1OHRzbDVP8MEEhO

