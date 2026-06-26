-- =============================================================================
-- Fase 3.4 — Deshacer conciliaciones bancarias
-- Agrega columnas de ciclo de vida a finanzas_conciliaciones
-- =============================================================================

ALTER TABLE public.finanzas_conciliaciones
  ADD COLUMN IF NOT EXISTS estatus          VARCHAR(20)   NOT NULL DEFAULT 'cerrada',
  ADD COLUMN IF NOT EXISTS anulada_en       TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS anulada_por      INTEGER       NULL,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT          NULL;

COMMENT ON COLUMN public.finanzas_conciliaciones.estatus IS
  'Estado de la conciliación: cerrada (vigente) o anulada (deshecha, solo para auditoría).';

COMMENT ON COLUMN public.finanzas_conciliaciones.anulada_en IS
  'Fecha y hora en que se deshizo la conciliación.';

COMMENT ON COLUMN public.finanzas_conciliaciones.anulada_por IS
  'ID del usuario que deshizo la conciliación.';

COMMENT ON COLUMN public.finanzas_conciliaciones.motivo_anulacion IS
  'Motivo capturado por el usuario al deshacer la conciliación, para auditoría.';
