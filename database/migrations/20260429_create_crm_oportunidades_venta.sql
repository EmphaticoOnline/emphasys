-- =========================
-- CREAR ESQUEMA
-- =========================
CREATE SCHEMA IF NOT EXISTS crm;

-- =========================
-- CREAR TABLA
-- =========================
CREATE TABLE IF NOT EXISTS crm.oportunidades_venta (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    conversacion_id INTEGER NULL,
    contacto_id INTEGER NOT NULL,
    vendedor_id INTEGER NULL,
    estatus VARCHAR(20) NOT NULL DEFAULT 'abierta',
    etapa VARCHAR(50) NULL,
    cotizacion_principal_id INTEGER NULL,
    fecha_estimada_decision DATE NULL,
    fecha_reactivacion_estimada DATE NULL,
    dolor_validado BOOLEAN NULL,
    presupuesto_validado BOOLEAN NULL,
    contacto_es_decisor BOOLEAN NULL,
    comentarios_no_cierre TEXT NULL,
    observaciones TEXT NULL,
    monto_estimado NUMERIC(14,2) NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- COLUMNAS (IDEMPOTENTE)
-- =========================
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS conversacion_id INTEGER;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS contacto_id INTEGER;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS vendedor_id INTEGER;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS etapa VARCHAR(50);
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS cotizacion_principal_id INTEGER;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS fecha_estimada_decision DATE;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS fecha_reactivacion_estimada DATE;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS dolor_validado BOOLEAN;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS presupuesto_validado BOOLEAN;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS contacto_es_decisor BOOLEAN;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS comentarios_no_cierre TEXT;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE crm.oportunidades_venta ADD COLUMN IF NOT EXISTS monto_estimado NUMERIC(14,2);

-- ======================
-- COMMENTS (YA SEGURO)
-- ======================

COMMENT ON TABLE crm.oportunidades_venta IS
'Oportunidades comerciales del CRM. Una oportunidad representa un proceso de venta asociado a un contacto y puede originarse desde una conversación, pero no es la conversación.';

COMMENT ON COLUMN crm.oportunidades_venta.id IS
'Identificador interno de la oportunidad de venta.';

COMMENT ON COLUMN crm.oportunidades_venta.empresa_id IS
'Empresa a la que pertenece la oportunidad.';

COMMENT ON COLUMN crm.oportunidades_venta.conversacion_id IS
'Conversación de origen asociada a la oportunidad.';

COMMENT ON COLUMN crm.oportunidades_venta.contacto_id IS
'Contacto o cliente asociado a la oportunidad.';

COMMENT ON COLUMN crm.oportunidades_venta.vendedor_id IS
'Vendedor responsable de la oportunidad.';

COMMENT ON COLUMN crm.oportunidades_venta.estatus IS
'Estatus: abierta, pausada, ganada, perdida o cancelada.';

COMMENT ON COLUMN crm.oportunidades_venta.etapa IS
'Etapa comercial.';

COMMENT ON COLUMN crm.oportunidades_venta.cotizacion_principal_id IS
'Cotización principal de la oportunidad.';

COMMENT ON COLUMN crm.oportunidades_venta.fecha_estimada_decision IS
'Fecha tentativa de decisión del cliente.';

COMMENT ON COLUMN crm.oportunidades_venta.fecha_reactivacion_estimada IS
'Fecha para retomar una oportunidad pausada.';

COMMENT ON COLUMN crm.oportunidades_venta.dolor_validado IS
'Indica si la necesidad del cliente es real.';

COMMENT ON COLUMN crm.oportunidades_venta.presupuesto_validado IS
'Indica si el cliente tiene presupuesto.';

COMMENT ON COLUMN crm.oportunidades_venta.contacto_es_decisor IS
'Indica si el contacto decide.';

COMMENT ON COLUMN crm.oportunidades_venta.comentarios_no_cierre IS
'Explicación de por qué no se concretó.';

COMMENT ON COLUMN crm.oportunidades_venta.observaciones IS
'Notas operativas del vendedor.';

COMMENT ON COLUMN crm.oportunidades_venta.monto_estimado IS
'Monto estimado.';

COMMENT ON COLUMN crm.oportunidades_venta.created_at IS
'Fecha de creación.';

COMMENT ON COLUMN crm.oportunidades_venta.updated_at IS
'Fecha de actualización.';