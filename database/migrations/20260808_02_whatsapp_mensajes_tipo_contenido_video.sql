-- Agrega 'video' como valor válido de crm.mensajes.tipo_contenido.
--
-- El constraint original (mensajes_tipo_contenido_chk, creado en
-- 20260423_add_whatsapp_mensajes_media.sql sobre whatsapp.mensajes, movida
-- luego a crm.mensajes) solo permitía 'text' | 'image' | 'audio' | 'document'.
-- Hasta ahora un video de WhatsApp (incluidos los GIF, que WhatsApp entrega
-- como video/mp4 en loop) se guardaba como 'document'. Este cambio permite
-- guardarlo con su tipo semántico real.
--
-- No convierte ni actualiza mensajes históricos: los videos ya guardados
-- como 'document' se quedan exactamente así, tal como se pidió.

BEGIN;

ALTER TABLE crm.mensajes
    DROP CONSTRAINT IF EXISTS mensajes_tipo_contenido_chk;

ALTER TABLE crm.mensajes
    ADD CONSTRAINT mensajes_tipo_contenido_chk
    CHECK (tipo_contenido IN ('text', 'image', 'audio', 'document', 'video'));

COMMENT ON COLUMN crm.mensajes.tipo_contenido IS 'Tipo de contenido del mensaje: text, image, audio, document, video';

COMMIT;
