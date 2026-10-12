-- Motor canónico de reconstrucción de inventario.
-- No cambia cantidades originales ni documentos: sólo actualiza columnas derivadas
-- de movimientos_partidas y la caché derivada inventario.existencias.
-- La representación de una transferencia son dos partidas: salida en origen y
-- entrada en destino. Cada partida se procesa una sola vez.

CREATE OR REPLACE FUNCTION inventario.reconstruir_producto(
  p_empresa_id integer, p_producto_id integer
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
  q numeric(24,6); v numeric(24,6); avgc numeric(24,6); outcost numeric(24,6);
  cantidad_calc numeric(24,6); valor_calc numeric(24,6); permite_negativos boolean;
BEGIN
  UPDATE inventario.movimientos_partidas mp
     SET existencia_resultante=0, valor_movimiento=NULL,
         costo_promedio_resultante=NULL, secuencia_operativa=NULL
    FROM inventario.movimientos m
   WHERE m.id=mp.movimiento_id AND m.empresa_id=mp.empresa_id
     AND mp.empresa_id=p_empresa_id AND mp.producto_id=p_producto_id
     AND coalesce(m.estatus_afectacion,1)<>1;

  SELECT lower(coalesce(pe.valor,p.valor_default,'false')) IN
           ('1','true','t','yes','si','sí','on')
    INTO permite_negativos
    FROM core.parametros p
    LEFT JOIN core.parametros_empresa pe
      ON pe.parametro_id=p.parametro_id AND pe.empresa_id=p_empresa_id
   WHERE p.clave='inventario.permite_negativos' LIMIT 1;
  permite_negativos:=coalesce(permite_negativos,false);

  UPDATE inventario.existencias SET existencia=0, updated_at=now()
   WHERE empresa_id=p_empresa_id AND producto_id=p_producto_id;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.inv_saldos_canonicos (
    almacen_id integer PRIMARY KEY,
    existencia numeric(24,6), valor numeric(24,6), ultimo_costo numeric(24,6)
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.inv_saldos_canonicos;

  FOR r IN
    SELECT mp.id, mp.movimiento_id, m.fecha, mp.almacen_id, mp.cantidad,
           mp.signo, mp.tipo_partida, mp.costo_unitario,
           coalesce(mp.precision_cantidad,6) precision_cantidad,
           coalesce(mp.precision_costo,6) precision_costo,
           row_number() OVER (ORDER BY m.fecha,m.id,
             CASE WHEN mp.tipo_partida='salida_transferencia' THEN 0 ELSE 1 END,
             mp.id) seq
      FROM inventario.movimientos_partidas mp
      JOIN inventario.movimientos m ON m.id=mp.movimiento_id
       AND m.empresa_id=mp.empresa_id
     WHERE mp.empresa_id=p_empresa_id AND mp.producto_id=p_producto_id
       AND coalesce(m.estatus_afectacion,1)=1
     ORDER BY m.fecha,m.id,
       CASE WHEN mp.tipo_partida='salida_transferencia' THEN 0 ELSE 1 END,mp.id
  LOOP
    INSERT INTO pg_temp.inv_saldos_canonicos VALUES(r.almacen_id,0,0,NULL)
      ON CONFLICT DO NOTHING;
    SELECT existencia,valor,ultimo_costo INTO q,v,outcost
      FROM pg_temp.inv_saldos_canonicos WHERE almacen_id=r.almacen_id FOR UPDATE;
    cantidad_calc:=round(r.cantidad,r.precision_cantidad);

    IF r.tipo_partida='entrada_transferencia' THEN
      SELECT round(x.costo_unitario,r.precision_costo) INTO outcost
        FROM inventario.movimientos_partidas x
       WHERE x.movimiento_id=r.movimiento_id AND x.producto_id=p_producto_id
         AND x.empresa_id=p_empresa_id
         AND x.tipo_partida='salida_transferencia' AND x.costo_unitario IS NOT NULL
       ORDER BY x.id LIMIT 1;
      IF outcost IS NULL THEN
        RAISE EXCEPTION 'COSTO_TRANSFERENCIA_NO_DISPONIBLE: producto %',p_producto_id
          USING ERRCODE='P0001';
      END IF;
    ELSIF r.signo<0 THEN
      IF NOT permite_negativos AND q<cantidad_calc THEN
        RAISE EXCEPTION 'EXISTENCIA_INSUFICIENTE: producto %, almacén %, disponible %, solicitado %',
          p_producto_id,r.almacen_id,q,cantidad_calc USING ERRCODE='P0001';
      END IF;
      outcost:=CASE WHEN q<>0 THEN round(v/q,r.precision_costo) ELSE outcost END;
      IF outcost IS NULL THEN
        RAISE EXCEPTION 'COSTO_NO_DISPONIBLE: producto %, almacén %',p_producto_id,r.almacen_id
          USING ERRCODE='P0001';
      END IF;
    ELSE
      IF r.costo_unitario IS NULL OR r.costo_unitario<0 THEN
        RAISE EXCEPTION 'COSTO_ENTRADA_REQUERIDO: producto %, partida %',p_producto_id,r.id
          USING ERRCODE='P0001';
      END IF;
      outcost:=round(r.costo_unitario,r.precision_costo);
    END IF;

    valor_calc:=round(cantidad_calc*outcost,r.precision_costo);
    q:=round(q+cantidad_calc*r.signo,r.precision_cantidad);
    v:=round(v+valor_calc*r.signo,r.precision_costo);
    avgc:=CASE WHEN q<>0 THEN round(v/q,r.precision_costo) ELSE outcost END;
    UPDATE pg_temp.inv_saldos_canonicos SET existencia=q,valor=v,ultimo_costo=outcost
      WHERE almacen_id=r.almacen_id;
    UPDATE inventario.movimientos_partidas
       SET costo_unitario=CASE WHEN r.tipo_partida='entrada_transferencia' THEN outcost
                               WHEN r.signo<0 THEN outcost ELSE costo_unitario END,
           valor_movimiento=valor_calc*r.signo,
           existencia_resultante=q,
           costo_promedio_resultante=avgc,
           secuencia_operativa=r.seq
     WHERE id=r.id;
  END LOOP;

  FOR r IN SELECT almacen_id,existencia FROM pg_temp.inv_saldos_canonicos LOOP
    INSERT INTO inventario.existencias(empresa_id,producto_id,almacen_id,existencia,updated_at)
    VALUES(p_empresa_id,p_producto_id,r.almacen_id,r.existencia,now())
    ON CONFLICT(empresa_id,producto_id,almacen_id)
    DO UPDATE SET existencia=excluded.existencia,updated_at=now();
  END LOOP;
END $$;

COMMENT ON FUNCTION inventario.reconstruir_producto(integer,integer) IS
'Implementación canónica: reconstruye por fecha, procesa cada partida una vez y conserva cantidades originales.';
