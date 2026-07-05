-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Fase 2
-- Solicitudes reales al Servicio Web de Descarga Masiva del SAT.
-- Solo llega hasta "solicitud creada"; verificación y descarga quedan para Fase 3.
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.cfdi_sat_solicitudes (
  id                    SERIAL PRIMARY KEY,
  empresa_id            INTEGER      NOT NULL REFERENCES core.empresas(id),
  usuario_id            INTEGER      NOT NULL REFERENCES core.usuarios(id),
  tipo_descarga         VARCHAR(10)  NOT NULL,
  fecha_inicio          DATE         NOT NULL,
  fecha_fin             DATE         NOT NULL,
  tipo_solicitud        VARCHAR(10)  NOT NULL,
  estatus_comprobante   VARCHAR(10)  NULL,
  sat_request_id        VARCHAR(80)  NULL,
  estatus               VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  mensaje_error         TEXT         NULL,
  creado_en             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  solicitado_en         TIMESTAMPTZ  NULL,
  CONSTRAINT ck_cfdi_sat_solicitudes_tipo_descarga CHECK (tipo_descarga IN ('emitidos', 'recibidos')),
  CONSTRAINT ck_cfdi_sat_solicitudes_tipo_solicitud CHECK (tipo_solicitud IN ('xml', 'metadata')),
  CONSTRAINT ck_cfdi_sat_solicitudes_estatus_comprobante CHECK (
    estatus_comprobante IS NULL OR estatus_comprobante IN ('activos', 'cancelados', 'todos')
  ),
  CONSTRAINT ck_cfdi_sat_solicitudes_estatus CHECK (
    estatus IN ('pendiente', 'solicitado', 'error', 'rechazado')
  ),
  CONSTRAINT ck_cfdi_sat_solicitudes_fechas CHECK (fecha_fin >= fecha_inicio)
);

COMMENT ON TABLE core.cfdi_sat_solicitudes IS
  'Solicitudes al Servicio Web de Descarga Masiva del SAT. Fase 2: solo llega hasta el paso de solicitud creada (sin verificación ni descarga de paquetes).';
COMMENT ON COLUMN core.cfdi_sat_solicitudes.sat_request_id IS
  'RequestId devuelto por el SAT cuando la solicitud es aceptada (query() exitoso).';
COMMENT ON COLUMN core.cfdi_sat_solicitudes.estatus IS
  'Estado interno del flujo: pendiente (creada, aún sin llamar al SAT), solicitado (SAT aceptó), error (fallo técnico/de comunicación), rechazado (SAT respondió pero rechazó la solicitud).';
COMMENT ON COLUMN core.cfdi_sat_solicitudes.mensaje_error IS
  'Mensaje de error legible cuando estatus es error o rechazado. Nunca debe contener la contraseña de la FIEL.';
COMMENT ON COLUMN core.cfdi_sat_solicitudes.solicitado_en IS
  'Fecha y hora en que el SAT aceptó la solicitud (query() exitoso).';

CREATE INDEX IF NOT EXISTS ix_cfdi_sat_solicitudes_empresa
  ON core.cfdi_sat_solicitudes (empresa_id, creado_en DESC);

-- Amplía la bitácora de Fase 1 para registrar la creación de solicitudes y sus errores.
ALTER TABLE core.cfdi_sat_bitacora DROP CONSTRAINT IF EXISTS ck_cfdi_sat_bitacora_accion;

ALTER TABLE core.cfdi_sat_bitacora ADD CONSTRAINT ck_cfdi_sat_bitacora_accion CHECK (
  accion IN (
    'credencial_subida',
    'credencial_eliminada',
    'autorizacion_aceptada',
    'solicitud_creada',
    'error'
  )
);
