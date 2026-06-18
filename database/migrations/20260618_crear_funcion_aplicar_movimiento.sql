-- Función: inventario.aplicar_movimiento
-- Crea un movimiento de inventario con sus partidas y actualiza existencias.
-- Parámetros:
--   p_empresa_id      : empresa propietaria
--   p_tipo_movimiento : 'entrada', 'salida', 'transferencia', etc.
--   p_fecha           : fecha efectiva del movimiento
--   p_usuario_id      : usuario que lo registra
--   p_documento_id    : documento origen (NULL para movimientos manuales)
--   p_observaciones   : notas opcionales
--   p_partidas        : array JSONB con estructura:
--     [{
--       producto_id: int,
--       almacen_id: int,
--       cantidad: numeric,
--       signo: 1 | -1,
--       tipo_partida?: 'normal'|'salida_transferencia'|'entrada_transferencia',
--       almacen_destino_id?: int | null,
--       documento_partida_id?: int | null,
--       costo_unitario?: numeric | null
--     }]
-- Retorna: id del movimiento creado (BIGINT)

CREATE OR REPLACE FUNCTION inventario.aplicar_movimiento(
  p_empresa_id       INTEGER,
  p_tipo_movimiento  VARCHAR(30),
  p_fecha            TIMESTAMPTZ,
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
  -- Insertar encabezado del movimiento
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

  -- Iterar partidas del JSONB
  FOR v_partida IN SELECT * FROM jsonb_array_elements(p_partidas) LOOP
    v_producto_id        := (v_partida->>'producto_id')::INTEGER;
    v_almacen_id         := (v_partida->>'almacen_id')::INTEGER;
    v_cantidad           := (v_partida->>'cantidad')::NUMERIC;
    v_signo              := (v_partida->>'signo')::SMALLINT;
    v_tipo_partida       := COALESCE(v_partida->>'tipo_partida', 'normal');
    v_costo_unitario     := (v_partida->>'costo_unitario')::NUMERIC;
    v_almacen_destino_id := (v_partida->>'almacen_destino_id')::INTEGER;
    v_doc_partida_id     := (v_partida->>'documento_partida_id')::INTEGER;

    -- Bloquear fila de existencias para evitar carreras en transacciones concurrentes
    SELECT existencia
      INTO v_existencia_actual
      FROM inventario.existencias
     WHERE empresa_id  = p_empresa_id
       AND producto_id = v_producto_id
       AND almacen_id  = v_almacen_id
     FOR UPDATE;

    v_existencia_actual     := COALESCE(v_existencia_actual, 0);
    v_existencia_resultante := v_existencia_actual + (v_cantidad * v_signo);

    -- Insertar partida del movimiento
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

    -- Actualizar o crear fila en existencias
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
