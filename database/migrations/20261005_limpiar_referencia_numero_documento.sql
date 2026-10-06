-- La sincronización de pagos copiaba documentos.numero a finanzas_operaciones.referencia
-- cuando el pago no traía una referencia bancaria. Ese número secuencial no es referencia.
-- El folio del documento sigue disponible por el join (serie + numero).

UPDATE finanzas_operaciones fo
   SET referencia = NULL
  FROM documentos d
 WHERE d.id = fo.documento_origen_id
   AND d.empresa_id = fo.empresa_id
   AND btrim(fo.referencia) = d.numero::text;
