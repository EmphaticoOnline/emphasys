-- Campos para soporte de Facturación Global SAT en documentos tipo 'factura'
-- tratamiento_impuestos = 'venta_publico_general': venta individual público general (no se timbra individualmente)
-- tratamiento_impuestos = 'factura_global': factura global que agrupa ventas público general (sí se timbra)

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS periodicidad_global varchar(2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meses_global       varchar(2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anio_global        smallint    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS factura_global_id  integer     DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fk_documentos_factura_global'
       AND conrelid = 'public.documentos'::regclass
  ) THEN
    ALTER TABLE public.documentos
      ADD CONSTRAINT fk_documentos_factura_global
        FOREIGN KEY (factura_global_id) REFERENCES public.documentos(id)
        ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_documentos_factura_global_id
  ON public.documentos(factura_global_id)
  WHERE factura_global_id IS NOT NULL;

-- Index para consulta eficiente de ventas público general pendientes
CREATE INDEX IF NOT EXISTS idx_documentos_publico_general_pendiente
  ON public.documentos(empresa_id, tratamiento_impuestos, es_publico_general, factura_global_id)
  WHERE tipo_documento = 'factura'
    AND tratamiento_impuestos = 'venta_publico_general'
    AND es_publico_general = true
    AND factura_global_id IS NULL;

COMMENT ON COLUMN public.documentos.periodicidad_global IS
  'Código SAT de periodicidad para factura global: 01=Diario, 02=Semanal, 03=Quincenal, 04=Mensual, 05=Bimestral';
COMMENT ON COLUMN public.documentos.meses_global IS
  'Código SAT de mes(es) para factura global: 01-12 mensual, 13-18 bimestral';
COMMENT ON COLUMN public.documentos.anio_global IS
  'Año de la factura global (4 dígitos)';
COMMENT ON COLUMN public.documentos.factura_global_id IS
  'Para ventas publico_general: ID de la factura global que las incluye. Evita doble agrupación.';
