-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Fase 3
-- Verificación de solicitudes y descarga real de paquetes/comprobantes.
-- No incluye importación a compras (queda para una fase posterior).
-- =============================================================================

-- Amplía los estatus posibles de una solicitud (Fase 2 solo tenía pendiente/solicitado/error/rechazado).
ALTER TABLE core.cfdi_sat_solicitudes DROP CONSTRAINT IF EXISTS ck_cfdi_sat_solicitudes_estatus;

ALTER TABLE core.cfdi_sat_solicitudes ADD CONSTRAINT ck_cfdi_sat_solicitudes_estatus CHECK (
  estatus IN (
    'pendiente', 'solicitado', 'en_proceso', 'terminado',
    'sin_resultados', 'error', 'expirado', 'rechazado'
  )
);

ALTER TABLE core.cfdi_sat_solicitudes
  ADD COLUMN IF NOT EXISTS cfdis_encontrados INTEGER      NULL,
  ADD COLUMN IF NOT EXISTS verificado_en      TIMESTAMPTZ  NULL;

COMMENT ON COLUMN core.cfdi_sat_solicitudes.cfdis_encontrados IS
  'Número de CFDIs reportado por el SAT en la última verificación (VerifyResult.getNumberCfdis()).';
COMMENT ON COLUMN core.cfdi_sat_solicitudes.verificado_en IS
  'Fecha y hora de la última llamada exitosa a verify() contra el SAT.';

-- Amplía la bitácora para registrar verificación y descarga de paquetes.
ALTER TABLE core.cfdi_sat_bitacora DROP CONSTRAINT IF EXISTS ck_cfdi_sat_bitacora_accion;

ALTER TABLE core.cfdi_sat_bitacora ADD CONSTRAINT ck_cfdi_sat_bitacora_accion CHECK (
  accion IN (
    'credencial_subida',
    'credencial_eliminada',
    'autorizacion_aceptada',
    'solicitud_creada',
    'verificacion',
    'descarga_paquete',
    'error'
  )
);

CREATE TABLE IF NOT EXISTS core.cfdi_sat_paquetes (
  id              SERIAL PRIMARY KEY,
  solicitud_id    INTEGER      NOT NULL REFERENCES core.cfdi_sat_solicitudes(id),
  sat_package_id  VARCHAR(80)  NOT NULL,
  estatus         VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  zip_path        VARCHAR(500) NULL,
  descargado_en   TIMESTAMPTZ  NULL,
  mensaje_error   TEXT         NULL,
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_cfdi_sat_paquetes_estatus CHECK (estatus IN ('pendiente', 'descargado', 'error')),
  CONSTRAINT ux_cfdi_sat_paquetes_solicitud_package UNIQUE (solicitud_id, sat_package_id)
);

COMMENT ON TABLE core.cfdi_sat_paquetes IS
  'Paquetes (ZIP) devueltos por la verificación de una solicitud al SAT. Uno o más por solicitud.';
COMMENT ON COLUMN core.cfdi_sat_paquetes.zip_path IS
  'Ruta relativa dentro de CFDI_SAT_STORAGE_DIR (storage privado, fuera de uploads/) donde se guardó el ZIP crudo descargado del SAT.';

CREATE INDEX IF NOT EXISTS ix_cfdi_sat_paquetes_solicitud
  ON core.cfdi_sat_paquetes (solicitud_id);

CREATE TABLE IF NOT EXISTS core.cfdi_sat_comprobantes (
  id                  SERIAL PRIMARY KEY,
  empresa_id          INTEGER       NOT NULL REFERENCES core.empresas(id),
  solicitud_id        INTEGER       NOT NULL REFERENCES core.cfdi_sat_solicitudes(id),
  paquete_id          INTEGER       NOT NULL REFERENCES core.cfdi_sat_paquetes(id),
  uuid                VARCHAR(36)   NOT NULL,
  rfc_emisor          VARCHAR(13)   NOT NULL,
  rfc_receptor        VARCHAR(13)   NOT NULL,
  nombre_emisor       VARCHAR(300)  NULL,
  nombre_receptor     VARCHAR(300)  NULL,
  fecha_emision       TIMESTAMP     NULL,
  tipo_comprobante    VARCHAR(1)    NULL,
  total               NUMERIC(15,2) NULL,
  moneda              VARCHAR(3)    NULL,
  estatus_sat         VARCHAR(10)   NULL,
  tipo_descarga       VARCHAR(10)   NOT NULL,
  xml_path            VARCHAR(500)  NULL,
  importado_compras   BOOLEAN       NOT NULL DEFAULT FALSE,
  documento_id        INTEGER       NULL REFERENCES public.documentos(id),
  creado_en           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT ck_cfdi_sat_comprobantes_tipo_comprobante CHECK (
    tipo_comprobante IS NULL OR tipo_comprobante IN ('I', 'E', 'T', 'N', 'P')
  ),
  CONSTRAINT ck_cfdi_sat_comprobantes_estatus_sat CHECK (
    estatus_sat IS NULL OR estatus_sat IN ('vigente', 'cancelado')
  ),
  CONSTRAINT ck_cfdi_sat_comprobantes_tipo_descarga CHECK (tipo_descarga IN ('emitidos', 'recibidos')),
  CONSTRAINT ux_cfdi_sat_comprobantes_empresa_uuid UNIQUE (empresa_id, uuid)
);

COMMENT ON TABLE core.cfdi_sat_comprobantes IS
  'CFDIs descargados del SAT (XML o solo metadata, según el tipo de solicitud). Fase 3: solo registro, sin importación a compras.';
COMMENT ON COLUMN core.cfdi_sat_comprobantes.xml_path IS
  'Ruta relativa dentro de CFDI_SAT_STORAGE_DIR (storage privado). NULL cuando la solicitud fue de tipo metadata (no hay XML disponible).';
COMMENT ON COLUMN core.cfdi_sat_comprobantes.estatus_sat IS
  'Vigente/cancelado según el SAT. Solo se conoce de forma confiable en solicitudes de tipo metadata; en tipo xml puede quedar NULL.';
COMMENT ON COLUMN core.cfdi_sat_comprobantes.importado_compras IS
  'Placeholder para una fase futura que importe los comprobantes recibidos al módulo de compras. No se usa todavía.';

CREATE INDEX IF NOT EXISTS ix_cfdi_sat_comprobantes_empresa
  ON core.cfdi_sat_comprobantes (empresa_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_cfdi_sat_comprobantes_solicitud
  ON core.cfdi_sat_comprobantes (solicitud_id);
