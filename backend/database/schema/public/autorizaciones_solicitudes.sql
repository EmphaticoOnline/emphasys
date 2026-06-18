-- Schema: public
-- Table: autorizaciones_solicitudes
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict igHHFlqTwqqZaUjpvVZL1rlCyd1QeZTS64gvOtjF23GfWtmU5A5utvutgIp5oCN

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
-- Name: autorizaciones_solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autorizaciones_solicitudes (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    regla_id integer NOT NULL,
    documento_origen_id integer NOT NULL,
    tipo_documento_origen character varying(60) NOT NULL,
    tipo_documento_destino character varying(60) NOT NULL,
    folio_documento_origen character varying(60),
    monto numeric(18,4) NOT NULL,
    usuario_solicitante_id integer NOT NULL,
    usuario_autorizador_id integer,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    comentario_solicitante text,
    comentario_autorizador text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    respondido_at timestamp with time zone,
    CONSTRAINT autorizaciones_solicitudes_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying, 'cancelada'::character varying])::text[])))
);


--
-- Name: TABLE autorizaciones_solicitudes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.autorizaciones_solicitudes IS 'Registro de solicitudes formales de autorización generadas por el modo=flujo. Se crea una fila cuando un usuario intenta ejecutar una transición sujeta a flujo y el documento aún no está aprobado. El documento origen queda en estado_autorizacion=pendiente hasta que el autorizador responde o el solicitante cancela. Los campos tipo_documento_* y folio_documento_origen se copian del documento en el momento de la solicitud para preservar el historial aunque el documento sea modificado o cancelado posteriormente.';


--
-- Name: COLUMN autorizaciones_solicitudes.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.id IS 'Identificador interno de la solicitud.';


--
-- Name: COLUMN autorizaciones_solicitudes.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.empresa_id IS 'Empresa a la que pertenece la solicitud. Referencia core.empresas.';


--
-- Name: COLUMN autorizaciones_solicitudes.regla_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.regla_id IS 'Política de autorización que disparó la creación de esta solicitud. Referencia autorizaciones_reglas.';


--
-- Name: COLUMN autorizaciones_solicitudes.documento_origen_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.documento_origen_id IS 'Documento cuya transición está pendiente de aprobación. Referencia public.documentos.';


--
-- Name: COLUMN autorizaciones_solicitudes.tipo_documento_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.tipo_documento_origen IS 'Código del tipo de documento origen en el momento de crear la solicitud (ej. cotizacion). Desnormalizado para preservar historial.';


--
-- Name: COLUMN autorizaciones_solicitudes.tipo_documento_destino; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.tipo_documento_destino IS 'Código del tipo de documento que se intentó generar (ej. factura). Desnormalizado para preservar historial.';


--
-- Name: COLUMN autorizaciones_solicitudes.folio_documento_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.folio_documento_origen IS 'Folio (serie + número) del documento origen en el momento de crear la solicitud. Desnormalizado para mostrar en la bandeja sin join adicional.';


--
-- Name: COLUMN autorizaciones_solicitudes.monto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.monto IS 'Total del documento origen en el momento de crear la solicitud. Determina qué política aplica; se congela aquí para que un cambio posterior en el documento no altere la solicitud en curso.';


--
-- Name: COLUMN autorizaciones_solicitudes.usuario_solicitante_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.usuario_solicitante_id IS 'Usuario que intentó ejecutar la transición y desencadenó la solicitud. Referencia core.usuarios.';


--
-- Name: COLUMN autorizaciones_solicitudes.usuario_autorizador_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.usuario_autorizador_id IS 'Usuario que efectivamente respondió la solicitud (aprobó o rechazó). Puede diferir del autorizador asignado por la regla si el rol permite a varios usuarios responder. NULL mientras la solicitud esté pendiente.';


--
-- Name: COLUMN autorizaciones_solicitudes.estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.estado IS 'Estado del ciclo de vida de la solicitud: pendiente (en espera de respuesta), aprobada (autorizador aprobó; el documento pasa a estado_autorizacion=aprobada), rechazada (autorizador rechazó), cancelada (el solicitante retiró la solicitud; el documento vuelve a estado_autorizacion=no_requerida).';


--
-- Name: COLUMN autorizaciones_solicitudes.comentario_solicitante; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.comentario_solicitante IS 'Comentario opcional que el solicitante puede incluir al crear la solicitud.';


--
-- Name: COLUMN autorizaciones_solicitudes.comentario_autorizador; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.comentario_autorizador IS 'Comentario opcional que el autorizador incluye al aprobar o rechazar.';


--
-- Name: COLUMN autorizaciones_solicitudes.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.created_at IS 'Marca de tiempo de creación de la solicitud (UTC).';


--
-- Name: COLUMN autorizaciones_solicitudes.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.updated_at IS 'Marca de tiempo de la última modificación (UTC). Se actualiza al responder o cancelar.';


--
-- Name: COLUMN autorizaciones_solicitudes.respondido_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_solicitudes.respondido_at IS 'Marca de tiempo en que el autorizador respondió (aprobó o rechazó). NULL mientras la solicitud esté pendiente o cancelada.';


--
-- Name: autorizaciones_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.autorizaciones_solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: autorizaciones_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.autorizaciones_solicitudes_id_seq OWNED BY public.autorizaciones_solicitudes.id;


--
-- Name: autorizaciones_solicitudes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.autorizaciones_solicitudes_id_seq'::regclass);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: idx_aut_sol_autorizador_resp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_autorizador_resp ON public.autorizaciones_solicitudes USING btree (usuario_autorizador_id);


--
-- Name: INDEX idx_aut_sol_autorizador_resp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_autorizador_resp IS 'Acelera la búsqueda de solicitudes respondidas por un autorizador específico.';


--
-- Name: idx_aut_sol_doc_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_doc_origen ON public.autorizaciones_solicitudes USING btree (documento_origen_id);


--
-- Name: INDEX idx_aut_sol_doc_origen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_doc_origen IS 'Acelera la búsqueda de solicitudes existentes para un documento origen concreto; usado al verificar si ya existe una solicitud pendiente antes de crear una nueva.';


--
-- Name: idx_aut_sol_empresa_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_empresa_estado ON public.autorizaciones_solicitudes USING btree (empresa_id, estado);


--
-- Name: INDEX idx_aut_sol_empresa_estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_empresa_estado IS 'Acelera la consulta de solicitudes por empresa y estado; cubre el filtro principal de la bandeja (empresa_id + estado=pendiente) y de Mis Solicitudes.';


--
-- Name: idx_aut_sol_solicitante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_sol_solicitante ON public.autorizaciones_solicitudes USING btree (usuario_solicitante_id);


--
-- Name: INDEX idx_aut_sol_solicitante; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_sol_solicitante IS 'Acelera la vista "Mis Solicitudes", que filtra por usuario_solicitante_id.';


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_documento_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_documento_origen_id_fkey FOREIGN KEY (documento_origen_id) REFERENCES public.documentos(id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_regla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES public.autorizaciones_reglas(id);


--
-- Name: autorizaciones_solicitudes autorizaciones_solicitudes_usuario_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_solicitudes
    ADD CONSTRAINT autorizaciones_solicitudes_usuario_solicitante_id_fkey FOREIGN KEY (usuario_solicitante_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict igHHFlqTwqqZaUjpvVZL1rlCyd1QeZTS64gvOtjF23GfWtmU5A5utvutgIp5oCN

