CREATE SCHEMA IF NOT EXISTS mantenimiento;

CREATE TABLE IF NOT EXISTS mantenimiento.cleanup_counts_before (
    session_id text NOT NULL,
    orden integer NOT NULL,
    tabla text NOT NULL,
    cantidad bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mantenimiento.cleanup_counts_after (
    session_id text NOT NULL,
    orden integer NOT NULL,
    tabla text NOT NULL,
    cantidad bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mantenimiento.cleanup_runs (
    session_id text PRIMARY KEY,
    empresa_id integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

BEGIN;

DO $$
DECLARE
    v_empresa_id integer := 4;
    v_session_id text := 'empresa_' || v_empresa_id || '_' || to_char(clock_timestamp(),'YYYYMMDD_HH24MISS');
BEGIN
    INSERT INTO mantenimiento.cleanup_runs (
        session_id,
        empresa_id
    )
    VALUES (
        v_session_id,
        v_empresa_id
    );

    DELETE FROM mantenimiento.cleanup_counts_before
    WHERE session_id = v_session_id;

    DELETE FROM mantenimiento.cleanup_counts_after
    WHERE session_id = v_session_id;

    DELETE FROM mantenimiento.cleanup_counts_before
    WHERE created_at < now() - interval '30 days';

    DELETE FROM mantenimiento.cleanup_counts_after
    WHERE created_at < now() - interval '30 days';

    INSERT INTO mantenimiento.cleanup_counts_before (
        session_id,
        orden,
        tabla,
        cantidad
    )
    WITH conteos AS (
        SELECT  1 AS orden, 'public.documentos' AS tabla, count(*)::bigint AS cantidad
        FROM public.documentos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT  2, 'public.documentos_partidas', count(*)::bigint
        FROM public.documentos_partidas dp
        JOIN public.documentos d ON d.id = dp.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  3, 'public.documentos_campos', count(*)::bigint
        FROM public.documentos_campos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT  4, 'public.documentos_cfdi', count(*)::bigint
        FROM public.documentos_cfdi dcf
        JOIN public.documentos d ON d.id = dcf.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  5, 'public.documentos_partidas_campos', count(*)::bigint
        FROM public.documentos_partidas_campos dpc
        JOIN public.documentos_partidas dp ON dp.id = dpc.partida_id
        JOIN public.documentos d ON d.id = dp.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  6, 'public.documentos_partidas_impuestos', count(*)::bigint
        FROM public.documentos_partidas_impuestos dpi
        JOIN public.documentos_partidas dp ON dp.id = dpi.partida_id
        JOIN public.documentos d ON d.id = dp.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  7, 'public.documentos_partidas_vinculos', count(*)::bigint
        FROM public.documentos_partidas_vinculos dpv
        WHERE EXISTS (
            SELECT 1
            FROM public.documentos d
            WHERE d.empresa_id = v_empresa_id
              AND (d.id = dpv.documento_origen_id OR d.id = dpv.documento_destino_id)
        )

        UNION ALL
        SELECT  8, 'public.aplicaciones_saldo', count(*)::bigint
        FROM public.aplicaciones_saldo
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT  9, 'public.finanzas_aplicaciones', count(*)::bigint
        FROM public.finanzas_aplicaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 10, 'public.finanzas_conciliaciones', count(*)::bigint
        FROM public.finanzas_conciliaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 11, 'public.finanzas_conciliaciones_operaciones', count(*)::bigint
        FROM public.finanzas_conciliaciones_operaciones fco
        WHERE EXISTS (
            SELECT 1
            FROM public.finanzas_conciliaciones fc
            WHERE fc.id = fco.conciliacion_id
              AND fc.empresa_id = v_empresa_id
        )

        UNION ALL
        SELECT 12, 'public.finanzas_transferencias', count(*)::bigint
        FROM public.finanzas_transferencias
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 13, 'public.finanzas_operaciones', count(*)::bigint
        FROM public.finanzas_operaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 14, 'public.credito_operaciones', count(*)::bigint
        FROM public.credito_operaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 15, 'public.credito_operaciones_aplicaciones', count(*)::bigint
        FROM public.credito_operaciones_aplicaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 16, 'public.credito_operaciones_items', count(*)::bigint
        FROM public.credito_operaciones_items coi
        WHERE EXISTS (
            SELECT 1
            FROM public.credito_operaciones co
            WHERE co.id = coi.operacion_credito_id
              AND co.empresa_id = v_empresa_id
        )

        UNION ALL
        SELECT 17, 'inventario.movimientos', count(*)::bigint
        FROM inventario.movimientos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 18, 'inventario.movimientos_partidas', count(*)::bigint
        FROM inventario.movimientos_partidas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 19, 'inventario.existencias', count(*)::bigint
        FROM inventario.existencias
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 20, 'crm.oportunidades_venta', count(*)::bigint
        FROM crm.oportunidades_venta
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 21, 'crm.actividades', count(*)::bigint
        FROM crm.actividades
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 22, 'crm.conversaciones', count(*)::bigint
        FROM crm.conversaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 23, 'crm.conversacion_etiquetas', count(*)::bigint
        FROM crm.conversacion_etiquetas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 24, 'crm.mensajes', count(*)::bigint
        FROM crm.mensajes
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 25, 'produccion.seguimientos', count(*)::bigint
        FROM produccion.seguimientos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 26, 'whatsapp.estadisticas', count(*)::bigint
        FROM whatsapp.estadisticas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 27, 'whatsapp.intentos_contacto', count(*)::bigint
        FROM whatsapp.intentos_contacto
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 28, 'public.audit_log', count(*)::bigint
        FROM public.audit_log
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 29, 'public.contactos', count(*)::bigint
        FROM public.contactos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 30, 'public.contactos_datos_fiscales', count(*)::bigint
        FROM public.contactos_datos_fiscales cdf
        JOIN public.contactos c ON c.id = cdf.contacto_id
        WHERE c.empresa_id = v_empresa_id

        UNION ALL
        SELECT 31, 'public.contactos_domicilios', count(*)::bigint
        FROM public.contactos_domicilios cd
        JOIN public.contactos c ON c.id = cd.contacto_id
        WHERE c.empresa_id = v_empresa_id

        UNION ALL
        SELECT 32, 'public.productos', count(*)::bigint
        FROM public.productos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 33, 'public.productos_archivos', count(*)::bigint
        FROM public.productos_archivos pa
        JOIN public.productos p ON p.id = pa.producto_id
        WHERE p.empresa_id = v_empresa_id

        UNION ALL
        SELECT 34, 'public.productos_impuestos', count(*)::bigint
        FROM public.productos_impuestos pi
        JOIN public.productos p ON p.id = pi.producto_id
        WHERE p.empresa_id = v_empresa_id

        UNION ALL
        SELECT 35, 'public.precios', count(*)::bigint
        FROM public.precios
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 36, 'public.precios_listas', count(*)::bigint
        FROM public.precios_listas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 37, 'public.unidades', count(*)::bigint
        FROM public.unidades

        UNION ALL
        SELECT 38, 'public.conceptos', count(*)::bigint
        FROM public.conceptos

        UNION ALL
        SELECT 39, 'public.finanzas_cuentas', count(*)::bigint
        FROM public.finanzas_cuentas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 40, 'whatsapp.contacto_mapeo', count(*)::bigint
        FROM whatsapp.contacto_mapeo wcm
        JOIN public.contactos c ON c.id = wcm.contacto_id
        WHERE c.empresa_id = v_empresa_id
    )
    SELECT
        v_session_id,
        orden,
        tabla,
        cantidad
    FROM conteos
    ORDER BY orden;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'documentos'
          AND column_name = 'finanzas_operacion_id'
    ) THEN
        EXECUTE '
            UPDATE public.documentos
            SET finanzas_operacion_id = NULL,
                documento_origen_id = NULL,
                documento_padre_id = NULL,
                documento_relacionado_id = NULL
            WHERE empresa_id = $1
        ' USING v_empresa_id;
    ELSE
        EXECUTE '
            UPDATE public.documentos
            SET documento_origen_id = NULL,
                documento_padre_id = NULL,
                documento_relacionado_id = NULL
            WHERE empresa_id = $1
        ' USING v_empresa_id;
    END IF;

    DELETE FROM public.aplicaciones_saldo
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.finanzas_aplicaciones
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.finanzas_conciliaciones_operaciones fco
    WHERE EXISTS (
        SELECT 1
        FROM public.finanzas_conciliaciones fc
        WHERE fc.id = fco.conciliacion_id
          AND fc.empresa_id = v_empresa_id
    );

    DELETE FROM public.finanzas_conciliaciones
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.finanzas_transferencias
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.finanzas_operaciones
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.credito_operaciones_items coi
    WHERE EXISTS (
        SELECT 1
        FROM public.credito_operaciones co
        WHERE co.id = coi.operacion_credito_id
          AND co.empresa_id = v_empresa_id
    );

    DELETE FROM public.credito_operaciones_aplicaciones
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.credito_operaciones
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.documentos_partidas_impuestos dpi
    WHERE EXISTS (
        SELECT 1
        FROM public.documentos_partidas dp
        JOIN public.documentos d ON d.id = dp.documento_id
        WHERE dp.id = dpi.partida_id
          AND d.empresa_id = v_empresa_id
    );

    DELETE FROM public.documentos_partidas_campos
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.documentos_partidas_vinculos dpv
    WHERE EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.empresa_id = v_empresa_id
          AND (d.id = dpv.documento_origen_id OR d.id = dpv.documento_destino_id)
    );

    DELETE FROM public.documentos_cfdi dcf
    WHERE EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.id = dcf.documento_id
          AND d.empresa_id = v_empresa_id
    );

    DELETE FROM public.documentos_campos
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.documentos_partidas dp
    WHERE EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.id = dp.documento_id
          AND d.empresa_id = v_empresa_id
    );

        DELETE FROM public.documentos
        WHERE empresa_id = v_empresa_id;

    DELETE FROM crm.conversacion_etiquetas
    WHERE empresa_id = v_empresa_id;

    DELETE FROM crm.mensajes
    WHERE empresa_id = v_empresa_id;

    DELETE FROM crm.actividades
    WHERE empresa_id = v_empresa_id;

    DELETE FROM crm.oportunidades_venta
    WHERE empresa_id = v_empresa_id;

    DELETE FROM crm.conversaciones
    WHERE empresa_id = v_empresa_id;

    DELETE FROM produccion.seguimientos
    WHERE empresa_id = v_empresa_id;

    DELETE FROM inventario.movimientos_partidas
    WHERE empresa_id = v_empresa_id;

    DELETE FROM inventario.movimientos
    WHERE empresa_id = v_empresa_id;

    DELETE FROM inventario.existencias
    WHERE empresa_id = v_empresa_id;

    DELETE FROM whatsapp.estadisticas
    WHERE empresa_id = v_empresa_id;

    DELETE FROM whatsapp.intentos_contacto
    WHERE empresa_id = v_empresa_id;

    DELETE FROM public.audit_log
    WHERE empresa_id = v_empresa_id;

    UPDATE public.finanzas_cuentas
    SET saldo = 0,
        saldo_inicial = 0,
        saldo_conciliado = 0,
        fecha_ultima_conciliacion = NULL
    WHERE empresa_id = v_empresa_id;

    INSERT INTO mantenimiento.cleanup_counts_after (
        session_id,
        orden,
        tabla,
        cantidad
    )
    WITH conteos AS (
        SELECT  1 AS orden, 'public.documentos' AS tabla, count(*)::bigint AS cantidad
        FROM public.documentos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT  2, 'public.documentos_partidas', count(*)::bigint
        FROM public.documentos_partidas dp
        JOIN public.documentos d ON d.id = dp.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  3, 'public.documentos_campos', count(*)::bigint
        FROM public.documentos_campos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT  4, 'public.documentos_cfdi', count(*)::bigint
        FROM public.documentos_cfdi dcf
        JOIN public.documentos d ON d.id = dcf.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  5, 'public.documentos_partidas_campos', count(*)::bigint
        FROM public.documentos_partidas_campos dpc
        JOIN public.documentos_partidas dp ON dp.id = dpc.partida_id
        JOIN public.documentos d ON d.id = dp.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  6, 'public.documentos_partidas_impuestos', count(*)::bigint
        FROM public.documentos_partidas_impuestos dpi
        JOIN public.documentos_partidas dp ON dp.id = dpi.partida_id
        JOIN public.documentos d ON d.id = dp.documento_id
        WHERE d.empresa_id = v_empresa_id

        UNION ALL
        SELECT  7, 'public.documentos_partidas_vinculos', count(*)::bigint
        FROM public.documentos_partidas_vinculos dpv
        WHERE EXISTS (
            SELECT 1
            FROM public.documentos d
            WHERE d.empresa_id = v_empresa_id
              AND (d.id = dpv.documento_origen_id OR d.id = dpv.documento_destino_id)
        )

        UNION ALL
        SELECT  8, 'public.aplicaciones_saldo', count(*)::bigint
        FROM public.aplicaciones_saldo
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT  9, 'public.finanzas_aplicaciones', count(*)::bigint
        FROM public.finanzas_aplicaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 10, 'public.finanzas_conciliaciones', count(*)::bigint
        FROM public.finanzas_conciliaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 11, 'public.finanzas_conciliaciones_operaciones', count(*)::bigint
        FROM public.finanzas_conciliaciones_operaciones fco
        WHERE EXISTS (
            SELECT 1
            FROM public.finanzas_conciliaciones fc
            WHERE fc.id = fco.conciliacion_id
              AND fc.empresa_id = v_empresa_id
        )

        UNION ALL
        SELECT 12, 'public.finanzas_transferencias', count(*)::bigint
        FROM public.finanzas_transferencias
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 13, 'public.finanzas_operaciones', count(*)::bigint
        FROM public.finanzas_operaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 14, 'public.credito_operaciones', count(*)::bigint
        FROM public.credito_operaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 15, 'public.credito_operaciones_aplicaciones', count(*)::bigint
        FROM public.credito_operaciones_aplicaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 16, 'public.credito_operaciones_items', count(*)::bigint
        FROM public.credito_operaciones_items coi
        WHERE EXISTS (
            SELECT 1
            FROM public.credito_operaciones co
            WHERE co.id = coi.operacion_credito_id
              AND co.empresa_id = v_empresa_id
        )

        UNION ALL
        SELECT 17, 'inventario.movimientos', count(*)::bigint
        FROM inventario.movimientos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 18, 'inventario.movimientos_partidas', count(*)::bigint
        FROM inventario.movimientos_partidas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 19, 'inventario.existencias', count(*)::bigint
        FROM inventario.existencias
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 20, 'crm.oportunidades_venta', count(*)::bigint
        FROM crm.oportunidades_venta
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 21, 'crm.actividades', count(*)::bigint
        FROM crm.actividades
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 22, 'crm.conversaciones', count(*)::bigint
        FROM crm.conversaciones
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 23, 'crm.conversacion_etiquetas', count(*)::bigint
        FROM crm.conversacion_etiquetas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 24, 'crm.mensajes', count(*)::bigint
        FROM crm.mensajes
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 25, 'produccion.seguimientos', count(*)::bigint
        FROM produccion.seguimientos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 26, 'whatsapp.estadisticas', count(*)::bigint
        FROM whatsapp.estadisticas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 27, 'whatsapp.intentos_contacto', count(*)::bigint
        FROM whatsapp.intentos_contacto
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 28, 'public.audit_log', count(*)::bigint
        FROM public.audit_log
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 29, 'public.contactos', count(*)::bigint
        FROM public.contactos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 30, 'public.contactos_datos_fiscales', count(*)::bigint
        FROM public.contactos_datos_fiscales cdf
        JOIN public.contactos c ON c.id = cdf.contacto_id
        WHERE c.empresa_id = v_empresa_id

        UNION ALL
        SELECT 31, 'public.contactos_domicilios', count(*)::bigint
        FROM public.contactos_domicilios cd
        JOIN public.contactos c ON c.id = cd.contacto_id
        WHERE c.empresa_id = v_empresa_id

        UNION ALL
        SELECT 32, 'public.productos', count(*)::bigint
        FROM public.productos
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 33, 'public.productos_archivos', count(*)::bigint
        FROM public.productos_archivos pa
        JOIN public.productos p ON p.id = pa.producto_id
        WHERE p.empresa_id = v_empresa_id

        UNION ALL
        SELECT 34, 'public.productos_impuestos', count(*)::bigint
        FROM public.productos_impuestos pi
        JOIN public.productos p ON p.id = pi.producto_id
        WHERE p.empresa_id = v_empresa_id

        UNION ALL
        SELECT 35, 'public.precios', count(*)::bigint
        FROM public.precios
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 36, 'public.precios_listas', count(*)::bigint
        FROM public.precios_listas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 37, 'public.unidades', count(*)::bigint
        FROM public.unidades

        UNION ALL
        SELECT 38, 'public.conceptos', count(*)::bigint
        FROM public.conceptos

        UNION ALL
        SELECT 39, 'public.finanzas_cuentas', count(*)::bigint
        FROM public.finanzas_cuentas
        WHERE empresa_id = v_empresa_id

        UNION ALL
        SELECT 40, 'whatsapp.contacto_mapeo', count(*)::bigint
        FROM whatsapp.contacto_mapeo wcm
        JOIN public.contactos c ON c.id = wcm.contacto_id
        WHERE c.empresa_id = v_empresa_id
    )
    SELECT
        v_session_id,
        orden,
        tabla,
        cantidad
    FROM conteos
    ORDER BY orden;
