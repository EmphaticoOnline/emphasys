-- Schema: sat
-- Table: metodos_pago
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict qGRUPzaJ84XQqIVVJKgZmKKKhuSTkmSwBr5wD4dp5HIViHHesKk7yKvIzuQcS6q

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
-- Name: metodos_pago; Type: TABLE; Schema: sat; Owner: -
--

CREATE TABLE sat.metodos_pago (
    id text NOT NULL,
    texto text NOT NULL,
    vigencia_desde text NOT NULL,
    vigencia_hasta text NOT NULL
);


--
-- Name: metodos_pago metodos_pago_pkey; Type: CONSTRAINT; Schema: sat; Owner: -
--

ALTER TABLE ONLY sat.metodos_pago
    ADD CONSTRAINT metodos_pago_pkey PRIMARY KEY (id);


--
-- Name: idx_metodos_pago_texto; Type: INDEX; Schema: sat; Owner: -
--

CREATE INDEX idx_metodos_pago_texto ON sat.metodos_pago USING btree (texto);


--
-- PostgreSQL database dump complete
--

\unrestrict qGRUPzaJ84XQqIVVJKgZmKKKhuSTkmSwBr5wD4dp5HIViHHesKk7yKvIzuQcS6q

