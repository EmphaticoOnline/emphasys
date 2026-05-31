ALTER TABLE public.documentos
	ADD COLUMN IF NOT EXISTS usuario_cancelacion_id INTEGER NULL,
	ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT NULL,
	ADD COLUMN IF NOT EXISTS motivo_sat VARCHAR(2) NULL,
	ADD COLUMN IF NOT EXISTS uuid_sustitucion VARCHAR(36) NULL;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'fk_documentos_usuario_cancelacion'
		  AND conrelid = 'public.documentos'::regclass
	) THEN
		ALTER TABLE public.documentos
			ADD CONSTRAINT fk_documentos_usuario_cancelacion
			FOREIGN KEY (usuario_cancelacion_id)
			REFERENCES core.usuarios(id)
			ON DELETE SET NULL;
	END IF;
END $$;

COMMENT ON COLUMN public.documentos.usuario_cancelacion_id IS 'Usuario que ejecutó la cancelación del documento';
COMMENT ON COLUMN public.documentos.motivo_cancelacion IS 'Motivo interno de cancelación capturado por el usuario';
COMMENT ON COLUMN public.documentos.motivo_sat IS 'Motivo SAT de cancelación CFDI (ejemplo: 01, 02, 03, 04)';
COMMENT ON COLUMN public.documentos.uuid_sustitucion IS 'UUID del CFDI sustituto cuando el motivo SAT requiere sustitución';
