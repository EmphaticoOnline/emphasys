-- Habilita el flujo espejo Factura Compra -> Nota de Crédito de Compra
-- para todas las empresas que tengan ambos tipos documentales activos.
-- La operación es idempotente y no modifica documentos existentes.
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
  origen.id,
  destino.id,
  true,
  COALESCE(base.max_orden, 0) + 1,
  NULL
FROM core.empresas e
JOIN core.tipos_documento origen ON origen.codigo = 'factura_compra'
JOIN core.tipos_documento destino ON destino.codigo = 'nota_credito_compra'
LEFT JOIN LATERAL (
  SELECT MAX(etdt.orden) AS max_orden
  FROM core.empresas_tipos_documento_transiciones etdt
  WHERE etdt.empresa_id = e.id
) base ON true
WHERE EXISTS (
  SELECT 1
  FROM core.empresas_tipos_documento etd
  WHERE etd.empresa_id = e.id
    AND etd.tipo_documento_id = origen.id
    AND etd.activo = true
)
AND EXISTS (
  SELECT 1
  FROM core.empresas_tipos_documento etd
  WHERE etd.empresa_id = e.id
    AND etd.tipo_documento_id = destino.id
    AND etd.activo = true
)
ON CONFLICT (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id)
DO UPDATE SET activo = true;
