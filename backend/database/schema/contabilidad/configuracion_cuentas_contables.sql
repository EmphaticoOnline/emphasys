-- Schema: contabilidad
-- Table: configuracion_cuentas_contables
-- Generated automatically

--
-- PostgreSQL database dump
--

\restrict nlQTlWk8CV4xesl3SKaVAhpVtIVbHoll1lbS43JUWiaVJK6gELEevG0f2mY8I26

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
-- Name: configuracion_cuentas_contables; Type: TABLE; Schema: contabilidad; Owner: -
--

CREATE TABLE contabilidad.configuracion_cuentas_contables (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    cuenta_id bigint NOT NULL,
    contacto_id integer,
    producto_id integer,
    almacen_id integer,
    finanzas_cuenta_id integer,
    concepto_id integer,
    impuesto_id character varying(30),
    producto_familia character varying(50),
    producto_linea character varying(50),
    producto_clasificacion character varying(50),
    producto_tipo character varying(30),
    uso_contable character varying(60) NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    notas text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_config_cuentas_una_sola_entidad CHECK (((((((((((((contacto_id IS NOT NULL))::integer + ((producto_id IS NOT NULL))::integer) + ((almacen_id IS NOT NULL))::integer) + ((finanzas_cuenta_id IS NOT NULL))::integer) + ((concepto_id IS NOT NULL))::integer) + ((impuesto_id IS NOT NULL))::integer) + ((producto_familia IS NOT NULL))::integer) + ((producto_linea IS NOT NULL))::integer) + ((producto_clasificacion IS NOT NULL))::integer) + ((producto_tipo IS NOT NULL))::integer) <= 1)),
    CONSTRAINT chk_config_cuentas_uso_contable CHECK (((uso_contable)::text = ANY ((ARRAY['cliente_cxc'::character varying, 'proveedor_cxp'::character varying, 'banco_caja'::character varying, 'concepto_tesoreria'::character varying, 'venta_producto'::character varying, 'compra_producto'::character varying, 'inventario_almacen'::character varying, 'costo_ventas'::character varying, 'ajuste_inventario_positivo'::character varying, 'ajuste_inventario_negativo'::character varying, 'merma_inventario'::character varying, 'traspaso_inventario'::character varying, 'iva_trasladado'::character varying, 'iva_acreditable'::character varying, 'retencion_iva'::character varying, 'retencion_isr'::character varying, 'ieps'::character varying, 'impuesto_otro'::character varying])::text[])))
);


--
-- Name: TABLE configuracion_cuentas_contables; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON TABLE contabilidad.configuracion_cuentas_contables IS 'Tabla central para configurar las cuentas contables usadas por el motor de contabilización automática del ERP. Permite asignar cuentas a contactos, productos, almacenes, cuentas financieras, conceptos, impuestos y atributos de producto.';


--
-- Name: COLUMN configuracion_cuentas_contables.id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.id IS 'Identificador interno único del registro de configuración contable.';


--
-- Name: COLUMN configuracion_cuentas_contables.empresa_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.empresa_id IS 'Empresa propietaria de esta configuración contable. Toda configuración es independiente por empresa.';


--
-- Name: COLUMN configuracion_cuentas_contables.cuenta_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.cuenta_id IS 'Cuenta contable que será usada al generar pólizas. Apunta a contabilidad.cuentas.id.';


--
-- Name: COLUMN configuracion_cuentas_contables.contacto_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.contacto_id IS 'Contacto al que aplica esta configuración. Se usa para clientes y proveedores. Si el contacto es cliente, normalmente representa CxC; si es proveedor, normalmente representa CxP.';


--
-- Name: COLUMN configuracion_cuentas_contables.producto_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_id IS 'Producto específico al que aplica esta configuración. Puede usarse para ventas, compras, inventario o costo de ventas.';


--
-- Name: COLUMN configuracion_cuentas_contables.almacen_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.almacen_id IS 'Almacén específico al que aplica esta configuración. Se usa principalmente para determinar la cuenta de almacén o inventario en movimientos de inventario.';


--
-- Name: COLUMN configuracion_cuentas_contables.finanzas_cuenta_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.finanzas_cuenta_id IS 'Cuenta financiera específica, banco o caja, a la que aplica esta configuración. Cada banco o caja debe tener su propia cuenta contable.';


--
-- Name: COLUMN configuracion_cuentas_contables.concepto_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.concepto_id IS 'Concepto operativo al que aplica esta configuración. Se usa principalmente en movimientos de tesorería que no corresponden a cobros de clientes ni pagos a proveedores.';


--
-- Name: COLUMN configuracion_cuentas_contables.impuesto_id; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.impuesto_id IS 'Impuesto al que aplica esta configuración. Se usa para IVA trasladado, IVA acreditable, retenciones, IEPS u otros impuestos.';


--
-- Name: COLUMN configuracion_cuentas_contables.producto_familia; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_familia IS 'Familia de producto a la que aplica esta configuración cuando no se desea configurar cuenta producto por producto.';


--
-- Name: COLUMN configuracion_cuentas_contables.producto_linea; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_linea IS 'Línea de producto a la que aplica esta configuración cuando se desea resolver cuentas por agrupación de producto.';


--
-- Name: COLUMN configuracion_cuentas_contables.producto_clasificacion; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_clasificacion IS 'Clasificación de producto a la que aplica esta configuración cuando se desea resolver cuentas por clasificación.';


