-- =========================================================
-- MIGRATION:
-- 20260513_add_activo_to_produccion_seguimientos_historial.sql
-- =========================================================

ALTER TABLE produccion.seguimientos
    ADD COLUMN IF NOT EXISTS activo BOOLEAN;

UPDATE produccion.seguimientos
   SET activo = TRUE
 WHERE activo IS NULL;

ALTER TABLE produccion.seguimientos
    ALTER COLUMN activo SET DEFAULT TRUE;

ALTER TABLE produccion.seguimientos
    ALTER COLUMN activo SET NOT NULL;

DROP INDEX IF EXISTS produccion.ux_produccion_seguimientos_empresa_documento;
