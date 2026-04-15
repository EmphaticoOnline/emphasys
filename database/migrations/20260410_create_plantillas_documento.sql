-- Crea la tabla base para plantillas de documentos (PDF/impresión)

CREATE TABLE IF NOT EXISTS public.plantillas_documento (
  id serial PRIMARY KEY,
  empresa_id integer not null,
  tipo_documento text NOT NULL,
  nombre text NOT NULL,
  contenido_html text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_documento_empresa_tipo_activo
  ON public.plantillas_documento (empresa_id, tipo_documento, activo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_plantilla_activa
ON public.plantillas_documento (empresa_id, tipo_documento)
WHERE activo = true;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON public.plantillas_documento
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();