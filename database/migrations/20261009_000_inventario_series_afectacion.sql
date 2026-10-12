-- Pre-requisito de esquema para el motor de series y afectación.
-- Preparada para aplicación manual; no ejecutar automáticamente.

ALTER TABLE inventario.movimientos
  ADD COLUMN IF NOT EXISTS serie varchar(20),
  ADD COLUMN IF NOT EXISTS numero bigint,
  ADD COLUMN IF NOT EXISTS estatus_afectacion smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS afectado_at timestamptz,
  ADD COLUMN IF NOT EXISTS afectado_por integer,
  ADD COLUMN IF NOT EXISTS desafectado_at timestamptz,
  ADD COLUMN IF NOT EXISTS desafectado_por integer,
  ADD COLUMN IF NOT EXISTS motivo_desafectacion text,
  ADD COLUMN IF NOT EXISTS movimiento_origen_id bigint;

ALTER TABLE inventario.movimientos
  DROP CONSTRAINT IF EXISTS chk_inv_mov_estatus_afectacion;
ALTER TABLE inventario.movimientos
  ADD CONSTRAINT chk_inv_mov_estatus_afectacion CHECK (estatus_afectacion IN (0, 1));

CREATE UNIQUE INDEX IF NOT EXISTS ux_inv_mov_folio
  ON inventario.movimientos (empresa_id, serie, numero)
 WHERE serie IS NOT NULL AND numero IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inv_mov_reversion_origen
  ON inventario.movimientos (empresa_id, movimiento_origen_id)
 WHERE movimiento_origen_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_inv_mov_empresa_estatus_fecha
  ON inventario.movimientos (empresa_id, estatus_afectacion, fecha, id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inv_mov_origen') THEN
    ALTER TABLE inventario.movimientos ADD CONSTRAINT fk_inv_mov_origen
      FOREIGN KEY (movimiento_origen_id) REFERENCES inventario.movimientos(id) ON DELETE RESTRICT;
  END IF;
END $$;

INSERT INTO public.series_documento
  (empresa_id, tipo_documento, serie, descripcion, es_fiscal, activa, ultimo_numero)
SELECT e.id, 'movimiento_inventario', 'INV',
       'Serie predeterminada de movimientos de inventario', false, true, 0
  FROM core.empresas e
ON CONFLICT (empresa_id, tipo_documento, serie) DO NOTHING;
