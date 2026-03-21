-- Schema: core
-- Table: usuarios_empresas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict edveo1LFd4Vr8eb4mlphuHH1eWLDVjOr4DFtX9nQ4pljOtwsXVf91Mhde9VAlny

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
-- Name: usuarios_empresas; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.usuarios_empresas (
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE usuarios_empresas; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.usuarios_empresas IS 'Relación entre usuarios y empresas a las que tienen acceso';


--
-- Name: COLUMN usuarios_empresas.usuario_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.usuario_id IS 'Usuario que tiene acceso a la empresa';


--
-- Name: COLUMN usuarios_empresas.empresa_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.empresa_id IS 'Empresa a la que el usuario tiene acceso';


--
-- Name: COLUMN usuarios_empresas.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.activo IS 'Indica si el acceso está activo';


--
-- Name: COLUMN usuarios_empresas.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.usuarios_empresas.created_at IS 'Fecha de creación de la relación';


--
-- Name: usuarios_empresas usuarios_empresas_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_pkey PRIMARY KEY (usuario_id, empresa_id);


--
-- Name: idx_usuarios_empresas_empresa; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_usuarios_empresas_empresa ON core.usuarios_empresas USING btree (empresa_id);


--
-- Name: INDEX idx_usuarios_empresas_empresa; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_usuarios_empresas_empresa IS 'Optimiza consultas de usuarios por empresa';


--
-- Name: usuarios_empresas usuarios_empresas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: usuarios_empresas usuarios_empresas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.usuarios_empresas
    ADD CONSTRAINT usuarios_empresas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict edveo1LFd4Vr8eb4mlphuHH1eWLDVjOr4DFtX9nQ4pljOtwsXVf91Mhde9VAlny

