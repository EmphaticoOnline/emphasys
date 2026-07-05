-- =====================================================
-- Responder mensaje (estilo WhatsApp) en el chat del CRM
-- Emphasys ERP
-- =====================================================

ALTER TABLE crm.mensajes
ADD COLUMN IF NOT EXISTS mensaje_respuesta_id BIGINT REFERENCES crm.mensajes(id);

COMMENT ON COLUMN crm.mensajes.mensaje_respuesta_id IS
'Mensaje original al que responde este mensaje (respuesta estilo WhatsApp), nulo si no es una respuesta.';

CREATE INDEX IF NOT EXISTS ix_mensajes_respuesta_id
ON crm.mensajes (mensaje_respuesta_id)
WHERE mensaje_respuesta_id IS NOT NULL;
