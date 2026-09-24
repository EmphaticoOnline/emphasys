CREATE TABLE IF NOT EXISTS crm.meta_leads (
  id BIGSERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  leadgen_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  form_id TEXT,
  form_name TEXT,
  created_time TEXT,
  ad_id TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  field_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  intentos INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  proximo_reintento_at TIMESTAMP WITHOUT TIME ZONE,
  contacto_id INTEGER,
  actividad_id INTEGER,
  recibido_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  procesado_at TIMESTAMP WITHOUT TIME ZONE,
  actualizado_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT meta_leads_empresa_leadgen_uq UNIQUE (empresa_id, leadgen_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_leads_reintentos
  ON crm.meta_leads (estado, proximo_reintento_at);
