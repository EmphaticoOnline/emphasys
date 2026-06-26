-- =============================================================================
-- Fase 3.4 — Corrección conceptual: base de cuadre en Conciliación Bancaria
-- Reemplaza saldo_sistema como base de cuadre por saldo_conciliado_calculado
-- =============================================================================

ALTER TABLE public.finanzas_conciliaciones
  ADD COLUMN IF NOT EXISTS saldo_conciliado_anterior   numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_depositos_cotejados   numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_retiros_cotejados     numeric(15,2),
  ADD COLUMN IF NOT EXISTS saldo_conciliado_calculado  numeric(15,2);

COMMENT ON COLUMN public.finanzas_conciliaciones.saldo_conciliado_anterior IS
  'Valor de finanzas_cuentas.saldo_conciliado antes de ejecutar este cierre (base del cuadre).';

COMMENT ON COLUMN public.finanzas_conciliaciones.total_depositos_cotejados IS
  'Suma de depósitos con estado cotejado incluidos en este cierre.';

COMMENT ON COLUMN public.finanzas_conciliaciones.total_retiros_cotejados IS
  'Suma de retiros con estado cotejado incluidos en este cierre.';

COMMENT ON COLUMN public.finanzas_conciliaciones.saldo_conciliado_calculado IS
  'saldo_conciliado_anterior + total_depositos_cotejados - total_retiros_cotejados. Base correcta de cuadre con saldo_banco.';
