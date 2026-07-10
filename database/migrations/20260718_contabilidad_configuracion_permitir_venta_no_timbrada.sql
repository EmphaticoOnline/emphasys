-- =========================================================
-- SCRIPT:
-- 20260718_contabilidad_configuracion_permitir_venta_no_timbrada.sql
--
-- Parámetro por empresa para la contabilización de facturas de venta:
-- por default, una factura estándar (tratamiento_impuestos = normal)
-- solo puede contabilizarse si ya está timbrada ante el SAT. Algunas
-- empresas necesitan contabilizar antes del timbrado (por ejemplo,
-- para cerrar el mes aunque el PAC esté caído); este parámetro permite
-- esa excepción explícitamente, por empresa, en vez de relajar la
-- regla para todos.
-- =========================================================

BEGIN;

ALTER TABLE contabilidad.configuracion
ADD COLUMN permitir_venta_no_timbrada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN contabilidad.configuracion.permitir_venta_no_timbrada IS
'Permite contabilizar facturas de venta estándar (tratamiento_impuestos = normal) que aún no están timbradas ante el SAT. Default false: solo se contabilizan facturas ya timbradas.';

COMMIT;
