-- Schema: crm
-- Table: oportunidades_venta
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict JuhFuyIbKH9dDaSDzJzAh7NtxKsHamuscepqZDVMWN2LjP3R5DkLIWYg9S9j7Ne

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
-- Name: oportunidades_venta; Type: TABLE; Schema: crm; Owner: -
--

CREATE TABLE crm.oportunidades_venta (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    conversacion_id integer,
    contacto_id integer NOT NULL,
    vendedor_id integer,
    estatus character varying(20) DEFAULT 'abierta'::character varying NOT NULL,
    etapa character varying(50),
    cotizacion_principal_id integer,
    fecha_estimada_decision date,
    fecha_reactivacion_estimada date,
    dolor_validado boolean,
    presupuesto_validado boolean,
    contacto_es_decisor boolean,
    comentarios_no_cierre text,
    observaciones text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE oportunidades_venta; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON TABLE crm.oportunidades_venta IS 'Oportunidades comerciales del CRM. Una oportunidad representa un proceso de venta asociado a un contacto y puede originarse desde una conversación, pero no es la conversación.';


--
-- Name: COLUMN oportunidades_venta.id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.id IS 'Identificador interno de la oportunidad de venta.';


--
-- Name: COLUMN oportunidades_venta.empresa_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.empresa_id IS 'Empresa a la que pertenece la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.conversacion_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.conversacion_id IS 'Conversación de origen asociada a la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.contacto_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.contacto_id IS 'Contacto o cliente asociado a la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.vendedor_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.vendedor_id IS 'Vendedor responsable de la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.estatus; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.estatus IS 'Estatus comercial: abierta, pausada, convertida, perdida o cancelada.';


--
-- Name: COLUMN oportunidades_venta.etapa; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.etapa IS 'Etapa comercial.';


--
-- Name: COLUMN oportunidades_venta.cotizacion_principal_id; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.cotizacion_principal_id IS 'Cotización principal de la oportunidad.';


--
-- Name: COLUMN oportunidades_venta.fecha_estimada_decision; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.fecha_estimada_decision IS 'Fecha tentativa de decisión del cliente.';


--
-- Name: COLUMN oportunidades_venta.fecha_reactivacion_estimada; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.fecha_reactivacion_estimada IS 'Fecha para retomar una oportunidad pausada.';


--
-- Name: COLUMN oportunidades_venta.dolor_validado; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.dolor_validado IS 'Indica si la necesidad del cliente es real.';


--
-- Name: COLUMN oportunidades_venta.presupuesto_validado; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.presupuesto_validado IS 'Indica si el cliente tiene presupuesto.';


--
-- Name: COLUMN oportunidades_venta.contacto_es_decisor; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.contacto_es_decisor IS 'Indica si el contacto decide.';


--
-- Name: COLUMN oportunidades_venta.comentarios_no_cierre; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.comentarios_no_cierre IS 'Explicación de por qué no se concretó.';


--
-- Name: COLUMN oportunidades_venta.observaciones; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.observaciones IS 'Notas operativas del vendedor.';


--
-- Name: COLUMN oportunidades_venta.created_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.created_at IS 'Fecha de creación.';


--
-- Name: COLUMN oportunidades_venta.updated_at; Type: COMMENT; Schema: crm; Owner: -
--

COMMENT ON COLUMN crm.oportunidades_venta.updated_at IS 'Fecha de actualización.';


--
-- Name: oportunidades_venta_id_seq; Type: SEQUENCE; Schema: crm; Owner: -
--

CREATE SEQUENCE crm.oportunidades_venta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: oportunidades_venta_id_seq; Type: SEQUENCE OWNED BY; Schema: crm; Owner: -
--

ALTER SEQUENCE crm.oportunidades_venta_id_seq OWNED BY crm.oportunidades_venta.id;


--
-- Name: oportunidades_venta id; Type: DEFAULT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.oportunidades_venta ALTER COLUMN id SET DEFAULT nextval('crm.oportunidades_venta_id_seq'::regclass);


--
-- Name: oportunidades_venta oportunidades_venta_pkey; Type: CONSTRAINT; Schema: crm; Owner: -
--

ALTER TABLE ONLY crm.oportunidades_venta
    ADD CONSTRAINT oportunidades_venta_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict JuhFuyIbKH9dDaSDzJzAh7NtxKsHamuscepqZDVMWN2LjP3R5DkLIWYg9S9j7Ne

