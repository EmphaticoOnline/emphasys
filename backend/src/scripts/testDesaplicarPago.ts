import assert from 'node:assert/strict';
import pool from '../config/database';
import { desaplicarPagoCliente } from '../modules/finanzas/finanzas.repository';

type Scenario = {
  app?: boolean;
  latest?: boolean;
  pagoTipo?: string;
  facturaTipo?: string;
  pagoEstado?: string;
  facturaEstado?: string;
  cancelacionPendiente?: boolean;
  cfdi?: boolean;
  poliza?: boolean;
  otras?: number;
  saldoPago?: number;
  saldoFactura?: number;
  failAt?: 'delete' | 'postSaldo';
};

function fakeClient(scenario: Scenario = {}) {
  const calls: string[] = [];
  let deleted = false;
  let audited = false;
  let rolledBack = false;
  let committed = false;
  const app = {
    id: 10,
    empresa_id: 8,
    documento_origen_id: 20,
    documento_destino_id: 30,
    monto: '40.00',
    monto_moneda_documento: '40.00',
    fecha_aplicacion: '2026-07-27T12:00:00Z',
    fecha_creacion: '2026-07-27T12:00:00Z',
    num_parcialidad: 1,
    imp_saldo_ant: '100.000000',
    imp_saldo_insoluto: '60.000000',
  };
  const query = async (sql: string) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    calls.push(normalized);
    if (normalized === 'BEGIN') return { rows: [], rowCount: null };
    if (normalized === 'COMMIT') {
      committed = true;
      return { rows: [], rowCount: null };
    }
    if (normalized === 'ROLLBACK') {
      rolledBack = true;
      deleted = false;
      audited = false;
      return { rows: [], rowCount: null };
    }
    if (normalized.startsWith('SELECT * FROM aplicaciones_saldo')) {
      return { rows: scenario.app === false || deleted ? [] : [app], rowCount: 1 };
    }
    if (normalized.includes('FROM documentos') && normalized.includes('ORDER BY id')) {
      return {
        rows: [
          { id: 20, empresa_id: 8, tipo_documento: scenario.pagoTipo ?? 'pago_cliente', estatus_documento: scenario.pagoEstado ?? 'emitido', total: '100', serie: 'P', numero: 1 },
          { id: 30, empresa_id: 8, tipo_documento: scenario.facturaTipo ?? 'factura', estatus_documento: scenario.facturaEstado ?? 'timbrado', total: '100', serie: 'F', numero: 1 },
        ],
        rowCount: 2,
      };
    }
    if (normalized.includes('ORDER BY fecha_aplicacion DESC')) {
      return { rows: [{ id: scenario.latest === false ? 11 : 10 }], rowCount: 1 };
    }
    if (normalized.includes('FROM documentos_cancelacion_intentos')) {
      return { rows: [{ existe: Boolean(scenario.cancelacionPendiente) }], rowCount: 1 };
    }
    if (normalized.startsWith('SELECT uuid FROM documentos_cfdi')) {
      return { rows: scenario.cfdi ? [{ uuid: 'uuid-timbrado' }] : [], rowCount: scenario.cfdi ? 1 : 0 };
    }
    if (normalized.includes('FROM contabilidad.documentos_polizas')) {
      return { rows: [{ existe: Boolean(scenario.poliza) }], rowCount: 1 };
    }
    if (normalized.startsWith('SELECT id, saldo FROM documentos_saldo')) {
      if (deleted && scenario.failAt === 'postSaldo') throw new Error('fallo simulado después del DELETE');
      return {
        rows: [
          { id: 20, saldo: String(deleted ? scenario.saldoPago ?? 100 : 60) },
          { id: 30, saldo: String(deleted ? scenario.saldoFactura ?? 100 : 60) },
        ],
        rowCount: 2,
      };
    }
    if (normalized.startsWith('SELECT COUNT(*) AS cantidad FROM aplicaciones_saldo')) {
      return { rows: [{ cantidad: String(scenario.otras ?? 0) }], rowCount: 1 };
    }
    if (normalized.startsWith('INSERT INTO finanzas_desaplicaciones_pago')) {
      audited = true;
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith('DELETE FROM aplicaciones_saldo')) {
      if (scenario.failAt === 'delete') throw new Error('fallo simulado antes del DELETE');
      deleted = true;
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`SQL no simulado: ${normalized}`);
  };
  return {
    client: { query, release() {} },
    state: () => ({ calls, deleted, audited, rolledBack, committed }),
  };
}

