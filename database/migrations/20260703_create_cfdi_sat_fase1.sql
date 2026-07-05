-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Fase 1
-- Credenciales FIEL por empresa, autorización expresa y bitácora básica.
-- No incluye conexión real al SAT (fases posteriores).
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.cfdi_sat_credenciales (
  id                     SERIAL PRIMARY KEY,
  empresa_id             INTEGER      NOT NULL REFERENCES core.empresas(id),
  rfc_certificado        VARCHAR(13)  NOT NULL,
  cer_content_encrypted  TEXT         NOT NULL,
  key_content_encrypted  TEXT         NOT NULL,
  vigencia_desde         TIMESTAMPTZ  NOT NULL,
  vigencia_hasta         TIMESTAMPTZ  NOT NULL,
  cargado_por            INTEGER      NOT NULL REFERENCES core.usuarios(id),
  cargado_en             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ux_cfdi_sat_credenciales_empresa UNIQUE (empresa_id)
);

COMMENT ON TABLE core.cfdi_sat_credenciales IS
  'Credencial e.firma (FIEL) por empresa para el Servicio de Descarga Masiva del SAT. No almacena la contraseña de la FIEL.';
COMMENT ON COLUMN core.cfdi_sat_credenciales.rfc_certificado IS
  'RFC extraído del certificado .cer, validado contra el RFC de la empresa al momento de subir.';
COMMENT ON COLUMN core.cfdi_sat_credenciales.cer_content_encrypted IS
  'Contenido binario del .cer (base64) cifrado con AES-256-GCM (utils/secret-crypto.ts). Nunca se sirve por rutas públicas.';
COMMENT ON COLUMN core.cfdi_sat_credenciales.key_content_encrypted IS
  'Contenido binario del .key (base64) cifrado con AES-256-GCM (utils/secret-crypto.ts). Nunca se sirve por rutas públicas.';
COMMENT ON COLUMN core.cfdi_sat_credenciales.vigencia_desde IS
  'notBefore del certificado X.509.';
COMMENT ON COLUMN core.cfdi_sat_credenciales.vigencia_hasta IS
  'notAfter del certificado X.509. Se usa para marcar la credencial como vencida.';

CREATE TABLE IF NOT EXISTS core.cfdi_sat_autorizaciones (
  id             SERIAL PRIMARY KEY,
  empresa_id     INTEGER      NOT NULL REFERENCES core.empresas(id),
  usuario_id     INTEGER      NOT NULL REFERENCES core.usuarios(id),
  version_texto  VARCHAR(20)  NOT NULL,
  aceptado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.cfdi_sat_autorizaciones IS
  'Registro append-only de aceptación expresa del uso de la e.firma para descarga de CFDIs del SAT. La versión vigente se define en el backend (cfdi-sat-autorizacion-texto.ts).';

CREATE INDEX IF NOT EXISTS ix_cfdi_sat_autorizaciones_empresa_version
  ON core.cfdi_sat_autorizaciones (empresa_id, version_texto, aceptado_en DESC);

CREATE TABLE IF NOT EXISTS core.cfdi_sat_bitacora (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER      NOT NULL REFERENCES core.empresas(id),
  usuario_id  INTEGER      NOT NULL REFERENCES core.usuarios(id),
  accion      VARCHAR(40)  NOT NULL,
  resultado   VARCHAR(10)  NOT NULL DEFAULT 'ok',
  detalle     TEXT         NULL,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_cfdi_sat_bitacora_accion CHECK (
    accion IN ('credencial_subida', 'credencial_eliminada', 'autorizacion_aceptada')
  ),
  CONSTRAINT ck_cfdi_sat_bitacora_resultado CHECK (resultado IN ('ok', 'error'))
);

COMMENT ON TABLE core.cfdi_sat_bitacora IS
  'Bitácora de auditoría de la funcionalidad de descarga masiva de CFDIs del SAT. No debe registrar contraseñas ni contenido de certificados.';

CREATE INDEX IF NOT EXISTS ix_cfdi_sat_bitacora_empresa
  ON core.cfdi_sat_bitacora (empresa_id, creado_en DESC);
