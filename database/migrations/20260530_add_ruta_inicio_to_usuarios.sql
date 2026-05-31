ALTER TABLE core.usuarios
	ADD COLUMN IF NOT EXISTS ruta_inicio text;

COMMENT ON COLUMN core.usuarios.ruta_inicio IS 'Ruta inicial sugerida al iniciar sesión';