async function runScenario(scenario: Scenario = {}) {
  const fake = fakeClient(scenario);
  (pool as any).connect = async () => fake.client;
  const result = await desaplicarPagoCliente(10, 8, {
    usuarioId: 99,
    motivo: 'Corrección de aplicación capturada por error',
  });
  return { result, state: fake.state() };
}

async function expectConflict(scenario: Scenario, message: RegExp) {
  const fake = fakeClient(scenario);
  (pool as any).connect = async () => fake.client;
  await assert.rejects(
    desaplicarPagoCliente(10, 8, { usuarioId: 99, motivo: 'Corrección de aplicación capturada por error' }),
    (error: any) => error?.status === 409 && message.test(error.message)
  );
  assert.equal(fake.state().rolledBack, true);
  assert.equal(fake.state().committed, false);
}

async function main() {
  const originalConnect = pool.connect.bind(pool);
  try {
    const success = await runScenario({ otras: 2 });
    assert.equal(success.result.aplicacion.id, 10, 'desaplica la aplicación seleccionada');
    assert.equal(success.result.pago.saldo_disponible, 100, 'recupera saldo del pago');
    assert.equal(success.result.factura.saldo_pendiente, 100, 'aumenta saldo de factura');
    assert.equal(success.state.committed, true, 'confirma una sola transacción');
    assert.equal(success.state.audited, true, 'inserta bitácora');
    assert.equal(success.state.deleted, true, 'borra físicamente la aplicación');
    assert.match(success.result.pago.folio, /^P1$/, 'devuelve folio de pago');
    assert.match(success.result.factura.folio, /^F1$/, 'devuelve folio de factura');

    const sinMotivo = fakeClient();
    (pool as any).connect = async () => sinMotivo.client;
    await desaplicarPagoCliente(10, 8, { usuarioId: 99, motivo: null });
    assert.equal(sinMotivo.state().committed, true, 'permite desaplicar sin motivo');

    await expectConflict({ latest: false }, /más reciente/);
    await expectConflict({ cfdi: true }, /complemento de pago timbrado/);
    await expectConflict({ pagoEstado: 'Cancelado' }, /pago está cancelado/);
    await expectConflict({ facturaEstado: 'cancelada' }, /factura está cancelada/);
    await expectConflict({ poliza: true }, /póliza contable aplicada/);
    await expectConflict({ cancelacionPendiente: true }, /cancelación CFDI pendiente/);
    await expectConflict({ pagoTipo: 'nota_credito' }, /no corresponde/);
    await expectConflict({ facturaTipo: 'factura_compra' }, /no corresponde/);
    await expectConflict({ saldoPago: 101 }, /saldos inconsistentes/);
    await expectConflict({ saldoFactura: 101 }, /saldos inconsistentes/);

    const missing = fakeClient({ app: false });
    (pool as any).connect = async () => missing.client;
    await assert.rejects(
      desaplicarPagoCliente(10, 8, { usuarioId: 99, motivo: 'Corrección de aplicación capturada por error' }),
      (error: any) => error?.status === 404
    );

    for (const failAt of ['delete', 'postSaldo'] as const) {
      const failed = fakeClient({ failAt });
      (pool as any).connect = async () => failed.client;
      await assert.rejects(
        desaplicarPagoCliente(10, 8, { usuarioId: 99, motivo: 'Corrección de aplicación capturada por error' })
      );
      assert.equal(failed.state().rolledBack, true, `rollback en ${failAt}`);
      assert.equal(failed.state().deleted, false, `restaura DELETE en ${failAt}`);
      assert.equal(failed.state().audited, false, `restaura bitácora en ${failAt}`);
    }

    console.log('OK: 20 comprobaciones aisladas de desaplicación completadas sin conexión a base de datos.');
  } finally {
    (pool as any).connect = originalConnect;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
