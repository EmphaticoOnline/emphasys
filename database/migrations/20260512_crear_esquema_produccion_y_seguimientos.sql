-- =========================================================
-- SCRIPT:
-- 20260512_crear_esquema_produccion_y_seguimientos.sql
-- =========================================================

-- =========================================================
-- ESQUEMA
-- =========================================================

CREATE SCHEMA IF NOT EXISTS produccion;

-- =========================================================
-- TABLA: produccion.etapas
-- =========================================================

CREATE TABLE IF NOT EXISTS produccion.etapas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(20),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- ÍNDICES: produccion.etapas
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_produccion_etapas_empresa
ON produccion.etapas (empresa_id);

CREATE INDEX IF NOT EXISTS idx_produccion_etapas_empresa_orden
ON produccion.etapas (empresa_id, orden);

-- =========================================================
-- TABLA: produccion.seguimientos
-- =========================================================

CREATE TABLE IF NOT EXISTS produccion.seguimientos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    documento_id INTEGER NOT NULL,
    etapa_id INTEGER,
    fecha_promesa DATE,
    comentarios TEXT,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_produccion_seguimientos_etapa
        FOREIGN KEY (etapa_id)
        REFERENCES produccion.etapas(id)
        ON DELETE SET NULL
);

-- =========================================================
-- ÍNDICES: produccion.seguimientos
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_produccion_seguimientos_empresa
ON produccion.seguimientos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_produccion_seguimientos_documento
ON produccion.seguimientos (documento_id);

CREATE INDEX IF NOT EXISTS idx_produccion_seguimientos_etapa
ON produccion.seguimientos (etapa_id);

-- =========================================================
-- FUNCIÓN updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- TRIGGER: etapas.updated_at
-- =========================================================

DROP TRIGGER IF EXISTS trg_produccion_etapas_updated_at
ON produccion.etapas;

CREATE TRIGGER trg_produccion_etapas_updated_at
BEFORE UPDATE ON produccion.etapas
FOR EACH ROW
EXECUTE FUNCTION core.set_updated_at();

-- =========================================================
-- TRIGGER: seguimientos.updated_at
-- =========================================================

DROP TRIGGER IF EXISTS trg_produccion_seguimientos_updated_at
ON produccion.seguimientos;

CREATE TRIGGER trg_produccion_seguimientos_updated_at
BEFORE UPDATE ON produccion.seguimientos
FOR EACH ROW
EXECUTE FUNCTION core.set_updated_at();

-- =========================================================
-- ETAPAS DEFAULT
-- SOLO SI LA EMPRESA AÚN NO TIENE ETAPAS
-- =========================================================

INSERT INTO produccion.etapas (
    empresa_id,
    nombre,
    orden,
    color
)
SELECT
    e.id,
    etapa.nombre,
    etapa.orden,
    etapa.color
FROM core.empresas e
CROSS JOIN (
    VALUES
        ('Diseño', 1, '#64748B'),
        ('Corte', 2, '#0EA5E9'),
        ('Impresión', 3, '#8B5CF6'),
        ('Costura', 4, '#F59E0B'),
        ('Calidad', 5, '#10B981'),
        ('Entrega', 6, '#EF4444')
) AS etapa(nombre, orden, color)
WHERE NOT EXISTS (
    SELECT 1
    FROM produccion.etapas pe
    WHERE pe.empresa_id = e.id
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_produccion_seguimientos_empresa_documento
ON produccion.seguimientos (empresa_id, documento_id);