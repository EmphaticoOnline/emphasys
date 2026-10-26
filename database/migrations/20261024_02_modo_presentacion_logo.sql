-- White Label: modo de presentación del logotipo por empresa.
-- Se crea para ejecución explícita; este archivo no se ejecuta automáticamente.
ALTER TABLE core.empresas_identidad_visual
  ADD COLUMN IF NOT EXISTS modo_presentacion_logo text NOT NULL DEFAULT 'automatico';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'eiv_modo_presentacion_logo'
       AND conrelid = 'core.empresas_identidad_visual'::regclass
  ) THEN
    ALTER TABLE core.empresas_identidad_visual
      ADD CONSTRAINT eiv_modo_presentacion_logo
      CHECK (modo_presentacion_logo IN ('automatico', 'fondo_blanco', 'logo_blanco'));
  END IF;
END $$;

COMMENT ON COLUMN core.empresas_identidad_visual.modo_presentacion_logo IS
  'Presentación del logotipo: automatico, fondo_blanco o logo_blanco.';
