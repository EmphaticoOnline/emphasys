-- ============================================================================
-- MIGRACION:
-- 20260612_add_ajuste_saldo_tipos_documento.sql
--
-- Propósito: Agregar tipos de documento ajuste_cliente y ajuste_proveedor.
-- Estos documentos afectan saldo mediante aplicaciones_saldo igual que una
-- nota de crédito, pero SIN generar finanzas_operacion ni movimiento bancario.
-- Usados principalmente para cerrar saldos en Facturación Global sin movimiento
-- de caja o banco.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Tipos de documento
-- ============================================================================

INSERT INTO core.tipos_documento (
    codigo,
    nombre,
    nombre_plural,
    icono,
    orden,
    activo,
    modulo
)
VALUES (
    'ajuste_cliente',
    'Ajuste de saldo',
    'Ajustes de saldo',
    'Tune',
    (
        SELECT COALESCE(MAX(td.orden) + 1, 0)
        FROM core.tipos_documento td
        WHERE LOWER(COALESCE(td.modulo, '')) = 'ventas'
    ),
    true,
    'ventas'
)
ON CONFLICT (codigo) DO UPDATE
SET
    nombre        = EXCLUDED.nombre,
    nombre_plural = EXCLUDED.nombre_plural,
    icono         = EXCLUDED.icono,
    activo        = true,
    modulo        = EXCLUDED.modulo;

INSERT INTO core.tipos_documento (
    codigo,
    nombre,
    nombre_plural,
    icono,
    orden,
    activo,
    modulo
)
VALUES (
    'ajuste_proveedor',
    'Ajuste de saldo',
    'Ajustes de saldo',
    'Tune',
    (
        SELECT COALESCE(MAX(td.orden) + 1, 0)
        FROM core.tipos_documento td
        WHERE LOWER(COALESCE(td.modulo, '')) = 'compras'
    ),
    true,
    'compras'
)
ON CONFLICT (codigo) DO UPDATE
SET
    nombre        = EXCLUDED.nombre,
    nombre_plural = EXCLUDED.nombre_plural,
    icono         = EXCLUDED.icono,
    activo        = true,
    modulo        = EXCLUDED.modulo;

-- ============================================================================
-- 2. naturaleza_saldo = 'abono'
--    Necesario para que la vista documentos_saldo calcule saldo disponible.
-- ============================================================================

UPDATE core.tipos_documento
SET naturaleza_saldo = 'abono'
WHERE codigo IN ('ajuste_cliente', 'ajuste_proveedor');

-- ============================================================================
-- 3. Registrar en todas las empresas existentes
-- ============================================================================

INSERT INTO core.empresas_tipos_documento (
    empresa_id,
    tipo_documento_id,
    activo,
    orden,
    usuario_creacion_id
)
SELECT
    e.id,
    td.id,
    true,
    td.orden,
    NULL
FROM core.empresas e
JOIN core.tipos_documento td
  ON td.codigo IN ('ajuste_cliente', 'ajuste_proveedor')
WHERE NOT EXISTS (
    SELECT 1
    FROM core.empresas_tipos_documento etd
    WHERE etd.empresa_id = e.id
      AND etd.tipo_documento_id = td.id
);

UPDATE core.empresas_tipos_documento etd
SET activo = true,
    orden  = td.orden
FROM core.tipos_documento td
WHERE td.id = etd.tipo_documento_id
  AND td.codigo IN ('ajuste_cliente', 'ajuste_proveedor');

-- ============================================================================
-- 4. Series por defecto para cada empresa
--    ACL = Ajuste de saldo Cliente
--    APR = Ajuste de saldo Proveedor
-- ============================================================================

INSERT INTO public.series_documento (
    empresa_id,
    tipo_documento,
    serie,
    descripcion,
    es_fiscal,
    activa,
    ultimo_numero,
    updated_at
)
SELECT
    e.id,
    d.tipo_documento,
    d.serie,
    d.descripcion,
    false,
    true,
    0,
    NOW()
FROM core.empresas e
CROSS JOIN (
    VALUES
        ('ajuste_cliente',   'ACL', 'Serie default de ajustes de saldo cliente'),
        ('ajuste_proveedor', 'APR', 'Serie default de ajustes de saldo proveedor')
) AS d(tipo_documento, serie, descripcion)
ON CONFLICT (empresa_id, tipo_documento, serie) DO NOTHING;

-- ============================================================================
-- 5. Conceptos: "Ajuste de saldo Cliente" y "Ajuste de saldo Proveedor"
--    Solo se insertan si no existen ya para cada empresa.
-- ============================================================================

INSERT INTO public.conceptos (empresa_id, nombre_concepto, es_gasto, activo, orden)
SELECT
    e.id,
    c.nombre_concepto,
    false,
    true,
    COALESCE(
        (SELECT MAX(orden) FROM public.conceptos WHERE empresa_id = e.id),
        0
    ) + ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY c.nombre_concepto)
FROM core.empresas e
CROSS JOIN (
    VALUES
        ('Ajuste de saldo Cliente'),
        ('Ajuste de saldo Proveedor')
) AS c(nombre_concepto)
ON CONFLICT (empresa_id, nombre_concepto) DO NOTHING;

COMMIT;
