BEGIN;

CREATE TABLE IF NOT EXISTS core.grid_preferences (
  id bigserial PRIMARY KEY,
  usuario_id integer NOT NULL,
  empresa_id integer NOT NULL,
  pantalla text NOT NULL,
  perfil_dispositivo text NOT NULL,
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grid_preferences_usuario_fkey
    FOREIGN KEY (usuario_id)
    REFERENCES core.usuarios(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT grid_preferences_empresa_fkey
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT grid_preferences_perfil_chk
    CHECK (perfil_dispositivo IN ('desktop', 'tablet', 'mobile')),
  CONSTRAINT grid_preferences_unique_scope
    UNIQUE (usuario_id, empresa_id, pantalla, perfil_dispositivo)
);

CREATE INDEX IF NOT EXISTS idx_grid_preferences_lookup
  ON core.grid_preferences (usuario_id, empresa_id, pantalla, perfil_dispositivo);

CREATE INDEX IF NOT EXISTS idx_grid_preferences_updated_at
  ON core.grid_preferences (updated_at DESC);

COMMIT;
