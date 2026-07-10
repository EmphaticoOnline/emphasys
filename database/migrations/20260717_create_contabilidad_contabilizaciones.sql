-- =========================================================
-- SCRIPT:
-- 20260717_create_contabilidad_contabilizaciones.sql
--
-- Infraestructura base para la fase de "contabilización operativa":
-- registra la relación entre las entidades operativas reales del ERP
-- y las pólizas contables generadas para ellas.
--
-- Modelo híbrido (similar a contabilidad.configuracion_cuentas_contables):
-- en vez de un par polimórfico genérico (tipo_documento, documento_id),
-- la fila apunta con FK real a EXACTAMENTE una de las entidades
-- operativas que puede contabilizarse:
--
--   - documento_id             -> public.documentos(id)
--       Cubre facturas de venta, facturas de compra, notas de crédito,
--       cobros, pagos, anticipos, devoluciones documentadas y ajustes
--       documentales: todo lo que en Emphasys vive como un documento
--       en public.documentos. No se agregan columnas sueltas como
--       cobro_id, pago_id, nota_credito_id o anticipo_id: todas esas
--       variantes usan documento_id.
--   - operacion_dinero_id      -> public.finanzas_operaciones(id)
--       Movimientos directos de banco/caja (depósitos y retiros) que
--       NO están representados por un documento en public.documentos.
--   - movimiento_inventario_id -> inventario.movimientos(id)
--       Entradas, salidas, traspasos, ajustes y mermas de inventario
--       que no están representados por un documento en public.documentos.
--
-- tipo_documento se conserva como clasificador descriptivo/operativo
-- (por ejemplo "factura", "nota_credito", "cobro", "ajuste_inventario"),
-- pero ya NO es parte de la relación real: la relación real siempre
-- está en documento_id, operacion_dinero_id o movimiento_inventario_id.
--
-- Esta fase solo crea la tabla y su administración; no genera pólizas
-- ni se conecta todavía con ventas, compras, tesorería ni inventario.
-- No modifica ni reemplaza contabilidad.documentos_polizas.
-- =========================================================

BEGIN;

CREATE TABLE contabilidad.contabilizaciones (
    id BIGSERIAL PRIMARY KEY,

    empresa_id BIGINT NOT NULL REFERENCES core.empresas(id),
    poliza_id BIGINT NOT NULL REFERENCES contabilidad.polizas(id),

    tipo_movimiento VARCHAR(20) NOT NULL,
    tipo_documento VARCHAR(30) NOT NULL,

    documento_id BIGINT NULL REFERENCES public.documentos(id),
    operacion_dinero_id INTEGER NULL REFERENCES public.finanzas_operaciones(id),
    movimiento_inventario_id BIGINT NULL REFERENCES inventario.movimientos(id),

    evento_contable VARCHAR(20) NOT NULL,
    modo_contabilizacion VARCHAR(20) NOT NULL,

    fecha_documento DATE NOT NULL,
    fecha_contabilizacion TIMESTAMPTZ NOT NULL DEFAULT now(),

    usuario_id INTEGER NULL REFERENCES core.usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,

    es_reversa BOOLEAN NOT NULL DEFAULT false,
    contabilizacion_origen_id BIGINT NULL REFERENCES contabilidad.contabilizaciones(id),

    comentario VARCHAR(500) NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_contabilizaciones_tipo_movimiento CHECK (
        tipo_movimiento IN (
            'venta',
            'compra',
            'inventario',
            'tesoreria',
            'cobranza',
            'pago',
            'ajuste'
        )
    ),

    CONSTRAINT chk_contabilizaciones_evento_contable CHECK (
        evento_contable IN (
            'emision',
            'recepcion',
            'cobro',
            'pago',
            'entrada_inventario',
            'salida_inventario',
            'cancelacion',
            'devolucion',
            'ajuste',
            'traspaso'
        )
    ),

    CONSTRAINT chk_contabilizaciones_modo CHECK (
        modo_contabilizacion IN (
            'individual',
            'lote_individual',
            'lote_concentrado',
            'automatico'
        )
    ),

    CONSTRAINT chk_contabilizaciones_reversa_origen CHECK (
        (es_reversa = false AND contabilizacion_origen_id IS NULL)
        OR
        (es_reversa = true AND contabilizacion_origen_id IS NOT NULL)
    ),

    -- Exactamente una referencia operativa por fila: documento, operación
    -- de dinero o movimiento de inventario, nunca varias ni ninguna.
    CONSTRAINT chk_contabilizaciones_una_referencia CHECK (
        (
            (documento_id IS NOT NULL)::int +
            (operacion_dinero_id IS NOT NULL)::int +
            (movimiento_inventario_id IS NOT NULL)::int
        ) = 1
    )
);

