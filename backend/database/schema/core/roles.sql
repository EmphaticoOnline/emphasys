-- Schema: core
-- Table: roles
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
-- Name: roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.roles (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(200),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE roles; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.roles IS 'Roles disponibles para usuarios dentro de cada empresa';


--
-- Name: COLUMN roles.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.id IS 'Identificador interno del rol';


--
-- Name: COLUMN roles.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.empresa_id IS 'Empresa a la que pertenece el rol';


--
-- Name: COLUMN roles.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.nombre IS 'Nombre del rol (Administrador, Ventas, etc)';


--
-- Name: COLUMN roles.descripcion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.descripcion IS 'Descripción del rol';


--
-- Name: COLUMN roles.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.activo IS 'Indica si el rol está activo';


--
-- Name: COLUMN roles.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.roles.created_at IS 'Fecha de creación del rol';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.roles_id_seq OWNED BY core.roles.id;


--
-- Name: roles id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles ALTER COLUMN id SET DEFAULT nextval('core.roles_id_seq'::regclass);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: idx_roles_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_roles_empresa ON core.roles USING btree (empresa_id);


--
-- Name: INDEX idx_roles_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_roles_empresa IS 'Optimiza consultas de roles por empresa';


--
-- Name: idx_roles_empresa_nombre; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_roles_empresa_nombre ON core.roles USING btree (empresa_id, nombre);


--
-- Name: roles roles_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

