BEGIN;

DROP TABLE IF EXISTS public.aplicaciones;

-- =========================================================
-- TABLA aplicaciones
-- =========================================================

CREATE TABLE IF NOT EXISTS public.aplicaciones (
    id serial4 NOT NULL,
    empresa_id int4 NOT NULL,

    -- origen del saldo
    finanzas_operacion_id int4 NULL,
    documento_origen_id int4 NULL,

    -- destino del saldo
    documento_destino_id int4 NOT NULL,

    monto numeric(15,2) NOT NULL,
    monto_moneda_documento numeric(15,2) NOT NULL,

    fecha_aplicacion timestamptz DEFAULT now() NOT NULL,
    fecha_creacion timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT aplicaciones_pkey PRIMARY KEY (id)
);

-- =========================================================
-- COMMENTS TABLA
-- =========================================================

COMMENT ON TABLE public.aplicaciones IS
'Registra aplicaciones de saldo desde pagos o notas de crédito hacia documentos destino (por ejemplo facturas). Soporta multimoneda.';

COMMENT ON COLUMN public.aplicaciones.id IS
'Identificador único de la aplicación.';

COMMENT ON COLUMN public.aplicaciones.empresa_id IS
'Empresa a la que pertenece la aplicación (soporte multiempresa).';

COMMENT ON COLUMN public.aplicaciones.finanzas_operacion_id IS
'Origen de la aplicación cuando proviene de una operación financiera (pago de banco o caja).';

COMMENT ON COLUMN public.aplicaciones.documento_origen_id IS
'Origen de la aplicación cuando proviene de un documento (por ejemplo una nota de crédito).';

COMMENT ON COLUMN public.aplicaciones.documento_destino_id IS
'Documento que recibe la aplicación de saldo (normalmente una factura).';

COMMENT ON COLUMN public.aplicaciones.monto IS
'Monto aplicado en moneda base del sistema (por ejemplo MXN). Se descuenta del saldo del origen.';

COMMENT ON COLUMN public.aplicaciones.monto_moneda_documento IS
'Monto aplicado expresado en la moneda del documento destino. Se utiliza para calcular el saldo del documento destino.';

COMMENT ON COLUMN public.aplicaciones.fecha_aplicacion IS
'Fecha efectiva en la que se realiza la aplicación del saldo.';

COMMENT ON COLUMN public.aplicaciones.fecha_creacion IS
'Fecha en que se creó el registro de la aplicación en el sistema.';

-- =========================================================
-- FOREIGN KEYS
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_empresa'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_operacion'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_operacion
        FOREIGN KEY (finanzas_operacion_id)
        REFERENCES public.finanzas_operaciones(id)
        ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_doc_origen'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_doc_origen
        FOREIGN KEY (documento_origen_id)
        REFERENCES public.documentos(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aplicaciones_doc_destino'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT fk_aplicaciones_doc_destino
        FOREIGN KEY (documento_destino_id)
        REFERENCES public.documentos(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

-- =========================================================
-- CHECK CONSTRAINT
-- Solo uno de los dos orígenes puede existir
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_aplicacion_origen'
    ) THEN
        ALTER TABLE public.aplicaciones
        ADD CONSTRAINT chk_aplicacion_origen
        CHECK (
            (finanzas_operacion_id IS NOT NULL AND documento_origen_id IS NULL)
            OR
            (finanzas_operacion_id IS NULL AND documento_origen_id IS NOT NULL)
        );
    END IF;
END $$;

-- =========================================================
-- ÍNDICES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_aplicaciones_empresa
ON public.aplicaciones(empresa_id);

COMMENT ON INDEX idx_aplicaciones_empresa IS
'Permite filtrar rápidamente aplicaciones por empresa.';

CREATE INDEX IF NOT EXISTS idx_aplicaciones_operacion
ON public.aplicaciones(finanzas_operacion_id);

COMMENT ON INDEX idx_aplicaciones_operacion IS
'Optimiza consultas para calcular saldo de operaciones financieras (pagos).';

CREATE INDEX IF NOT EXISTS idx_aplicaciones_doc_origen
ON public.aplicaciones(documento_origen_id);

COMMENT ON INDEX idx_aplicaciones_doc_origen IS
'Optimiza consultas para calcular saldo disponible de notas de crédito.';

CREATE INDEX IF NOT EXISTS idx_aplicaciones_doc_destino
ON public.aplicaciones(documento_destino_id);

COMMENT ON INDEX idx_aplicaciones_doc_destino IS
'Optimiza consultas para calcular saldo pendiente de documentos destino (facturas).';

ALTER TABLE finanzas_operaciones
ADD COLUMN naturaleza_operacion VARCHAR(30) NOT NULL DEFAULT 'movimiento_general';

CREATE INDEX idx_finanzas_operaciones_empresa_naturaleza
ON finanzas_operaciones (empresa_id, naturaleza_operacion);

CREATE INDEX idx_aplicaciones_operacion_empresa
ON aplicaciones (empresa_id, finanzas_operacion_id);


-- Crea la vista documentos_saldo para compatibilidad con consultas de finanzas
-- Calcula el saldo como total del documento menos las aplicaciones al documento destino
CREATE OR REPLACE VIEW public.documentos_saldo AS
SELECT
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total,
    d.total - COALESCE(SUM(a.monto), 0) AS saldo
FROM public.documentos d
LEFT JOIN public.aplicaciones a
  ON a.documento_destino_id = d.id
 AND a.empresa_id = d.empresa_id
GROUP BY
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total;

COMMENT ON VIEW public.documentos_saldo IS 'Vista de compatibilidad: id, empresa_id, datos básicos y saldo = total - aplicaciones (COALESCE).';



COMMIT;