-- ============================================================================
-- MIGRACION:
-- 20260527_add_naturaleza_saldo_to_tipos_documento.sql
-- ============================================================================

BEGIN;

ALTER TABLE core.tipos_documento
ADD COLUMN IF NOT EXISTS naturaleza_saldo varchar(20);

COMMENT ON COLUMN core.tipos_documento.naturaleza_saldo IS
'Define comportamiento financiero del documento: cargo, abono o none.';

-- ============================================================================
-- Valores existentes
-- ============================================================================

UPDATE core.tipos_documento
SET naturaleza_saldo = 'cargo'
WHERE codigo IN (
    'factura',
    'factura_compra'
);

UPDATE core.tipos_documento
SET naturaleza_saldo = 'abono'
WHERE codigo IN (
    'nota_credito',
    'nota_credito_compra'
);

UPDATE core.tipos_documento
SET naturaleza_saldo = 'none'
WHERE naturaleza_saldo IS NULL;

-- ============================================================================
-- Constraint
-- ============================================================================

ALTER TABLE core.tipos_documento
DROP CONSTRAINT IF EXISTS chk_tipos_documento_naturaleza_saldo;

ALTER TABLE core.tipos_documento
ADD CONSTRAINT chk_tipos_documento_naturaleza_saldo
CHECK (
    naturaleza_saldo IN ('cargo', 'abono', 'none')
);

COMMIT;