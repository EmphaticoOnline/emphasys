-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Fase 6
-- Trazabilidad de UUID en la factura de compra importada + restricción única
-- a nivel de base de datos (defensa adicional contra duplicados).
--
-- Decisión de diseño: NO se usa public.documentos_cfdi para esto. Esa tabla
-- está acoplada a la cancelación vía Facturama (documentos-cancel.service.ts
-- cancela automáticamente en la cuenta Facturama de Emphasys cualquier UUID
-- presente ahí) y a un "estatus Timbrado" forzado en el PDF. Un CFDI de un
-- proveedor (timbrado por su propio PAC, nunca por Emphasys) no debe entrar en
-- ese camino. La trazabilidad vive en una columna propia y ligera, separada de
-- core.cfdi_sat_comprobantes.documento_id (que ya existe desde la Fase 3).
-- =============================================================================

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS uuid_cfdi_origen VARCHAR(36) NULL;

COMMENT ON COLUMN public.documentos.uuid_cfdi_origen IS
  'UUID del CFDI de origen cuando el documento fue importado desde la Descarga Masiva del SAT (ver core.cfdi_sat_comprobantes). NULL para documentos capturados/timbrados normalmente. No confundir con public.documentos_cfdi, reservada para CFDIs que Emphasys mismo timbra.';

-- Único parcial: evita dos documentos de la misma empresa con el mismo UUID de
-- origen, incluso si por alguna condición de carrera se saltara la validación
-- de aplicación (core.cfdi_sat_comprobantes.importado_compras + FOR UPDATE).
CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_empresa_uuid_cfdi_origen
  ON public.documentos (empresa_id, uuid_cfdi_origen)
  WHERE uuid_cfdi_origen IS NOT NULL;