-- Evita duplicar una contabilización activa (no reversa) para el mismo
-- documento y evento contable. Las reversas quedan fuera a propósito,
-- ya que conviven con la fila original que reversan.
CREATE UNIQUE INDEX ux_contabilizaciones_documento_evento_activa
ON contabilidad.contabilizaciones (empresa_id, documento_id, evento_contable)
WHERE documento_id IS NOT NULL AND es_reversa = false;

CREATE UNIQUE INDEX ux_contabilizaciones_operacion_dinero_evento_activa
ON contabilidad.contabilizaciones (empresa_id, operacion_dinero_id, evento_contable)
WHERE operacion_dinero_id IS NOT NULL AND es_reversa = false;

CREATE UNIQUE INDEX ux_contabilizaciones_movimiento_inventario_evento_activa
ON contabilidad.contabilizaciones (empresa_id, movimiento_inventario_id, evento_contable)
WHERE movimiento_inventario_id IS NOT NULL AND es_reversa = false;

-- Evita reversar dos veces la misma contabilización original.
CREATE UNIQUE INDEX ux_contabilizaciones_origen_reversa
ON contabilidad.contabilizaciones (contabilizacion_origen_id)
WHERE es_reversa = true;

CREATE INDEX idx_contabilizaciones_empresa
ON contabilidad.contabilizaciones (empresa_id);

CREATE INDEX idx_contabilizaciones_poliza
ON contabilidad.contabilizaciones (poliza_id);

CREATE INDEX idx_contabilizaciones_documento
ON contabilidad.contabilizaciones (documento_id)
WHERE documento_id IS NOT NULL;

CREATE INDEX idx_contabilizaciones_operacion_dinero
ON contabilidad.contabilizaciones (operacion_dinero_id)
WHERE operacion_dinero_id IS NOT NULL;

CREATE INDEX idx_contabilizaciones_movimiento_inventario
ON contabilidad.contabilizaciones (movimiento_inventario_id)
WHERE movimiento_inventario_id IS NOT NULL;

CREATE INDEX idx_contabilizaciones_tipo_movimiento
ON contabilidad.contabilizaciones (tipo_movimiento);

CREATE INDEX idx_contabilizaciones_tipo_documento
ON contabilidad.contabilizaciones (tipo_documento);

CREATE INDEX idx_contabilizaciones_evento_contable
ON contabilidad.contabilizaciones (evento_contable);

CREATE INDEX idx_contabilizaciones_fecha_documento
ON contabilidad.contabilizaciones (fecha_documento);

CREATE INDEX idx_contabilizaciones_fecha_contabilizacion
ON contabilidad.contabilizaciones (fecha_contabilizacion);

CREATE INDEX idx_contabilizaciones_origen
ON contabilidad.contabilizaciones (contabilizacion_origen_id);

COMMENT ON TABLE contabilidad.contabilizaciones IS
'Registro de control de la contabilización operativa: liga entidades operativas reales del ERP (documentos de public.documentos, operaciones de dinero de public.finanzas_operaciones o movimientos de inventario de inventario.movimientos) con la póliza contable generada para ellas. No genera pólizas por sí misma; solo documenta el resultado de un proceso de contabilización controlado (individual, lote o concentrado).';

COMMENT ON COLUMN contabilidad.contabilizaciones.id IS
'Identificador interno único del registro de contabilización.';

COMMENT ON COLUMN contabilidad.contabilizaciones.empresa_id IS
'Empresa propietaria de la contabilización.';

COMMENT ON COLUMN contabilidad.contabilizaciones.poliza_id IS
'Póliza contable generada. Varias filas pueden compartir la misma póliza cuando la contabilización fue concentrada.';

COMMENT ON COLUMN contabilidad.contabilizaciones.tipo_movimiento IS
'Familia principal del movimiento: venta, compra, inventario, tesoreria, cobranza, pago o ajuste. No expresa el documento ni el evento (ver tipo_documento y evento_contable).';

