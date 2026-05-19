-- ============================================================
-- Ajusta core.cfdi_pac_config para permitir solo una configuración activa global
-- ============================================================

DROP INDEX IF EXISTS core.ux_cfdi_pac_config_activo_modo;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS rn
    FROM core.cfdi_pac_config
   WHERE activo = TRUE
)
UPDATE core.cfdi_pac_config cfg
   SET activo = FALSE,
       updated_at = NOW()
  FROM ranked r
 WHERE cfg.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cfdi_pac_config_activo_global
ON core.cfdi_pac_config (activo)
WHERE activo = TRUE;