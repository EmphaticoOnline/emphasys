CREATE TABLE IF NOT EXISTS crm.conversacion_temperaturas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id integer NOT NULL,
  conversacion_id bigint NOT NULL,
  puntuacion integer NOT NULL CHECK (puntuacion BETWEEN 0 AND 100),
  nivel varchar(20) NOT NULL CHECK (nivel IN ('frio', 'tibio', 'caliente', 'muy_caliente')),
  confianza numeric(4,3) NOT NULL CHECK (confianza BETWEEN 0 AND 1),
  explicacion text NOT NULL,
  principales_razones jsonb NOT NULL DEFAULT '[]'::jsonb,
  riesgo_informacion_faltante jsonb NOT NULL DEFAULT '[]'::jsonb,
  siguiente_accion_recomendada text NOT NULL,
  mensajes_considerados integer NOT NULL CHECK (mensajes_considerados >= 0),
  ultimo_mensaje_id_considerado bigint,
  ultima_fecha_mensaje_considerada timestamptz,
  snapshot_hash varchar(64) NOT NULL,
  modelo varchar(100) NOT NULL,
  prompt_version varchar(50) NOT NULL,
  tokens_entrada integer,
  tokens_salida integer,
  tokens_totales integer,
  creado_por integer,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversacion_temperaturas_empresa_fk FOREIGN KEY (empresa_id) REFERENCES core.empresas(id),
  CONSTRAINT conversacion_temperaturas_conversacion_fk FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id) ON DELETE CASCADE,
  CONSTRAINT conversacion_temperaturas_snapshot_uq UNIQUE (empresa_id, conversacion_id, snapshot_hash, prompt_version, modelo)
);
CREATE INDEX IF NOT EXISTS ix_conversacion_temperaturas_ultimo ON crm.conversacion_temperaturas (empresa_id, conversacion_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_conversacion_temperaturas_snapshot ON crm.conversacion_temperaturas (empresa_id, conversacion_id, snapshot_hash, prompt_version, modelo);
