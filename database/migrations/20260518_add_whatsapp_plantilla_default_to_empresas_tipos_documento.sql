DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'core'
      AND table_name = 'empresas_tipos_documento'
      AND column_name = 'whatsapp_plantilla_default_id'
  ) THEN
    ALTER TABLE core.empresas_tipos_documento
      ADD COLUMN whatsapp_plantilla_default_id bigint NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_tipos_documento_whatsapp_plantilla_default_fkey'
      AND conrelid = 'core.empresas_tipos_documento'::regclass
  ) THEN
    ALTER TABLE core.empresas_tipos_documento
      ADD CONSTRAINT empresas_tipos_documento_whatsapp_plantilla_default_fkey
      FOREIGN KEY (whatsapp_plantilla_default_id)
      REFERENCES whatsapp.plantillas(id);
  END IF;
END $$;

COMMENT ON COLUMN core.empresas_tipos_documento.whatsapp_plantilla_default_id
  IS 'Plantilla de WhatsApp predeterminada para este tipo de documento dentro de la empresa. La relación es opcional.';