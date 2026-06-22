ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS serie_externa  varchar(10),
  ADD COLUMN IF NOT EXISTS numero_externo int4;

-- Búsquedas por referencia del proveedor (serie + número juntos)
CREATE INDEX IF NOT EXISTS idx_documentos_ref_externa
  ON public.documentos (empresa_id, serie_externa, numero_externo)
  WHERE tipo_documento IN ('factura_compra', 'nota_credito_compra');

-- Búsquedas solo por número externo (proveedores sin serie)
CREATE INDEX IF NOT EXISTS idx_documentos_numero_externo
  ON public.documentos (empresa_id, numero_externo)
  WHERE tipo_documento IN ('factura_compra', 'nota_credito_compra')
    AND numero_externo IS NOT NULL;
