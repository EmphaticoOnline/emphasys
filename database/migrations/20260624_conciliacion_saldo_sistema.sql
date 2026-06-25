-- =============================================================================
-- Fase 3.4 — Conciliación Bancaria Básica Manual
-- Agrega saldo_sistema y diferencia al snapshot de conciliación
-- =============================================================================

ALTER TABLE public.finanzas_conciliaciones
  ADD COLUMN IF NOT EXISTS saldo_sistema numeric(15,2),
  ADD COLUMN IF NOT EXISTS diferencia    numeric(15,2);

COMMENT ON COLUMN public.finanzas_conciliaciones.saldo_sistema IS
  'Saldo del sistema calculado al momento de cerrar la conciliación (saldo_inicial + movimientos hasta fecha_corte).';

COMMENT ON COLUMN public.finanzas_conciliaciones.diferencia IS
  'Diferencia saldo_banco - saldo_sistema al momento del cierre.';
