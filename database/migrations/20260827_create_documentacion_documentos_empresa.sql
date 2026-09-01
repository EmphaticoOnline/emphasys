CREATE SCHEMA IF NOT EXISTS documentacion;

CREATE TABLE IF NOT EXISTS documentacion.documentos_empresa_tipos (
  id serial PRIMARY KEY,
  nombre varchar(100) NOT NULL UNIQUE,
  descripcion text,
  requiere_vigencia boolean NOT NULL DEFAULT false,
  dias_vigencia integer,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS documentacion.documentos_empresa (
  id serial PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES core.empresas(id),
  tipo_id integer NOT NULL REFERENCES documentacion.documentos_empresa_tipos(id),
  archivo_url text NOT NULL,
  nombre_original varchar(255) NOT NULL,
  fecha_subida timestamptz NOT NULL DEFAULT now(),
  fecha_vencimiento date,
  vigente boolean NOT NULL DEFAULT true,
  comentarios text,
  usuario_subio_id integer REFERENCES core.usuarios(id)
);

CREATE INDEX IF NOT EXISTS documentos_empresa_empresa_fecha_idx ON documentacion.documentos_empresa (empresa_id, fecha_subida DESC);
CREATE INDEX IF NOT EXISTS documentos_empresa_empresa_tipo_idx ON documentacion.documentos_empresa (empresa_id, tipo_id);
CREATE INDEX IF NOT EXISTS documentos_empresa_empresa_vigente_idx ON documentacion.documentos_empresa (empresa_id, vigente);
