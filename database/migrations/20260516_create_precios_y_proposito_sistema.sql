-- =====================================================
-- Módulo de precios / listas de precios
-- Emphasys ERP
-- =====================================================

-- 1) Agregar propósito de sistema a campos configurables
ALTER TABLE core.campos_configuracion
ADD COLUMN IF NOT EXISTS proposito_sistema VARCHAR(50) NULL;

COMMENT ON COLUMN core.campos_configuracion.proposito_sistema IS
'Propósito especial del campo configurable dentro del sistema. Ejemplo: PRECIOS.';

-- Solo puede existir un campo con el mismo propósito por empresa.
-- Permite múltiples NULL.
CREATE UNIQUE INDEX IF NOT EXISTS ux_campos_configuracion_empresa_proposito_sistema
ON core.campos_configuracion (empresa_id, proposito_sistema)
WHERE proposito_sistema IS NOT NULL;


-- 2) Crear tabla de listas de precios
CREATE TABLE IF NOT EXISTS precios_listas (
    id BIGSERIAL PRIMARY KEY,

    empresa_id INT4 NOT NULL,

    nombre VARCHAR(120) NOT NULL,

    tipo_precio VARCHAR(20) NOT NULL DEFAULT 'VENTA',

    orden INT4 NULL,

    es_default BOOLEAN NOT NULL DEFAULT FALSE,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE precios_listas
ADD COLUMN IF NOT EXISTS orden INT4 NULL;

ALTER TABLE precios_listas
ADD COLUMN IF NOT EXISTS es_default BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON TABLE precios_listas IS
'Define listas de precios de venta o compra por empresa.';

COMMENT ON COLUMN precios_listas.tipo_precio IS
'Tipo de lista de precio. Valores esperados: VENTA o COMPRA.';

COMMENT ON COLUMN precios_listas.orden IS
'Orden opcional para despliegue y ordenamientos futuros del catálogo.';

COMMENT ON COLUMN precios_listas.es_default IS
'Indica si la lista es la predeterminada para la empresa y tipo de precio.';


-- 3) Índices y unicidad de listas
CREATE INDEX IF NOT EXISTS idx_precios_listas_empresa
ON precios_listas (empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_precios_listas_empresa_tipo_nombre
ON precios_listas (empresa_id, tipo_precio, nombre);

CREATE UNIQUE INDEX IF NOT EXISTS ux_precios_listas_empresa_tipo_default
ON precios_listas (empresa_id, tipo_precio)
WHERE es_default = TRUE;


-- 4) Foreign key empresa
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'precios_listas'
          AND constraint_name = 'fk_precios_listas_empresa'
    ) THEN
        ALTER TABLE precios_listas
        ADD CONSTRAINT fk_precios_listas_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id);
    END IF;
END $$;


-- 5) Agregar lista directa al contacto
ALTER TABLE contactos
ADD COLUMN IF NOT EXISTS precio_lista_id BIGINT NULL;

COMMENT ON COLUMN contactos.precio_lista_id IS
'Lista de precios asignada directamente al contacto. Tiene prioridad sobre la lista derivada desde la clasificación comercial.';

CREATE INDEX IF NOT EXISTS idx_contactos_precio_lista
ON contactos (precio_lista_id);


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'contactos'
          AND constraint_name = 'fk_contactos_precio_lista'
    ) THEN
        ALTER TABLE contactos
        ADD CONSTRAINT fk_contactos_precio_lista
        FOREIGN KEY (precio_lista_id)
        REFERENCES precios_listas(id);
    END IF;
END $$;


ALTER TABLE core.catalogos
ADD COLUMN IF NOT EXISTS precio_lista_id BIGINT NULL;

COMMENT ON COLUMN core.catalogos.precio_lista_id IS
'Lista de precios asociada al valor de catálogo. Útil para derivar lista desde clasificaciones comerciales.';

CREATE INDEX IF NOT EXISTS idx_catalogos_precio_lista
ON core.catalogos (precio_lista_id)
WHERE precio_lista_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'core'
          AND table_name = 'catalogos'
          AND constraint_name = 'fk_catalogos_precio_lista'
    ) THEN
        ALTER TABLE core.catalogos
        ADD CONSTRAINT fk_catalogos_precio_lista
        FOREIGN KEY (precio_lista_id)
        REFERENCES public.precios_listas(id);
    END IF;
END $$;


-- 6) Crear tabla de precios
CREATE TABLE IF NOT EXISTS precios (
    id BIGSERIAL PRIMARY KEY,

    empresa_id INT4 NOT NULL,

    producto_id BIGINT NOT NULL,

    precio_lista_id BIGINT NOT NULL,

    contacto_id BIGINT NULL,

    precio NUMERIC(18,6) NOT NULL DEFAULT 0,

    moneda_id BIGINT NULL,

    vigencia_desde TIMESTAMP NULL,
    vigencia_hasta TIMESTAMP NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE precios IS
'Precios de productos por lista, con posibilidad futura de precio específico por contacto.';


-- 7) Índices de precios
CREATE INDEX IF NOT EXISTS idx_precios_empresa
ON precios (empresa_id);

CREATE INDEX IF NOT EXISTS idx_precios_producto
ON precios (producto_id);

CREATE INDEX IF NOT EXISTS idx_precios_lista
ON precios (precio_lista_id);

CREATE INDEX IF NOT EXISTS idx_precios_contacto
ON precios (contacto_id);


-- 8) Evitar duplicados de precio
CREATE UNIQUE INDEX IF NOT EXISTS ux_precios_empresa_producto_lista_contacto
ON precios (
    empresa_id,
    producto_id,
    precio_lista_id,
    COALESCE(contacto_id, 0)
);


-- 9) Foreign keys de precios
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'precios'
          AND constraint_name = 'fk_precios_empresa'
    ) THEN
        ALTER TABLE precios
        ADD CONSTRAINT fk_precios_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES core.empresas(id);
    END IF;
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'precios'
          AND constraint_name = 'fk_precios_lista'
    ) THEN
        ALTER TABLE precios
        ADD CONSTRAINT fk_precios_lista
        FOREIGN KEY (precio_lista_id)
        REFERENCES precios_listas(id);
    END IF;
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'precios'
          AND constraint_name = 'fk_precios_contacto'
    ) THEN
        ALTER TABLE precios
        ADD CONSTRAINT fk_precios_contacto
        FOREIGN KEY (contacto_id)
        REFERENCES contactos(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'precios'
          AND constraint_name = 'fk_precios_producto'
    ) THEN
        ALTER TABLE precios
        ADD CONSTRAINT fk_precios_producto
        FOREIGN KEY (producto_id)
        REFERENCES public.productos(id);
    END IF;
END $$;