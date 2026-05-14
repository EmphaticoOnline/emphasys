INSERT INTO core.tipos_documento (
    codigo,
    nombre,
    nombre_plural,
    icono,
    orden,
    activo,
    modulo
)
VALUES (
    'orden_servicio',
    'Orden de servicio',
    'Órdenes de servicio',
    'Build',
    (
        SELECT COALESCE(MAX(td.orden) + 1, 0)
        FROM core.tipos_documento td
        WHERE LOWER(COALESCE(td.modulo, '')) = 'ventas'
    ),
    true,
    'ventas'
)
ON CONFLICT (codigo) DO UPDATE
SET
    nombre = EXCLUDED.nombre,
    nombre_plural = EXCLUDED.nombre_plural,
    icono = EXCLUDED.icono,
    activo = true,
    modulo = EXCLUDED.modulo;
DO $$
DECLARE
  tiene_afecta_inventario BOOLEAN;
  tiene_afecta_reservado BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'core'
      AND table_name = 'empresas_tipos_documento'
      AND column_name = 'afecta_inventario'
  )
  INTO tiene_afecta_inventario;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'core'
      AND table_name = 'empresas_tipos_documento'
      AND column_name = 'afecta_reservado'
  )
  INTO tiene_afecta_reservado;

  IF tiene_afecta_inventario AND tiene_afecta_reservado THEN
    INSERT INTO core.empresas_tipos_documento (
      empresa_id,
      tipo_documento_id,
      activo,
      orden,
      usuario_creacion_id,
      afecta_inventario,
      afecta_reservado
    )
    SELECT
      e.id,
      td.id,
      true,
      td.orden,
      NULL,
      'none',
      false
    FROM core.empresas e
    JOIN core.tipos_documento td
      ON td.codigo = 'orden_servicio'
    WHERE NOT EXISTS (
      SELECT 1
      FROM core.empresas_tipos_documento etd
      WHERE etd.empresa_id = e.id
        AND etd.tipo_documento_id = td.id
    );

    UPDATE core.empresas_tipos_documento etd
    SET activo = true,
        afecta_inventario = 'none',
        afecta_reservado = false
    FROM core.tipos_documento td
    WHERE td.id = etd.tipo_documento_id
      AND td.codigo = 'orden_servicio';
  ELSE
    INSERT INTO core.empresas_tipos_documento (
      empresa_id,
      tipo_documento_id,
      activo,
      orden,
      usuario_creacion_id
    )
    SELECT
      e.id,
      td.id,
      true,
      td.orden,
      NULL
    FROM core.empresas e
    JOIN core.tipos_documento td
      ON td.codigo = 'orden_servicio'
    WHERE NOT EXISTS (
      SELECT 1
      FROM core.empresas_tipos_documento etd
      WHERE etd.empresa_id = e.id
        AND etd.tipo_documento_id = td.id
    );

    UPDATE core.empresas_tipos_documento etd
    SET activo = true
    FROM core.tipos_documento td
    WHERE td.id = etd.tipo_documento_id
      AND td.codigo = 'orden_servicio';
  END IF;
END $$;