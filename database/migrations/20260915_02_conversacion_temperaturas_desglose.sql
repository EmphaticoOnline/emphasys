ALTER TABLE crm.conversacion_temperaturas
  ADD COLUMN IF NOT EXISTS desglose_puntuacion jsonb;
