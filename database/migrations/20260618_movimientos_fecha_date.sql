-- Cambia inventario.movimientos.fecha y movimientos_partidas.fecha_movimiento
-- de TIMESTAMPTZ a DATE para evitar conversiones de zona horaria.
-- La fecha de un movimiento de inventario es una fecha de negocio, no un instante.

ALTER TABLE inventario.movimientos
  ALTER COLUMN fecha TYPE DATE USING fecha::DATE;

ALTER TABLE inventario.movimientos_partidas
  ALTER COLUMN fecha_movimiento TYPE DATE USING fecha_movimiento::DATE;

-- Actualizar la función para recibir DATE en lugar de TIMESTAMPTZ
CREATE OR REPLACE FUNCTION inventario.aplicar_movimiento(
  p_empresa_id       INTEGER,
  p_tipo_movimiento  VARCHAR(30),
  p_fecha            DATE,
  p_usuario_id       INTEGER,
  p_documento_id     INTEGER,
  p_observaciones    TEXT,
  p_partidas         JSONB
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_movimiento_id         BIGINT;
  v_partida               JSONB;
  v_producto_id           INTEGER;
  v_almacen_id            INTEGER;
  v_cantidad              NUMERIC(18,6);
  v_signo                 SMALLINT;
  v_tipo_partida          VARCHAR(25);
  v_costo_unitario        NUMERIC(18,6);
  v_almacen_destino_id    INTEGER;
  v_doc_partida_id        INTEGER;
  v_existencia_actual     NUMERIC(18,6);
  v_existencia_resultante NUMERIC(18,6);
BEGIN
  INSERT INTO inventario.movimientos (
    empresa_id,
    tipo_movimiento,
    fecha,
    usuario_id,
    documento_id,
    observaciones
  ) VALUES (
    p_empresa_id,
    p_tipo_movimiento,
    p_fecha,
    p_usuario_id,
    p_documento_id,
    p_observaciones
  ) RETURNING id INTO v_movimiento_id;

  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    v_producto_id        := (v_partida->>'producto_id')::INTEGER;
    v_almacen_id         := (v_partida->>'almacen_id')::INTEGER;
    v_cantidad           := (v_partida->>'cantidad')::NUMERIC;
    v_signo              := (v_partida->>'signo')::SMALLINT;
    v_tipo_partida       := COALESCE(v_partida->>'tipo_partida', 'normal');
    v_costo_unitario     := (v_partida->>'costo_unitario')::NUMERIC;
    v_almacen_destino_id := (v_partida->>'almacen_destino_id')::INTEGER;
    v_doc_partida_id     := (v_partida->>'documento_partida_id')::INTEGER;

    SELECT existencia
      INTO v_existencia_actual
      FROM inventario.existencias
     WHERE empresa_id  = p_empresa_id
       AND producto_id = v_producto_id
       AND almacen_id  = v_almacen_id
     FOR UPDATE;

    v_existencia_actual     := COALESCE(v_existencia_actual, 0);
    v_existencia_resultante := v_existencia_actual + (v_cantidad * v_signo);

    INSERT INTO inventario.movimientos_partidas (
      empresa_id,
      movimiento_id,
      documento_partida_id,
      producto_id,
      almacen_id,
      almacen_destino_id,
      fecha_movimiento,
      cantidad,
      signo,
      tipo_partida,
      costo_unitario,
      existencia_resultante
    ) VALUES (
      p_empresa_id,
      v_movimiento_id,
      v_doc_partida_id,
      v_producto_id,
      v_almacen_id,
      v_almacen_destino_id,
      p_fecha,
      v_cantidad,
      v_signo,
      v_tipo_partida,
      v_costo_unitario,
      v_existencia_resultante
    );

    INSERT INTO inventario.existencias (
      empresa_id,
      producto_id,
      almacen_id,
      existencia,
      updated_at
    ) VALUES (
      p_empresa_id,
      v_producto_id,
      v_almacen_id,
      v_existencia_resultante,
      now()
    ) ON CONFLICT (empresa_id, producto_id, almacen_id)
      DO UPDATE SET
        existencia = v_existencia_resultante,
        updated_at = now();
  END LOOP;

  RETURN v_movimiento_id;
END;
$$;
