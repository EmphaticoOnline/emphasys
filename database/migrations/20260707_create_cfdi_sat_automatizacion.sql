-- =============================================================================
-- Descarga masiva de CFDIs desde el SAT — Fase 9
-- Configuración de automatización por empresa (verificación/descarga asistidas).
-- IMPORTANTE: no existe una tabla de "ejecuciones programadas" porque no hay un
-- cron desatendido: ver docs/cfdi-sat-descarga.md, sección "Automatización",
-- para el diagnóstico completo de por qué no es posible sin guardar la
-- contraseña de la FIEL.
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.cfdi_sat_automatizacion (
  empresa_id           INTEGER      PRIMARY KEY REFERENCES core.empresas(id),
  auto_verificar       BOOLEAN      NOT NULL DEFAULT FALSE,
  auto_descargar       BOOLEAN      NOT NULL DEFAULT FALSE,
  frecuencia_minutos   INTEGER      NOT NULL DEFAULT 60,
  ultimo_run_en        TIMESTAMPTZ  NULL,
  actualizado_por      INTEGER      NULL REFERENCES core.usuarios(id),
  actualizado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_cfdi_sat_automatizacion_frecuencia CHECK (frecuencia_minutos BETWEEN 15 AND 1440)
);

COMMENT ON TABLE core.cfdi_sat_automatizacion IS
  'Configuración de automatización asistida del módulo CFDI SAT por empresa. No implica un cron desatendido: la contraseña de la FIEL nunca se guarda, así que la verificación/descarga "automática" se ejecuta bajo demanda cuando un administrador la dispara y captura la contraseña una sola vez para procesar todo lo elegible.';
COMMENT ON COLUMN core.cfdi_sat_automatizacion.auto_verificar IS
  'Si está activo, la ejecución asistida intenta verificar todas las solicitudes en estatus solicitado/en_proceso de la empresa.';
COMMENT ON COLUMN core.cfdi_sat_automatizacion.auto_descargar IS
  'Si está activo, la ejecución asistida intenta descargar los paquetes pendientes de las solicitudes que ya quedaron terminadas.';
COMMENT ON COLUMN core.cfdi_sat_automatizacion.frecuencia_minutos IS
  'Frecuencia sugerida (en minutos) con la que el administrador debería disparar la ejecución asistida; usada solo para mostrar un recordatorio visual, no dispara nada por sí sola.';
COMMENT ON COLUMN core.cfdi_sat_automatizacion.ultimo_run_en IS
  'Fecha y hora de la última ejecución asistida (manual, con contraseña capturada) que se haya completado.';

-- Amplía la bitácora para distinguir acciones automáticas/asistidas de las manuales.
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
    'error'
  )
);
