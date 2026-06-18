-- Schema: public
-- Table: autorizaciones_reglas
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict yD0V7g7hQXzMZLCCGSyuaiJqSnhEYHzltVeCacEJftfL4eGJws4ScEY4kgnbOas

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
-- Name: autorizaciones_reglas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autorizaciones_reglas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    transicion_id integer NOT NULL,
    monto_minimo numeric(18,4),
    monto_maximo numeric(18,4),
    modo character varying(20) DEFAULT 'flujo'::character varying NOT NULL,
    rol_autorizador_id integer,
    usuario_autorizador_id integer,
    nivel smallint DEFAULT 1 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT autorizaciones_reglas_modo_check CHECK (((modo)::text = ANY ((ARRAY['ninguna'::character varying, 'directa'::character varying, 'flujo'::character varying])::text[]))),
    CONSTRAINT ck_autorizador_segun_modo CHECK ((((modo)::text = 'ninguna'::text) OR ((rol_autorizador_id IS NOT NULL) AND (usuario_autorizador_id IS NULL)) OR ((rol_autorizador_id IS NULL) AND (usuario_autorizador_id IS NOT NULL))))
);


--
-- Name: TABLE autorizaciones_reglas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.autorizaciones_reglas IS 'Políticas de autorización por transición documental y rango de monto. Define si una transición (ej. cotización → factura) requiere autorización y bajo qué modo. Invariante: no pueden existir dos filas activas con la misma transicion_id cuyos rangos [monto_minimo, monto_maximo] se solapen; esta regla se valida en la capa de negocio al insertar o actualizar.';


--
-- Name: COLUMN autorizaciones_reglas.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.id IS 'Identificador interno de la política.';


--
-- Name: COLUMN autorizaciones_reglas.empresa_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.empresa_id IS 'Empresa a la que pertenece esta política. Referencia core.empresas.';


--
-- Name: COLUMN autorizaciones_reglas.transicion_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.transicion_id IS 'Transición documental a la que aplica la política. Referencia core.empresas_tipos_documento_transiciones; contiene el par (tipo_documento_origen, tipo_documento_destino) habilitado para la empresa.';


--
-- Name: COLUMN autorizaciones_reglas.monto_minimo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.monto_minimo IS 'Límite inferior del rango de monto (inclusive). NULL significa sin límite inferior (aplica desde cero).';


--
-- Name: COLUMN autorizaciones_reglas.monto_maximo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.monto_maximo IS 'Límite superior del rango de monto (inclusive). NULL significa sin límite superior (aplica hasta cualquier monto).';


--
-- Name: COLUMN autorizaciones_reglas.modo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.modo IS 'Modo de autorización: ninguna = libre, sin restricción; directa = solo usuarios con el rol/usuario asignado pueden ejecutar la transición; flujo = se crea una solicitud formal y el documento queda bloqueado hasta que el autorizador responda.';


--
-- Name: COLUMN autorizaciones_reglas.rol_autorizador_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.rol_autorizador_id IS 'Rol que puede autorizar la transición en modos directa y flujo. Mutuamente excluyente con usuario_autorizador_id. NULL cuando modo=ninguna.';


--
-- Name: COLUMN autorizaciones_reglas.usuario_autorizador_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.usuario_autorizador_id IS 'Usuario específico que puede autorizar la transición en modos directa y flujo. Mutuamente excluyente con rol_autorizador_id. NULL cuando modo=ninguna.';


--
-- Name: COLUMN autorizaciones_reglas.nivel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.nivel IS 'Nivel de autorización en cadena. Reservado para uso futuro (cadenas de aprobación multinivel). Sprint 2 usa siempre nivel = 1.';


--
-- Name: COLUMN autorizaciones_reglas.activa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.activa IS 'Soft-delete: false oculta la política sin eliminarla. Las políticas inactivas no se evalúan en tiempo de ejecución ni participan en la validación de traslape.';


--
-- Name: COLUMN autorizaciones_reglas.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.created_at IS 'Marca de tiempo de creación del registro (UTC).';


--
-- Name: COLUMN autorizaciones_reglas.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.autorizaciones_reglas.updated_at IS 'Marca de tiempo de la última modificación del registro (UTC).';


--
-- Name: CONSTRAINT ck_autorizador_segun_modo ON autorizaciones_reglas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT ck_autorizador_segun_modo ON public.autorizaciones_reglas IS 'Garantiza coherencia entre modo y autorizador: modo ninguna no requiere autorizador; modos directa y flujo requieren exactamente uno (rol XOR usuario).';


--
-- Name: autorizaciones_reglas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.autorizaciones_reglas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: autorizaciones_reglas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.autorizaciones_reglas_id_seq OWNED BY public.autorizaciones_reglas.id;


--
-- Name: autorizaciones_reglas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas ALTER COLUMN id SET DEFAULT nextval('public.autorizaciones_reglas_id_seq'::regclass);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_pkey PRIMARY KEY (id);


--
-- Name: idx_aut_reglas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_reglas_empresa ON public.autorizaciones_reglas USING btree (empresa_id);


--
-- Name: INDEX idx_aut_reglas_empresa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_reglas_empresa IS 'Acelera la consulta de políticas activas al filtrar por empresa_id.';


--
-- Name: idx_aut_reglas_transicion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aut_reglas_transicion ON public.autorizaciones_reglas USING btree (transicion_id);


--
-- Name: INDEX idx_aut_reglas_transicion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_aut_reglas_transicion IS 'Acelera la búsqueda de políticas para una transición concreta durante la validación en tiempo de ejecución y la detección de traslape de rangos.';


--
-- Name: autorizaciones_reglas autorizaciones_reglas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_rol_autorizador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_rol_autorizador_id_fkey FOREIGN KEY (rol_autorizador_id) REFERENCES core.roles(id);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_transicion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_transicion_id_fkey FOREIGN KEY (transicion_id) REFERENCES core.empresas_tipos_documento_transiciones(id);


--
-- Name: autorizaciones_reglas autorizaciones_reglas_usuario_autorizador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autorizaciones_reglas
    ADD CONSTRAINT autorizaciones_reglas_usuario_autorizador_id_fkey FOREIGN KEY (usuario_autorizador_id) REFERENCES core.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict yD0V7g7hQXzMZLCCGSyuaiJqSnhEYHzltVeCacEJftfL4eGJws4ScEY4kgnbOas

