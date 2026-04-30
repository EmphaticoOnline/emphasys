CREATE TABLE IF NOT EXISTS crm.reglas_seguimiento (
  empresa_id INTEGER NOT NULL,
  tiempo_tolerancia_respuesta_a_cliente INTEGER NOT NULL DEFAULT 30,
  tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente INTEGER NOT NULL DEFAULT 4,
  tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm.reglas_seguimiento
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER;

ALTER TABLE crm.reglas_seguimiento
  ADD COLUMN IF NOT EXISTS tiempo_tolerancia_respuesta_a_cliente INTEGER NOT NULL DEFAULT 30;

ALTER TABLE crm.reglas_seguimiento
  ADD COLUMN IF NOT EXISTS tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente INTEGER NOT NULL DEFAULT 4;

ALTER TABLE crm.reglas_seguimiento
  ADD COLUMN IF NOT EXISTS tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente INTEGER NOT NULL DEFAULT 24;

ALTER TABLE crm.reglas_seguimiento
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE crm.reglas_seguimiento
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE crm.reglas_seguimiento
  ALTER COLUMN tiempo_tolerancia_respuesta_a_cliente SET DEFAULT 30;

ALTER TABLE crm.reglas_seguimiento
  ALTER COLUMN tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente SET DEFAULT 4;

ALTER TABLE crm.reglas_seguimiento
  ALTER COLUMN tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente SET DEFAULT 24;

CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_reglas_seguimiento_empresa_id
  ON crm.reglas_seguimiento (empresa_id);

COMMENT ON TABLE crm.reglas_seguimiento IS
  'Configuración por empresa de umbrales operativos para seguimiento comercial de leads.';

COMMENT ON COLUMN crm.reglas_seguimiento.empresa_id IS
  'Empresa propietaria de la configuración de seguimiento.';

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_tolerancia_respuesta_a_cliente IS
  'Minutos tolerados para responder a un mensaje entrante antes de escalar a riesgo.';

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente IS
  'Horas después de un mensaje saliente a partir de las cuales el lead requiere seguimiento.';

COMMENT ON COLUMN crm.reglas_seguimiento.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente IS
  'Horas máximas sin respuesta del cliente tras un mensaje saliente antes de considerar riesgo de pérdida.';