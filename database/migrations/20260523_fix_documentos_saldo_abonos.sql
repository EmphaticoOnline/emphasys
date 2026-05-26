-- Corrige la semántica de saldo para documentos de cargo vs abono.
-- Cargo: saldo pendiente = total - aplicaciones recibidas en moneda del documento destino.
-- Abono: saldo disponible = abs(total) - aplicaciones generadas desde el documento, convertidas a moneda del origen.

CREATE OR REPLACE VIEW public.documentos_saldo AS
SELECT
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total,
    CASE
        WHEN LOWER(COALESCE(d.tipo_documento, '')) IN ('nota_credito', 'nota_credito_compra') THEN
            GREATEST(
                0::numeric,
                ABS(COALESCE(d.total, 0::numeric)) - COALESCE(origen.aplicado_origen_moneda, 0::numeric)
            )
        ELSE
            GREATEST(
                0::numeric,
                COALESCE(d.total, 0::numeric) - COALESCE(destino.aplicado_destino_moneda, 0::numeric)
            )
    END AS saldo
FROM public.documentos d
LEFT JOIN (
    SELECT
        a.documento_destino_id AS documento_id,
        a.empresa_id,
        SUM(COALESCE(a.monto_moneda_documento, 0::numeric)) AS aplicado_destino_moneda
    FROM public.aplicaciones_saldo a
    WHERE a.documento_destino_id IS NOT NULL
    GROUP BY a.documento_destino_id, a.empresa_id
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
    FROM public.aplicaciones_saldo a
    JOIN public.documentos doc
      ON doc.id = a.documento_origen_id
     AND doc.empresa_id = a.empresa_id
    WHERE a.documento_origen_id IS NOT NULL
    GROUP BY a.documento_origen_id, a.empresa_id
) origen
    ON origen.documento_id = d.id
   AND origen.empresa_id = d.empresa_id;

COMMENT ON VIEW public.documentos_saldo IS 'Saldo financiero por documento: cargos restan aplicaciones recibidas; abonos restan aplicaciones emitidas desde el origen.';