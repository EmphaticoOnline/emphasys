-- Schema: core
-- Table: empresas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict OVRTAOSbvv67e6ltcB3fb8aLNiz2Aw7tkcfo5Dcps6wvxRz4eEde2JWBmYaVD4d

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
-- Name: empresas; Type: TABLE; Schema: core; Owner: -
--

CREATE TABLE core.empresas (
    id integer NOT NULL,
    identificador character varying(120) NOT NULL,
    nombre character varying(150) NOT NULL,
    razon_social character varying(200) NOT NULL,
    rfc character varying(13) NOT NULL,
    regimen_fiscal_id text NOT NULL,
    codigo_postal_id text NOT NULL,
    estado_id text NOT NULL,
    localidad_id text,
    colonia_id text,
    calle character varying(150),
    numero_exterior character varying(20),
    numero_interior character varying(20),
    pais character varying(100) DEFAULT 'México'::character varying,
    telefono character varying(30),
    email character varying(120),
    sitio_web character varying(150),
    certificado_csd text,
    llave_privada_csd text,
    password_csd character varying(100),
    activo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    codigo_postal character varying(10),
    regimen_fiscal character varying(10)
);


--
-- Name: TABLE empresas; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON TABLE core.empresas IS 'Empresas registradas en la plataforma Emphasys ERP/CRM';


--
-- Name: COLUMN empresas.id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.id IS 'Identificador interno de la empresa';


--
-- Name: COLUMN empresas.identificador; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.identificador IS 'Alias o nombre corto de la empresa (ej. Runika, Dicor)';


--
-- Name: COLUMN empresas.nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.nombre IS 'Nombre visible de la empresa dentro del sistema';


--
-- Name: COLUMN empresas.razon_social; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.razon_social IS 'Razón social fiscal registrada ante el SAT';


--
-- Name: COLUMN empresas.rfc; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.rfc IS 'RFC de la empresa';


--
-- Name: COLUMN empresas.regimen_fiscal_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.regimen_fiscal_id IS 'Régimen fiscal SAT';


--
-- Name: COLUMN empresas.codigo_postal_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.codigo_postal_id IS 'Código postal SAT del domicilio fiscal';


--
-- Name: COLUMN empresas.estado_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.estado_id IS 'Estado SAT del domicilio';


--
-- Name: COLUMN empresas.localidad_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.localidad_id IS 'Localidad SAT del domicilio';


--
-- Name: COLUMN empresas.colonia_id; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.colonia_id IS 'Colonia SAT del domicilio';


--
-- Name: COLUMN empresas.calle; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.calle IS 'Calle del domicilio fiscal';


--
-- Name: COLUMN empresas.numero_exterior; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.numero_exterior IS 'Número exterior del domicilio';


--
-- Name: COLUMN empresas.numero_interior; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.numero_interior IS 'Número interior del domicilio';


--
-- Name: COLUMN empresas.pais; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.pais IS 'País del domicilio';


--
-- Name: COLUMN empresas.telefono; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.telefono IS 'Teléfono principal de la empresa';


--
-- Name: COLUMN empresas.email; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.email IS 'Correo electrónico de contacto';


--
-- Name: COLUMN empresas.sitio_web; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.sitio_web IS 'Sitio web de la empresa';


--
-- Name: COLUMN empresas.certificado_csd; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.certificado_csd IS 'Certificado digital para timbrado CFDI';


--
-- Name: COLUMN empresas.llave_privada_csd; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.llave_privada_csd IS 'Llave privada del certificado digital';


--
-- Name: COLUMN empresas.password_csd; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.password_csd IS 'Password del certificado digital';


--
-- Name: COLUMN empresas.activo; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.activo IS 'Indica si la empresa está activa';


--
-- Name: COLUMN empresas.created_at; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON COLUMN core.empresas.created_at IS 'Fecha de creación del registro';


--
-- Name: empresas_id_seq; Type: SEQUENCE; Schema: core; Owner: -
--

CREATE SEQUENCE core.empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: core; Owner: -
--

ALTER SEQUENCE core.empresas_id_seq OWNED BY core.empresas.id;


--
-- Name: empresas id; Type: DEFAULT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas ALTER COLUMN id SET DEFAULT nextval('core.empresas_id_seq'::regclass);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: idx_empresas_cp; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_cp ON core.empresas USING btree (codigo_postal_id);


--
-- Name: INDEX idx_empresas_cp; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_cp IS 'Optimiza consultas por código postal';


--
-- Name: idx_empresas_estado; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_estado ON core.empresas USING btree (estado_id);


--
-- Name: INDEX idx_empresas_estado; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_estado IS 'Optimiza consultas por estado';


--
-- Name: idx_empresas_identificador; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_empresas_identificador ON core.empresas USING btree (identificador);


--
-- Name: INDEX idx_empresas_identificador; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_identificador IS 'Garantiza unicidad del alias de empresa';


--
-- Name: idx_empresas_nombre; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_nombre ON core.empresas USING btree (nombre);


--
-- Name: INDEX idx_empresas_nombre; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_nombre IS 'Optimiza búsquedas por nombre de empresa';


--
-- Name: idx_empresas_regimen; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_empresas_regimen ON core.empresas USING btree (regimen_fiscal_id);


--
-- Name: INDEX idx_empresas_regimen; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_regimen IS 'Optimiza consultas por régimen fiscal';


--
-- Name: idx_empresas_rfc; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX idx_empresas_rfc ON core.empresas USING btree (rfc);


--
-- Name: INDEX idx_empresas_rfc; Type: COMMENT; Schema: core; Owner: -
--

COMMENT ON INDEX core.idx_empresas_rfc IS 'Optimiza búsqueda de empresa por RFC';


--
-- Name: empresas fk_empresas_colonia; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_colonia FOREIGN KEY (codigo_postal_id, colonia_id) REFERENCES sat.colonias(codigo_postal, colonia);


--
-- Name: empresas fk_empresas_cp; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_cp FOREIGN KEY (codigo_postal_id) REFERENCES sat.codigos_postales(id);


--
-- Name: empresas fk_empresas_estado; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_estado FOREIGN KEY (estado_id) REFERENCES sat.estados(estado);


--
-- Name: empresas fk_empresas_localidad; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_localidad FOREIGN KEY (estado_id, localidad_id) REFERENCES sat.localidades(estado, localidad);


--
-- Name: empresas fk_empresas_regimen; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.empresas
    ADD CONSTRAINT fk_empresas_regimen FOREIGN KEY (regimen_fiscal_id) REFERENCES sat.regimenes_fiscales(id);


--
-- PostgreSQL database dump complete
--

\unrestrict OVRTAOSbvv67e6ltcB3fb8aLNiz2Aw7tkcfo5Dcps6wvxRz4eEde2JWBmYaVD4d

