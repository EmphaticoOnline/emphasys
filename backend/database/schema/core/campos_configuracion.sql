-- Schema: core
-- Table: campos_configuracion
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
-- Name: campos_configuracion; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.campos_configuracion (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    entidad_tipo_id integer NOT NULL,
    tipo_documento character varying(30),
    nombre character varying(120) NOT NULL,
    clave character varying(60),
    tipo_dato character varying(20) NOT NULL,
    tipo_control character varying(20),
    catalogo_tipo_id integer,
    campo_padre_id integer,
    obligatorio boolean DEFAULT false,
    activo boolean DEFAULT true,
    orden integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE campos_configuracion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.campos_configuracion IS 'Define campos dinámicos configurables que pueden aparecer en documentos, partidas, contactos o productos.';


--
-- Name: COLUMN campos_configuracion.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.id IS 'Identificador único del campo configurable.';


--
-- Name: COLUMN campos_configuracion.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.empresa_id IS 'Empresa propietaria de la configuración del campo dinámico.';


--
-- Name: COLUMN campos_configuracion.entidad_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.entidad_tipo_id IS 'Tipo de entidad donde se aplicará el campo (documento, partida, contacto, producto).';


--
-- Name: COLUMN campos_configuracion.tipo_documento; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.tipo_documento IS 'Tipo de documento específico cuando el campo aplica a documentos o partidas.';


--
-- Name: COLUMN campos_configuracion.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.nombre IS 'Nombre visible del campo que aparecerá en la interfaz de captura.';


--
-- Name: COLUMN campos_configuracion.clave; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.clave IS 'Clave técnica del campo utilizada en lógica de negocio, reportes o integraciones.';


--
-- Name: COLUMN campos_configuracion.tipo_dato; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.tipo_dato IS 'Tipo de dato lógico del campo (texto, numero, fecha, booleano o lista).';


--
-- Name: COLUMN campos_configuracion.tipo_control; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.tipo_control IS 'Tipo de control visual sugerido para el frontend (textbox, dropdown, checkbox, datepicker).';


--
-- Name: COLUMN campos_configuracion.catalogo_tipo_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.catalogo_tipo_id IS 'Tipo de catálogo utilizado cuando el campo es de tipo lista.';


--
-- Name: COLUMN campos_configuracion.campo_padre_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.campo_padre_id IS 'Permite definir dependencias entre campos dinámicos (ejemplo: Modelo depende de Marca).';


--
-- Name: COLUMN campos_configuracion.obligatorio; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.obligatorio IS 'Indica si el campo debe ser capturado obligatoriamente.';


--
-- Name: COLUMN campos_configuracion.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.activo IS 'Indica si el campo está activo y disponible para captura.';


--
-- Name: COLUMN campos_configuracion.orden; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.orden IS 'Orden de aparición del campo dentro del formulario.';


--
-- Name: COLUMN campos_configuracion.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_configuracion.created_at IS 'Fecha y hora en que se creó el registro de configuración.';


--
-- Name: campos_configuracion_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.campos_configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campos_configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.campos_configuracion_id_seq OWNED BY core.campos_configuracion.id;


--
-- Name: campos_configuracion id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion ALTER COLUMN id SET DEFAULT nextval('core.campos_configuracion_id_seq'::regclass);


--
-- Name: campos_configuracion campos_configuracion_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT campos_configuracion_pkey PRIMARY KEY (id);


--
-- Name: idx_campos_configuracion_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_campos_configuracion_empresa ON core.campos_configuracion USING btree (empresa_id);


--
-- Name: INDEX idx_campos_configuracion_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_campos_configuracion_empresa IS 'Optimiza consultas de campos configurables filtradas por empresa.';


--
-- Name: idx_campos_configuracion_entidad; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_campos_configuracion_entidad ON core.campos_configuracion USING btree (entidad_tipo_id);


--
-- Name: INDEX idx_campos_configuracion_entidad; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_campos_configuracion_entidad IS 'Optimiza consultas de campos configurables por tipo de entidad.';


--
-- Name: campos_configuracion fk_campos_configuracion_catalogo; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_catalogo FOREIGN KEY (catalogo_tipo_id) REFERENCES core.catalogos_tipos(id);


--
-- Name: campos_configuracion fk_campos_configuracion_empresa; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_empresa FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: campos_configuracion fk_campos_configuracion_entidad; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_entidad FOREIGN KEY (entidad_tipo_id) REFERENCES core.entidades_tipos(id);


--
-- Name: campos_configuracion fk_campos_configuracion_padre; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_configuracion
    ADD CONSTRAINT fk_campos_configuracion_padre FOREIGN KEY (campo_padre_id) REFERENCES core.campos_configuracion(id);


--
-- PostgreSQL database dump complete
--

