-- Schema: core
-- Table: cfdi_sat_automatizacion
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict z3dc0G6SQISmtnxJ8cZ4fiO9drv04Pnte8YQNBanFi0JDiPFAmrb46uHEkTHAAw

-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
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
-- Name: cfdi_sat_automatizacion; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.cfdi_sat_automatizacion (
    empresa_id integer NOT NULL,
    auto_verificar boolean DEFAULT false NOT NULL,
    auto_descargar boolean DEFAULT false NOT NULL,
    frecuencia_minutos integer DEFAULT 60 NOT NULL,
    ultimo_run_en timestamp with time zone,
    actualizado_por integer,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_cfdi_sat_automatizacion_frecuencia CHECK (((frecuencia_minutos >= 15) AND (frecuencia_minutos <= 1440)))
);


--
-- Name: TABLE cfdi_sat_automatizacion; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.cfdi_sat_automatizacion IS 'Configuración de automatización asistida del módulo CFDI SAT por empresa. No implica un cron desatendido: la contraseña de la FIEL nunca se guarda, así que la verificación/descarga "automática" se ejecuta bajo demanda cuando un administrador la dispara y captura la contraseña una sola vez para procesar todo lo elegible.';


--
-- Name: COLUMN cfdi_sat_automatizacion.auto_verificar; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_automatizacion.auto_verificar IS 'Si está activo, la ejecución asistida intenta verificar todas las solicitudes en estatus solicitado/en_proceso de la empresa.';


--
-- Name: COLUMN cfdi_sat_automatizacion.auto_descargar; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_automatizacion.auto_descargar IS 'Si está activo, la ejecución asistida intenta descargar los paquetes pendientes de las solicitudes que ya quedaron terminadas.';


--
-- Name: COLUMN cfdi_sat_automatizacion.frecuencia_minutos; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_automatizacion.frecuencia_minutos IS 'Frecuencia sugerida (en minutos) con la que el administrador debería disparar la ejecución asistida; usada solo para mostrar un recordatorio visual, no dispara nada por sí sola.';


--
-- Name: COLUMN cfdi_sat_automatizacion.ultimo_run_en; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.cfdi_sat_automatizacion.ultimo_run_en IS 'Fecha y hora de la última ejecución asistida (manual, con contraseña capturada) que se haya completado.';


--
-- Name: cfdi_sat_automatizacion cfdi_sat_automatizacion_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_automatizacion
    ADD CONSTRAINT cfdi_sat_automatizacion_pkey PRIMARY KEY (empresa_id);


--
-- Name: cfdi_sat_automatizacion cfdi_sat_automatizacion_actualizado_por_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_automatizacion
    ADD CONSTRAINT cfdi_sat_automatizacion_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES core.usuarios(id);


--
-- Name: cfdi_sat_automatizacion cfdi_sat_automatizacion_empresa_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cfdi_sat_automatizacion
    ADD CONSTRAINT cfdi_sat_automatizacion_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

\unrestrict z3dc0G6SQISmtnxJ8cZ4fiO9drv04Pnte8YQNBanFi0JDiPFAmrb46uHEkTHAAw

