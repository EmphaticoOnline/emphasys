-- =========================
-- FASE 1: ACTIVIDADES POR CONTACTO
-- =========================

-- 1. Agrega la columna como nullable para una adopcion segura.
ALTER TABLE crm.actividades
    ADD COLUMN IF NOT EXISTS contacto_id INTEGER NULL;

-- 2. Documenta la nueva relacion primaria de negocio.
COMMENT ON COLUMN crm.actividades.contacto_id IS
'Contacto al que pertenece la actividad. En Fase 1 es nullable solo para permitir backfill y auditoria.';

-- 3. Crea indice para futuras consultas por contacto.
CREATE INDEX IF NOT EXISTS idx_actividades_contacto
    ON crm.actividades (contacto_id);

-- 4. Agrega FK idempotente hacia public.contactos.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_contacto'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        ADD CONSTRAINT fk_actividades_contacto
        FOREIGN KEY (contacto_id)
        REFERENCES public.contactos(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

-- 5. Backfill: deriva contacto_id desde la oportunidad cuando exista.
UPDATE crm.actividades a
SET contacto_id = o.contacto_id
FROM crm.oportunidades_venta o
WHERE a.oportunidad_id = o.id
  AND a.contacto_id IS NULL
  AND o.contacto_id IS NOT NULL;

-- 6. Auditoria de estado posterior al backfill.
SELECT
    COUNT(*) AS total_actividades,
    COUNT(*) FILTER (WHERE a.contacto_id IS NOT NULL) AS actividades_con_contacto_id,
    COUNT(*) FILTER (WHERE a.contacto_id IS NULL) AS actividades_sin_contacto_id,
    COUNT(*) FILTER (WHERE a.oportunidad_id IS NOT NULL) AS actividades_con_oportunidad_id,
    COUNT(*) FILTER (WHERE a.oportunidad_id IS NULL) AS actividades_sin_oportunidad_id,
    COUNT(*) FILTER (
        WHERE a.oportunidad_id IS NOT NULL
          AND (
              o.id IS NULL
              OR o.contacto_id IS NULL
              OR a.contacto_id IS DISTINCT FROM o.contacto_id
          )
    ) AS actividades_con_oportunidad_inconsistente
FROM crm.actividades a
LEFT JOIN crm.oportunidades_venta o
    ON o.id = a.oportunidad_id;