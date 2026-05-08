ALTER TABLE crm.actividades
    ADD COLUMN IF NOT EXISTS recordatorio_disparado_at timestamp NULL;
