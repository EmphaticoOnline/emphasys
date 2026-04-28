CREATE TABLE IF NOT EXISTS crm.email_plantillas (
  id bigserial PRIMARY KEY,
  empresa_id int NOT NULL,
  tipo varchar(100) NOT NULL,
  asunto text NOT NULL,
  html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_plantillas_empresa_fkey
    FOREIGN KEY (empresa_id) REFERENCES core.empresas(id),
  CONSTRAINT email_plantillas_empresa_tipo_uk
    UNIQUE (empresa_id, tipo)
);

CREATE INDEX IF NOT EXISTS email_plantillas_empresa_idx
  ON crm.email_plantillas (empresa_id);

COMMENT ON TABLE crm.email_plantillas
  IS 'Plantillas de correo configurables por empresa y tipo';

COMMENT ON COLUMN crm.email_plantillas.tipo
  IS 'Tipo de plantilla de correo, por ejemplo cotizacion';

COMMENT ON COLUMN crm.email_plantillas.asunto
  IS 'Asunto de la plantilla de correo con variables dinámicas';

COMMENT ON COLUMN crm.email_plantillas.html
  IS 'Contenido HTML de la plantilla de correo con variables dinámicas';

INSERT INTO crm.email_plantillas (empresa_id, tipo, asunto, html)
SELECT
  e.id,
  'cotizacion',
  'Cotizacion {{folio}} para {{cliente}}',
  '<div style="background:#f4f7fb;padding:24px;font-family:Arial,sans-serif;color:#1f2937;">'
    || '<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe3f4;border-radius:12px;overflow:hidden;">'
    || '<div style="padding:24px 28px 12px 28px;">'
    || '<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Hola {{cliente}},</p>'
    || '<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#374151;">Te compartimos la cotizacion <strong>{{folio}}</strong> adjunta en PDF.</p>'
    || '<p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">{{mensaje}}</p>'
    || '</div>'
    || '<div style="padding:16px 28px 24px 28px;border-top:1px solid #e5e7eb;background:#f9fafb;">'
    || '<p style="margin:0 0 8px 0;font-size:14px;color:#6b7280;">Saludos,</p>'
    || '<p style="margin:0;font-size:15px;font-weight:700;color:#111827;">{{nombreRemitente}}</p>'
    || '</div>'
    || '</div>'
    || '</div>'
FROM core.empresas e
ON CONFLICT (empresa_id, tipo) DO NOTHING;