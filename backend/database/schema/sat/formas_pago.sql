-- Schema: sat
-- Table: formas_pago
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
-- Name: formas_pago; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.formas_pago (
    id text NOT NULL,
    texto text NOT NULL,
    es_bancarizado integer NOT NULL,
    requiere_numero_operacion integer NOT NULL,
    permite_banco_ordenante_rfc integer NOT NULL,
    permite_cuenta_ordenante integer NOT NULL,
    patron_cuenta_ordenante text,
    permite_banco_beneficiario_rfc integer NOT NULL,
    permite_cuenta_beneficiario integer NOT NULL,
    patron_cuenta_beneficiario text,
    permite_tipo_cadena_pago integer NOT NULL,
    requiere_banco_ordenante_nombre_ext integer NOT NULL,
    vigencia_desde text,
    vigencia_hasta text
);


--
-- Name: formas_pago formas_pago_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.formas_pago
    ADD CONSTRAINT formas_pago_pkey PRIMARY KEY (id);


--
-- Name: idx_formas_pago_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_formas_pago_texto ON sat.formas_pago USING btree (texto);


--
-- PostgreSQL database dump complete
--

