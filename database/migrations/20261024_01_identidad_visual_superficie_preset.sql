-- White Label: superficie secundaria independiente y preset canónico.
-- Se crea para ejecución explícita; este archivo no se ejecuta automáticamente.
ALTER TABLE core.empresas_identidad_visual
  ADD COLUMN IF NOT EXISTS color_superficie_secundaria char(7) NULL,
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'emphasys';

UPDATE core.empresas_identidad_visual
   SET modo = 'personalizado'
 WHERE modo = 'emphasys'
   AND (color_primario IS NOT NULL OR color_acento IS NOT NULL OR color_sidebar IS NOT NULL OR color_superficie_secundaria IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'eiv_color_superficie_secundaria_hex'
       AND conrelid = 'core.empresas_identidad_visual'::regclass
  ) THEN
    ALTER TABLE core.empresas_identidad_visual
      ADD CONSTRAINT eiv_color_superficie_secundaria_hex
      CHECK (color_superficie_secundaria IS NULL OR color_superficie_secundaria ~ '^#[0-9a-f]{6}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'eiv_modo_identidad'
       AND conrelid = 'core.empresas_identidad_visual'::regclass
  ) THEN
    ALTER TABLE core.empresas_identidad_visual
      ADD CONSTRAINT eiv_modo_identidad CHECK (modo IN ('emphasys', 'personalizado'));
  END IF;
END $$;

COMMENT ON COLUMN core.empresas_identidad_visual.color_superficie_secundaria IS
  'Superficie secundaria elevada (#rrggbb); NULL = derivada del sidebar.';
COMMENT ON COLUMN core.empresas_identidad_visual.modo IS
  'emphasys = usa la identidad canónica completa; personalizado = usa colores de empresa.';
