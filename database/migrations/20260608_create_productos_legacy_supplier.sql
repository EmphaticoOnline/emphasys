CREATE SCHEMA IF NOT EXISTS migrate;

CREATE TABLE IF NOT EXISTS migrate.productos_legacy_supplier (
    empresa_id int4 NOT NULL,
    clave_producto varchar(50) NOT NULL,

    proveedor_surtido varchar(150) NULL,
    proveedor_surtido_2 varchar(150) NULL,
    proveedor_surtido_3 varchar(150) NULL,

    unidad_aduana varchar(20) NULL,
    factor_equivalente_unidad_aduana numeric(18,6) NULL,

    usa_pedimento boolean NULL,
    costo_reposicion numeric(18,6) NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_productos_legacy_supplier
        PRIMARY KEY (empresa_id, clave_producto)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_productos_legacy_supplier_producto'
    ) THEN
        ALTER TABLE migrate.productos_legacy_supplier
        ADD CONSTRAINT fk_productos_legacy_supplier_producto
        FOREIGN KEY (empresa_id, clave_producto)
        REFERENCES public.productos (empresa_id, clave)
        ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_productos_legacy_supplier_proveedor_surtido
    ON migrate.productos_legacy_supplier(proveedor_surtido);

CREATE INDEX IF NOT EXISTS ix_productos_legacy_supplier_proveedor_surtido_2
    ON migrate.productos_legacy_supplier(proveedor_surtido_2);

CREATE INDEX IF NOT EXISTS ix_productos_legacy_supplier_proveedor_surtido_3
    ON migrate.productos_legacy_supplier(proveedor_surtido_3);

CREATE TABLE migrate.productos_raw (
    empresa_id int4 NOT NULL,
    data jsonb NOT NULL,
    fecha_importacion timestamptz NOT NULL DEFAULT now()
);