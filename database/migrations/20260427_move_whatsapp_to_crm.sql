BEGIN;

CREATE SCHEMA IF NOT EXISTS crm;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'conversaciones'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW whatsapp.conversaciones';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'mensajes'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW whatsapp.mensajes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'etiquetas'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW whatsapp.etiquetas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'conversacion_etiquetas'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW whatsapp.conversacion_etiquetas';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'conversaciones'
      AND c.relkind IN ('r', 'p')
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'crm'
      AND c.relname = 'conversaciones'
      AND c.relkind IN ('r', 'p')
  ) THEN
    EXECUTE 'ALTER TABLE whatsapp.conversaciones SET SCHEMA crm';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'mensajes'
      AND c.relkind IN ('r', 'p')
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'crm'
      AND c.relname = 'mensajes'
      AND c.relkind IN ('r', 'p')
  ) THEN
    EXECUTE 'ALTER TABLE whatsapp.mensajes SET SCHEMA crm';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'etiquetas'
      AND c.relkind IN ('r', 'p')
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'crm'
      AND c.relname = 'etiquetas'
      AND c.relkind IN ('r', 'p')
  ) THEN
    EXECUTE 'ALTER TABLE whatsapp.etiquetas SET SCHEMA crm';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'whatsapp'
      AND c.relname = 'conversacion_etiquetas'
      AND c.relkind IN ('r', 'p')
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'crm'
      AND c.relname = 'conversacion_etiquetas'
      AND c.relkind IN ('r', 'p')
  ) THEN
    EXECUTE 'ALTER TABLE whatsapp.conversacion_etiquetas SET SCHEMA crm';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'whatsapp' AND c.relname = 'conversaciones_id_seq' AND c.relkind = 'S')
     AND NOT EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'crm' AND c.relname = 'conversaciones_id_seq' AND c.relkind = 'S') THEN
    EXECUTE 'ALTER SEQUENCE whatsapp.conversaciones_id_seq SET SCHEMA crm';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'whatsapp' AND c.relname = 'mensajes_id_seq' AND c.relkind = 'S')
     AND NOT EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'crm' AND c.relname = 'mensajes_id_seq' AND c.relkind = 'S') THEN
    EXECUTE 'ALTER SEQUENCE whatsapp.mensajes_id_seq SET SCHEMA crm';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'whatsapp' AND c.relname = 'etiquetas_id_seq' AND c.relkind = 'S')
     AND NOT EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'crm' AND c.relname = 'etiquetas_id_seq' AND c.relkind = 'S') THEN
    EXECUTE 'ALTER SEQUENCE whatsapp.etiquetas_id_seq SET SCHEMA crm';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'whatsapp' AND c.relname = 'conversacion_etiquetas_id_seq' AND c.relkind = 'S')
     AND NOT EXISTS (SELECT 1 FROM pg_class c INNER JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'crm' AND c.relname = 'conversacion_etiquetas_id_seq' AND c.relkind = 'S') THEN
    EXECUTE 'ALTER SEQUENCE whatsapp.conversacion_etiquetas_id_seq SET SCHEMA crm';
  END IF;
END $$;

ALTER TABLE IF EXISTS crm.conversaciones
  DROP CONSTRAINT IF EXISTS conversaciones_contacto_id_fkey;

ALTER TABLE IF EXISTS crm.conversaciones
  DROP CONSTRAINT IF EXISTS fk_conversaciones_contactos;

ALTER TABLE IF EXISTS crm.mensajes
  DROP CONSTRAINT IF EXISTS mensajes_contacto_id_fkey;

ALTER TABLE IF EXISTS crm.mensajes
  DROP CONSTRAINT IF EXISTS fk_mensajes_contactos;

ALTER TABLE IF EXISTS crm.mensajes
  DROP CONSTRAINT IF EXISTS mensajes_conversacion_id_fkey;

ALTER TABLE IF EXISTS crm.mensajes
  DROP CONSTRAINT IF EXISTS fk_mensajes_conversaciones;

ALTER TABLE IF EXISTS crm.conversacion_etiquetas
  DROP CONSTRAINT IF EXISTS fk_conversacion_etiquetas_conversaciones;

