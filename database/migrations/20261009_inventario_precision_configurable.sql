-- Instantánea de precisión por partida de inventario.
-- Históricos NULL conservan la precisión legacy de seis decimales.
-- Preparada para aplicación manual; no ejecutar automáticamente.

ALTER TABLE inventario.movimientos_partidas
  ADD COLUMN IF NOT EXISTS precision_cantidad smallint,
  ADD COLUMN IF NOT EXISTS precision_costo smallint;

CREATE OR REPLACE FUNCTION inventario.asignar_precision_partida()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  empresa_id_mov bigint;
  dec_cantidad integer;
  dec_costo integer;
BEGIN
  SELECT m.empresa_id INTO empresa_id_mov
    FROM inventario.movimientos m WHERE m.id = NEW.movimiento_id;
  SELECT COALESCE(pe.valor, p.valor_default)::integer INTO dec_cantidad
    FROM core.parametros p LEFT JOIN core.parametros_empresa pe
      ON pe.parametro_id = p.parametro_id AND pe.empresa_id = empresa_id_mov
   WHERE p.clave = 'decimales_cantidades' LIMIT 1;
  SELECT COALESCE(pe.valor, p.valor_default)::integer INTO dec_costo
    FROM core.parametros p LEFT JOIN core.parametros_empresa pe
      ON pe.parametro_id = p.parametro_id AND pe.empresa_id = empresa_id_mov
   WHERE p.clave = 'decimales_costos' LIMIT 1;
  NEW.precision_cantidad := CASE WHEN NEW.precision_cantidad BETWEEN 0 AND 6 THEN NEW.precision_cantidad ELSE COALESCE(dec_cantidad, 6) END;
  NEW.precision_costo := CASE WHEN NEW.precision_costo BETWEEN 0 AND 6 THEN NEW.precision_costo ELSE COALESCE(dec_costo, 6) END;
  NEW.cantidad := round(NEW.cantidad, NEW.precision_cantidad);
  IF NEW.costo_unitario IS NOT NULL THEN NEW.costo_unitario := round(NEW.costo_unitario, NEW.precision_costo); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_asignar_precision_partida ON inventario.movimientos_partidas;
CREATE TRIGGER trg_asignar_precision_partida
BEFORE INSERT ON inventario.movimientos_partidas
FOR EACH ROW EXECUTE FUNCTION inventario.asignar_precision_partida();

