-- Vincula mercancías de viaje con el maestro general de productos.
BEGIN;
ALTER TABLE transporte.viaje_mercancias
  ADD COLUMN IF NOT EXISTS producto_id integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'transporte.viaje_mercancias'::regclass
      AND conname = 'fk_transporte_viaje_mercancias_producto'
  ) THEN
    ALTER TABLE transporte.viaje_mercancias
      ADD CONSTRAINT fk_transporte_viaje_mercancias_producto
      FOREIGN KEY (producto_id) REFERENCES public.productos(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_transporte_viaje_mercancias_producto
  ON transporte.viaje_mercancias (empresa_id, producto_id)
  WHERE producto_id IS NOT NULL;

COMMENT ON COLUMN transporte.viaje_mercancias.producto_id IS
  'Producto maestro de la mercancía; NULL permite mercancía libre excepcional.';
COMMIT;
