-- =============================================================================
-- Fase 3.4 — Conciliación Bancaria Básica Manual
-- Agrega saldo_sistema y diferencia al snapshot de conciliación
-- =============================================================================

ALTER TABLE public.finanzas_conciliaciones
  ADD COLUMN IF NOT EXISTS saldo_sistema numeric(15,2),
  ADD COLUMN IF NOT EXISTS diferencia    numeric(15,2);

COMMENT ON COLUMN public.finanzas_conciliaciones.saldo_sistema IS
  'Saldo del sistema informativo calculado al momento de cerrar la conciliación: saldo teórico considerando saldo_inicial + todos los movimientos registrados hasta fecha_corte. No es la base del cuadre.';

COMMENT ON COLUMN public.finanzas_conciliaciones.diferencia IS
  'Diferencia saldo_banco - saldo_conciliado_calculado al momento del cierre. saldo_conciliado_calculado representa el saldo formado por los movimientos efectivamente conciliados.';
