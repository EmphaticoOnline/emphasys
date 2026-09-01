CREATE TABLE IF NOT EXISTS migrate.entidades_alias (
  sistema_origen text NOT NULL,
  tipo_entidad text NOT NULL,
  id_origen text NOT NULL,
  empresa_destino_id integer NOT NULL REFERENCES core.empresas(id),
  id_destino_canonico bigint NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_origen jsonb,
  hash_origen text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sistema_origen, tipo_entidad, id_origen, empresa_destino_id)
);
CREATE INDEX IF NOT EXISTS ix_entidades_alias_destino ON migrate.entidades_alias (sistema_origen, tipo_entidad, empresa_destino_id, id_destino_canonico);
COMMENT ON TABLE migrate.entidades_alias IS 'Aliases históricos de entidades deduplicadas que comparten un destino físico canónico.';
