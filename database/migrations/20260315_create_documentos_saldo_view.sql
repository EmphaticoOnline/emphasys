-- Crea la vista documentos_saldo para compatibilidad con consultas de finanzas
-- Calcula el saldo como total del documento menos las aplicaciones al documento destino
CREATE OR REPLACE VIEW public.documentos_saldo AS
SELECT
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total,
    d.total - COALESCE(SUM(a.monto), 0) AS saldo
FROM public.documentos d
LEFT JOIN public.aplicaciones a
  ON a.documento_destino_id = d.id
 AND a.empresa_id = d.empresa_id
GROUP BY
    d.id,
    d.empresa_id,
    d.tipo_documento,
    d.moneda,
    d.tipo_cambio,
    d.total;

COMMENT ON VIEW public.documentos_saldo IS 'Vista de compatibilidad: id, empresa_id, datos básicos y saldo = total - aplicaciones (COALESCE).';
