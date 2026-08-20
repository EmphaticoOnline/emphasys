BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_productos_impuestos_producto'
          AND conrelid = 'public.productos_impuestos'::regclass
    ) THEN
        ALTER TABLE public.productos_impuestos
            ADD CONSTRAINT fk_productos_impuestos_producto
            FOREIGN KEY (producto_id)
            REFERENCES public.productos(id)
            ON DELETE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_productos_impuestos_producto_impuesto'
          AND conrelid = 'public.productos_impuestos'::regclass
    ) THEN
        ALTER TABLE public.productos_impuestos
            ADD CONSTRAINT uq_productos_impuestos_producto_impuesto
            UNIQUE (producto_id, impuesto_id);
    END IF;
END
$$;

COMMIT;
