-- ============================================================
-- 20260518_create_core_cfdi_pac_config.sql
-- Configuración global de PAC CFDI
-- ============================================================

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.cfdi_pac_config (
    id SERIAL PRIMARY KEY,

    pac VARCHAR(50) NOT NULL DEFAULT 'facturama',
    modo VARCHAR(20) NOT NULL DEFAULT 'sandbox',

    base_url TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    stamp_path TEXT NOT NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT cfdi_pac_config_modo_chk
        CHECK (modo IN ('sandbox', 'produccion')),

    CONSTRAINT cfdi_pac_config_pac_modo_unique
        UNIQUE (pac, modo)
);

-- Solo una configuración activa por modo
CREATE UNIQUE INDEX IF NOT EXISTS ux_cfdi_pac_config_activo_modo
ON core.cfdi_pac_config (modo)
WHERE activo = TRUE;

-- Registro sandbox inicial
INSERT INTO core.cfdi_pac_config (
    pac,
    modo,
    base_url,
    username,
    password,
    stamp_path,
    activo
)
VALUES (
    'facturama',
    'sandbox',
    'https://apisandbox.facturama.mx',
    'emphasyspruebas',
    'CAMBIAR_PASSWORD',
    '/3/cfdis',
    TRUE
)
ON CONFLICT (pac, modo)
DO UPDATE SET
    base_url = EXCLUDED.base_url,
    stamp_path = EXCLUDED.stamp_path,
    updated_at = NOW();