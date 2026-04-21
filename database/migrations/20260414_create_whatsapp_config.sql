CREATE TABLE whatsapp.config (
  id bigserial PRIMARY KEY,
  empresa_id int NOT NULL,
  phone_number varchar(20) NOT NULL,
  api_key varchar(255) NOT NULL,
  app_name varchar(100) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL,
  CONSTRAINT whatsapp_config_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES core.empresas(id),
  CONSTRAINT whatsapp_config_empresa_id_uk
    UNIQUE (empresa_id),
  CONSTRAINT whatsapp_config_phone_number_chk
    CHECK (phone_number ~ '^[+0-9]{8,20}$')
);

CREATE INDEX whatsapp_config_empresa_id_idx
  ON whatsapp.config (empresa_id);

COMMENT ON TABLE whatsapp.config
  IS 'Configuración del canal WhatsApp por empresa (API key, número, app de Gupshup)';
