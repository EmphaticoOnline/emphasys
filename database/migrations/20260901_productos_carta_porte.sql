BEGIN;

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS clave_bienes_transportados_sat varchar(20),
  ADD COLUMN IF NOT EXISTS es_material_peligroso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clave_material_peligroso_sat varchar(20),
  ADD COLUMN IF NOT EXISTS clave_embalaje_sat varchar(20),
  ADD COLUMN IF NOT EXISTS descripcion_embalaje varchar(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_productos_carta_porte_claves_no_vacias'
      AND conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT ck_productos_carta_porte_claves_no_vacias
      CHECK (
        (clave_bienes_transportados_sat IS NULL OR btrim(clave_bienes_transportados_sat) <> '')
        AND (clave_material_peligroso_sat IS NULL OR btrim(clave_material_peligroso_sat) <> '')
        AND (clave_embalaje_sat IS NULL OR btrim(clave_embalaje_sat) <> '')
      );
  END IF;
END $$;

COMMIT;
