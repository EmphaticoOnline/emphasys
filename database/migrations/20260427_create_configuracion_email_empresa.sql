CREATE TABLE crm.configuracion_email_empresa (
  id bigserial PRIMARY KEY,
  empresa_id int NOT NULL,
  smtp_host varchar(255) NOT NULL,
  smtp_port int NOT NULL,
  smtp_user varchar(255) NOT NULL,
  smtp_password text NULL,
  smtp_secure boolean NOT NULL DEFAULT false,
  email_remitente varchar(255) NULL,
  nombre_remitente varchar(255) NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configuracion_email_empresa_empresa_fkey
    FOREIGN KEY (empresa_id) REFERENCES core.empresas(id),
  CONSTRAINT configuracion_email_empresa_empresa_uk
    UNIQUE (empresa_id),
  CONSTRAINT configuracion_email_empresa_smtp_port_chk
    CHECK (smtp_port BETWEEN 1 AND 65535)
);

CREATE INDEX configuracion_email_empresa_empresa_idx
  ON crm.configuracion_email_empresa (empresa_id);

COMMENT ON TABLE crm.configuracion_email_empresa
  IS 'Configuración SMTP por empresa para envío de correos';

COMMENT ON COLUMN crm.configuracion_email_empresa.smtp_password
  IS 'Password SMTP cifrado por la aplicación';