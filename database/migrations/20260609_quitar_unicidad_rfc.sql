BEGIN;

DROP INDEX IF EXISTS public.ux_contactos_rfc_empresa;

CREATE INDEX IF NOT EXISTS ix_contactos_empresa_rfc
ON public.contactos (empresa_id, rfc)
WHERE rfc IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_contactos_empresa_codigo_legacy
ON public.contactos (empresa_id, codigo_legacy)
WHERE codigo_legacy IS NOT NULL;

COMMIT;