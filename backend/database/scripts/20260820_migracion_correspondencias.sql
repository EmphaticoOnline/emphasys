BEGIN;

CREATE SCHEMA IF NOT EXISTS migrate;

CREATE TABLE IF NOT EXISTS migrate.entidades_correspondencias (
  sistema_origen text NOT NULL,
  tipo_entidad text NOT NULL,
  id_origen text NOT NULL,
  empresa_destino_id integer NOT NULL,
  id_destino bigint NOT NULL,
  fecha_migracion timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_entidades_correspondencias
    PRIMARY KEY (sistema_origen, tipo_entidad, id_origen, empresa_destino_id),
  CONSTRAINT uq_entidades_correspondencias_destino
    UNIQUE (sistema_origen, tipo_entidad, empresa_destino_id, id_destino),
  CONSTRAINT fk_entidades_correspondencias_empresa
    FOREIGN KEY (empresa_destino_id) REFERENCES core.empresas(id),
  CONSTRAINT ck_entidades_correspondencias_sistema
    CHECK (btrim(sistema_origen) <> ''),
  CONSTRAINT ck_entidades_correspondencias_tipo
    CHECK (btrim(tipo_entidad) <> ''),
  CONSTRAINT ck_entidades_correspondencias_origen
    CHECK (btrim(id_origen) <> '')
);

COMMENT ON TABLE migrate.entidades_correspondencias IS
  'Correspondencias idempotentes entre entidades de sistemas origen y registros canónicos de Emphasys.';

COMMENT ON COLUMN migrate.entidades_correspondencias.id_destino IS
  'ID polimórfico del registro destino; su tabla se determina mediante tipo_entidad.';

COMMIT;
