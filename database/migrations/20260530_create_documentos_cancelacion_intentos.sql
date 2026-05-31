-- Tabla de seguimiento de intentos de cancelación (patrón saga corta)
-- Permite reintentar la cancelación interna cuando Facturama ya fue invocado con éxito
-- pero la transacción interna falló.
--
-- Estados posibles:
--   iniciado                   → intento creado, antes de llamar a Facturama
--   error_externo              → Facturama falló; no hubo cambios internos
--   externo_ok                 → Facturama OK (estado transitorio; debe pasar a completado o externo_ok_interno_pendiente)
--   completado                 → Facturama OK + cancelación interna OK
--   externo_ok_interno_pendiente → Facturama OK pero transacción interna falló (bloqueante para edición)
--   error_interno              → no había CFDI; sólo la transacción interna falló (no bloqueante)

CREATE TABLE IF NOT EXISTS public.documentos_cancelacion_intentos (
    id                     BIGSERIAL                    PRIMARY KEY,
    empresa_id             INTEGER                      NOT NULL REFERENCES core.empresas(id),
    documento_id           INTEGER                      NOT NULL REFERENCES public.documentos(id),
    usuario_id             INTEGER                      NOT NULL REFERENCES core.usuarios(id),
    estado                 VARCHAR(40)                  NOT NULL
        CHECK (estado IN (
            'iniciado',
            'error_externo',
            'externo_ok',
            'completado',
            'externo_ok_interno_pendiente',
            'error_interno'
        )),
    motivo_cancelacion     TEXT                         NULL,
    motivo_sat             VARCHAR(2)                   NULL,
    uuid_sustitucion       VARCHAR(36)                  NULL,
    cfdi_uuid              VARCHAR(36)                  NULL,
    facturama_respuesta    JSONB                        NULL,
    error_externo_mensaje  TEXT                         NULL,
    error_interno_mensaje  TEXT                         NULL,
    created_at             TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ                  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dci_documento_empresa_estado
    ON public.documentos_cancelacion_intentos (documento_id, empresa_id, estado);

COMMENT ON TABLE  public.documentos_cancelacion_intentos IS 'Seguimiento de intentos de cancelación de documentos (saga corta)';
COMMENT ON COLUMN public.documentos_cancelacion_intentos.estado IS 'iniciado | error_externo | externo_ok | completado | externo_ok_interno_pendiente | error_interno';
COMMENT ON COLUMN public.documentos_cancelacion_intentos.cfdi_uuid IS 'UUID del CFDI que fue cancelado en Facturama (NULL si el documento no tenía CFDI timbrado)';
COMMENT ON COLUMN public.documentos_cancelacion_intentos.facturama_respuesta IS 'Respuesta JSON devuelta por Facturama al cancelar el CFDI';
COMMENT ON COLUMN public.documentos_cancelacion_intentos.error_externo_mensaje IS 'Mensaje de error cuando Facturama rechazó la cancelación';
COMMENT ON COLUMN public.documentos_cancelacion_intentos.error_interno_mensaje IS 'Mensaje de error cuando la transacción interna falló';
