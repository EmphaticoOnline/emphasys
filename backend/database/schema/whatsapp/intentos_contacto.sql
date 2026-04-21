-- Schema: whatsapp
-- Table: intentos_contacto
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
-- Name: intentos_contacto; Type: TABLE; Schema: whatsapp; Owner: -
--

CREATE TABLE whatsapp.intentos_contacto (
    id bigint NOT NULL,
    empresa_id integer NOT NULL,
    pagina_origen text,
    producto text,
    fuente text,
    mensaje_prellenado text,
    session_id text,
    ip_address inet,
    user_agent text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE intentos_contacto; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON TABLE whatsapp.intentos_contacto IS 'Registra intentos de contacto a WhatsApp desde la web antes de que exista una conversacion real. Representa intencion del usuario.';


--
-- Name: COLUMN intentos_contacto.id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.id IS 'Identificador unico del intento de contacto.';


--
-- Name: COLUMN intentos_contacto.empresa_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.empresa_id IS 'Empresa a la que pertenece el intento de contacto.';


--
-- Name: COLUMN intentos_contacto.pagina_origen; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.pagina_origen IS 'Ruta o URL de la pagina donde se genero el clic (ej. /sky-dancer).';


--
-- Name: COLUMN intentos_contacto.producto; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.producto IS 'Producto o categoria asociada al clic (ej. Sky Dancer, Display).';


--
-- Name: COLUMN intentos_contacto.fuente; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.fuente IS 'Origen del trafico (ej. web, landing, campaña, QR).';


--
-- Name: COLUMN intentos_contacto.mensaje_prellenado; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.mensaje_prellenado IS 'Mensaje que se envia prellenado al abrir WhatsApp.';


--
-- Name: COLUMN intentos_contacto.session_id; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.session_id IS 'Identificador de sesion del navegador para agrupar eventos del mismo usuario.';


--
-- Name: COLUMN intentos_contacto.ip_address; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.ip_address IS 'Direccion IP del usuario al momento del clic.';


--
-- Name: COLUMN intentos_contacto.user_agent; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.user_agent IS 'Cadena de identificacion del navegador o dispositivo del usuario.';


--
-- Name: COLUMN intentos_contacto.creado_en; Type: COMMENT; Schema: whatsapp; Owner: -
--

COMMENT ON COLUMN whatsapp.intentos_contacto.creado_en IS 'Fecha y hora en que se registro el intento de contacto.';


--
-- Name: intentos_contacto_id_seq; Type: SEQUENCE; Schema: whatsapp; Owner: -
--

CREATE SEQUENCE whatsapp.intentos_contacto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intentos_contacto_id_seq; Type: SEQUENCE OWNED BY; Schema: whatsapp; Owner: -
--

ALTER SEQUENCE whatsapp.intentos_contacto_id_seq OWNED BY whatsapp.intentos_contacto.id;


--
-- Name: intentos_contacto id; Type: DEFAULT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.intentos_contacto ALTER COLUMN id SET DEFAULT nextval('whatsapp.intentos_contacto_id_seq'::regclass);


--
-- Name: intentos_contacto intentos_contacto_pkey; Type: CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.intentos_contacto
    ADD CONSTRAINT intentos_contacto_pkey PRIMARY KEY (id);


--
-- Name: intentos_contacto intentos_contacto_empresa_id_fkey; Type: FK CONSTRAINT; Schema: whatsapp; Owner: -
--

ALTER TABLE ONLY whatsapp.intentos_contacto
    ADD CONSTRAINT intentos_contacto_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- PostgreSQL database dump complete
--

