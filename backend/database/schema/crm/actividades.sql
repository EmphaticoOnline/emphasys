-- Schema: crm
-- Table: actividades
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict PyZT2o4en2riJI0Z5PnDBePySMYBkKnQPVZ5cQGIDphg0dsm3qDzLvmCFa6CDRs

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
-- Name: actividades; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.actividades (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    usuario_asignado_id integer NOT NULL,
    usuario_creador_id integer NOT NULL,
    oportunidad_id integer,
    tipo_actividad character varying(30) NOT NULL,
    fecha_programada timestamp without time zone NOT NULL,
    notas text,
    estatus character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_realizacion timestamp without time zone,
    resultado text,
    recordatorio boolean DEFAULT false,
    recordatorio_minutos integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    recordatorio_disparado_at timestamp without time zone,
    contacto_id integer
);


--
-- Name: TABLE actividades; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.actividades IS 'Tabla de actividades programadas de seguimiento comercial en el ERP multiempresa.';


--
-- Name: COLUMN actividades.id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.id IS 'Identificador unico de la actividad.';


--
-- Name: COLUMN actividades.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.empresa_id IS 'Empresa a la que pertenece la actividad dentro del modelo multiempresa.';


--
-- Name: COLUMN actividades.usuario_asignado_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.usuario_asignado_id IS 'Usuario responsable de ejecutar la actividad.';


--
-- Name: COLUMN actividades.usuario_creador_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.usuario_creador_id IS 'Usuario que creo o asigno la actividad.';


--
-- Name: COLUMN actividades.oportunidad_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.oportunidad_id IS 'Oportunidad de venta relacionada. Es opcional y puede ser NULL para actividades generales.';


--
-- Name: COLUMN actividades.tipo_actividad; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.tipo_actividad IS 'Tipo de actividad. No usa catalogo por ahora; los valores se controlan desde aplicacion.';


--
-- Name: COLUMN actividades.fecha_programada; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.fecha_programada IS 'Fecha y hora en que debe ejecutarse la actividad.';


--
-- Name: COLUMN actividades.notas; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.notas IS 'Notas o instrucciones capturadas para el seguimiento.';


--
-- Name: COLUMN actividades.estatus; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.estatus IS 'Estatus de la actividad. Los valores se controlan desde aplicacion.';


--
-- Name: COLUMN actividades.fecha_realizacion; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.fecha_realizacion IS 'Fecha y hora en que se realizo la actividad. A nivel aplicacion es obligatoria cuando el estatus sea realizada.';


--
-- Name: COLUMN actividades.resultado; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.resultado IS 'Resultado de la actividad. A nivel aplicacion es obligatorio cuando el estatus sea realizada.';


--
-- Name: COLUMN actividades.recordatorio; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.recordatorio IS 'Indica si la actividad debe generar un recordatorio antes de su ejecucion.';


--
-- Name: COLUMN actividades.recordatorio_minutos; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.recordatorio_minutos IS 'Cantidad de minutos antes de la actividad en que se debe avisar.';


--
-- Name: COLUMN actividades.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.created_at IS 'Fecha y hora de creacion del registro.';


--
-- Name: COLUMN actividades.updated_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.updated_at IS 'Fecha y hora de la ultima actualizacion del registro.';


--
-- Name: COLUMN actividades.contacto_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.actividades.contacto_id IS 'Contacto al que pertenece la actividad. En Fase 1 es nullable solo para permitir backfill y auditoria.';


--
-- Name: actividades_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.actividades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: actividades_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.actividades_id_seq OWNED BY crm.actividades.id;


--
-- Name: actividades id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades ALTER COLUMN id SET DEFAULT nextval('crm.actividades_id_seq'::regclass);


--
-- Name: actividades actividades_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT actividades_pkey PRIMARY KEY (id);


--
-- Name: idx_actividades_contacto; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_contacto ON crm.actividades USING btree (contacto_id);


--
-- Name: idx_actividades_estatus; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_estatus ON crm.actividades USING btree (estatus);


--
-- Name: idx_actividades_oportunidad; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_oportunidad ON crm.actividades USING btree (oportunidad_id);


--
-- Name: idx_actividades_usuario_asignado_fecha; Type: INDEX; Schema: crm; Owner: -
--

CREATE INDEX idx_actividades_usuario_asignado_fecha ON crm.actividades USING btree (usuario_asignado_id, fecha_programada);


--
-- Name: actividades trg_actividades_updated_at; Type: TRIGGER; Schema: crm; Owner: -
--

CREATE TRIGGER trg_actividades_updated_at BEFORE UPDATE ON crm.actividades FOR EACH ROW EXECUTE FUNCTION crm.set_actividades_updated_at();


--
-- Name: actividades fk_actividades_contacto; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_contacto FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE RESTRICT;


--
-- Name: actividades fk_actividades_empresa; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT;


--
-- Name: actividades fk_actividades_oportunidad; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_oportunidad FOREIGN KEY (oportunidad_id) REFERENCES crm.oportunidades_venta(id) ON DELETE SET NULL;


--
-- Name: actividades fk_actividades_usuario_asignado; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_usuario_asignado FOREIGN KEY (usuario_asignado_id) REFERENCES core.usuarios(id) ON DELETE RESTRICT;


--
-- Name: actividades fk_actividades_usuario_creador; Type: FK CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.actividades
    ADD CONSTRAINT fk_actividades_usuario_creador FOREIGN KEY (usuario_creador_id) REFERENCES core.usuarios(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict PyZT2o4en2riJI0Z5PnDBePySMYBkKnQPVZ5cQGIDphg0dsm3qDzLvmCFa6CDRs

