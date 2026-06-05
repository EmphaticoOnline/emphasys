ALTER TABLE public.contactos
	ADD COLUMN IF NOT EXISTS interes_inicial VARCHAR(500) NULL;

COMMENT ON COLUMN public.contactos.interes_inicial IS 'Interés inicial capturado para seguimiento comercial del contacto';

-- Rollback manual:
-- ALTER TABLE public.contactos DROP COLUMN IF EXISTS interes_inicial;