-- =========================================================
-- WhatsApp: Sistema de Etiquetas para Conversaciones
-- Script idempotente completo
-- =========================================================

-- =========================
-- Tabla: whatsapp.etiquetas
-- =========================
CREATE TABLE IF NOT EXISTS whatsapp.etiquetas (
  id serial PRIMARY KEY,
  empresa_id integer NOT NULL,
  nombre text NOT NULL,
  color text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_whatsapp_etiquetas_color_hex
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- COMMENTS tabla etiquetas
COMMENT ON TABLE whatsapp.etiquetas IS
  'Catálogo de etiquetas para clasificar conversaciones de WhatsApp por empresa';

COMMENT ON COLUMN whatsapp.etiquetas.empresa_id IS
  'Empresa a la que pertenece la etiqueta';

COMMENT ON COLUMN whatsapp.etiquetas.nombre IS
  'Nombre de la etiqueta (ej: Cotizado, Urgente, Seguimiento)';

COMMENT ON COLUMN whatsapp.etiquetas.color IS
  'Color en formato HEX (#RRGGBB), sin transparencia';

COMMENT ON COLUMN whatsapp.etiquetas.activo IS
  'Indica si la etiqueta está disponible para uso';

COMMENT ON COLUMN whatsapp.etiquetas.created_at IS
  'Fecha de creación del registro';

COMMENT ON COLUMN whatsapp.etiquetas.updated_at IS
  'Fecha de última actualización';


-- =========================
-- Índices etiquetas
-- =========================

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_etiquetas_empresa_nombre
  ON whatsapp.etiquetas (empresa_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_whatsapp_etiquetas_empresa_activo
  ON whatsapp.etiquetas (empresa_id, activo);


-- COMMENTS índices etiquetas (idempotentes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'ux_whatsapp_etiquetas_empresa_nombre'
      AND n.nspname = 'whatsapp'
  ) THEN
    COMMENT ON INDEX whatsapp.ux_whatsapp_etiquetas_empresa_nombre IS
      'Evita duplicados de nombre de etiqueta por empresa (case-insensitive)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_whatsapp_etiquetas_empresa_activo'
      AND n.nspname = 'whatsapp'
  ) THEN
    COMMENT ON INDEX whatsapp.idx_whatsapp_etiquetas_empresa_activo IS
      'Optimiza consultas de etiquetas activas por empresa';
  END IF;
END $$;


-- ============================================
-- Tabla: whatsapp.conversacion_etiquetas
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp.conversacion_etiquetas (
  id serial PRIMARY KEY,
  empresa_id integer NOT NULL,
  conversacion_id integer NOT NULL,
  etiqueta_id integer NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_whatsapp_conversacion_etiquetas
    UNIQUE (conversacion_id, etiqueta_id),

  CONSTRAINT fk_whatsapp_conversacion_etiquetas_conversacion
    FOREIGN KEY (conversacion_id)
    REFERENCES whatsapp.conversaciones (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_whatsapp_conversacion_etiquetas_etiqueta
    FOREIGN KEY (etiqueta_id)
    REFERENCES whatsapp.etiquetas (id)
    ON DELETE CASCADE
);

-- COMMENTS tabla relación
COMMENT ON TABLE whatsapp.conversacion_etiquetas IS
  'Tabla puente que relaciona conversaciones con múltiples etiquetas';

COMMENT ON COLUMN whatsapp.conversacion_etiquetas.empresa_id IS
  'Empresa propietaria de la relación';

COMMENT ON COLUMN whatsapp.conversacion_etiquetas.conversacion_id IS
  'ID de la conversación de WhatsApp';

COMMENT ON COLUMN whatsapp.conversacion_etiquetas.etiqueta_id IS
  'ID de la etiqueta asignada a la conversación';

COMMENT ON COLUMN whatsapp.conversacion_etiquetas.created_at IS
  'Fecha en que se asignó la etiqueta a la conversación';


-- =========================
-- Índices relación
-- =========================

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversacion_etiquetas_empresa_conversacion
  ON whatsapp.conversacion_etiquetas (empresa_id, conversacion_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversacion_etiquetas_etiqueta
  ON whatsapp.conversacion_etiquetas (etiqueta_id);


-- COMMENTS índices relación (idempotentes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_whatsapp_conversacion_etiquetas_empresa_conversacion'
      AND n.nspname = 'whatsapp'
  ) THEN
    COMMENT ON INDEX whatsapp.idx_whatsapp_conversacion_etiquetas_empresa_conversacion IS
      'Optimiza búsqueda de etiquetas por conversación y empresa';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_whatsapp_conversacion_etiquetas_etiqueta'
      AND n.nspname = 'whatsapp'
  ) THEN
    COMMENT ON INDEX whatsapp.idx_whatsapp_conversacion_etiquetas_etiqueta IS
      'Optimiza consultas de conversaciones por etiqueta';
  END IF;
END $$;