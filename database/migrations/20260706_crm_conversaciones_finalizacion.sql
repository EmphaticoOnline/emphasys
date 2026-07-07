BEGIN;

-- La tabla vive en crm.conversaciones (movida desde whatsapp.conversaciones
-- en 20260427_move_whatsapp_to_crm.sql). whatsapp.conversaciones sigue
-- existiendo como vista de compatibilidad sobre esta tabla.

ALTER TABLE crm.conversaciones
ADD COLUMN IF NOT EXISTS finalizada_en timestamptz,
ADD COLUMN IF NOT EXISTS finalizada_por integer,
ADD COLUMN IF NOT EXISTS motivo_finalizacion varchar(40),
ADD COLUMN IF NOT EXISTS observaciones_finalizacion text,
ADD COLUMN IF NOT EXISTS reactivada_en timestamptz,
ADD COLUMN IF NOT EXISTS reactivada_por_evento varchar(30);

ALTER TABLE crm.conversaciones
DROP CONSTRAINT IF EXISTS conversaciones_motivo_finalizacion_chk;

ALTER TABLE crm.conversaciones
ADD CONSTRAINT conversaciones_motivo_finalizacion_chk
CHECK (
    motivo_finalizacion IS NULL
    OR motivo_finalizacion IN (
        'venta_cerrada',
        'informacion_entregada',
        'no_interesado',
        'sin_respuesta',
        'fuera_de_perfil',
        'duplicada',
        'prueba',
        'otro'
    )
);

COMMENT ON COLUMN crm.conversaciones.finalizada_en IS
'Fecha en que el vendedor marcó la conversación como finalizada (ya no requiere seguimiento operativo).';
COMMENT ON COLUMN crm.conversaciones.finalizada_por IS
'Usuario (public.usuarios.id) que finalizó la conversación.';
COMMENT ON COLUMN crm.conversaciones.motivo_finalizacion IS
'Motivo de finalización: venta_cerrada, informacion_entregada, no_interesado, sin_respuesta, fuera_de_perfil, duplicada, prueba u otro.';
COMMENT ON COLUMN crm.conversaciones.observaciones_finalizacion IS
'Observaciones capturadas al finalizar la conversación. Obligatorio cuando motivo_finalizacion = otro.';
COMMENT ON COLUMN crm.conversaciones.reactivada_en IS
'Fecha en que la conversación volvió a estado abierta después de estar finalizada.';
COMMENT ON COLUMN crm.conversaciones.reactivada_por_evento IS
'Evento que reactivó la conversación: mensaje_entrante o reapertura_manual.';

-- Refresca la vista de compatibilidad para que exponga las columnas nuevas
-- (una vista "SELECT *" no se actualiza sola al alterar la tabla base).
CREATE OR REPLACE VIEW whatsapp.conversaciones AS
SELECT *
FROM crm.conversaciones;

COMMIT;
