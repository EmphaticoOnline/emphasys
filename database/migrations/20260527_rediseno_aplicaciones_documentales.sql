-- ============================================================================
-- MIGRACION:
-- 20260527_rediseno_aplicaciones_documentales.sql
--
-- OBJETIVO:
-- Convertir aplicaciones_saldo a un modelo exclusivamente documental.
--
-- CAMBIOS:
-- - eliminar finanzas_operacion_id
-- - hacer documento_origen_id obligatorio
-- - conservar modelo actual de montos
-- - simplificar constraints e índices
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Eliminar constraint viejo
-- ============================================================================

ALTER TABLE public.aplicaciones_saldo
DROP CONSTRAINT IF EXISTS chk_aplicacion_origen;

-- ============================================================================
-- 2. Eliminar FK hacia finanzas_operaciones
-- ============================================================================

ALTER TABLE public.aplicaciones_saldo
DROP CONSTRAINT IF EXISTS fk_aplicaciones_operacion;

-- ============================================================================
-- 3. Eliminar índices relacionados a finanzas_operacion_id
-- ============================================================================

DROP INDEX IF EXISTS public.idx_aplicaciones_operacion_empresa;
DROP INDEX IF EXISTS public.idx_aplicaciones_saldo_operacion;

-- ============================================================================
-- 4. Eliminar columna finanzas_operacion_id
-- ============================================================================

ALTER TABLE public.aplicaciones_saldo
DROP COLUMN IF EXISTS finanzas_operacion_id;

-- ============================================================================
-- 5. Hacer obligatorio documento_origen_id
-- ============================================================================

ALTER TABLE public.aplicaciones_saldo
ALTER COLUMN documento_origen_id SET NOT NULL;

-- ============================================================================
-- 6. Agregar validación para evitar auto-aplicaciones
-- ============================================================================

ALTER TABLE public.aplicaciones_saldo
ADD CONSTRAINT chk_aplicacion_documentos_distintos
CHECK (documento_origen_id <> documento_destino_id);

-- ============================================================================
-- 7. Comentarios actualizados
-- ============================================================================

COMMENT ON TABLE public.aplicaciones_saldo IS
'Registra aplicaciones de saldo entre documentos. Modelo exclusivamente documental.';

COMMENT ON COLUMN public.aplicaciones_saldo.documento_origen_id IS
'Documento que origina el saldo aplicable (pago, nota de crédito, ajuste, etc.).';

COMMENT ON COLUMN public.aplicaciones_saldo.documento_destino_id IS
'Documento que recibe la aplicación de saldo (factura, factura_compra, etc.).';

COMMENT ON COLUMN public.aplicaciones_saldo.monto IS
'Monto aplicado en moneda base del sistema.';

COMMENT ON COLUMN public.aplicaciones_saldo.monto_moneda_documento IS
'Monto aplicado expresado en la moneda del documento destino.';

COMMIT;