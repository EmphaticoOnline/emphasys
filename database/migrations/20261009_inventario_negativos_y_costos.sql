-- Permite configurar inventario negativo por empresa y conserva una valoración
-- determinista cuando el saldo cruza cero.
-- Preparada para aplicación manual; no ejecutar automáticamente.

INSERT INTO core.parametros (clave, nombre, tipo_dato, tipo_control, valor_default)
VALUES (
  'inventario.permite_negativos',
  'Permitir existencias negativas',
  'boolean',
  'switch',
  'false'
)
ON CONFLICT (clave) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      tipo_dato = EXCLUDED.tipo_dato,
      tipo_control = EXCLUDED.tipo_control,
      valor_default = EXCLUDED.valor_default;

CREATE OR REPLACE FUNCTION inventario.reconstruir_producto(p_empresa_id integer, p_producto_id integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
  q numeric(24,6);
  v numeric(24,6);
  avgc numeric(24,6);
  outcost numeric(24,6);
  permite_negativos boolean;
BEGIN
  SELECT lower(coalesce(pe.valor, p.valor_default, 'false')) IN ('1','true','t','yes','si','sí','on')
    INTO permite_negativos
    FROM core.parametros p
    LEFT JOIN core.parametros_empresa pe
      ON pe.parametro_id = p.parametro_id AND pe.empresa_id = p_empresa_id
   WHERE p.clave = 'inventario.permite_negativos'
   LIMIT 1;
  permite_negativos := coalesce(permite_negativos, false);

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.inv_saldos (
    almacen_id integer PRIMARY KEY,
    existencia numeric(24,6),
    valor numeric(24,6),
    ultimo_costo numeric(24,6)
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.inv_saldos;

  FOR r IN
    SELECT mp.id, mp.movimiento_id, m.fecha, mp.almacen_id, mp.almacen_destino_id,
           mp.cantidad, mp.signo, mp.tipo_partida, mp.costo_unitario,
           row_number() OVER (ORDER BY m.fecha, m.id, mp.id) AS seq
      FROM inventario.movimientos_partidas mp
      JOIN inventario.movimientos m ON m.id = mp.movimiento_id AND m.empresa_id = mp.empresa_id
     WHERE mp.empresa_id = p_empresa_id AND mp.producto_id = p_producto_id
     ORDER BY m.fecha, m.id, mp.id
  LOOP
    INSERT INTO pg_temp.inv_saldos VALUES (r.almacen_id, 0, 0, NULL)
      ON CONFLICT (almacen_id) DO NOTHING;
    SELECT existencia, valor, ultimo_costo INTO q, v, outcost
      FROM pg_temp.inv_saldos WHERE almacen_id = r.almacen_id FOR UPDATE;

    IF r.tipo_partida = 'entrada_transferencia' THEN
      SELECT costo_unitario INTO outcost
        FROM inventario.movimientos_partidas
       WHERE movimiento_id = r.movimiento_id AND producto_id = p_producto_id
         AND tipo_partida = 'salida_transferencia' AND costo_unitario IS NOT NULL
       ORDER BY id LIMIT 1;
      IF outcost IS NULL THEN
        RAISE EXCEPTION 'COSTO_TRANSFERENCIA_NO_DISPONIBLE: producto %', p_producto_id USING ERRCODE='P0001';
      END IF;
      UPDATE inventario.movimientos_partidas
         SET costo_unitario = outcost,
             valor_movimiento = r.cantidad * outcost,
             existencia_resultante = q,
             costo_promedio_resultante = CASE WHEN q <> 0 THEN v / q ELSE outcost END,
             secuencia_operativa = r.seq
       WHERE id = r.id;
      CONTINUE;
    ELSIF r.signo < 0 THEN
      IF NOT permite_negativos AND q < r.cantidad THEN
        RAISE EXCEPTION 'EXISTENCIA_INSUFICIENTE: producto %, almacén %, disponible %, solicitado %',
          p_producto_id, r.almacen_id, q, r.cantidad USING ERRCODE='P0001';
      END IF;
      outcost := coalesce(outcost, nullif(r.costo_unitario, 0));
      IF outcost IS NULL THEN
        RAISE EXCEPTION 'COSTO_NO_DISPONIBLE: producto %, almacén %', p_producto_id, r.almacen_id USING ERRCODE='P0001';
      END IF;
    ELSE
      IF r.costo_unitario IS NULL OR r.costo_unitario < 0 THEN
        RAISE EXCEPTION 'COSTO_ENTRADA_REQUERIDO: producto %, partida %', p_producto_id, r.id USING ERRCODE='P0001';
      END IF;
      outcost := r.costo_unitario;
    END IF;

    IF r.signo > 0 THEN
      v := v + r.cantidad * outcost;
      q := q + r.cantidad;
    ELSE
      v := v - r.cantidad * outcost;
      q := q - r.cantidad;
    END IF;
    avgc := CASE WHEN q <> 0 THEN v / q ELSE outcost END;
    UPDATE pg_temp.inv_saldos
       SET existencia = q, valor = v, ultimo_costo = outcost
     WHERE almacen_id = r.almacen_id;
    UPDATE inventario.movimientos_partidas
       SET costo_unitario = outcost,
           valor_movimiento = r.cantidad * outcost * r.signo,
           existencia_resultante = q,
           costo_promedio_resultante = avgc,
           secuencia_operativa = r.seq
     WHERE id = r.id;

    IF r.tipo_partida = 'salida_transferencia' THEN
      INSERT INTO pg_temp.inv_saldos VALUES (r.almacen_destino_id, 0, 0, outcost)
        ON CONFLICT (almacen_id) DO NOTHING;
      SELECT existencia, valor INTO q, v FROM pg_temp.inv_saldos
       WHERE almacen_id = r.almacen_destino_id FOR UPDATE;
      q := q + r.cantidad;
      v := v + r.cantidad * outcost;
      UPDATE pg_temp.inv_saldos SET existencia = q, valor = v, ultimo_costo = outcost
       WHERE almacen_id = r.almacen_destino_id;
    END IF;
  END LOOP;

  FOR r IN SELECT almacen_id, existencia FROM pg_temp.inv_saldos LOOP
    INSERT INTO inventario.existencias(empresa_id, producto_id, almacen_id, existencia, updated_at)
    VALUES (p_empresa_id, p_producto_id, r.almacen_id, r.existencia, now())
    ON CONFLICT (empresa_id, producto_id, almacen_id)
    DO UPDATE SET existencia = EXCLUDED.existencia, updated_at = now();
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION inventario.aplicar_movimiento(
  p_empresa_id integer, p_tipo_movimiento varchar(30), p_fecha date,
  p_usuario_id integer, p_documento_id integer, p_observaciones text, p_partidas jsonb
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
  PERFORM pg_advisory_xact_lock(hashtextextended('inventario:' || p_empresa_id::text, 0));
  INSERT INTO inventario.movimientos(empresa_id, tipo_movimiento, fecha, usuario_id, documento_id, observaciones)
  VALUES (p_empresa_id, p_tipo_movimiento, p_fecha, p_usuario_id, p_documento_id, p_observaciones)
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
