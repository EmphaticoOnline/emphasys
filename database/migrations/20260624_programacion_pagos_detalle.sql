-- =============================================================================
-- Fase 3.2A v2 — Programación de Pagos: modelo encabezado + detalle
-- Permite múltiples facturas de compra por programación de pago.
-- =============================================================================

-- 1. Tabla de detalles: una fila por factura incluida en la programación
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finanzas_programacion_pagos_detalle (
    id               serial PRIMARY KEY,
    empresa_id       integer NOT NULL,
    programacion_id  integer NOT NULL
        REFERENCES public.finanzas_programacion_pagos(id) ON DELETE CASCADE,
    documento_id     integer NOT NULL
        REFERENCES public.documentos(id) ON DELETE RESTRICT,
    monto_programado numeric(20,6) NOT NULL,
    moneda           varchar(3)  NOT NULL DEFAULT 'MXN',
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_det_monto   CHECK (monto_programado > 0),
    CONSTRAINT uq_det_prog_doc UNIQUE (programacion_id, documento_id)
);

COMMENT ON TABLE public.finanzas_programacion_pagos_detalle IS
  'Detalle de programación de pago: una fila por factura de compra cubierta. '
  'Permite pagar varias facturas del mismo proveedor en un solo movimiento bancario.';

COMMENT ON COLUMN public.finanzas_programacion_pagos_detalle.programacion_id IS
  'FK al encabezado. ON DELETE CASCADE: al cancelar/borrar la programación se eliminan sus detalles.';

COMMENT ON COLUMN public.finanzas_programacion_pagos_detalle.documento_id IS
  'FK a la factura de compra que se pagará parcial o totalmente.';

CREATE INDEX IF NOT EXISTS idx_prog_pagos_det_empresa
    ON public.finanzas_programacion_pagos_detalle (empresa_id);

CREATE INDEX IF NOT EXISTS idx_prog_pagos_det_programacion
    ON public.finanzas_programacion_pagos_detalle (programacion_id);

CREATE INDEX IF NOT EXISTS idx_prog_pagos_det_documento
    ON public.finanzas_programacion_pagos_detalle (documento_id);

-- 2. Migrar registros existentes: cada programación actual → un detalle
-- ---------------------------------------------------------------------------
INSERT INTO public.finanzas_programacion_pagos_detalle
    (empresa_id, programacion_id, documento_id, monto_programado, moneda)
SELECT
    empresa_id,
    id          AS programacion_id,
    documento_id,
    monto_programado,
    moneda
FROM public.finanzas_programacion_pagos
WHERE documento_id IS NOT NULL
ON CONFLICT (programacion_id, documento_id) DO NOTHING;

-- 3. documento_id en el encabezado pasa a ser nullable (campo legacy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.finanzas_programacion_pagos
    ALTER COLUMN documento_id DROP NOT NULL;

COMMENT ON COLUMN public.finanzas_programacion_pagos.documento_id IS
  'LEGACY: apuntaba a la única factura en el modelo v1. '
  'NULL para programaciones creadas con el modelo v2 (multi-factura). '
  'La información canónica de facturas está en finanzas_programacion_pagos_detalle.';
