-- =========================================================
-- SCRIPT:
-- 20260710_contabilidad_configuracion_estructura_cuentas.sql
--
-- Agrega la estructura de segmentos del número de cuenta
-- (ej. "3-4-3") a la configuración contable por empresa.
-- =========================================================

BEGIN;

ALTER TABLE contabilidad.configuracion
ADD COLUMN estructura_cuentas varchar(30) NOT NULL DEFAULT '3-4-3';

COMMENT ON COLUMN contabilidad.configuracion.estructura_cuentas IS 'Estructura de segmentos del número de cuenta contable, expresada como longitudes separadas por guion (ej. 3-4-3, 3-4-3-3, 4-3-3).';

COMMIT;
