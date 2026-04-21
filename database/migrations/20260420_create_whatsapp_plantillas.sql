-- Crear esquema si no existe
CREATE SCHEMA IF NOT EXISTS whatsapp;

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS whatsapp.plantillas (
  id bigserial PRIMARY KEY,
  empresa_id int NOT NULL,
  nombre_interno varchar(120) NOT NULL,
  tipo varchar(50) NOT NULL,
  proveedor varchar(50) NOT NULL,
  provider_template_id varchar(120) NOT NULL,
  es_default boolean NOT NULL DEFAULT false,
  activa boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NULL,
  CONSTRAINT whatsapp_plantillas_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES core.empresas(id)
);

-- Índices (idempotentes)
CREATE INDEX IF NOT EXISTS whatsapp_plantillas_empresa_id_idx
  ON whatsapp.plantillas (empresa_id);

CREATE INDEX IF NOT EXISTS whatsapp_plantillas_empresa_tipo_idx
  ON whatsapp.plantillas (empresa_id, tipo);

-- Índice único parcial para default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'whatsapp'
      AND indexname = 'whatsapp_plantillas_default_uk'
  ) THEN
    CREATE UNIQUE INDEX whatsapp_plantillas_default_uk
      ON whatsapp.plantillas (empresa_id, tipo)
      WHERE es_default IS TRUE;
  END IF;
END$$;

-- =========================
-- COMMENTS (documentación)
-- =========================

COMMENT ON TABLE whatsapp.plantillas
  IS 'Plantillas de WhatsApp definidas por empresa. Permiten desacoplar el ERP del proveedor (ej. Gupshup) y controlar el uso por tipo de mensaje (ej. reactivación).';

COMMENT ON COLUMN whatsapp.plantillas.id
  IS 'Identificador único de la plantilla.';

COMMENT ON COLUMN whatsapp.plantillas.empresa_id
  IS 'Empresa a la que pertenece la plantilla.';

COMMENT ON COLUMN whatsapp.plantillas.nombre_interno
  IS 'Nombre descriptivo interno para identificar la plantilla dentro del ERP.';

COMMENT ON COLUMN whatsapp.plantillas.tipo
  IS 'Tipo o propósito de la plantilla (ej. reactivacion, seguimiento, cierre).';

COMMENT ON COLUMN whatsapp.plantillas.proveedor
  IS 'Proveedor de mensajería (ej. gupshup). Permite soportar múltiples integraciones en el futuro.';

COMMENT ON COLUMN whatsapp.plantillas.provider_template_id
  IS 'Identificador de la plantilla en el proveedor (ej. template_id en Gupshup).';

COMMENT ON COLUMN whatsapp.plantillas.es_default
  IS 'Indica si esta plantilla es la predeterminada para su empresa y tipo. Solo puede existir una por empresa + tipo.';

COMMENT ON COLUMN whatsapp.plantillas.activa
  IS 'Indica si la plantilla está disponible para uso.';

COMMENT ON COLUMN whatsapp.plantillas.creado_en
  IS 'Fecha de creación del registro.';

COMMENT ON COLUMN whatsapp.plantillas.actualizado_en
  IS 'Fecha de última actualización del registro.'; 