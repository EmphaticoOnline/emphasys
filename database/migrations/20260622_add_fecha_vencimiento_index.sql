CREATE INDEX IF NOT EXISTS idx_documentos_empresa_tipo_vencimiento
ON public.documentos (
  empresa_id,
  tipo_documento,
  fecha_vencimiento
)
WHERE tipo_documento IN ('factura', 'factura_compra')
  AND fecha_vencimiento IS NOT NULL;
