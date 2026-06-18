-- Schema: core
-- Table: grid_preferences
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict YR7kI3fT4l07bWJjGiSEFRtX6XEHUfCS297cTjoxO1JMlGsfaluQVALjPfpoYW0

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
-- Name: grid_preferences; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.grid_preferences (
    id bigint NOT NULL,
    usuario_id integer NOT NULL,
    empresa_id integer NOT NULL,
    pantalla text NOT NULL,
    perfil_dispositivo text NOT NULL,
    preferencias jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grid_preferences_perfil_chk CHECK ((perfil_dispositivo = ANY (ARRAY['desktop'::text, 'tablet'::text, 'mobile'::text])))
);


--
-- Name: grid_preferences_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.grid_preferences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grid_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.grid_preferences_id_seq OWNED BY core.grid_preferences.id;


--
-- Name: grid_preferences id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences ALTER COLUMN id SET DEFAULT nextval('core.grid_preferences_id_seq'::regclass);


--
-- Name: grid_preferences grid_preferences_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_pkey PRIMARY KEY (id);


--
-- Name: grid_preferences grid_preferences_unique_scope; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_unique_scope UNIQUE (usuario_id, empresa_id, pantalla, perfil_dispositivo);


--
-- Name: idx_grid_preferences_lookup; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_grid_preferences_lookup ON core.grid_preferences USING btree (usuario_id, empresa_id, pantalla, perfil_dispositivo);


--
-- Name: idx_grid_preferences_updated_at; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_grid_preferences_updated_at ON core.grid_preferences USING btree (updated_at DESC);


--
-- Name: grid_preferences grid_preferences_empresa_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_empresa_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: grid_preferences grid_preferences_usuario_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.grid_preferences
    ADD CONSTRAINT grid_preferences_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict YR7kI3fT4l07bWJjGiSEFRtX6XEHUfCS297cTjoxO1JMlGsfaluQVALjPfpoYW0

