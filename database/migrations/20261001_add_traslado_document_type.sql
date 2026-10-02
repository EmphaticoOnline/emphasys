BEGIN;

INSERT INTO core.tipos_documento (
  codigo, nombre, nombre_plural, icono, orden, activo, modulo,
  naturaleza_saldo, afecta_inventario
)
VALUES (
  'traslado', 'Traslado', 'Traslados', 'LocalShipping',
  (SELECT COALESCE(MAX(orden) + 1, 0) FROM core.tipos_documento),
  true, 'ventas', 'none', 'none'
)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    nombre_plural = EXCLUDED.nombre_plural,
    icono = EXCLUDED.icono,
    activo = true,
    naturaleza_saldo = 'none',
    afecta_inventario = 'none';

INSERT INTO core.empresas_tipos_documento (
  empresa_id, tipo_documento_id, activo, orden, usuario_creacion_id,
  afecta_inventario, afecta_reservado
)
SELECT e.id, td.id, true, td.orden, NULL, 'none', false
  FROM core.empresas e
  JOIN core.tipos_documento td ON td.codigo = 'traslado'
 WHERE NOT EXISTS (
   SELECT 1 FROM core.empresas_tipos_documento etd
    WHERE etd.empresa_id = e.id AND etd.tipo_documento_id = td.id
 );

UPDATE core.empresas_tipos_documento etd
   SET activo = true,
       afecta_inventario = 'none',
       afecta_reservado = false
  FROM core.tipos_documento td
 WHERE td.id = etd.tipo_documento_id
   AND td.codigo = 'traslado';

INSERT INTO public.series_documento (
  empresa_id, tipo_documento, serie, descripcion, es_fiscal, activa,
  ultimo_numero, updated_at
)
SELECT e.id, 'traslado', 'TRS', 'Serie fiscal de Traslados', true, true, 0, NOW()
  FROM core.empresas e
ON CONFLICT (empresa_id, tipo_documento, serie) DO UPDATE
   SET descripcion = EXCLUDED.descripcion,
       es_fiscal = true,
       activa = true,
       updated_at = NOW();

COMMIT;
