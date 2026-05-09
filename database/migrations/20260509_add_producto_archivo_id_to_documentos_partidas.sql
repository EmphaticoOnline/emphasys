ALTER TABLE public.documentos_partidas
    ADD COLUMN IF NOT EXISTS producto_archivo_id integer NULL;

DO $$
BEGIN
    ALTER TABLE public.documentos_partidas
        ADD CONSTRAINT documentos_partidas_producto_archivo_id_fkey
        FOREIGN KEY (producto_archivo_id)
        REFERENCES public.productos_archivos(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;