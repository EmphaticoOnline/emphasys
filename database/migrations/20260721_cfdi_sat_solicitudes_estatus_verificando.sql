-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Verificación asíncrona
-- La verificación de una solicitud ante el SAT ahora se dispara en segundo
-- plano (no bloquea la respuesta HTTP): se necesita un estatus transitorio
-- para reflejar "ya se disparó la llamada al SAT, todavía no hay resultado".
-- =============================================================================

ALTER TABLE core.cfdi_sat_solicitudes DROP CONSTRAINT IF EXISTS ck_cfdi_sat_solicitudes_estatus;

ALTER TABLE core.cfdi_sat_solicitudes ADD CONSTRAINT ck_cfdi_sat_solicitudes_estatus CHECK (
  estatus IN (
    'pendiente', 'solicitado', 'verificando', 'en_proceso', 'terminado',
    'sin_resultados', 'error', 'expirado', 'rechazado'
  )
);