CREATE OR REPLACE FUNCTION inventario.reconstruir_producto(p_empresa_id integer, p_producto_id integer)
RETURNS void LANGUAGE plpgsql AS $$
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
     AND COALESCE(m.estatus_afectacion, 1) = 0;

  SELECT lower(coalesce(pe.valor, p.valor_default, 'false')) IN ('1','true','t','yes','si','sí','on') INTO permite_negativos
    FROM core.parametros p LEFT JOIN core.parametros_empresa pe ON pe.parametro_id=p.parametro_id AND pe.empresa_id=p_empresa_id
   WHERE p.clave='inventario.permite_negativos' LIMIT 1;
  permite_negativos := coalesce(permite_negativos, false);
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.inv_saldos (almacen_id integer PRIMARY KEY, existencia numeric(24,6), valor numeric(24,6), ultimo_costo numeric(24,6)) ON COMMIT DROP;
  TRUNCATE pg_temp.inv_saldos;

  FOR r IN
    SELECT mp.id, mp.movimiento_id, m.fecha, mp.almacen_id, mp.almacen_destino_id, mp.cantidad, mp.signo,
           mp.tipo_partida, mp.costo_unitario, COALESCE(mp.precision_cantidad,6) AS precision_cantidad,
           COALESCE(mp.precision_costo,6) AS precision_costo,
           row_number() OVER (ORDER BY m.fecha,m.id,mp.id) AS seq
      FROM inventario.movimientos_partidas mp JOIN inventario.movimientos m ON m.id=mp.movimiento_id AND m.empresa_id=mp.empresa_id
     WHERE mp.empresa_id=p_empresa_id AND mp.producto_id=p_producto_id
       AND COALESCE(m.estatus_afectacion, 1) = 1
     ORDER BY m.fecha,m.id,mp.id
  LOOP
    INSERT INTO pg_temp.inv_saldos VALUES (r.almacen_id,0,0,NULL) ON CONFLICT (almacen_id) DO NOTHING;
    SELECT existencia,valor,ultimo_costo INTO q,v,outcost FROM pg_temp.inv_saldos WHERE almacen_id=r.almacen_id FOR UPDATE;
    cantidad_calc := round(r.cantidad, r.precision_cantidad);

    IF r.tipo_partida='entrada_transferencia' THEN
      SELECT costo_unitario INTO outcost FROM inventario.movimientos_partidas WHERE movimiento_id=r.movimiento_id AND producto_id=p_producto_id AND tipo_partida='salida_transferencia' AND costo_unitario IS NOT NULL ORDER BY id LIMIT 1;
      IF outcost IS NULL THEN RAISE EXCEPTION 'COSTO_TRANSFERENCIA_NO_DISPONIBLE: producto %',p_producto_id USING ERRCODE='P0001'; END IF;
      outcost := round(outcost,r.precision_costo);
      q := round(q + cantidad_calc,r.precision_cantidad);
      valor_calc := round(cantidad_calc*outcost,r.precision_costo);
      v := round(v + valor_calc,r.precision_costo);
      avgc := CASE WHEN q<>0 THEN round(v/q,r.precision_costo) ELSE outcost END;
      UPDATE pg_temp.inv_saldos SET existencia=q,valor=v,ultimo_costo=outcost WHERE almacen_id=r.almacen_id;
      UPDATE inventario.movimientos_partidas SET costo_unitario=outcost,valor_movimiento=valor_calc,existencia_resultante=q,costo_promedio_resultante=avgc,secuencia_operativa=r.seq WHERE id=r.id;
      CONTINUE;
    ELSIF r.signo<0 THEN
      IF NOT permite_negativos AND q<cantidad_calc THEN RAISE EXCEPTION 'EXISTENCIA_INSUFICIENTE: producto %, almacén %, disponible %, solicitado %',p_producto_id,r.almacen_id,q,cantidad_calc USING ERRCODE='P0001'; END IF;
      outcost := CASE WHEN q<>0 THEN round(v/q,r.precision_costo) ELSE outcost END;
      IF outcost IS NULL THEN RAISE EXCEPTION 'COSTO_NO_DISPONIBLE: producto %, almacén %',p_producto_id,r.almacen_id USING ERRCODE='P0001'; END IF;
    ELSE
      IF r.costo_unitario IS NULL OR r.costo_unitario<0 THEN RAISE EXCEPTION 'COSTO_ENTRADA_REQUERIDO: producto %, partida %',p_producto_id,r.id USING ERRCODE='P0001'; END IF;
      outcost := round(r.costo_unitario,r.precision_costo);
    END IF;

    valor_calc := round(cantidad_calc*outcost,r.precision_costo);
    IF r.signo>0 THEN
      q := round(q+cantidad_calc,r.precision_cantidad); v := round(v+valor_calc,r.precision_costo);
    ELSE
      q := round(q-cantidad_calc,r.precision_cantidad); v := round(v-valor_calc,r.precision_costo);
    END IF;
    avgc := CASE WHEN q<>0 THEN round(v/q,r.precision_costo) ELSE outcost END;
    UPDATE pg_temp.inv_saldos SET existencia=q,valor=v,ultimo_costo=outcost WHERE almacen_id=r.almacen_id;
    UPDATE inventario.movimientos_partidas SET cantidad=cantidad_calc,costo_unitario=outcost,valor_movimiento=valor_calc*r.signo,existencia_resultante=q,costo_promedio_resultante=avgc,secuencia_operativa=r.seq WHERE id=r.id;
    IF r.tipo_partida='salida_transferencia' THEN
      INSERT INTO pg_temp.inv_saldos VALUES (r.almacen_destino_id,0,0,outcost) ON CONFLICT (almacen_id) DO NOTHING;
      SELECT existencia,valor INTO q,v FROM pg_temp.inv_saldos WHERE almacen_id=r.almacen_destino_id FOR UPDATE;
      q:=round(q+cantidad_calc,r.precision_cantidad); v:=round(v+valor_calc,r.precision_costo);
      UPDATE pg_temp.inv_saldos SET existencia=q,valor=v,ultimo_costo=outcost WHERE almacen_id=r.almacen_destino_id;
    END IF;
  END LOOP;
  FOR r IN SELECT almacen_id,existencia FROM pg_temp.inv_saldos LOOP
    INSERT INTO inventario.existencias(empresa_id,producto_id,almacen_id,existencia,updated_at) VALUES(p_empresa_id,p_producto_id,r.almacen_id,r.existencia,now())
    ON CONFLICT (empresa_id,producto_id,almacen_id) DO UPDATE SET existencia=EXCLUDED.existencia,updated_at=now();
  END LOOP;
END $$;
