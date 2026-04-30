DO $$
DECLARE
v_entidad_tipo_id INTEGER;
v_catalogo_tipo_id INTEGER;
v_empresa_id INTEGER;
BEGIN

-- =========================
-- 1. ENTIDAD: OPORTUNIDAD_VENTA
-- =========================

IF NOT EXISTS (
SELECT 1 FROM core.entidades_tipos WHERE codigo = 'OPORTUNIDAD_VENTA'
) THEN
INSERT INTO core.entidades_tipos (codigo, nombre)
VALUES ('OPORTUNIDAD_VENTA', 'Oportunidad de venta');
END IF;

SELECT id INTO v_entidad_tipo_id
FROM core.entidades_tipos
WHERE codigo = 'OPORTUNIDAD_VENTA';

-- =========================
-- 2. LOOP EMPRESAS
-- =========================

FOR v_empresa_id IN SELECT unnest(ARRAY[1,2,3])
LOOP


-- Crear tipo de catálogo por empresa
IF NOT EXISTS (
    SELECT 1
    FROM core.catalogos_tipos
    WHERE nombre = 'Motivo no cierre'
      AND entidad_tipo_id = v_entidad_tipo_id
      AND empresa_id = v_empresa_id
) THEN
    INSERT INTO core.catalogos_tipos (
        empresa_id,
        entidad_tipo_id,
        nombre,
        permite_multiple,
        activo
    )
    VALUES (
        v_empresa_id,
        v_entidad_tipo_id,
        'Motivo no cierre',
        false,
        true
    );
END IF;

SELECT id INTO v_catalogo_tipo_id
FROM core.catalogos_tipos
WHERE nombre = 'Motivo no cierre'
  AND entidad_tipo_id = v_entidad_tipo_id
  AND empresa_id = v_empresa_id
LIMIT 1;

-- =========================
-- VALORES DEL CATÁLOGO
-- =========================

-- Precio alto
IF NOT EXISTS (
    SELECT 1 FROM core.catalogos
    WHERE tipo_catalogo_id = v_catalogo_tipo_id
      AND descripcion = 'Precio alto'
) THEN
    INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, descripcion, orden, activo)
    VALUES (v_empresa_id, v_catalogo_tipo_id, 'Precio alto', 1, true);
END IF;

-- Competencia
IF NOT EXISTS (
    SELECT 1 FROM core.catalogos
    WHERE tipo_catalogo_id = v_catalogo_tipo_id
      AND descripcion = 'Se fue con competencia'
) THEN
    INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, descripcion, orden, activo)
    VALUES (v_empresa_id, v_catalogo_tipo_id, 'Se fue con competencia', 2, true);
END IF;

-- No prioridad
IF NOT EXISTS (
    SELECT 1 FROM core.catalogos
    WHERE tipo_catalogo_id = v_catalogo_tipo_id
      AND descripcion = 'No era prioridad'
) THEN
    INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, descripcion, orden, activo)
    VALUES (v_empresa_id, v_catalogo_tipo_id, 'No era prioridad', 3, true);
END IF;

-- Sin presupuesto
IF NOT EXISTS (
    SELECT 1 FROM core.catalogos
    WHERE tipo_catalogo_id = v_catalogo_tipo_id
      AND descripcion = 'Sin presupuesto'
) THEN
    INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, descripcion, orden, activo)
    VALUES (v_empresa_id, v_catalogo_tipo_id, 'Sin presupuesto', 4, true);
END IF;

-- Proyecto cancelado
IF NOT EXISTS (
    SELECT 1 FROM core.catalogos
    WHERE tipo_catalogo_id = v_catalogo_tipo_id
      AND descripcion = 'Proyecto cancelado'
) THEN
    INSERT INTO core.catalogos (empresa_id, tipo_catalogo_id, descripcion, orden, activo)
    VALUES (v_empresa_id, v_catalogo_tipo_id, 'Proyecto cancelado', 5, true);
END IF;


END LOOP;

END $$;
