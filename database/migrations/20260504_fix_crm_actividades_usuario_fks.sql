-- Corrige FKs de crm.actividades para usar la tabla de usuarios autenticados en core.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_usuario_asignado'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        DROP CONSTRAINT fk_actividades_usuario_asignado;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_usuario_creador'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        DROP CONSTRAINT fk_actividades_usuario_creador;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_usuario_asignado'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        ADD CONSTRAINT fk_actividades_usuario_asignado
        FOREIGN KEY (usuario_asignado_id)
        REFERENCES core.usuarios(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE con.conname = 'fk_actividades_usuario_creador'
          AND nsp.nspname = 'crm'
          AND rel.relname = 'actividades'
    ) THEN
        ALTER TABLE crm.actividades
        ADD CONSTRAINT fk_actividades_usuario_creador
        FOREIGN KEY (usuario_creador_id)
        REFERENCES core.usuarios(id)
        ON DELETE RESTRICT;
    END IF;
END $$;