ALTER TABLE IF EXISTS crm.conversacion_etiquetas
  DROP CONSTRAINT IF EXISTS fk_conversacion_etiquetas_etiquetas;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
    INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  INNER JOIN pg_attribute att ON att.attrelid = rel.oid
    AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND nsp.nspname = 'crm'
    AND rel.relname = 'mensajes'
    AND att.attname = 'contacto_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE crm.mensajes DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
    INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  INNER JOIN pg_attribute att ON att.attrelid = rel.oid
    AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND nsp.nspname = 'crm'
    AND rel.relname = 'mensajes'
    AND att.attname = 'conversacion_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE crm.mensajes DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
    INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  INNER JOIN pg_attribute att ON att.attrelid = rel.oid
    AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND nsp.nspname = 'crm'
    AND rel.relname = 'conversacion_etiquetas'
    AND att.attname = 'conversacion_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE crm.conversacion_etiquetas DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
    INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  INNER JOIN pg_attribute att ON att.attrelid = rel.oid
    AND att.attnum = ANY (con.conkey)
  WHERE con.contype = 'f'
    AND nsp.nspname = 'crm'
    AND rel.relname = 'conversacion_etiquetas'
    AND att.attname = 'etiqueta_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE crm.conversacion_etiquetas DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE IF EXISTS crm.conversaciones
  ADD CONSTRAINT fk_conversaciones_contactos
  FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);

ALTER TABLE IF EXISTS crm.mensajes
  ADD CONSTRAINT fk_mensajes_contactos
  FOREIGN KEY (contacto_id) REFERENCES public.contactos(id);

ALTER TABLE IF EXISTS crm.mensajes
  ADD CONSTRAINT fk_mensajes_conversaciones
  FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id);

ALTER TABLE IF EXISTS crm.conversacion_etiquetas
  ADD CONSTRAINT fk_conversacion_etiquetas_conversaciones
  FOREIGN KEY (conversacion_id) REFERENCES crm.conversaciones(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS crm.conversacion_etiquetas
  ADD CONSTRAINT fk_conversacion_etiquetas_etiquetas
  FOREIGN KEY (etiqueta_id) REFERENCES crm.etiquetas(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS crm.mensajes
  ALTER COLUMN telefono DROP NOT NULL;

ALTER TABLE IF EXISTS crm.mensajes
  ADD COLUMN IF NOT EXISTS email_from character varying(150),
  ADD COLUMN IF NOT EXISTS email_to character varying(150),
  ADD COLUMN IF NOT EXISTS email_subject character varying(200),
  ADD COLUMN IF NOT EXISTS email_cc character varying(200),
  ADD COLUMN IF NOT EXISTS email_bcc character varying(200),
  ADD COLUMN IF NOT EXISTS in_reply_to character varying(150);

COMMENT ON COLUMN crm.mensajes.email_from IS 'Remitente para mensajes de correo dentro del canal CRM.';
COMMENT ON COLUMN crm.mensajes.email_to IS 'Destinatario principal para mensajes de correo dentro del canal CRM.';
COMMENT ON COLUMN crm.mensajes.email_subject IS 'Asunto del correo asociado al mensaje CRM.';
COMMENT ON COLUMN crm.mensajes.email_cc IS 'Destinatarios en copia para mensajes de correo del CRM.';
COMMENT ON COLUMN crm.mensajes.email_bcc IS 'Destinatarios en copia oculta para mensajes de correo del CRM.';
COMMENT ON COLUMN crm.mensajes.in_reply_to IS 'Identificador externo del mensaje al que responde un correo.';

CREATE OR REPLACE VIEW whatsapp.conversaciones AS
SELECT *
FROM crm.conversaciones;

CREATE OR REPLACE VIEW whatsapp.mensajes AS
SELECT *
FROM crm.mensajes;

CREATE OR REPLACE VIEW whatsapp.etiquetas AS
SELECT *
FROM crm.etiquetas;

CREATE OR REPLACE VIEW whatsapp.conversacion_etiquetas AS
SELECT *
FROM crm.conversacion_etiquetas;

COMMIT;