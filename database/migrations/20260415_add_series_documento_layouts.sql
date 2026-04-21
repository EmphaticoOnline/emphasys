-- =========================================
-- EXTENSIÓN DE LAYOUTS POR SERIE (IDEMPOTENTE + DOCUMENTADO)
-- =========================================

-- 1) Asegura columna JSONB en plantillas_documento
ALTER TABLE IF EXISTS public.plantillas_documento
  ADD COLUMN IF NOT EXISTS configuracion JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Comentarios tabla plantillas_documento
COMMENT ON TABLE public.plantillas_documento IS
'Plantillas de layout configurables para documentos (PDF), por empresa.';

COMMENT ON COLUMN public.plantillas_documento.id IS
'Identificador único de la plantilla';

COMMENT ON COLUMN public.plantillas_documento.empresa_id IS
'Empresa propietaria de la plantilla';

COMMENT ON COLUMN public.plantillas_documento.tipo_documento IS
'Tipo de documento (factura, cotizacion, etc.) asociado a la plantilla (uso legado o fallback)';

COMMENT ON COLUMN public.plantillas_documento.nombre IS
'Nombre descriptivo de la plantilla';

COMMENT ON COLUMN public.plantillas_documento.contenido_html IS
'Contenido HTML de la plantilla (uso legado si aplica)';

COMMENT ON COLUMN public.plantillas_documento.configuracion IS
'Configuración del layout en formato JSON (colores, visibilidad de secciones, etc.)';

COMMENT ON COLUMN public.plantillas_documento.activo IS
'Indica si la plantilla está activa';

COMMENT ON COLUMN public.plantillas_documento.created_at IS
'Fecha de creación de la plantilla';

COMMENT ON COLUMN public.plantillas_documento.updated_at IS
'Fecha de última actualización de la plantilla';

-- 2) FK a empresa en plantillas_documento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_plantillas_documento_empresa'
  ) THEN
    ALTER TABLE public.plantillas_documento
      ADD CONSTRAINT fk_plantillas_documento_empresa
      FOREIGN KEY (empresa_id)
      REFERENCES core.empresas(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;

    COMMENT ON CONSTRAINT fk_plantillas_documento_empresa ON public.plantillas_documento IS
    'Relación entre plantilla y empresa propietaria';
  END IF;
END $$;

-- Índice por empresa
CREATE INDEX IF NOT EXISTS idx_plantillas_empresa
  ON public.plantillas_documento (empresa_id);

COMMENT ON INDEX idx_plantillas_empresa IS
'Optimiza búsquedas de plantillas por empresa';

-- =========================================
-- 3) TABLA: series_documento
-- =========================================

CREATE TABLE IF NOT EXISTS public.series_documento (
  id serial PRIMARY KEY,
  empresa_id integer NOT NULL,
  tipo_documento text NOT NULL,
  nombre text NOT NULL,
  layout_id integer NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Asegurar columnas existentes en caso de tabla previa
ALTER TABLE public.series_documento
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.series_documento
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- Comentarios tabla
COMMENT ON TABLE public.series_documento IS
'Define series de documentos por empresa, permitiendo asociar plantillas específicas de layout por serie.';

COMMENT ON COLUMN public.series_documento.id IS
'Identificador único de la serie';

COMMENT ON COLUMN public.series_documento.empresa_id IS
'Empresa a la que pertenece la serie';

COMMENT ON COLUMN public.series_documento.tipo_documento IS
'Tipo de documento (factura, cotizacion, etc.)';

COMMENT ON COLUMN public.series_documento.nombre IS
'Nombre o clave de la serie (ej. A, B, MOSTRADOR)';

COMMENT ON COLUMN public.series_documento.layout_id IS
'Plantilla de layout asociada a la serie (opcional)';

COMMENT ON COLUMN public.series_documento.created_at IS
'Fecha de creación de la serie';

COMMENT ON COLUMN public.series_documento.updated_at IS
'Fecha de última actualización de la serie';

-- =========================================
-- 4) FOREIGN KEYS + CONSTRAINTS
-- =========================================

DO $$
BEGIN
  -- FK empresa
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_series_documento_empresa'
  ) THEN
    ALTER TABLE public.series_documento
      ADD CONSTRAINT fk_series_documento_empresa
      FOREIGN KEY (empresa_id)
      REFERENCES core.empresas(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;

    COMMENT ON CONSTRAINT fk_series_documento_empresa ON public.series_documento IS
    'Relación entre serie de documento y empresa';
  END IF;

  -- FK layout
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_series_documento_layout'
  ) THEN
    ALTER TABLE public.series_documento
      ADD CONSTRAINT fk_series_documento_layout
      FOREIGN KEY (layout_id)
      REFERENCES public.plantillas_documento(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;

    COMMENT ON CONSTRAINT fk_series_documento_layout ON public.series_documento IS
    'Relación entre serie de documento y plantilla de layout';
  END IF;

  -- UNIQUE correcto
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_series_documento_empresa_tipo_nombre'
  ) THEN
    ALTER TABLE public.series_documento
      ADD CONSTRAINT uq_series_documento_empresa_tipo_nombre
      UNIQUE (empresa_id, tipo_documento, nombre);

    COMMENT ON CONSTRAINT uq_series_documento_empresa_tipo_nombre ON public.series_documento IS
    'Evita duplicar nombres de serie por empresa y tipo de documento';
  END IF;

END $$;

-- =========================================
-- 5) NORMALIZACIÓN
-- =========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_series_tipo_lower'
  ) THEN
    ALTER TABLE public.series_documento
      ADD CONSTRAINT chk_series_tipo_lower
      CHECK (tipo_documento = LOWER(tipo_documento));

    COMMENT ON CONSTRAINT chk_series_tipo_lower ON public.series_documento IS
    'Asegura que tipo_documento esté en minúsculas para evitar inconsistencias';
  END IF;
END $$;

-- =========================================
-- 6) ÍNDICES
-- =========================================

CREATE INDEX IF NOT EXISTS idx_series_documento_empresa_tipo
  ON public.series_documento (empresa_id, tipo_documento);

COMMENT ON INDEX idx_series_documento_empresa_tipo IS
'Optimiza búsquedas de series por empresa y tipo de documento';

CREATE INDEX IF NOT EXISTS idx_series_documento_layout
  ON public.series_documento (layout_id);

COMMENT ON INDEX idx_series_documento_layout IS
'Optimiza consultas por plantilla asociada';