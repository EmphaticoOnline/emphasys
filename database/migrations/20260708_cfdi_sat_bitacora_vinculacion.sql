-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Fase 11
-- Vinculación de un CFDI SAT descargado con una factura de compra existente
-- (capturada manualmente), sin crear un documento nuevo.
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
    'verificacion_automatica',
    'descarga_automatica',
    'automatizacion_error',
    'vinculacion_documento',
    'error'
  )
);
