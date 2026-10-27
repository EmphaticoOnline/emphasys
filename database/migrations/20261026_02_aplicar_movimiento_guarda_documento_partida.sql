-- Corrige la regresión de 20261009_inventario_negativos_y_costos.sql: la función
-- dejó de guardar inventario.movimientos_partidas.documento_partida_id aunque el
-- backend lo envía en cada partida (la versión 20260618 sí lo guardaba).
--
-- Parte EXACTAMENTE de la versión vigente (20261010_001_correccion_transferencias_
-- aplicar_movimiento.sql, verificada idéntica a producción el 2026-10-26) y sólo
-- agrega la lectura de `documento_partida_id` y su inserción en las partidas.
-- No cambia costos, negativos, transferencias ni la reconstrucción.
-- Reemplaza únicamente la sobrecarga de 8 parámetros usada por el backend.
-- No modifica movimientos existentes (el relleno va en 20261026_03).
--
-- Análisis: docs/analisis-enlace-partida-movimientos-inventario.md

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
  doc_partida integer;
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
    -- Partida del documento que origina el renglón (NULL en movimientos manuales).
    doc_partida := nullif(p->>'documento_partida_id', '')::integer;

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
         fecha_movimiento, cantidad, signo, tipo_partida, existencia_resultante,
         documento_partida_id)
      VALUES
        (p_empresa_id, mov, prod, source, dest, p_fecha, qty, -1,
         'salida_transferencia', 0, doc_partida);

      INSERT INTO inventario.movimientos_partidas
        (empresa_id, movimiento_id, producto_id, almacen_id, almacen_destino_id,
         fecha_movimiento, cantidad, signo, tipo_partida, existencia_resultante,
         documento_partida_id)
      VALUES
        (p_empresa_id, mov, prod, dest, source, p_fecha, qty, 1,
         'entrada_transferencia', 0, doc_partida);
    ELSIF sentido = 'entrada' THEN
      INSERT INTO inventario.movimientos_partidas
        (empresa_id, movimiento_id, producto_id, almacen_id, fecha_movimiento,
         cantidad, signo, tipo_partida, costo_unitario, existencia_resultante,
         documento_partida_id)
      VALUES
        (p_empresa_id, mov, prod, source, p_fecha, qty, 1, 'normal',
         nullif(p->>'costo_unitario', '')::numeric, 0, doc_partida);
    ELSIF sentido = 'salida' THEN
      INSERT INTO inventario.movimientos_partidas
        (empresa_id, movimiento_id, producto_id, almacen_id, fecha_movimiento,
         cantidad, signo, tipo_partida, existencia_resultante,
         documento_partida_id)
      VALUES
        (p_empresa_id, mov, prod, source, p_fecha, qty, -1, 'normal', 0, doc_partida);
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
