-- Fase 1 estabilización Finanzas/Tesorería: trazabilidad básica de usuario.
-- Agrega created_by (nullable) a las dos tablas financieras principales.
-- Los registros históricos quedan con NULL; solo los nuevos registros se poblarán.
-- Sin FK para evitar bloqueos si un usuario es eliminado (consistente con finanzas_transferencias.usuario_id).

ALTER TABLE public.finanzas_operaciones
  ADD COLUMN IF NOT EXISTS created_by INTEGER;

ALTER TABLE public.aplicaciones_saldo
  ADD COLUMN IF NOT EXISTS created_by INTEGER;

COMMENT ON COLUMN public.finanzas_operaciones.created_by IS
'ID del usuario que creó la operación (ref. tabla usuarios). NULL en registros anteriores a Fase 1.';

COMMENT ON COLUMN public.aplicaciones_saldo.created_by IS
'ID del usuario que registró la aplicación de saldo (ref. tabla usuarios). NULL en registros anteriores a Fase 1.';
