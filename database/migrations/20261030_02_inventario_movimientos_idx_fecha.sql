-- database/migrations/20261030_02_inventario_movimientos_idx_fecha.sql
-- Índice para el listado de movimientos de inventario por periodo, paginado por (fecha, id) descendente.
-- El índice ix_inv_mov_empresa_estatus_fecha tiene estatus_afectacion en medio y no sirve para este orden.

CREATE INDEX IF NOT EXISTS ix_inv_mov_empresa_fecha_id
    ON inventario.movimientos (empresa_id, fecha DESC, id DESC);
