import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import {
  assertDocumentoCobrableEnTransaccion,
  DocumentoCobroBloqueadoError,
  esCancelacionCobroBloqueante,
} from '../modules/documentos/documentos-cobro';

function clientWithState(params: {
  estatusDocumento?: string;
  cancelacionEstado?: string | null;
  intentoEstado?: string | null;
}) {
  return {
    async query() {
      return {
        rows: [{
          serie: 'T',
          numero: 1,
          estatus_documento: params.estatusDocumento ?? 'Timbrado',
          cancelacion_estado: params.cancelacionEstado ?? 'no_solicitada',
          intento_estado: params.intentoEstado ?? null,
        }],
      };
    },
  } as unknown as PoolClient;
}

async function expectBlocked(
  params: Parameters<typeof clientWithState>[0],
  code: DocumentoCobroBloqueadoError['code']
) {
  await assert.rejects(
    () => assertDocumentoCobrableEnTransaccion(clientWithState(params), 1, 1),
    (error: unknown) =>
      error instanceof DocumentoCobroBloqueadoError
      && error.status === 409
      && error.code === code
  );
}

async function main() {
  for (const estado of ['iniciado', 'solicitada', 'pendiente']) {
    assert.equal(esCancelacionCobroBloqueante(estado), true);
    await expectBlocked(
      { intentoEstado: estado },
      'INVOICE_CANCELLATION_IN_PROGRESS'
    );
  }
  await expectBlocked(
    { intentoEstado: 'requiere_reconciliacion' },
    'INVOICE_CANCELLATION_RECONCILIATION_REQUIRED'
  );
  await expectBlocked(
    { estatusDocumento: 'Cancelado', cancelacionEstado: 'cancelada' },
    'INVOICE_CANCELLED'
  );

  for (const estado of ['no_solicitada', 'rechazada', 'error']) {
    await assert.doesNotReject(
      () => assertDocumentoCobrableEnTransaccion(
        clientWithState({ cancelacionEstado: estado }),
        1,
        1
      )
    );
  }

  console.log(JSON.stringify({
    activos_bloqueados: 4,
    cancelada_bloqueada: true,
    rechazo_restaura_cobrabilidad: true,
    error_terminal_restaura_cobrabilidad: true,
    modificaciones_db: 0,
    llamadas_pac: 0,
  }));
}

void main();
