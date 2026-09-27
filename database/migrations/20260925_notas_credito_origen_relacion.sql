BEGIN;

ALTER TABLE public.documentos_relaciones
  DROP CONSTRAINT IF EXISTS documentos_relaciones_tipo_relacion_check;

ALTER TABLE public.documentos_relaciones
  ADD CONSTRAINT documentos_relaciones_tipo_relacion_check
  CHECK (tipo_relacion IN (
    'derivacion_operativa', 'regeneracion', 'correccion',
    'sustitucion_fiscal', 'duplicacion', 'referencia_interna',
    'origen_nota_credito'
  ));

INSERT INTO core.empresas_tipos_documento_transiciones (
  empresa_id, tipo_documento_origen_id, tipo_documento_destino_id,
  activo, orden, usuario_creacion_id
)
SELECT 1, origen.id, destino.id, true, COALESCE(existing.orden, 0), NULL
FROM core.tipos_documento origen
JOIN core.tipos_documento destino ON destino.codigo = 'nota_credito'
LEFT JOIN core.empresas_tipos_documento_transiciones existing
  ON existing.empresa_id = 1
 AND existing.tipo_documento_origen_id = origen.id
 AND existing.tipo_documento_destino_id = destino.id
WHERE origen.codigo = 'factura'
ON CONFLICT (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id)
DO UPDATE SET activo = true;

COMMIT;
