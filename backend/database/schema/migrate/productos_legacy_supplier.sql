-- Schema: migrate
-- Table: productos_legacy_supplier
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict NUy8EoV06P46K0ztR1DhqqYzdLN4hWuhPfmxK71Iy07tYAGOkLSNHGSPlHElBKl

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
-- Name: productos_legacy_supplier; Type: TABLE; Schema: migrate; Owner: -
--

CREATE TABLE migrate.productos_legacy_supplier (
    empresa_id integer NOT NULL,
    clave_producto character varying(50) NOT NULL,
    proveedor_surtido character varying(150),
    proveedor_surtido_2 character varying(150),
    proveedor_surtido_3 character varying(150),
    unidad_aduana character varying(20),
    factor_equivalente_unidad_aduana numeric(18,6),
    usa_pedimento boolean,
    costo_reposicion numeric(18,6),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: productos_legacy_supplier pk_productos_legacy_supplier; Type: CONSTRAINT; Schema: migrate; Owner: -
--

ALTER TABLE ONLY migrate.productos_legacy_supplier
    ADD CONSTRAINT pk_productos_legacy_supplier PRIMARY KEY (empresa_id, clave_producto);


--
-- PostgreSQL database dump complete
--

\unrestrict NUy8EoV06P46K0ztR1DhqqYzdLN4hWuhPfmxK71Iy07tYAGOkLSNHGSPlHElBKl

