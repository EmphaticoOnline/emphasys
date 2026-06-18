-- Vista: progreso de recepción por partida de Orden de Compra
-- No requiere columnas adicionales. Lee documentos_partidas_vinculos + documentos.
-- Solo contabiliza vínculos cuyo destino sea tipo 'recepcion' y no esté cancelada.
-- Los vínculos de recepciones canceladas o eliminadas se excluyen correctamente:
--   · canceladas: d_dest.estatus_documento IN ('cancelado','cancelada') → CASE = 0
--   · eliminadas: d_dest es NULL → comparación LOWER(NULL) = 'recepcion' = FALSE → CASE = 0

CREATE OR REPLACE VIEW public.oc_partidas_recepcion AS
SELECT
  dp_oc.documento_id                            AS oc_id,
  d_oc.empresa_id,
  dp_oc.id                                      AS partida_oc_id,
  dp_oc.producto_id,
  dp_oc.cantidad                                AS cantidad_ordenada,
  COALESCE(SUM(
    CASE
      WHEN LOWER(d_dest.tipo_documento) = 'recepcion'
       AND LOWER(COALESCE(d_dest.estatus_documento, ''))
           NOT IN ('cancelado', 'cancelada')
      THEN dpv.cantidad
      ELSE 0
    END
  ), 0)                                         AS cantidad_recibida,
  dp_oc.cantidad - COALESCE(SUM(
    CASE
      WHEN LOWER(d_dest.tipo_documento) = 'recepcion'
       AND LOWER(COALESCE(d_dest.estatus_documento, ''))
           NOT IN ('cancelado', 'cancelada')
      THEN dpv.cantidad
      ELSE 0
    END
  ), 0)                                         AS cantidad_pendiente
FROM public.documentos_partidas dp_oc
JOIN public.documentos d_oc
  ON d_oc.id = dp_oc.documento_id
 AND LOWER(d_oc.tipo_documento) = 'orden_compra'
LEFT JOIN public.documentos_partidas_vinculos dpv
  ON dpv.documento_origen_id = d_oc.id
 AND dpv.partida_origen_id   = dp_oc.id
LEFT JOIN public.documentos d_dest
  ON d_dest.id = dpv.documento_destino_id
GROUP BY
  dp_oc.documento_id,
  d_oc.empresa_id,
  dp_oc.id,
  dp_oc.producto_id,
  dp_oc.cantidad;

COMMENT ON VIEW public.oc_partidas_recepcion IS
'Progreso de recepción por partida de Orden de Compra. Sin columnas adicionales ni triggers.';
