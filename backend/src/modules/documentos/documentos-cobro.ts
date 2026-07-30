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
      | 'INVOICE_CANCELLED',
    message: string
  ) {
    super(message);
    this.name = 'DocumentoCobroBloqueadoError';
  }
}

export function esCancelacionCobroBloqueante(value: unknown): boolean {
  return ESTADOS_CANCELACION_COBRO_BLOQUEADO.includes(
    String(value ?? '').trim().toLowerCase() as EstadoCancelacionCobroBloqueado
  );
}

export async function assertDocumentoCobrableEnTransaccion(
  client: PoolClient,
  documentoId: number,
  empresaId: number
): Promise<void> {
  const { rows } = await client.query<{
    serie: string | null;
    numero: number | null;
    estatus_documento: string | null;
    cancelacion_estado: string | null;
    intento_estado: string | null;
  }>(
    `SELECT d.serie, d.numero, d.estatus_documento,
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
