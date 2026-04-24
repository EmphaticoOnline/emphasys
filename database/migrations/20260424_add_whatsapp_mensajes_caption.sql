-- Agrega caption para mensajes multimedia en whatsapp.mensajes
-- Fecha: 2026-04-24

BEGIN;

ALTER TABLE whatsapp.mensajes
    ADD COLUMN IF NOT EXISTS caption TEXT NULL;

COMMENT ON COLUMN whatsapp.mensajes.caption IS 'Texto/caption asociado a mensajes multimedia (imagen, audio, documento)';

COMMIT;
