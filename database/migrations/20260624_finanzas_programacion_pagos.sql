-- =============================================================================
-- Fase 3.2A — Programación de Pagos a Proveedores
-- tabla: public.finanzas_programacion_pagos
-- =============================================================================
-- Propósito: registrar intenciones de pago sobre facturas de compra pendientes
-- sin crear todavía el pago real (finanzas_operacion).
-- El pago real se implementará en Fase 3.2B.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.finanzas_programacion_pagos (
    id               serial PRIMARY KEY,
    empresa_id       integer NOT NULL,
    documento_id     integer NOT NULL
        REFERENCES public.documentos(id) ON DELETE RESTRICT,
    proveedor_id     integer,
    fecha_programada date NOT NULL,
    monto_programado numeric(20,6) NOT NULL,
    moneda           varchar(3) NOT NULL DEFAULT 'MXN',
    cuenta_origen_id integer
        REFERENCES public.finanzas_cuentas(id) ON DELETE SET NULL,
    metodo_pago_id   integer
        REFERENCES public.finanzas_metodos_pago(id) ON DELETE SET NULL,
    referencia       varchar(100),
    estatus          varchar(20) NOT NULL DEFAULT 'programado',
    notas            text,
    created_by       integer,
    updated_by       integer,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_programacion_monto   CHECK (monto_programado > 0),
    CONSTRAINT chk_programacion_estatus CHECK (estatus IN ('programado', 'pagado', 'cancelado'))
);

COMMENT ON TABLE  public.finanzas_programacion_pagos IS
  'Programación (plan) de pagos a proveedores sobre facturas de compra. '
  'No genera movimientos financieros; el pago real se registra con finanzas_operaciones.';

COMMENT ON COLUMN public.finanzas_programacion_pagos.proveedor_id IS
  'Desnormalizado de documentos.contacto_principal_id para eficiencia de listado.';

COMMENT ON COLUMN public.finanzas_programacion_pagos.estatus IS
  'programado: pendiente de pagar. pagado: se ejecutó el pago real (Fase 3.2B). cancelado: anulado sin pagar.';

CREATE INDEX IF NOT EXISTS idx_prog_pagos_empresa_fecha
    ON public.finanzas_programacion_pagos (empresa_id, fecha_programada);

CREATE INDEX IF NOT EXISTS idx_prog_pagos_documento
    ON public.finanzas_programacion_pagos (documento_id);

CREATE INDEX IF NOT EXISTS idx_prog_pagos_proveedor
    ON public.finanzas_programacion_pagos (empresa_id, proveedor_id)
    WHERE proveedor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prog_pagos_estatus
    ON public.finanzas_programacion_pagos (empresa_id, estatus);
