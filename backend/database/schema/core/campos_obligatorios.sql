-- Schema: core
-- Table: campos_obligatorios
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict kRmTKdImNkGnr8ZgumyH3NGEwM2kE9w3lMUMz2JWLZXmNhZRLN7QCSFfW7qxJRS

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
-- Name: campos_obligatorios; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.campos_obligatorios (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    entidad character varying(50) NOT NULL,
    contexto character varying(50),
    campo character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE campos_obligatorios; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.campos_obligatorios IS 'Campos configurados como obligatorios por empresa, entidad y contexto. La tabla solo almacena excepciones: si un campo no existe aquí, se considera opcional.';


--
-- Name: COLUMN campos_obligatorios.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.id IS 'Identificador único del registro.';


--
-- Name: COLUMN campos_obligatorios.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.empresa_id IS 'Empresa a la que pertenece la configuración.';


--
-- Name: COLUMN campos_obligatorios.entidad; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.entidad IS 'Entidad funcional del sistema, por ejemplo contactos o documentos. No depende del nombre físico del formulario.';


--
-- Name: COLUMN campos_obligatorios.contexto; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.contexto IS 'Contexto específico de la entidad. En contactos puede ser el tipo de contacto; en documentos puede ser el tipo_documento. Puede ser NULL cuando la configuración aplique a toda la entidad.';


--
-- Name: COLUMN campos_obligatorios.campo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.campo IS 'Nombre técnico del campo dentro de la entidad.';


--
-- Name: COLUMN campos_obligatorios.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.campos_obligatorios.created_at IS 'Fecha y hora en que se creó la configuración.';


--
-- Name: campos_obligatorios_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.campos_obligatorios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campos_obligatorios_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.campos_obligatorios_id_seq OWNED BY core.campos_obligatorios.id;


--
-- Name: campos_obligatorios id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_obligatorios ALTER COLUMN id SET DEFAULT nextval('core.campos_obligatorios_id_seq'::regclass);


--
-- Name: campos_obligatorios campos_obligatorios_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.campos_obligatorios
    ADD CONSTRAINT campos_obligatorios_pkey PRIMARY KEY (id);


--
-- Name: ux_campos_obligatorios; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX ux_campos_obligatorios ON core.campos_obligatorios USING btree (empresa_id, entidad, contexto, campo);


--
-- PostgreSQL database dump complete
--

\unrestrict kRmTKdImNkGnr8ZgumyH3NGEwM2kE9w3lMUMz2JWLZXmNhZRLN7QCSFfW7qxJRS

