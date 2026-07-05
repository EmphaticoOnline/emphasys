-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Fase 5
-- Importación de comprobantes recibidos al módulo de Compras (factura_compra).
-- No requiere columnas nuevas: core.cfdi_sat_comprobantes.documento_id e
-- importado_compras ya existen desde la Fase 3 exactamente para este propósito.
-- =============================================================================

ALTER TABLE core.cfdi_sat_bitacora DROP CONSTRAINT IF EXISTS ck_cfdi_sat_bitacora_accion;

ALTER TABLE core.cfdi_sat_bitacora ADD CONSTRAINT ck_cfdi_sat_bitacora_accion CHECK (
  accion IN (
    'credencial_subida',
    'credencial_eliminada',
    'autorizacion_aceptada',
    'solicitud_creada',
    'verificacion',
    'descarga_paquete',
    'importado_compras',
    'error'
  )
);
