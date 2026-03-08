-- Schema: core
-- Table: usuarios_roles
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
-- Name: usuarios_roles; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuarios_roles (
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    rol_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE usuarios_roles; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.usuarios_roles IS 'Asignación de roles a usuarios dentro de cada empresa';


--
-- Name: COLUMN usuarios_roles.usuario_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.usuario_id IS 'Usuario al que se asigna el rol';


--
-- Name: COLUMN usuarios_roles.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.empresa_id IS 'Empresa donde aplica el rol';


--
-- Name: COLUMN usuarios_roles.rol_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.rol_id IS 'Rol asignado al usuario';


--
-- Name: COLUMN usuarios_roles.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_roles.created_at IS 'Fecha de creación de la asignación';


--
-- Name: usuarios_roles usuarios_roles_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_pkey PRIMARY KEY (usuario_id, empresa_id, rol_id);


--
-- Name: idx_usuarios_roles_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_usuarios_roles_empresa ON core.usuarios_roles USING btree (empresa_id);


--
-- Name: INDEX idx_usuarios_roles_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_usuarios_roles_empresa IS 'Optimiza consultas de roles por empresa';


--
-- Name: usuarios_roles usuarios_roles_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: usuarios_roles usuarios_roles_rol_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES core.roles(id);


--
-- Name: usuarios_roles usuarios_roles_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_roles
    ADD CONSTRAINT usuarios_roles_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

