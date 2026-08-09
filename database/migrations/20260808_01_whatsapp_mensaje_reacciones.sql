-- Reacciones a mensajes de WhatsApp (estilo WhatsApp: emoji por participante,
-- no un mensaje independiente en la conversación).
--
-- Un chat de WhatsApp 1:1 solo tiene dos participantes reales que pueden
-- reaccionar: el contacto (cliente) y el número de negocio (Emphasys). Por
-- eso UNIQUE(mensaje_id, autor) modela la semántica real: cambiar de emoji es
-- un UPSERT, quitar la reacción es un DELETE de esa fila — nunca se acumulan
-- reacciones del mismo participante sobre el mismo mensaje.

BEGIN;

CREATE TABLE IF NOT EXISTS crm.mensaje_reacciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    mensaje_id BIGINT NOT NULL REFERENCES crm.mensajes(id) ON DELETE CASCADE,
    autor VARCHAR(10) NOT NULL CHECK (autor IN ('contacto', 'agente')),
    usuario_id INTEGER REFERENCES core.usuarios(id),
    emoji VARCHAR(16) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (mensaje_id, autor)
);

COMMENT ON TABLE crm.mensaje_reacciones IS
    'Reacciones (emoji) sobre mensajes de crm.mensajes. No representan mensajes propios: son metadata asociada al mensaje original.';
COMMENT ON COLUMN crm.mensaje_reacciones.autor IS
    'contacto = reacción hecha por el cliente vía WhatsApp; agente = reacción hecha desde Emphasys.';
COMMENT ON COLUMN crm.mensaje_reacciones.usuario_id IS
    'Usuario de Emphasys que reaccionó, solo cuando autor = agente.';

CREATE INDEX IF NOT EXISTS ix_mensaje_reacciones_mensaje_id
    ON crm.mensaje_reacciones (mensaje_id);

COMMIT;
