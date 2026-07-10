-- =========================================================
-- SCRIPT:
-- 20260715_create_contabilidad_configuracion_cuentas_contables.sql
--
-- Tabla central de configuración contable para la contabilización
-- automática de movimientos provenientes de otros módulos del ERP.
-- Permite asignar cuentas contables (contabilidad.cuentas) a entidades
-- operativas reales (contactos, productos, almacenes, cuentas
-- financieras, conceptos, impuestos y atributos de producto) sin
-- agregar campos cuenta_contable_id sueltos en cada tabla operativa.
--
-- Esta fase solo crea la tabla y su administración; no genera pólizas
-- ni se conecta todavía con facturas, inventarios ni finanzas.
-- =========================================================

BEGIN;

CREATE TABLE contabilidad.configuracion_cuentas_contables (
    id BIGSERIAL PRIMARY KEY,

    empresa_id BIGINT NOT NULL REFERENCES core.empresas(id),
    cuenta_id BIGINT NOT NULL REFERENCES contabilidad.cuentas(id),

    contacto_id INTEGER NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
    producto_id INTEGER NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    almacen_id INTEGER NULL REFERENCES inventario.almacenes(id) ON DELETE CASCADE,
    finanzas_cuenta_id INTEGER NULL REFERENCES public.finanzas_cuentas(id) ON DELETE CASCADE,
    concepto_id INTEGER NULL REFERENCES public.conceptos(id) ON DELETE CASCADE,
    impuesto_id VARCHAR(30) NULL REFERENCES public.impuestos(id) ON DELETE CASCADE,

    producto_familia VARCHAR(50) NULL,
    producto_linea VARCHAR(50) NULL,
    producto_clasificacion VARCHAR(50) NULL,
    producto_tipo VARCHAR(30) NULL,

    uso_contable VARCHAR(60) NOT NULL,

    activa BOOLEAN NOT NULL DEFAULT true,
    notas TEXT NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_config_cuentas_una_sola_entidad CHECK (
        (
            (contacto_id IS NOT NULL)::int +
            (producto_id IS NOT NULL)::int +
            (almacen_id IS NOT NULL)::int +
            (finanzas_cuenta_id IS NOT NULL)::int +
            (concepto_id IS NOT NULL)::int +
            (impuesto_id IS NOT NULL)::int +
            (producto_familia IS NOT NULL)::int +
            (producto_linea IS NOT NULL)::int +
            (producto_clasificacion IS NOT NULL)::int +
            (producto_tipo IS NOT NULL)::int
        ) <= 1
    ),

    CONSTRAINT chk_config_cuentas_uso_contable CHECK (
        uso_contable IN (
            'cliente_cxc',
            'proveedor_cxp',
            'banco_caja',
            'concepto_tesoreria',

            'venta_producto',
            'compra_producto',
            'inventario_almacen',
            'costo_ventas',

            'ajuste_inventario_positivo',
            'ajuste_inventario_negativo',
            'merma_inventario',
            'traspaso_inventario',

            'iva_trasladado',
            'iva_acreditable',
            'retencion_iva',
            'retencion_isr',
            'ieps',
            'impuesto_otro'
        )
    )
);

CREATE UNIQUE INDEX uq_config_cuentas_contables_unica
ON contabilidad.configuracion_cuentas_contables (
    empresa_id,
    uso_contable,
    COALESCE(contacto_id, -1),
    COALESCE(producto_id, -1),
    COALESCE(almacen_id, -1),
    COALESCE(finanzas_cuenta_id, -1),
    COALESCE(concepto_id, -1),
    COALESCE(impuesto_id, ''),
    COALESCE(producto_familia, ''),
    COALESCE(producto_linea, ''),
    COALESCE(producto_clasificacion, ''),
    COALESCE(producto_tipo, '')
);

CREATE INDEX idx_config_cuentas_empresa_uso
ON contabilidad.configuracion_cuentas_contables (empresa_id, uso_contable)
WHERE activa = true;

