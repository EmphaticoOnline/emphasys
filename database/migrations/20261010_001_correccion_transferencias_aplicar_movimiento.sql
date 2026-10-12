-- Corrección idempotente de transferencias de inventario.
-- Aplicar después de 20261010_inventario_recalculo_admin.sql.
-- Reemplaza únicamente la sobrecarga de 8 parámetros usada por el backend.
-- No modifica movimientos existentes.

CREATE OR REPLACE FUNCTION inventario.aplicar_movimiento(
  p_empresa_id integer,
  p_tipo_movimiento varchar(30),
  p_fecha date,
  p_usuario_id integer,
  p_documento_id integer,
  p_observaciones text,
  p_partidas jsonb,
  p_contacto_id integer
) RETURNS bigint
LANGUAGE plpgsql
AS $$
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
  IF jsonb_typeof(p_partidas) <> 'array' OR jsonb_array_length(p_partidas) = 0 THEN
    RAISE EXCEPTION 'SIN_PARTIDAS' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('inventario:' || p_empresa_id::text, 0));

  INSERT INTO inventario.movimientos
    (empresa_id, tipo_movimiento, fecha, usuario_id, documento_id, observaciones, contacto_id)
  VALUES
    (p_empresa_id, p_tipo_movimiento, p_fecha, p_usuario_id, p_documento_id, p_observaciones, p_contacto_id)
  RETURNING id INTO mov;

  FOR p IN SELECT value FROM jsonb_array_elements(p_partidas) LOOP
    prod := (p->>'producto_id')::integer;
    source := (p->>'almacen_id')::integer;
    dest := nullif(p->>'almacen_destino_id', '')::integer;
    qty := (p->>'cantidad')::numeric;
    sentido := lower(coalesce(p->>'sentido', CASE WHEN (p->>'signo') = '1' THEN 'entrada' ELSE 'salida' END));

    IF prod IS NULL OR source IS NULL OR qty IS NULL OR qty <= 0 THEN
      RAISE EXCEPTION 'PARTIDA_INVALIDA' USING ERRCODE = 'P0001';
    END IF;

    IF sentido = 'transferencia' THEN
      IF dest IS NULL OR dest = source THEN
        RAISE EXCEPTION 'ALMACEN_DESTINO_INVALIDO' USING ERRCODE = 'P0001';
      END IF;

      -- Una transferencia siempre se representa por las dos partidas.
      INSERT INTO inventario.movimientos_partidas
        (empresa_id, movimiento_id, producto_id, almacen_id, almacen_destino_id,
         fecha_movimiento, cantidad, signo, tipo_partida, existencia_resultante)
      VALUES
        (p_empresa_id, mov, prod, source, dest, p_fecha, qty, -1,
         'salida_transferencia', 0);

      INSERT INTO inventario.movimientos_partidas
        (empresa_id, movimiento_id, producto_id, almacen_id, almacen_destino_id,
         fecha_movimiento, cantidad, signo, tipo_partida, existencia_resultante)
      VALUES
        (p_empresa_id, mov, prod, dest, source, p_fecha, qty, 1,
         'entrada_transferencia', 0);
    ELSIF sentido = 'entrada' THEN
      INSERT INTO inventario.movimientos_partidas
        (empresa_id, movimiento_id, producto_id, almacen_id, fecha_movimiento,
         cantidad, signo, tipo_partida, costo_unitario, existencia_resultante)
      VALUES
        (p_empresa_id, mov, prod, source, p_fecha, qty, 1, 'normal',
         nullif(p->>'costo_unitario', '')::numeric, 0);
    ELSIF sentido = 'salida' THEN
      INSERT INTO inventario.movimientos_partidas
        (empresa_id, movimiento_id, producto_id, almacen_id, fecha_movimiento,
         cantidad, signo, tipo_partida, existencia_resultante)
      VALUES
        (p_empresa_id, mov, prod, source, p_fecha, qty, -1, 'normal', 0);
    ELSE
      RAISE EXCEPTION 'SENTIDO_INVALIDO: %', sentido USING ERRCODE = 'P0001';
    END IF;

    IF NOT prod = ANY(affected) THEN
      affected := array_append(affected, prod);
    END IF;
  END LOOP;

  FOREACH prod IN ARRAY affected LOOP
    PERFORM inventario.reconstruir_producto(p_empresa_id, prod);
  END LOOP;

  RETURN mov;
END;
$$;
