-- =========================
-- CREAR ESQUEMA
-- =========================
CREATE SCHEMA IF NOT EXISTS crm;

-- =========================
-- CREAR TABLA
-- =========================
CREATE TABLE IF NOT EXISTS crm.actividades (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL,
    usuario_asignado_id INT NOT NULL,
    usuario_creador_id INT NOT NULL,
    oportunidad_id INT NULL,
    tipo_actividad VARCHAR(30) NOT NULL,
    fecha_programada TIMESTAMP NOT NULL,
    notas TEXT NULL,
    estatus VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fecha_realizacion TIMESTAMP NULL,
    resultado TEXT NULL,
    recordatorio BOOLEAN DEFAULT FALSE,
    recordatorio_minutos INT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- COLUMNAS (IDEMPOTENTE)
-- =========================
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS empresa_id INT;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS usuario_asignado_id INT;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS usuario_creador_id INT;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS oportunidad_id INT;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS tipo_actividad VARCHAR(30);
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS fecha_programada TIMESTAMP;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS estatus VARCHAR(20) DEFAULT 'pendiente';
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS fecha_realizacion TIMESTAMP;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS resultado TEXT;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS recordatorio BOOLEAN DEFAULT FALSE;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS recordatorio_minutos INT;
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE crm.actividades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE crm.actividades
    ALTER COLUMN estatus SET DEFAULT 'pendiente';

ALTER TABLE crm.actividades
    ALTER COLUMN recordatorio SET DEFAULT FALSE;

ALTER TABLE crm.actividades
    ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE crm.actividades
    ALTER COLUMN updated_at SET DEFAULT NOW();

-- =========================
-- FOREIGN KEYS
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_empresa'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        ADD CONSTRAINT fk_actividades_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_usuario_asignado'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        ADD CONSTRAINT fk_actividades_usuario_asignado
        FOREIGN KEY (usuario_asignado_id)
        REFERENCES core.usuarios(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_usuario_creador'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        ADD CONSTRAINT fk_actividades_usuario_creador
        FOREIGN KEY (usuario_creador_id)
        REFERENCES core.usuarios(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_oportunidad'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        ADD CONSTRAINT fk_actividades_oportunidad
        FOREIGN KEY (oportunidad_id)
        REFERENCES crm.oportunidades_venta(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- =========================
-- INDICES
-- =========================
CREATE INDEX IF NOT EXISTS idx_actividades_usuario_asignado_fecha
    ON crm.actividades (usuario_asignado_id, fecha_programada);

CREATE INDEX IF NOT EXISTS idx_actividades_oportunidad
    ON crm.actividades (oportunidad_id);

CREATE INDEX IF NOT EXISTS idx_actividades_estatus
    ON crm.actividades (estatus);

-- =========================
-- COMMENTS
-- =========================
COMMENT ON TABLE crm.actividades IS
'Tabla de actividades programadas de seguimiento comercial en el ERP multiempresa.';

COMMENT ON COLUMN crm.actividades.id IS
'Identificador unico de la actividad.';

COMMENT ON COLUMN crm.actividades.empresa_id IS
'Empresa a la que pertenece la actividad dentro del modelo multiempresa.';

COMMENT ON COLUMN crm.actividades.usuario_asignado_id IS
'Usuario responsable de ejecutar la actividad.';

COMMENT ON COLUMN crm.actividades.usuario_creador_id IS
'Usuario que creo o asigno la actividad.';

COMMENT ON COLUMN crm.actividades.oportunidad_id IS
'Oportunidad de venta relacionada. Es opcional y puede ser NULL para actividades generales.';

COMMENT ON COLUMN crm.actividades.tipo_actividad IS
'Tipo de actividad. No usa catalogo por ahora; los valores se controlan desde aplicacion.';

COMMENT ON COLUMN crm.actividades.fecha_programada IS
'Fecha y hora en que debe ejecutarse la actividad.';

COMMENT ON COLUMN crm.actividades.notas IS
'Notas o instrucciones capturadas para el seguimiento.';

COMMENT ON COLUMN crm.actividades.estatus IS
'Estatus de la actividad. Los valores se controlan desde aplicacion.';

COMMENT ON COLUMN crm.actividades.fecha_realizacion IS
'Fecha y hora en que se realizo la actividad. A nivel aplicacion es obligatoria cuando el estatus sea realizada.';

COMMENT ON COLUMN crm.actividades.resultado IS
'Resultado de la actividad. A nivel aplicacion es obligatorio cuando el estatus sea realizada.';

COMMENT ON COLUMN crm.actividades.recordatorio IS
'Indica si la actividad debe generar un recordatorio antes de su ejecucion.';

COMMENT ON COLUMN crm.actividades.recordatorio_minutos IS
'Cantidad de minutos antes de la actividad en que se debe avisar.';

COMMENT ON COLUMN crm.actividades.created_at IS
'Fecha y hora de creacion del registro.';

COMMENT ON COLUMN crm.actividades.updated_at IS
'Fecha y hora de la ultima actualizacion del registro.';

-- =========================
-- FUNCION Y TRIGGER UPDATED_AT
-- =========================
CREATE OR REPLACE FUNCTION crm.set_actividades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('crm.actividades') IS NOT NULL
       AND NOT EXISTS (
        SELECT 1
        FROM pg_trigger trg
        INNER JOIN pg_class rel ON rel.oid = trg.tgrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE trg.tgname = 'trg_actividades_updated_at'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
          AND NOT trg.tgisinternal
    ) THEN
        CREATE TRIGGER trg_actividades_updated_at
        BEFORE UPDATE ON crm.actividades
        FOR EACH ROW
        EXECUTE FUNCTION crm.set_actividades_updated_at();
    END IF;
END $$;