--
-- Name: COLUMN configuracion_cuentas_contables.producto_tipo; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_tipo IS 'Tipo de producto al que aplica esta configuración, por ejemplo producto, servicio o manufacturable, según el valor usado en public.productos.tipo_producto.';


--
-- Name: COLUMN configuracion_cuentas_contables.uso_contable; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.uso_contable IS 'Uso funcional de la cuenta dentro del motor contable. Define para qué se usa la cuenta: cliente_cxc, proveedor_cxp, banco_caja, venta_producto, inventario_almacen, costo_ventas, iva_trasladado, iva_acreditable, etc.';


--
-- Name: COLUMN configuracion_cuentas_contables.activa; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.activa IS 'Indica si esta configuración está vigente. Si es false, el motor de contabilización debe ignorarla.';


--
-- Name: COLUMN configuracion_cuentas_contables.notas; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.notas IS 'Notas internas para documentar el criterio, alcance o motivo de esta configuración contable.';


--
-- Name: COLUMN configuracion_cuentas_contables.creado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.creado_en IS 'Fecha y hora de creación del registro.';


--
-- Name: COLUMN configuracion_cuentas_contables.actualizado_en; Type: COMMENT; Schema: contabilidad; Owner: -
--

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.actualizado_en IS 'Fecha y hora de la última actualización del registro.';


--
-- Name: configuracion_cuentas_contables_id_seq; Type: SEQUENCE; Schema: contabilidad; Owner: -
--

CREATE SEQUENCE contabilidad.configuracion_cuentas_contables_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_cuentas_contables_id_seq; Type: SEQUENCE OWNED BY; Schema: contabilidad; Owner: -
--

ALTER SEQUENCE contabilidad.configuracion_cuentas_contables_id_seq OWNED BY contabilidad.configuracion_cuentas_contables.id;


--
-- Name: configuracion_cuentas_contables id; Type: DEFAULT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables ALTER COLUMN id SET DEFAULT nextval('contabilidad.configuracion_cuentas_contables_id_seq'::regclass);


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_pkey; Type: CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_pkey PRIMARY KEY (id);


--
-- Name: idx_config_cuentas_almacen; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_config_cuentas_almacen ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, almacen_id, uso_contable) WHERE ((almacen_id IS NOT NULL) AND (activa = true));


--
-- Name: idx_config_cuentas_concepto; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_config_cuentas_concepto ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, concepto_id, uso_contable) WHERE ((concepto_id IS NOT NULL) AND (activa = true));


--
-- Name: idx_config_cuentas_contacto; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_config_cuentas_contacto ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, contacto_id, uso_contable) WHERE ((contacto_id IS NOT NULL) AND (activa = true));


--
-- Name: idx_config_cuentas_empresa_uso; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_config_cuentas_empresa_uso ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, uso_contable) WHERE (activa = true);


--
-- Name: idx_config_cuentas_finanzas_cuenta; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_config_cuentas_finanzas_cuenta ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, finanzas_cuenta_id, uso_contable) WHERE ((finanzas_cuenta_id IS NOT NULL) AND (activa = true));


--
-- Name: idx_config_cuentas_impuesto; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_config_cuentas_impuesto ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, impuesto_id, uso_contable) WHERE ((impuesto_id IS NOT NULL) AND (activa = true));


--
-- Name: idx_config_cuentas_producto; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE INDEX idx_config_cuentas_producto ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, producto_id, uso_contable) WHERE ((producto_id IS NOT NULL) AND (activa = true));


--
-- Name: uq_config_cuentas_contables_unica; Type: INDEX; Schema: contabilidad; Owner: -
--

CREATE UNIQUE INDEX uq_config_cuentas_contables_unica ON contabilidad.configuracion_cuentas_contables USING btree (empresa_id, uso_contable, COALESCE(contacto_id, '-1'::integer), COALESCE(producto_id, '-1'::integer), COALESCE(almacen_id, '-1'::integer), COALESCE(finanzas_cuenta_id, '-1'::integer), COALESCE(concepto_id, '-1'::integer), COALESCE(impuesto_id, ''::character varying), COALESCE(producto_familia, ''::character varying), COALESCE(producto_linea, ''::character varying), COALESCE(producto_clasificacion, ''::character varying), COALESCE(producto_tipo, ''::character varying));


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_almacen_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_almacen_id_fkey FOREIGN KEY (almacen_id) REFERENCES inventario.almacenes(id) ON DELETE CASCADE;


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_concepto_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_concepto_id_fkey FOREIGN KEY (concepto_id) REFERENCES public.conceptos(id) ON DELETE CASCADE;


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_contacto_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES public.contactos(id) ON DELETE CASCADE;


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_cuenta_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES contabilidad.cuentas(id);


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_empresa_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES core.empresas(id);


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_finanzas_cuenta_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_finanzas_cuenta_id_fkey FOREIGN KEY (finanzas_cuenta_id) REFERENCES public.finanzas_cuentas(id) ON DELETE CASCADE;


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_impuesto_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_impuesto_id_fkey FOREIGN KEY (impuesto_id) REFERENCES public.impuestos(id) ON DELETE CASCADE;


--
-- Name: configuracion_cuentas_contables configuracion_cuentas_contables_producto_id_fkey; Type: FK CONSTRAINT; Schema: contabilidad; Owner: -
--

ALTER TABLE ONLY contabilidad.configuracion_cuentas_contables
    ADD CONSTRAINT configuracion_cuentas_contables_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict nlQTlWk8CV4xesl3SKaVAhpVtIVbHoll1lbS43JUWiaVJK6gELEevG0f2mY8I26

