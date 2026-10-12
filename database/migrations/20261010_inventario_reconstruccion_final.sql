-- Consolidación final del motor de reconstrucción de inventario.
-- Ejecutar después de 20261009_000_inventario_series_afectacion.sql.
-- No crea movimientos ni modifica datos existentes al instalarse.

ALTER TABLE inventario.movimientos_partidas
  ADD COLUMN IF NOT EXISTS precision_cantidad smallint,
  ADD COLUMN IF NOT EXISTS precision_costo smallint,
  ADD COLUMN IF NOT EXISTS valor_movimiento numeric(24,6),
  ADD COLUMN IF NOT EXISTS costo_promedio_resultante numeric(24,6),
  ADD COLUMN IF NOT EXISTS secuencia_operativa bigint;

CREATE OR REPLACE FUNCTION inventario.reconstruir_producto(
  p_empresa_id integer,
  p_producto_id integer
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  q numeric(24,6);
  v numeric(24,6);
  avgc numeric(24,6);
  outcost numeric(24,6);
  cantidad_calc numeric(24,6);
  valor_calc numeric(24,6);
  permite_negativos boolean;
BEGIN
  -- Las partidas excluidas dejan de ser resultados operativos válidos.
  -- existencia_resultante es NOT NULL en el esquema histórico, por eso se usa 0.
  UPDATE inventario.movimientos_partidas mp
     SET existencia_resultante = 0,
         valor_movimiento = NULL,
         costo_promedio_resultante = NULL,
         secuencia_operativa = NULL
    FROM inventario.movimientos m
   WHERE m.id = mp.movimiento_id
     AND m.empresa_id = mp.empresa_id
     AND mp.empresa_id = p_empresa_id
     AND mp.producto_id = p_producto_id
     AND COALESCE(m.estatus_afectacion, 1) <> 1;

  SELECT lower(coalesce(pe.valor, p.valor_default, 'false'))
           IN ('1','true','t','yes','si','sí','on')
    INTO permite_negativos
    FROM core.parametros p
    LEFT JOIN core.parametros_empresa pe
      ON pe.parametro_id = p.parametro_id
     AND pe.empresa_id = p_empresa_id
   WHERE p.clave = 'inventario.permite_negativos'
   LIMIT 1;
  permite_negativos := coalesce(permite_negativos, false);

  -- Garantiza que existencias represente solamente movimientos afectados,
  -- incluyendo almacenes que ya no tengan ninguna partida operativa.
  UPDATE inventario.existencias
     SET existencia = 0,
         updated_at = now()
   WHERE empresa_id = p_empresa_id
     AND producto_id = p_producto_id;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.inv_saldos_final (
    almacen_id integer PRIMARY KEY,
    existencia numeric(24,6),
    valor numeric(24,6),
    ultimo_costo numeric(24,6)
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.inv_saldos_final;

  FOR r IN
    SELECT mp.id,
           mp.movimiento_id,
           m.fecha,
           mp.almacen_id,
           mp.almacen_destino_id,
           mp.cantidad,
           mp.signo,
           mp.tipo_partida,
           mp.costo_unitario,
           COALESCE(mp.precision_cantidad, 6) AS precision_cantidad,
           COALESCE(mp.precision_costo, 6) AS precision_costo,
           row_number() OVER (ORDER BY m.fecha, m.id, mp.id) AS seq
      FROM inventario.movimientos_partidas mp
      JOIN inventario.movimientos m
        ON m.id = mp.movimiento_id
       AND m.empresa_id = mp.empresa_id
     WHERE mp.empresa_id = p_empresa_id
       AND mp.producto_id = p_producto_id
       AND COALESCE(m.estatus_afectacion, 1) = 1
     ORDER BY m.fecha, m.id, mp.id
  LOOP
    INSERT INTO pg_temp.inv_saldos_final
      (almacen_id, existencia, valor, ultimo_costo)
    VALUES (r.almacen_id, 0, 0, NULL)
    ON CONFLICT (almacen_id) DO NOTHING;

    SELECT existencia, valor, ultimo_costo
      INTO q, v, outcost
      FROM pg_temp.inv_saldos_final
     WHERE almacen_id = r.almacen_id
     FOR UPDATE;

    cantidad_calc := round(r.cantidad, r.precision_cantidad);

    IF r.tipo_partida = 'entrada_transferencia' THEN
      SELECT round(costo_unitario, r.precision_costo)
        INTO outcost
        FROM inventario.movimientos_partidas
       WHERE movimiento_id = r.movimiento_id
         AND producto_id = p_producto_id
         AND tipo_partida = 'salida_transferencia'
         AND costo_unitario IS NOT NULL
       ORDER BY id
       LIMIT 1;

      IF outcost IS NULL THEN
        RAISE EXCEPTION 'COSTO_TRANSFERENCIA_NO_DISPONIBLE: producto %', p_producto_id
          USING ERRCODE = 'P0001';
      END IF;

      q := round(q + cantidad_calc, r.precision_cantidad);
      valor_calc := round(cantidad_calc * outcost, r.precision_costo);
      v := round(v + valor_calc, r.precision_costo);
      avgc := CASE WHEN q <> 0
                   THEN round(v / q, r.precision_costo)
                   ELSE outcost END;

      UPDATE pg_temp.inv_saldos_final
         SET existencia = q, valor = v, ultimo_costo = outcost
       WHERE almacen_id = r.almacen_id;
      UPDATE inventario.movimientos_partidas
         SET costo_unitario = outcost,
             valor_movimiento = valor_calc,
             existencia_resultante = q,
             costo_promedio_resultante = avgc,
             secuencia_operativa = r.seq
       WHERE id = r.id;
      CONTINUE;
    ELSIF r.signo < 0 THEN
      IF NOT permite_negativos AND q < cantidad_calc THEN
        RAISE EXCEPTION
          'EXISTENCIA_INSUFICIENTE: producto %, almacén %, disponible %, solicitado %',
          p_producto_id, r.almacen_id, q, cantidad_calc
          USING ERRCODE = 'P0001';
      END IF;

      -- La salida siempre utiliza el promedio vigente antes de la salida.
      -- Si existe saldo cero y se permiten negativos, se conserva el último
      -- costo conocido para poder valorar determinísticamente la salida.
      outcost := CASE WHEN q <> 0
                      THEN round(v / q, r.precision_costo)
                      ELSE outcost END;
      IF outcost IS NULL THEN
        RAISE EXCEPTION 'COSTO_NO_DISPONIBLE: producto %, almacén %',
          p_producto_id, r.almacen_id
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      IF r.costo_unitario IS NULL OR r.costo_unitario < 0 THEN
        RAISE EXCEPTION 'COSTO_ENTRADA_REQUERIDO: producto %, partida %',
          p_producto_id, r.id
          USING ERRCODE = 'P0001';
      END IF;
      outcost := round(r.costo_unitario, r.precision_costo);
    END IF;

    valor_calc := round(cantidad_calc * outcost, r.precision_costo);
    IF r.signo > 0 THEN
      q := round(q + cantidad_calc, r.precision_cantidad);
      v := round(v + valor_calc, r.precision_costo);
    ELSE
      q := round(q - cantidad_calc, r.precision_cantidad);
      v := round(v - valor_calc, r.precision_costo);
    END IF;

    avgc := CASE WHEN q <> 0
                 THEN round(v / q, r.precision_costo)
                 ELSE outcost END;

    UPDATE pg_temp.inv_saldos_final
       SET existencia = q, valor = v, ultimo_costo = outcost
     WHERE almacen_id = r.almacen_id;

    UPDATE inventario.movimientos_partidas
       SET cantidad = cantidad_calc,
           costo_unitario = outcost,
           valor_movimiento = valor_calc * r.signo,
           existencia_resultante = q,
           costo_promedio_resultante = avgc,
           secuencia_operativa = r.seq
     WHERE id = r.id;

    IF r.tipo_partida = 'salida_transferencia' THEN
      INSERT INTO pg_temp.inv_saldos_final
        (almacen_id, existencia, valor, ultimo_costo)
      VALUES (r.almacen_destino_id, 0, 0, outcost)
      ON CONFLICT (almacen_id) DO NOTHING;

      SELECT existencia, valor
        INTO q, v
        FROM pg_temp.inv_saldos_final
       WHERE almacen_id = r.almacen_destino_id
       FOR UPDATE;
      q := round(q + cantidad_calc, r.precision_cantidad);
      v := round(v + valor_calc, r.precision_costo);
      UPDATE pg_temp.inv_saldos_final
         SET existencia = q, valor = v, ultimo_costo = outcost
       WHERE almacen_id = r.almacen_destino_id;
    END IF;
  END LOOP;

  FOR r IN SELECT almacen_id, existencia FROM pg_temp.inv_saldos_final LOOP
    INSERT INTO inventario.existencias
      (empresa_id, producto_id, almacen_id, existencia, updated_at)
    VALUES (p_empresa_id, p_producto_id, r.almacen_id, r.existencia, now())
    ON CONFLICT (empresa_id, producto_id, almacen_id)
    DO UPDATE SET existencia = EXCLUDED.existencia, updated_at = now();
  END LOOP;
END;
$$;
