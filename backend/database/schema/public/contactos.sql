-- Schema: public
-- Table: contactos
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict mdIyVJpGtYsfholf7XEuqGriyd7EFSp26eA3MBiIZvyxtkvDBahWKuTPmgHqDYC

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
-- Name: contactos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo_contacto public.tipo_contacto_enum DEFAULT 'Cliente'::public.tipo_contacto_enum NOT NULL,
    nombre character varying(150) NOT NULL,
    rfc character varying(13),
    email character varying(150),
    telefono character varying(30),
    activo boolean DEFAULT true NOT NULL,
    bloqueado boolean DEFAULT false NOT NULL,
    dias_credito smallint,
    limite_credito numeric(12,2),
    vendedor_id integer,
    fecha_alta timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    motivo_bloqueo character varying(100),
    zona character varying(20),
    ultimo_concepto_utilizado character varying(50),
    iva_desglosado boolean,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    telefono_secundario character varying(15),
    codigo_legacy character varying(20),
    precio_lista_id bigint,
    nombre_contacto character varying(150),
    interes_inicial character varying(500)
);


--
-- Name: COLUMN contactos.precio_lista_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contactos.precio_lista_id IS 'Lista de precios asignada directamente al contacto. Tiene prioridad sobre la lista derivada de campos configurables.';


--
-- Name: COLUMN contactos.nombre_contacto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contactos.nombre_contacto IS 'Nombre de la persona de contacto asociado a la empresa del contacto';


--
-- Name: COLUMN contactos.interes_inicial; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contactos.interes_inicial IS 'Interés inicial capturado para seguimiento comercial del contacto';


--
-- Name: contactos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contactos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contactos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contactos_id_seq OWNED BY public.contactos.id;


--
-- Name: contactos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos ALTER COLUMN id SET DEFAULT nextval('public.contactos_id_seq'::regclass);


--
-- Name: contactos contactos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT contactos_pkey PRIMARY KEY (id);


--
-- Name: idx_contactos_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_email_trgm ON public.contactos USING gin (email sat.gin_trgm_ops) WHERE (email IS NOT NULL);


--
-- Name: idx_contactos_nombre_contacto_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_nombre_contacto_trgm ON public.contactos USING gin (nombre_contacto sat.gin_trgm_ops) WHERE (nombre_contacto IS NOT NULL);


--
-- Name: idx_contactos_nombre_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_nombre_trgm ON public.contactos USING gin (nombre sat.gin_trgm_ops);


--
-- Name: idx_contactos_precio_lista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_precio_lista ON public.contactos USING btree (precio_lista_id);


--
-- Name: idx_contactos_telefono_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contactos_telefono_trgm ON public.contactos USING gin (telefono sat.gin_trgm_ops) WHERE (telefono IS NOT NULL);


--
-- Name: ix_contactos_codigo_legacy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_codigo_legacy ON public.contactos USING btree (empresa_id, codigo_legacy) WHERE (codigo_legacy IS NOT NULL);


--
-- Name: ix_contactos_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_email ON public.contactos USING btree (empresa_id, email) WHERE (email IS NOT NULL);


--
-- Name: ix_contactos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa ON public.contactos USING btree (empresa_id);


--
-- Name: ix_contactos_empresa_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_activo ON public.contactos USING btree (empresa_id) WHERE (activo = true);


--
-- Name: ix_contactos_empresa_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_nombre ON public.contactos USING btree (empresa_id, nombre);


--
-- Name: ix_contactos_empresa_rfc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_rfc ON public.contactos USING btree (empresa_id, rfc) WHERE (rfc IS NOT NULL);


--
-- Name: ix_contactos_empresa_tel_sec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_tel_sec ON public.contactos USING btree (empresa_id, telefono_secundario) WHERE (telefono_secundario IS NOT NULL);


--
-- Name: ix_contactos_empresa_telefono; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_telefono ON public.contactos USING btree (empresa_id, telefono) WHERE (telefono IS NOT NULL);


--
-- Name: ix_contactos_empresa_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_empresa_tipo ON public.contactos USING btree (empresa_id, tipo_contacto);


--
-- Name: ix_contactos_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_nombre ON public.contactos USING btree (nombre);


--
-- Name: ix_contactos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contactos_tipo ON public.contactos USING btree (tipo_contacto);


--
-- Name: ux_contactos_empresa_codigo_legacy; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_contactos_empresa_codigo_legacy ON public.contactos USING btree (empresa_id, codigo_legacy) WHERE (codigo_legacy IS NOT NULL);


--
-- Name: contactos trg_contactos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contactos_updated_at BEFORE UPDATE ON public.contactos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contactos fk_contactos_precio_lista; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT fk_contactos_precio_lista FOREIGN KEY (precio_lista_id) REFERENCES public.precios_listas(id);


--
-- Name: contactos fk_contactos_vendedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactos
    ADD CONSTRAINT fk_contactos_vendedor FOREIGN KEY (vendedor_id) REFERENCES public.contactos(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict mdIyVJpGtYsfholf7XEuqGriyd7EFSp26eA3MBiIZvyxtkvDBahWKuTPmgHqDYC

