-- database/migrations/20261030_01_inventario_movimientos_referencia.sql
-- Agrega la referencia del movimiento de inventario (texto corto que identifica su origen).
-- En Clarion cada transacción de inventario trae una Referencia de hasta 50 caracteres
-- ("De Módulo de Clientes Emphasys", "AJUSTE POR INVENTARIO FISICO"...).

ALTER TABLE inventario.movimientos ADD COLUMN IF NOT EXISTS referencia varchar(100);

COMMENT ON COLUMN inventario.movimientos.referencia IS 'Referencia corta que identifica el origen o motivo del movimiento (por ejemplo, la referencia de la transacción en Clarion).';
