CREATE TABLE IF NOT EXISTS crm.conversaciones_lecturas (
  empresa_id integer NOT NULL,
  usuario_id integer NOT NULL,
  conversacion_id bigint NOT NULL,
  ultima_lectura_en timestamptz NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, usuario_id, conversacion_id),
  CONSTRAINT conversaciones_lecturas_conversacion_fk FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm.conversaciones_lecturas_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  inicio_no_leidos_en timestamptz NOT NULL
);

INSERT INTO crm.conversaciones_lecturas_config (id, inicio_no_leidos_en)
VALUES (true, now())
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS ix_conv_lecturas_usuario_conv
  ON crm.conversaciones_lecturas (empresa_id, usuario_id, conversacion_id);

CREATE INDEX IF NOT EXISTS ix_mensajes_unread_lookup
  ON crm.mensajes (empresa_id, conversacion_id, tipo_mensaje, fecha_envio);
