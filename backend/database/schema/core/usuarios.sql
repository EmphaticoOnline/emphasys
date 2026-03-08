-- Schema: core
-- Table: usuarios
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
-- Name: usuarios; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuarios (
    id integer NOT NULL,
    nombre character varying(120) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    ultimo_login timestamp without time zone,
    activo boolean DEFAULT true,
    es_superadmin boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE usuarios; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.usuarios IS 'Usuarios del sistema que pueden acceder a una o más empresas';


--
-- Name: COLUMN usuarios.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.id IS 'Identificador interno del usuario';


--
-- Name: COLUMN usuarios.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.nombre IS 'Nombre completo del usuario';


--
-- Name: COLUMN usuarios.email; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.email IS 'Correo electrónico usado como login';


--
-- Name: COLUMN usuarios.password_hash; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.password_hash IS 'Hash de la contraseña del usuario';


--
-- Name: COLUMN usuarios.ultimo_login; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.ultimo_login IS 'Fecha del último acceso del usuario';


--
-- Name: COLUMN usuarios.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.activo IS 'Indica si el usuario está activo';


--
-- Name: COLUMN usuarios.es_superadmin; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.es_superadmin IS 'Usuario administrador global de la plataforma';


--
-- Name: COLUMN usuarios.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios.created_at IS 'Fecha de creación del usuario';


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.usuarios_id_seq OWNED BY core.usuarios.id;


--
-- Name: usuarios id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios ALTER COLUMN id SET DEFAULT nextval('core.usuarios_id_seq'::regclass);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_usuarios_email; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_usuarios_email ON core.usuarios USING btree (email);


--
-- Name: INDEX idx_usuarios_email; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_usuarios_email IS 'Garantiza unicidad del correo electrónico';


--
-- PostgreSQL database dump complete
--