CREATE INDEX idx_config_cuentas_contacto
ON contabilidad.configuracion_cuentas_contables (empresa_id, contacto_id, uso_contable)
WHERE contacto_id IS NOT NULL AND activa = true;

CREATE INDEX idx_config_cuentas_producto
ON contabilidad.configuracion_cuentas_contables (empresa_id, producto_id, uso_contable)
WHERE producto_id IS NOT NULL AND activa = true;

CREATE INDEX idx_config_cuentas_almacen
ON contabilidad.configuracion_cuentas_contables (empresa_id, almacen_id, uso_contable)
WHERE almacen_id IS NOT NULL AND activa = true;

CREATE INDEX idx_config_cuentas_finanzas_cuenta
ON contabilidad.configuracion_cuentas_contables (empresa_id, finanzas_cuenta_id, uso_contable)
WHERE finanzas_cuenta_id IS NOT NULL AND activa = true;

CREATE INDEX idx_config_cuentas_concepto
ON contabilidad.configuracion_cuentas_contables (empresa_id, concepto_id, uso_contable)
WHERE concepto_id IS NOT NULL AND activa = true;

CREATE INDEX idx_config_cuentas_impuesto
ON contabilidad.configuracion_cuentas_contables (empresa_id, impuesto_id, uso_contable)
WHERE impuesto_id IS NOT NULL AND activa = true;

COMMENT ON TABLE contabilidad.configuracion_cuentas_contables IS
'Tabla central para configurar las cuentas contables usadas por el motor de contabilización automática del ERP. Permite asignar cuentas a contactos, productos, almacenes, cuentas financieras, conceptos, impuestos y atributos de producto.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.id IS
'Identificador interno único del registro de configuración contable.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.empresa_id IS
'Empresa propietaria de esta configuración contable. Toda configuración es independiente por empresa.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.cuenta_id IS
'Cuenta contable que será usada al generar pólizas. Apunta a contabilidad.cuentas.id.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.contacto_id IS
'Contacto al que aplica esta configuración. Se usa para clientes y proveedores. Si el contacto es cliente, normalmente representa CxC; si es proveedor, normalmente representa CxP.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_id IS
'Producto específico al que aplica esta configuración. Puede usarse para ventas, compras, inventario o costo de ventas.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.almacen_id IS
'Almacén específico al que aplica esta configuración. Se usa principalmente para determinar la cuenta de almacén o inventario en movimientos de inventario.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.finanzas_cuenta_id IS
'Cuenta financiera específica, banco o caja, a la que aplica esta configuración. Cada banco o caja debe tener su propia cuenta contable.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.concepto_id IS
'Concepto operativo al que aplica esta configuración. Se usa principalmente en movimientos de tesorería que no corresponden a cobros de clientes ni pagos a proveedores.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.impuesto_id IS
'Impuesto al que aplica esta configuración. Se usa para IVA trasladado, IVA acreditable, retenciones, IEPS u otros impuestos.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_familia IS
'Familia de producto a la que aplica esta configuración cuando no se desea configurar cuenta producto por producto.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_linea IS
'Línea de producto a la que aplica esta configuración cuando se desea resolver cuentas por agrupación de producto.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_clasificacion IS
'Clasificación de producto a la que aplica esta configuración cuando se desea resolver cuentas por clasificación.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.producto_tipo IS
'Tipo de producto al que aplica esta configuración, por ejemplo producto, servicio o manufacturable, según el valor usado en public.productos.tipo_producto.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.uso_contable IS
'Uso funcional de la cuenta dentro del motor contable. Define para qué se usa la cuenta: cliente_cxc, proveedor_cxp, banco_caja, venta_producto, inventario_almacen, costo_ventas, iva_trasladado, iva_acreditable, etc.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.activa IS
'Indica si esta configuración está vigente. Si es false, el motor de contabilización debe ignorarla.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.notas IS
'Notas internas para documentar el criterio, alcance o motivo de esta configuración contable.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.creado_en IS
'Fecha y hora de creación del registro.';

COMMENT ON COLUMN contabilidad.configuracion_cuentas_contables.actualizado_en IS
'Fecha y hora de la última actualización del registro.';

COMMIT;
