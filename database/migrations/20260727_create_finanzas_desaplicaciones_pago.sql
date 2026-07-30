BEGIN;

CREATE TABLE IF NOT EXISTS public.finanzas_desaplicaciones_pago (
  id bigserial PRIMARY KEY,
  empresa_id integer NOT NULL,
  aplicacion_id integer NOT NULL,
  documento_origen_id integer NOT NULL,
  documento_destino_id integer NOT NULL,
  monto numeric(15,2) NOT NULL,
  monto_moneda_documento numeric(15,2) NOT NULL,
  fecha_aplicacion timestamptz,
  num_parcialidad integer,
  imp_saldo_ant numeric(20,6),
  imp_saldo_insoluto numeric(20,6),
  usuario_id integer NOT NULL,
  motivo varchar(500),
  fecha_desaplicacion timestamptz NOT NULL DEFAULT now(),
  pago_folio varchar(120),
  factura_folio varchar(120),
  CONSTRAINT fk_finanzas_desaplicaciones_empresa
    FOREIGN KEY (empresa_id) REFERENCES core.empresas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_finanzas_desaplicaciones_usuario
    FOREIGN KEY (usuario_id) REFERENCES core.usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT chk_finanzas_desaplicaciones_motivo
    CHECK (motivo IS NULL OR char_length(btrim(motivo)) BETWEEN 1 AND 500),
  CONSTRAINT chk_finanzas_desaplicaciones_montos
    CHECK (monto > 0 AND monto_moneda_documento > 0),
  CONSTRAINT uq_finanzas_desaplicaciones_aplicacion
    UNIQUE (empresa_id, aplicacion_id)
);

CREATE INDEX IF NOT EXISTS idx_finanzas_desaplicaciones_pago_origen
  ON public.finanzas_desaplicaciones_pago (empresa_id, documento_origen_id, fecha_desaplicacion DESC);

CREATE INDEX IF NOT EXISTS idx_finanzas_desaplicaciones_pago_destino
  ON public.finanzas_desaplicaciones_pago (empresa_id, documento_destino_id, fecha_desaplicacion DESC);

CREATE OR REPLACE FUNCTION public.bloquear_mutacion_finanzas_desaplicaciones_pago()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de desaplicaciones de pago es inmutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_finanzas_desaplicaciones_pago_inmutable
  ON public.finanzas_desaplicaciones_pago;
CREATE TRIGGER trg_finanzas_desaplicaciones_pago_inmutable
BEFORE UPDATE OR DELETE ON public.finanzas_desaplicaciones_pago
FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacion_finanzas_desaplicaciones_pago();

COMMENT ON TABLE public.finanzas_desaplicaciones_pago IS
  'Bitácora inmutable de aplicaciones de pagos de cliente eliminadas físicamente.';
COMMENT ON COLUMN public.finanzas_desaplicaciones_pago.aplicacion_id IS
  'ID histórico de aplicaciones_saldo. No tiene FK porque la aplicación se elimina en la misma transacción.';
COMMENT ON COLUMN public.finanzas_desaplicaciones_pago.motivo IS
  'Motivo funcional opcional capturado al desaplicar el pago.';

COMMIT;
