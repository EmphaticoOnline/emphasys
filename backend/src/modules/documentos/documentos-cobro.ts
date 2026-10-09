import type { PoolClient } from 'pg';

export const ESTADOS_CANCELACION_COBRO_BLOQUEADO = [
  'iniciado',
  'solicitada',
  'pendiente',
  'requiere_reconciliacion',
] as const;

export type EstadoCancelacionCobroBloqueado = typeof ESTADOS_CANCELACION_COBRO_BLOQUEADO[number];

export class DocumentoCobroBloqueadoError extends Error {
  readonly status = 409;

  constructor(
    readonly code:
      | 'INVOICE_CANCELLATION_IN_PROGRESS'
      | 'INVOICE_CANCELLATION_RECONCILIATION_REQUIRED'
      | 'INVOICE_CANCELLED'
      | 'INVOICE_DRAFT',
    message: string
  ) {
    super(message);
    this.name = 'DocumentoCobroBloqueadoError';
  }
}

function esFacturaVentaEstandar(row: {
  tipo_documento?: unknown;
  tratamiento_impuestos?: unknown;
}): boolean {
  return String(row.tipo_documento ?? '').trim().toLowerCase() === 'factura'
    && String(row.tratamiento_impuestos ?? '').trim().toLowerCase() === 'normal';
}

export function esCancelacionCobroBloqueante(value: unknown): boolean {
  return ESTADOS_CANCELACION_COBRO_BLOQUEADO.includes(
    String(value ?? '').trim().toLowerCase() as EstadoCancelacionCobroBloqueado
  );
}

export async function assertDocumentoCobrableEnTransaccion(
  client: PoolClient,
  documentoId: number,
  empresaId: number,
  options: { bloquearBorrador?: boolean } = {}
): Promise<void> {
  const { rows } = await client.query<{
    serie: string | null;
    numero: number | null;
    estatus_documento: string | null;
    tipo_documento: string | null;
    tratamiento_impuestos: string | null;
    cfdi_uuid: string | null;
    cfdi_estado_sat: string | null;
    cfdi_fecha_cancelacion: string | null;
    cfdi_cancelacion_estado: string | null;
    cancelacion_estado: string | null;
    intento_estado: string | null;
  }>(
    `SELECT d.serie, d.numero, d.estatus_documento,
            d.tipo_documento, d.tratamiento_impuestos,
            dc.uuid AS cfdi_uuid,
            dc.estado_sat AS cfdi_estado_sat,
            dc.fecha_cancelacion AS cfdi_fecha_cancelacion,
            dc.cancelacion_estado AS cfdi_cancelacion_estado,
            dc.cancelacion_estado,
            intento.estado AS intento_estado
       FROM documentos d
       LEFT JOIN documentos_cfdi dc ON dc.documento_id = d.id
       LEFT JOIN LATERAL (
         SELECT i.estado
           FROM documentos_cancelacion_intentos i
          WHERE i.empresa_id = d.empresa_id
            AND i.documento_id = d.id
            AND i.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
          ORDER BY i.created_at DESC, i.id DESC
          LIMIT 1
       ) intento ON TRUE
      WHERE d.id = $1 AND d.empresa_id = $2`,
    [documentoId, empresaId]
  );
  const row = rows[0];
  if (!row) return;
  const folio = `${row.serie ? `${row.serie}-` : ''}${row.numero ?? documentoId}`;
  const estatus = String(row.estatus_documento ?? '').trim().toLowerCase();
  if (estatus === 'cancelado' || estatus === 'cancelada' || row.cancelacion_estado === 'cancelada') {
    throw new DocumentoCobroBloqueadoError(
      'INVOICE_CANCELLED',
      `No se puede aplicar el pago a la factura ${folio} porque está cancelada.`
    );
  }
  if (options.bloquearBorrador && estatus === 'borrador') {
    throw new DocumentoCobroBloqueadoError(
      'INVOICE_DRAFT',
      `No se puede aplicar el pago a la factura ${folio} porque está en borrador.`
    );
  }
  const cfdiVigente = Boolean(row.cfdi_uuid)
    && !row.cfdi_fecha_cancelacion
    && !['cancelado', 'cancelada'].includes(String(row.cfdi_estado_sat ?? '').trim().toLowerCase())
    && !['cancelado', 'cancelada'].includes(String(row.cfdi_cancelacion_estado ?? '').trim().toLowerCase());
  if (esFacturaVentaEstandar(row) && !cfdiVigente) {
    throw new DocumentoCobroBloqueadoError(
      'INVOICE_DRAFT',
      `No se puede aplicar el pago a la factura ${folio} porque no tiene un CFDI timbrado y vigente.`
    );
  }
  const estado = String(row.intento_estado || row.cancelacion_estado || '').trim().toLowerCase();
  if (estado === 'requiere_reconciliacion') {
    throw new DocumentoCobroBloqueadoError(
      'INVOICE_CANCELLATION_RECONCILIATION_REQUIRED',
      `No se puede aplicar el pago a la factura ${folio} hasta reconciliar su estado de cancelación.`
    );
  }
  if (esCancelacionCobroBloqueante(estado)) {
    throw new DocumentoCobroBloqueadoError(
      'INVOICE_CANCELLATION_IN_PROGRESS',
      `No se puede aplicar el pago a la factura ${folio} porque su cancelación está pendiente.`
    );
  }
}
