-- Schema: migrate
-- Table: clientes_legacy_supplier
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict OGtW5FlgBQESVur6yaFO4UorZDoVRhaQXzQwUQpE8wFc7R9TYCRTsMVVVMSVj5C

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
-- Name: clientes_legacy_supplier; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.clientes_legacy_supplier (
    empresa_id integer NOT NULL,
    codigo_legacy character varying(20) NOT NULL,
    agente character varying(50),
    agente_cobranza character varying(50),
    clasificacion character varying(80),
    categoria character varying(80),
    mercado character varying(80),
    goldmine character varying(100),
    proceso_general_venta character varying(100),
    cuenta_contable character varying(50),
    descuento numeric(12,4),
    saldo_maximo_deudor numeric(12,2),
    usar_ultimo_precio boolean,
    cobrar_iva boolean,
    es_extranjero boolean,
    intercompania boolean,
    banco_cuenta_predeterminada character varying(100),
    numero_cuenta_pago character varying(100),
    comentarios_credito text,
    autorizado_por character varying(100),
    fecha_autorizacion timestamp with time zone,
    fecha_inicio_relaciones timestamp with time zone,
    fecha_ultimo_movimiento timestamp with time zone,
    bloquear_al_siguiente_dia boolean,
    usuario_bloqueo character varying(100),
    pagina_web character varying(150),
    lunes_contrarecibo boolean,
    martes_contrarecibo boolean,
    miercoles_contrarecibo boolean,
    jueves_contrarecibo boolean,
    viernes_contrarecibo boolean,
    lunes_pago boolean,
    martes_pago boolean,
    miercoles_pago boolean,
    jueves_pago boolean,
    viernes_pago boolean,
    lunes_recepcion_mercancia boolean,
    martes_recepcion_mercancia boolean,
    miercoles_recepcion_mercancia boolean,
    jueves_recepcion_mercancia boolean,
    viernes_recepcion_mercancia boolean,
    horario_contrarecibo character varying(100),
    horario_pago character varying(100),
    horario_recepcion_mercancia character varying(100),
    campo_usuario_1 character varying(150),
    campo_usuario_2 character varying(150),
    campo_usuario_3 character varying(150),
    campo_usuario_4 character varying(150),
    campo_usuario_5 character varying(150),
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clientes_legacy_supplier pk_clientes_legacy_supplier; Type: CONSTRAINT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.clientes_legacy_supplier
    ADD CONSTRAINT pk_clientes_legacy_supplier PRIMARY KEY (empresa_id, codigo_legacy);


--
-- PostgreSQL database dump complete
--

\unrestrict OGtW5FlgBQESVur6yaFO4UorZDoVRhaQXzQwUQpE8wFc7R9TYCRTsMVVVMSVj5C

