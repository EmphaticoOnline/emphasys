-- ============================================================
-- 20260925_03_cfdi_pac_config_activo_por_modo.sql
-- Formaliza en Git el esquema de unicidad de perfiles PAC activos.
--
-- La migración 20260518_adjust_cfdi_pac_config_single_active_global.sql
-- dejó una regla de "un solo perfil activo en toda la tabla" (índice
-- único sobre (activo) WHERE activo = true), incompatible con tener
-- Facturama Sandbox y Facturama Producción activos simultáneamente.
--
-- La base de datos real ya opera hoy con una regla distinta (unicidad
-- por (pac, modo) en vez de global), aplicada fuera del sistema de
-- migraciones. Esta migración no cambia el comportamiento actual: solo
-- documenta y garantiza en Git el índice que ya existe.
--
-- No modifica filas de core.cfdi_pac_config ni de
-- core.empresas_cfdi_pac_config. No activa/desactiva perfiles ni
-- altera asignaciones existentes.
-- ============================================================

-- 1) Elimina de forma idempotente la restricción histórica de "un solo
--    perfil activo en toda la tabla" (y su predecesora por modo, por si
--    en algún entorno aún existiera sin el parche aplicado a mano).
DROP INDEX IF EXISTS core.ux_cfdi_pac_config_activo_global;
DROP INDEX IF EXISTS core.ux_cfdi_pac_config_activo_modo;

-- 2) Garantiza la unicidad correcta: como máximo un perfil activo por
--    combinación (pac, modo), permitiendo sandbox y producción activos
--    a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cfdi_pac_config_activo_pac_modo
ON core.cfdi_pac_config (pac, modo)
WHERE activo = TRUE;
