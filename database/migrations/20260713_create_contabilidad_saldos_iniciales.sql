-- =========================================================
-- SCRIPT:
-- 20260713_create_contabilidad_saldos_iniciales.sql
--
-- Fase 5 de e-contabilidad: saldos iniciales/de apertura por cuenta y
-- ejercicio, para empresas que empiezan a usar Emphasys ya con saldos
-- contables previos (migradas de otro sistema o a mitad de año).
--
-- Se crea una tabla NUEVA y separada de
-- contabilidad.cuentas_saldos_mensuales a propósito:
--   - cuentas_saldos_mensuales representa acumulados de cargos/abonos
--     MENSUALES generados por pólizas aplicadas (periodo 1-12, con CHECK
--     cargos >= 0 y abonos >= 0). Un saldo inicial no es un cargo ni un
--     abono del mes, y forzarlo ahí implicaría inventar un periodo 0 o
--     ensuciar enero con un movimiento que nunca ocurrió.
--   - cuentas_saldos_iniciales representa el saldo de ARRANQUE del
--     ejercicio: un solo número firmado por cuenta y ejercicio, no un
--     movimiento. Es una tabla de captura/migración, no de operación.
--
-- Convención del saldo (firmado, NO cargo/abono separado):
--   positivo = saldo deudor
--   negativo = saldo acreedor
--   cero     = sin saldo inicial relevante
-- Ejemplos: Caja 100000.00 (deudor), Proveedores -80000.00 (acreedor).
-- Esta convención es independiente de la naturaleza de la cuenta: el
-- signo indica directamente el lado (deudor/acreedor) del saldo real,
-- igual que en una balanza de comprobación tradicional.
-- =========================================================

BEGIN;

CREATE TABLE contabilidad.cuentas_saldos_iniciales (
  id bigserial PRIMARY KEY,

  empresa_id bigint NOT NULL,
  ejercicio integer NOT NULL,
  cuenta_id bigint NOT NULL,

  saldo_inicial numeric(19,2) NOT NULL DEFAULT 0,

  origen varchar(50) NOT NULL DEFAULT 'manual',
  observaciones text,

  creado_por bigint,
  actualizado_por bigint,

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_cuentas_saldos_iniciales
    UNIQUE (empresa_id, ejercicio, cuenta_id),

  CONSTRAINT fk_cuentas_saldos_iniciales_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES core.empresas(id),

  CONSTRAINT fk_cuentas_saldos_iniciales_cuenta
    FOREIGN KEY (cuenta_id)
    REFERENCES contabilidad.cuentas(id),

  CONSTRAINT chk_cuentas_saldos_iniciales_ejercicio
    CHECK (ejercicio >= 2000),

  CONSTRAINT chk_cuentas_saldos_iniciales_origen
    CHECK (origen IN ('manual', 'importacion', 'migracion'))
);

COMMENT ON TABLE contabilidad.cuentas_saldos_iniciales IS 'Saldo contable de arranque (apertura) de una cuenta para un ejercicio, capturado o migrado desde fuera de Emphasys. No representa movimientos ni pólizas; no se toca desde la lógica de cargos/abonos mensuales.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.id IS 'Identificador interno del saldo inicial.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.empresa_id IS 'Empresa a la que pertenece el saldo inicial.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.ejercicio IS 'Ejercicio contable al que corresponde el saldo de arranque.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.cuenta_id IS 'Cuenta contable a la que pertenece el saldo inicial.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.saldo_inicial IS 'Saldo firmado de arranque del ejercicio: positivo = saldo deudor, negativo = saldo acreedor, independientemente de la naturaleza de la cuenta.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.origen IS 'Origen del dato: manual (capturado a mano), importacion o migracion (cargado desde el sistema anterior).';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.observaciones IS 'Notas libres sobre el origen o justificación del saldo inicial, por ejemplo referencia al sistema anterior.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.creado_por IS 'Usuario que capturó el saldo inicial por primera vez.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.actualizado_por IS 'Usuario que modificó por última vez el saldo inicial.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.creado_en IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN contabilidad.cuentas_saldos_iniciales.actualizado_en IS 'Fecha y hora de la última actualización del registro.';
COMMENT ON CONSTRAINT uq_cuentas_saldos_iniciales ON contabilidad.cuentas_saldos_iniciales IS 'Evita duplicar el saldo inicial de una misma cuenta en un mismo ejercicio para la misma empresa.';
COMMENT ON CONSTRAINT fk_cuentas_saldos_iniciales_empresa ON contabilidad.cuentas_saldos_iniciales IS 'Relaciona el saldo inicial con su empresa.';
COMMENT ON CONSTRAINT fk_cuentas_saldos_iniciales_cuenta ON contabilidad.cuentas_saldos_iniciales IS 'Relaciona el saldo inicial con la cuenta contable.';
COMMENT ON CONSTRAINT chk_cuentas_saldos_iniciales_ejercicio ON contabilidad.cuentas_saldos_iniciales IS 'Descarta ejercicios claramente inválidos (antes del año 2000).';
COMMENT ON CONSTRAINT chk_cuentas_saldos_iniciales_origen ON contabilidad.cuentas_saldos_iniciales IS 'Limita el origen del dato a los valores reconocidos por el sistema.';

CREATE INDEX idx_cuentas_saldos_iniciales_empresa_ejercicio
ON contabilidad.cuentas_saldos_iniciales (empresa_id, ejercicio);

COMMENT ON INDEX contabilidad.idx_cuentas_saldos_iniciales_empresa_ejercicio IS 'Índice para consultar todos los saldos iniciales de una empresa en un ejercicio (pantalla de captura y validador de e-contabilidad).';

COMMIT;
