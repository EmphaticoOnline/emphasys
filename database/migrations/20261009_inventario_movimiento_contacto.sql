-- Conserva el contacto asociado al momento de registrar un movimiento.
-- Preparada para aplicación manual; no ejecutar automáticamente.

ALTER TABLE inventario.movimientos
  ADD COLUMN IF NOT EXISTS contacto_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'fk_movimientos_contacto'
       AND conrelid = 'inventario.movimientos'::regclass
  ) THEN
    ALTER TABLE inventario.movimientos
      ADD CONSTRAINT fk_movimientos_contacto
      FOREIGN KEY (contacto_id) REFERENCES public.contactos(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_inventario_movimientos_contacto_id
  ON inventario.movimientos (empresa_id, contacto_id)
  WHERE contacto_id IS NOT NULL;

CREATE OR REPLACE FUNCTION inventario.validar_movimiento_contacto_empresa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contacto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.contactos c
     WHERE c.id = NEW.contacto_id
       AND c.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'CONTACTO_EMPRESA_INVALIDO' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_movimiento_contacto_empresa ON inventario.movimientos;
CREATE TRIGGER trg_validar_movimiento_contacto_empresa
BEFORE INSERT OR UPDATE OF empresa_id, contacto_id ON inventario.movimientos
FOR EACH ROW EXECUTE FUNCTION inventario.validar_movimiento_contacto_empresa();

CREATE OR REPLACE FUNCTION inventario.aplicar_movimiento(
  p_empresa_id integer, p_tipo_movimiento varchar(30), p_fecha date,
  p_usuario_id integer, p_documento_id integer, p_observaciones text,
  p_partidas jsonb, p_contacto_id integer
)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  mov bigint;
  p jsonb;
  prod integer;
  source integer;
  dest integer;
  qty numeric;
  sentido text;
  affected integer[] := '{}';
BEGIN
  IF jsonb_array_length(p_partidas) = 0 THEN
    RAISE EXCEPTION 'SIN_PARTIDAS' USING ERRCODE='P0001';
  END IF;

  IF p_contacto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contactos c
     WHERE c.id = p_contacto_id AND c.empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'CONTACTO_EMPRESA_INVALIDO' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('inventario:' || p_empresa_id::text, 0));
  INSERT INTO inventario.movimientos(empresa_id, tipo_movimiento, fecha, usuario_id, documento_id, observaciones, contacto_id)
  VALUES (p_empresa_id, p_tipo_movimiento, p_fecha, p_usuario_id, p_documento_id, p_observaciones, p_contacto_id)
  RETURNING id INTO mov;

  FOR p IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    prod := (p->>'producto_id')::integer;
    source := (p->>'almacen_id')::integer;
    dest := nullif(p->>'almacen_destino_id', '')::integer;
    qty := (p->>'cantidad')::numeric;
    sentido := coalesce(p->>'sentido', CASE WHEN (p->>'signo') = '1' THEN 'entrada' ELSE 'salida' END);
    IF qty IS NULL OR qty <= 0 THEN RAISE EXCEPTION 'CANTIDAD_INVALIDA' USING ERRCODE='P0001'; END IF;
    IF sentido = 'transferencia' AND (dest IS NULL OR dest = source) THEN RAISE EXCEPTION 'ALMACEN_DESTINO_INVALIDO' USING ERRCODE='P0001'; END IF;
    IF sentido = 'entrada' THEN
      INSERT INTO inventario.movimientos_partidas(empresa_id,movimiento_id,producto_id,almacen_id,fecha_movimiento,cantidad,signo,tipo_partida,costo_unitario,existencia_resultante)
      VALUES(p_empresa_id,mov,prod,source,p_fecha,qty,1,'normal',nullif(p->>'costo_unitario','')::numeric,0);
    ELSIF sentido = 'salida' THEN
      INSERT INTO inventario.movimientos_partidas(empresa_id,movimiento_id,producto_id,almacen_id,fecha_movimiento,cantidad,signo,tipo_partida,existencia_resultante)
      VALUES(p_empresa_id,mov,prod,source,p_fecha,qty,-1,'normal',0);
    ELSE
      INSERT INTO inventario.movimientos_partidas(empresa_id,movimiento_id,producto_id,almacen_id,almacen_destino_id,fecha_movimiento,cantidad,signo,tipo_partida,existencia_resultante)
      VALUES(p_empresa_id,mov,prod,source,dest,p_fecha,qty,-1,'salida_transferencia',0);
    END IF;
    IF NOT prod = ANY(affected) THEN affected := array_append(affected, prod); END IF;
  END LOOP;

  FOREACH prod IN ARRAY affected LOOP
    PERFORM inventario.reconstruir_producto(p_empresa_id, prod);
  END LOOP;
  RETURN mov;
END $$;

COMMENT ON COLUMN inventario.movimientos.contacto_id IS
  'Contacto asociado al movimiento al momento de su registro; NULL para movimientos sin contacto.';