END $$;

SELECT
    orden,
    tabla,
    cantidad
FROM mantenimiento.cleanup_counts_before
WHERE session_id = (
    SELECT session_id
    FROM mantenimiento.cleanup_runs
    WHERE empresa_id = 4
    ORDER BY created_at DESC
    LIMIT 1
)
ORDER BY orden;

SELECT
    orden,
    tabla,
    cantidad
FROM mantenimiento.cleanup_counts_after
WHERE session_id = (
    SELECT session_id
    FROM mantenimiento.cleanup_runs
    WHERE empresa_id = 4
    ORDER BY created_at DESC
    LIMIT 1
)
ORDER BY orden;

SELECT
    b.tabla,
    b.cantidad AS cantidad_antes,
    a.cantidad AS cantidad_despues,
    (b.cantidad = a.cantidad) AS coincide
FROM mantenimiento.cleanup_counts_before b
JOIN mantenimiento.cleanup_counts_after a
    ON a.session_id = b.session_id
   AND a.tabla = b.tabla
WHERE b.tabla IN (
    'public.contactos',
    'public.contactos_datos_fiscales',
    'public.contactos_domicilios',
    'public.productos',
    'public.productos_archivos',
    'public.productos_impuestos',
    'public.precios',
    'public.precios_listas',
    'public.unidades',
    'public.conceptos',
    'public.finanzas_cuentas'
)
    AND b.session_id = (
        SELECT session_id
        FROM mantenimiento.cleanup_runs
        WHERE empresa_id = 4
        ORDER BY created_at DESC
        LIMIT 1
    )
ORDER BY b.tabla;

ROLLBACK;
-- COMMIT;
