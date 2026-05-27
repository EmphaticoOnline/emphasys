-- ============================================================================
-- MIGRACION:
-- 20260527_refactor_documentos_saldo_naturaleza.sql
-- ============================================================================

CREATE OR REPLACE VIEW public.documentos_saldo AS

SELECT
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total,

    CASE

        -- ================================================================
        -- DOCUMENTOS DE ABONO
        -- ================================================================

        WHEN td.naturaleza_saldo = 'abono' THEN

            GREATEST(
                0::numeric,
                ABS(COALESCE(d.total, 0::numeric))
                - COALESCE(origen.aplicado_origen_moneda, 0::numeric)
            )

        -- ================================================================
        -- DOCUMENTOS DE CARGO
        -- ================================================================

        WHEN td.naturaleza_saldo = 'cargo' THEN

            GREATEST(
                0::numeric,
                COALESCE(d.total, 0::numeric)
                - COALESCE(destino.aplicado_destino_moneda, 0::numeric)
            )

        -- ================================================================
        -- DOCUMENTOS SIN SALDO
        -- ================================================================

        ELSE 0::numeric

    END AS saldo

FROM documentos d

JOIN core.tipos_documento td
    ON lower(td.codigo::text) = lower(d.tipo_documento::text)

LEFT JOIN (

    SELECT
        a.documento_destino_id AS documento_id,
        a.empresa_id,

        SUM(
            COALESCE(a.monto_moneda_documento, 0::numeric)
        ) AS aplicado_destino_moneda

    FROM aplicaciones_saldo a

    WHERE a.documento_destino_id IS NOT NULL

    GROUP BY
        a.documento_destino_id,
        a.empresa_id

) destino
    ON destino.documento_id = d.id
   AND destino.empresa_id = d.empresa_id

LEFT JOIN (

    SELECT
        a.documento_origen_id AS documento_id,
        a.empresa_id,

        SUM(
            COALESCE(a.monto, 0::numeric)
            / NULLIF(ABS(COALESCE(doc.tipo_cambio, 1::numeric)), 0::numeric)
        ) AS aplicado_origen_moneda

    FROM aplicaciones_saldo a

    JOIN documentos doc
        ON doc.id = a.documento_origen_id
       AND doc.empresa_id = a.empresa_id

    WHERE a.documento_origen_id IS NOT NULL

    GROUP BY
        a.documento_origen_id,
        a.empresa_id

) origen
    ON origen.documento_id = d.id
   AND origen.empresa_id = d.empresa_id;


COMMENT ON VIEW public.documentos_saldo IS
'Vista universal de saldos documentales basada en naturaleza_saldo.';