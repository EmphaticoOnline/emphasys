BEGIN;

-- conversaciones_estado_check (definición actual, ver
-- backend/database/schema/crm/conversaciones.sql) solo permite
-- 'abierta' y 'cerrada'. Se agrega 'finalizada' conservando los valores
-- previamente válidos.
ALTER TABLE crm.conversaciones
DROP CONSTRAINT IF EXISTS conversaciones_estado_check;

ALTER TABLE crm.conversaciones
ADD CONSTRAINT conversaciones_estado_check
CHECK (
    estado IN (
        'abierta',
        'cerrada',
        'finalizada'
    )
);

-- No se agregan/quitan columnas: whatsapp.conversaciones (vista SELECT *
-- sobre crm.conversaciones) no requiere recrearse por este cambio.

COMMIT;
