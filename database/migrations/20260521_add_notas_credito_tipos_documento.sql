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
    'nota_credito',
    'Nota de crédito',
    'Notas de crédito',
    'RequestQuote',
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
    nombre = EXCLUDED.nombre,
    nombre_plural = EXCLUDED.nombre_plural,
    icono = EXCLUDED.icono,
    activo = true,
    modulo = EXCLUDED.modulo;

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
    'nota_credito_compra',
    'Nota de crédito de compra',
    'Notas de crédito de compra',
    'RequestQuote',
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
    nombre = EXCLUDED.nombre,
    nombre_plural = EXCLUDED.nombre_plural,
    icono = EXCLUDED.icono,
    activo = true,
    modulo = EXCLUDED.modulo;

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
  ON td.codigo IN ('nota_credito', 'nota_credito_compra')
WHERE NOT EXISTS (
    SELECT 1
    FROM core.empresas_tipos_documento etd
    WHERE etd.empresa_id = e.id
      AND etd.tipo_documento_id = td.id
);

UPDATE core.empresas_tipos_documento etd
SET activo = true,
    orden = td.orden
FROM core.tipos_documento td
WHERE td.id = etd.tipo_documento_id
  AND td.codigo IN ('nota_credito', 'nota_credito_compra');

WITH transiciones(cod_origen, cod_destino) AS (
  VALUES
    ('factura', 'nota_credito'),
    ('factura_compra', 'nota_credito_compra')
)
INSERT INTO core.empresas_tipos_documento_transiciones (
    empresa_id,
    tipo_documento_origen_id,
    tipo_documento_destino_id,
    activo,
    orden,
    usuario_creacion_id
)
SELECT
    e.id,
    td_origen.id,
    td_destino.id,
    true,
    COALESCE(base.max_orden, 0) + ROW_NUMBER() OVER (
      PARTITION BY e.id
      ORDER BY transiciones.cod_origen, transiciones.cod_destino
    ),
    NULL
FROM core.empresas e
JOIN transiciones
  ON true
JOIN core.tipos_documento td_origen
  ON td_origen.codigo = transiciones.cod_origen
JOIN core.tipos_documento td_destino
  ON td_destino.codigo = transiciones.cod_destino
LEFT JOIN LATERAL (
  SELECT MAX(etdt.orden) AS max_orden
  FROM core.empresas_tipos_documento_transiciones etdt
  WHERE etdt.empresa_id = e.id
) base ON true
WHERE NOT EXISTS (
    SELECT 1
    FROM core.empresas_tipos_documento_transiciones etdt
    WHERE etdt.empresa_id = e.id
      AND etdt.tipo_documento_origen_id = td_origen.id
      AND etdt.tipo_documento_destino_id = td_destino.id
);

UPDATE core.empresas_tipos_documento_transiciones etdt
SET activo = true
FROM core.tipos_documento td_origen,
     core.tipos_documento td_destino
WHERE td_origen.id = etdt.tipo_documento_origen_id
  AND td_destino.id = etdt.tipo_documento_destino_id
  AND (
    (td_origen.codigo = 'factura' AND td_destino.codigo = 'nota_credito')
    OR (td_origen.codigo = 'factura_compra' AND td_destino.codigo = 'nota_credito_compra')
  );
