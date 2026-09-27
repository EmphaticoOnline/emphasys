import assert from 'node:assert/strict';
import pool from '../config/database';
import { aplicarDistribucionSaldoNotaCredito } from '../modules/finanzas/finanzas.repository';

type AppFake = {
  id: number;
  destino: number;
  monto: number;
  origenTipo: string;
  destinoTipo: string;
};

function fakeClient(iniciales: AppFake[]) {
  const facturas = new Map<number, number>([[15, 6000], [21, 8500]]);
  let aplicaciones = iniciales.map((item) => ({ ...item }));
  let nextId = Math.max(0, ...aplicaciones.map((item) => item.id)) + 1;
  let committed = false;
  let rolledBack = false;
  let deletes = 0;
  let inserts = 0;
  const calls: string[] = [];
  let snapshot = aplicaciones.map((item) => ({ ...item }));

  const aplicadoOrigen = () => aplicaciones.reduce((sum, item) => sum + item.monto, 0);
  const aplicadoDestino = (id: number) => aplicaciones
    .filter((item) => item.destino === id)
    .reduce((sum, item) => sum + item.monto, 0);

  const query = async (sql: string, params: unknown[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    calls.push(normalized);
    if (/documentos_relaciones|documentos_partidas_vinculos|documentos_partidas\b|UPDATE documentos\b/i.test(normalized)) {
      throw new Error(`El guardado no debe tocar documentos ni relaciones: ${normalized}`);
    }
    if (normalized === 'BEGIN') {
      snapshot = aplicaciones.map((item) => ({ ...item }));
      return { rows: [], rowCount: null };
    }
    if (normalized === 'COMMIT') {
      committed = true;
      return { rows: [], rowCount: null };
    }
    if (normalized === 'ROLLBACK') {
      rolledBack = true;
      committed = false;
      aplicaciones = snapshot.map((item) => ({ ...item }));
      return { rows: [], rowCount: null };
    }
    if (normalized.startsWith('SELECT id, documento_destino_id')) {
      const ids = params[2] as number[];
      const rows = aplicaciones.filter((item) => ids.includes(item.id));
      return { rows: rows.map((item) => ({ id: item.id, documento_destino_id: item.destino })), rowCount: rows.length };
    }
    if (normalized.startsWith('SELECT id FROM documentos')) {
      const destino = Number(params[1]);
      return { rows: facturas.has(destino) ? [{ id: destino }] : [], rowCount: facturas.has(destino) ? 1 : 0 };
    }
    if (normalized.startsWith('SELECT id, tipo_documento FROM documentos')) {
      return { rows: [{ id: 50, tipo_documento: 'nota_credito' }], rowCount: 1 };
    }
    if (normalized.includes('FOR UPDATE OF a')) {
      const ids = params[2] as number[];
      const rows = aplicaciones.filter((item) => ids.includes(item.id));
      return {
        rows: rows.map((item) => ({ id: item.id, origen_tipo: item.origenTipo, destino_tipo: item.destinoTipo })),
        rowCount: rows.length,
      };
    }
    if (normalized.startsWith('DELETE FROM aplicaciones_saldo')) {
      const ids = params[2] as number[];
      const antes = aplicaciones.length;
      aplicaciones = aplicaciones.filter((item) => !ids.includes(item.id));
      deletes += antes - aplicaciones.length;
      return { rows: [], rowCount: antes - aplicaciones.length };
    }
    if (normalized.includes('AS contacto_id') && normalized.includes("tipo_documento IN ('factura', 'factura_compra')")) {
      const destino = Number(params[0]);
      return {
        rows: [{
          id: destino,
          empresa_id: 8,
          contacto_id: 9,
          tipo_documento: 'factura',
          moneda: 'MXN',
          tipo_cambio: 1,
          total: facturas.get(destino) ?? 0,
        }],
        rowCount: 1,
      };
    }
    if (normalized.includes('intento_estado')) {
      return { rows: [{ serie: 'A', numero: 1, estatus_documento: 'timbrado', cancelacion_estado: null, intento_estado: null }], rowCount: 1 };
    }
    if (normalized.includes('AS contacto_id') && normalized.includes("'nota_credito'")) {
      return {
        rows: [{
          id: 50,
          empresa_id: 8,
          contacto_id: 9,
          tipo_documento: 'nota_credito',
          moneda: 'MXN',
          tipo_cambio: 1,
          total: 10000,
        }],
        rowCount: 1,
      };
    }
    if (normalized.includes('tratamiento_impuestos')) {
      return {
        rows: [{
          estatus_documento: 'timbrado',
          tratamiento_impuestos: 'normal',
          uuid: '11111111-1111-1111-1111-111111111111',
          estado_sat: 'vigente',
          fecha_cancelacion: null,
          cancelacion_estado: null,
        }],
        rowCount: 1,
      };
    }
    if (normalized.includes('aplicado_origen_base')) {
      return { rows: [{ aplicado_origen_base: aplicadoOrigen() }], rowCount: 1 };
    }
    if (normalized.includes('aplicado_destino')) {
      return { rows: [{ aplicado_destino: aplicadoDestino(Number(params[0])) }], rowCount: 1 };
    }
    if (normalized.includes('AS cnt')) {
      return { rows: [{ cnt: String(aplicaciones.filter((item) => item.destino === Number(params[0])).length) }], rowCount: 1 };
    }
    if (normalized.startsWith('INSERT INTO aplicaciones_saldo')) {
      const destino = Number(params[2]);
      const monto = Number(params[3]);
      aplicaciones.push({
        id: nextId,
        destino,
        monto,
        origenTipo: 'nota_credito',
        destinoTipo: 'factura',
      });
      nextId += 1;
      inserts += 1;
      return { rows: [{ id: nextId - 1, documento_destino_id: destino, monto }], rowCount: 1 };
    }
    throw new Error(`SQL no simulado: ${normalized}`);
  };

  return {
    client: { query, release() {} },
    state: () => ({
      calls,
      committed,
      rolledBack,
      deletes,
      inserts,
      aplicaciones: aplicaciones.map((item) => item.id),
      aplicadoOrigen: aplicadoOrigen(),
    }),
  };
}

const iniciales = (): AppFake[] => [
  { id: 10, destino: 15, monto: 3000, origenTipo: 'nota_credito', destinoTipo: 'factura' },
  { id: 11, destino: 21, monto: 4000, origenTipo: 'nota_credito', destinoTipo: 'factura' },
];

async function guardar(quitar: number[], aplicaciones: Array<{ destino: number; monto: number }>, apps = iniciales()) {
  const fake = fakeClient(apps);
  (pool as any).connect = async () => fake.client;
  const result = await aplicarDistribucionSaldoNotaCredito({
    documento_origen_id: 50,
    quitar,
    aplicaciones: aplicaciones.map((item) => ({
      documento_destino_id: item.destino,
      monto: item.monto,
      monto_moneda_documento: item.monto,
      fecha_aplicacion: '2026-09-26',
    })),
    created_by: 1,
  }, 8);
  return { result, state: fake.state() };
}

async function main() {
  const originalConnect = pool.connect.bind(pool);
  try {
    const soloQuitar = await guardar([10], []);
    assert.equal(soloQuitar.state.committed, true, 'quitar una aplicación confirma');
    assert.equal(soloQuitar.state.deletes, 1);
    assert.equal(soloQuitar.state.inserts, 0);
    assert.deepEqual(soloQuitar.state.aplicaciones, [11], 'conserva la otra aplicación');
    assert.equal(soloQuitar.state.aplicadoOrigen, 4000, 'la nota recupera 3000');
    assert.equal(soloQuitar.state.calls.filter((sql) => sql === 'COMMIT').length, 1);
    assert.equal(soloQuitar.state.calls.some((sql) => /documentos_relaciones|documentos_partidas/.test(sql)), false);

    const mixta = await guardar([10], [{ destino: 21, monto: 1000 }]);
    assert.equal(mixta.state.committed, true, 'quitar y crear van en la misma transacción');
    assert.equal(mixta.state.deletes, 1);
    assert.equal(mixta.state.inserts, 1);
    assert.equal(mixta.result.length, 1);
    assert.equal(mixta.state.aplicadoOrigen, 5000, '4000 conservados más 1000 nuevos');
    assert.equal(mixta.state.calls.indexOf('COMMIT') > mixta.state.calls.findIndex((sql) => sql.startsWith('DELETE')), true);

    const excede = fakeClient(iniciales());
    (pool as any).connect = async () => excede.client;
    await assert.rejects(
      aplicarDistribucionSaldoNotaCredito({
        documento_origen_id: 50,
        quitar: [10],
        aplicaciones: [{ documento_destino_id: 21, monto: 7000, monto_moneda_documento: 7000 }],
        created_by: 1,
      }, 8),
      (error: any) => error?.status === 409,
    );
    assert.equal(excede.state().rolledBack, true, 'si la alta falla, la quita también se revierte');
    assert.equal(excede.state().committed, false);
    assert.deepEqual(excede.state().aplicaciones, [10, 11]);
    assert.equal(excede.state().inserts, 0);

    const ajena = fakeClient(iniciales());
    (pool as any).connect = async () => ajena.client;
    await assert.rejects(
      aplicarDistribucionSaldoNotaCredito({
        documento_origen_id: 50,
        quitar: [99],
        aplicaciones: [],
        created_by: 1,
      }, 8),
      (error: any) => error?.status === 409,
    );
    assert.deepEqual(ajena.state().aplicaciones, [10, 11], 'una aplicación ajena no se borra');

    console.log('testGuardarSaldoNotaCredito: ok');
  } finally {
    pool.connect = originalConnect;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
