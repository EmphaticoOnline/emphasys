ALTER TABLE crm.actividades
  ADD COLUMN IF NOT EXISTS recordatorio_erp_claimed_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_erp_claimed_by varchar(120) NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_erp_entregado_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_push_claimed_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_push_entregado_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_push_ultimo_intento_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_push_error text NULL;

CREATE INDEX IF NOT EXISTS idx_actividades_recordatorios_entrega
  ON crm.actividades (empresa_id, usuario_asignado_id, fecha_programada)
  WHERE estatus = 'pendiente' AND recordatorio = true;
