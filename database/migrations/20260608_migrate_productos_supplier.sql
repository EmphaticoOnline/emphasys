ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS dias_entrega integer,
    ADD COLUMN IF NOT EXISTS cantidad_minima_compra numeric(15,4),
    ADD COLUMN IF NOT EXISTS proveedor_preferido_id integer,
    ADD COLUMN IF NOT EXISTS pais_origen_id text;

ALTER TABLE public.productos
    ADD CONSTRAINT fk_productos_proveedor_preferido
    FOREIGN KEY (proveedor_preferido_id)
    REFERENCES public.contactos(id)
    ON DELETE SET NULL;

ALTER TABLE public.productos
    ADD CONSTRAINT fk_productos_pais_origen
    FOREIGN KEY (pais_origen_id)
    REFERENCES sat.paises(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_productos_proveedor_preferido
    ON public.productos(proveedor_preferido_id);

CREATE INDEX IF NOT EXISTS ix_productos_pais_origen
    ON public.productos(pais_origen_id);