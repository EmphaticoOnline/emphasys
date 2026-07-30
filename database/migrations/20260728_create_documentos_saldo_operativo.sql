BEGIN;

CREATE OR REPLACE VIEW public.documentos_saldo_operativo AS
SELECT
  ds.id,
  ds.empresa_id,
  ds.tipo_documento,
  ds.moneda,
  ds.tipo_cambio,
  ds.total,
  ds.saldo AS saldo_registrado,
  CASE
    WHEN LOWER(TRIM(COALESCE(d.estatus_documento, ''))) IN ('cancelado', 'cancelada')
      OR dc.cancelacion_estado = 'cancelada'
      OR intento.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
      OR dc.cancelacion_estado IN ('solicitada', 'pendiente', 'requiere_reconciliacion')
    THEN 0::numeric
    ELSE ds.saldo
  END AS saldo_operativo,
  CASE
    WHEN intento.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
      OR dc.cancelacion_estado IN ('solicitada', 'pendiente', 'requiere_reconciliacion')
    THEN ds.saldo
    ELSE 0::numeric
  END AS saldo_suspendido_cancelacion,
  COALESCE(intento.estado, dc.cancelacion_estado, 'no_solicitada') AS cancelacion_estado_operativo,
  (
    intento.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
    OR dc.cancelacion_estado IN ('solicitada', 'pendiente', 'requiere_reconciliacion', 'cancelada')
    OR LOWER(TRIM(COALESCE(d.estatus_documento, ''))) IN ('cancelado', 'cancelada')
  ) AS cobro_bloqueado
FROM public.documentos_saldo ds
JOIN public.documentos d
  ON d.id = ds.id
 AND d.empresa_id = ds.empresa_id
LEFT JOIN public.documentos_cfdi dc
  ON dc.documento_id = d.id
LEFT JOIN LATERAL (
  SELECT i.estado
  FROM public.documentos_cancelacion_intentos i
  WHERE i.empresa_id = d.empresa_id
    AND i.documento_id = d.id
    AND i.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
  ORDER BY i.created_at DESC, i.id DESC
  LIMIT 1
) intento ON TRUE;

COMMENT ON VIEW public.documentos_saldo_operativo IS
'Conserva el saldo financiero real y deriva el saldo cobrable. Una cancelación activa suspende el cobro sin destruir el saldo registrado.';

COMMIT;
