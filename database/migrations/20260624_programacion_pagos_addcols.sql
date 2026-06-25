-- =============================================================================
-- Fase 3.2B — Ejecutar pago sobre programación de pago
-- Agrega referencias al documento pago_proveedor y operación bancaria creados
-- al ejecutar el pago.
-- =============================================================================

ALTER TABLE public.finanzas_programacion_pagos
  ADD COLUMN IF NOT EXISTS documento_pago_id      integer
      REFERENCES public.documentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finanzas_operacion_id  integer
      REFERENCES public.finanzas_operaciones(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.finanzas_programacion_pagos.documento_pago_id IS
  'Documento pago_proveedor creado al ejecutar el pago real (Fase 3.2B). NULL hasta que se pague.';

COMMENT ON COLUMN public.finanzas_programacion_pagos.finanzas_operacion_id IS
  'Operación bancaria (finanzas_operaciones) creada al ejecutar el pago. NULL hasta que se pague.';

CREATE INDEX IF NOT EXISTS idx_prog_pagos_doc_pago
    ON public.finanzas_programacion_pagos (documento_pago_id)
    WHERE documento_pago_id IS NOT NULL;
