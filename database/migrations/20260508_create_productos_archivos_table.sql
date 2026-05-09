BEGIN;

-- =========================================================
-- Crear tabla productos_archivos
-- =========================================================

CREATE TABLE IF NOT EXISTS public.productos_archivos (
    id serial4 NOT NULL,

    producto_id int4 NOT NULL,

    -- imagen, ficha_tecnica, certificado, otro
    tipo_archivo varchar(30) NOT NULL,

    -- nombre/ruta/url del archivo
    archivo varchar(255) NOT NULL,

    descripcion varchar(150) NULL,

    orden_visual int4 DEFAULT 1 NOT NULL,

    principal bool DEFAULT false NOT NULL,

    fecha_creacion timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT productos_archivos_pkey
        PRIMARY KEY (id),

    CONSTRAINT fk_productos_archivos_producto
        FOREIGN KEY (producto_id)
        REFERENCES public.productos(id)
        ON DELETE CASCADE
);

-- =========================================================
-- Índices
-- =========================================================

CREATE INDEX IF NOT EXISTS ix_productos_archivos_producto
    ON public.productos_archivos(producto_id);

CREATE INDEX IF NOT EXISTS ix_productos_archivos_tipo
    ON public.productos_archivos(tipo_archivo);

CREATE INDEX IF NOT EXISTS ix_productos_archivos_principal
    ON public.productos_archivos(producto_id, principal);

-- =========================================================
-- Eliminar columnas viejas si existen
-- =========================================================

ALTER TABLE public.productos
    DROP COLUMN IF EXISTS archivo_fotografia_1;

ALTER TABLE public.productos
    DROP COLUMN IF EXISTS archivo_fotografia_2;

ALTER TABLE public.productos
    DROP COLUMN IF EXISTS archivo_ficha_tecnica;

ALTER TABLE public.productos
    DROP COLUMN IF EXISTS archivo_certificado;

COMMIT;