BEGIN;

DROP INDEX IF EXISTS public.ux_contactos_empresa_telefono;

CREATE INDEX IF NOT EXISTS ix_contactos_empresa_telefono
ON public.contactos (empresa_id, telefono)
WHERE telefono IS NOT NULL;

COMMIT;