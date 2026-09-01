-- Definiciones funcionales para el corte runtime DICOR → Emphasys, empresa 9.
-- Idempotente: no crea valores ni modifica documentos existentes.
INSERT INTO core.campos_configuracion
  (empresa_id, entidad_tipo_id, tipo_documento, nombre, clave, tipo_dato,
   tipo_control, obligatorio, activo, orden)
SELECT 9, et.id, tipos.tipo_documento, tipos.nombre, tipos.clave, tipos.tipo_dato,
       tipos.tipo_control, false, true, tipos.orden
FROM core.entidades_tipos et
CROSS JOIN (VALUES
  ('DOCUMENTO', 'factura', 'Folio externo DICOR', 'folio_externo', 'texto', 'textbox', 900),
  ('DOCUMENTO', 'factura_compra', 'Folio externo DICOR', 'folio_externo', 'texto', 'textbox', 900),
  ('DOCUMENTO_PARTIDA', 'factura', 'Precio base Dani', 'precio_dani', 'numero', 'textbox', 901),
  ('DOCUMENTO_PARTIDA', 'factura_compra', 'Precio base Dani', 'precio_dani', 'numero', 'textbox', 901)
) AS tipos(entidad, tipo_documento, nombre, clave, tipo_dato, tipo_control, orden)
WHERE et.codigo = tipos.entidad
  AND NOT EXISTS (
    SELECT 1 FROM core.campos_configuracion cc
    WHERE cc.empresa_id = 9
      AND cc.entidad_tipo_id = et.id
      AND cc.tipo_documento = tipos.tipo_documento
      AND cc.clave = tipos.clave
  );
