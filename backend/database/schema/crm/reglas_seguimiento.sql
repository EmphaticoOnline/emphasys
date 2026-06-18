-- Schema: crm
-- Table: reglas_seguimiento
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict LL8UsFwx5GhRf3jc0kCxg37wbbOyfQk5ySTsYtbqwWAK9vZh1GJFFMqyObVFjV2

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
-- Name: reglas_seguimiento; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.reglas_seguimiento (
    empresa_id integer NOT NULL,
    tiempo_tolerancia_respuesta_a_cliente integer DEFAULT 30 NOT NULL,
    tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente integer DEFAULT 4 NOT NULL,
    tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente integer DEFAULT 24 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE reglas_seguimiento; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.reglas_seguimiento IS 'Configuración por empresa de umbrales operativos para seguimiento comercial de leads.';


--
-- Name: COLUMN reglas_seguimiento.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.empresa_id IS 'Empresa propietaria de la configuración de seguimiento.';


--
-- Name: COLUMN reglas_seguimiento.tiempo_tolerancia_respuesta_a_cliente; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_tolerancia_respuesta_a_cliente IS 'Minutos tolerados para responder a un mensaje entrante antes de escalar a riesgo.';


--
-- Name: COLUMN reglas_seguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente IS 'Horas después de un mensaje saliente a partir de las cuales el lead se considera activo sin requerir seguimiento.';


--
-- Name: COLUMN reglas_seguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente IS 'Horas máximas sin respuesta del cliente tras un mensaje saliente antes de considerar riesgo de pérdida.';


--
-- Name: reglas_seguimiento pk_crm_reglas_seguimiento; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.reglas_seguimiento
    ADD CONSTRAINT pk_crm_reglas_seguimiento PRIMARY KEY (empresa_id);


--
-- Name: ux_crm_reglas_seguimiento_empresa_id; Type: INDEX; Schema: crm; Owner: -
--

CREATE UNIQUE INDEX ux_crm_reglas_seguimiento_empresa_id ON crm.reglas_seguimiento USING btree (empresa_id);


--
-- PostgreSQL database dump complete
--

\unrestrict LL8UsFwx5GhRf3jc0kCxg37wbbOyfQk5ySTsYtbqwWAK9vZh1GJFFMqyObVFjV2