COMMENT ON COLUMN contabilidad.contabilizaciones.tipo_documento IS
'Clasificador descriptivo/operativo del origen (por ejemplo factura, nota_credito, cobro, pago, anticipo, transferencia, ajuste_inventario). No es la relación real: la relación real está en documento_id, operacion_dinero_id o movimiento_inventario_id.';

COMMENT ON COLUMN contabilidad.contabilizaciones.documento_id IS
'Documento operativo contabilizado. Cubre facturas de venta y compra, notas de crédito, cobros, pagos, anticipos, devoluciones documentadas y ajustes documentales, todos ellos representados en public.documentos.';

COMMENT ON COLUMN contabilidad.contabilizaciones.operacion_dinero_id IS
'Operación de dinero contabilizada (depósito o retiro de banco/caja) cuando no está representada por un documento en public.documentos. Apunta a public.finanzas_operaciones.';

COMMENT ON COLUMN contabilidad.contabilizaciones.movimiento_inventario_id IS
'Movimiento de inventario contabilizado (entrada, salida, traspaso, ajuste o merma) cuando no está representado por un documento en public.documentos. Apunta a inventario.movimientos.';

COMMENT ON COLUMN contabilidad.contabilizaciones.evento_contable IS
'Evento contable específico que originó la póliza: emision, recepcion, cobro, pago, entrada_inventario, salida_inventario, cancelacion, devolucion, ajuste o traspaso.';

COMMENT ON COLUMN contabilidad.contabilizaciones.modo_contabilizacion IS
'Modo en que se generó la contabilización: individual, lote_individual (una póliza por documento dentro de un proceso por lote), lote_concentrado (una póliza para varios documentos) o automatico (reservado para una fase futura).';

COMMENT ON COLUMN contabilidad.contabilizaciones.fecha_documento IS
'Fecha del documento u operación original, para reportes y validaciones por rango de fechas.';

COMMENT ON COLUMN contabilidad.contabilizaciones.fecha_contabilizacion IS
'Fecha y hora en que se ejecutó el proceso de contabilización.';

COMMENT ON COLUMN contabilidad.contabilizaciones.usuario_id IS
'Usuario que ejecutó la contabilización. Nulo si no se pudo determinar o se generó de forma automática.';

COMMENT ON COLUMN contabilidad.contabilizaciones.es_reversa IS
'Indica si esta fila es una reversa contable de otra contabilización (ligada mediante contabilizacion_origen_id) en lugar de una contabilización original.';

COMMENT ON COLUMN contabilidad.contabilizaciones.contabilizacion_origen_id IS
'Contabilización original que esta fila reversa. Obligatorio cuando es_reversa es true; debe ser nulo en caso contrario.';

COMMENT ON COLUMN contabilidad.contabilizaciones.comentario IS
'Comentario libre sobre la contabilización o la reversa, por ejemplo el motivo de la cancelación.';

COMMENT ON COLUMN contabilidad.contabilizaciones.creado_en IS
'Fecha y hora de creación del registro.';

COMMENT ON COLUMN contabilidad.contabilizaciones.actualizado_en IS
'Fecha y hora de la última actualización del registro.';

COMMENT ON CONSTRAINT chk_contabilizaciones_una_referencia ON contabilidad.contabilizaciones IS
'Obliga a que cada fila tenga exactamente una referencia operativa: documento_id, operacion_dinero_id o movimiento_inventario_id.';

COMMENT ON INDEX contabilidad.ux_contabilizaciones_documento_evento_activa IS
'Impide duplicar una contabilización activa (no reversa) para el mismo documento y evento contable dentro de una empresa.';

COMMENT ON INDEX contabilidad.ux_contabilizaciones_operacion_dinero_evento_activa IS
'Impide duplicar una contabilización activa (no reversa) para la misma operación de dinero y evento contable dentro de una empresa.';

COMMENT ON INDEX contabilidad.ux_contabilizaciones_movimiento_inventario_evento_activa IS
'Impide duplicar una contabilización activa (no reversa) para el mismo movimiento de inventario y evento contable dentro de una empresa.';

COMMENT ON INDEX contabilidad.ux_contabilizaciones_origen_reversa IS
'Impide registrar más de una reversa para la misma contabilización original.';

COMMIT;
