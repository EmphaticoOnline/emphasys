import assert from 'node:assert/strict';
import pool from '../config/database';
import { desaplicarAplicacionDocumental } from '../modules/finanzas/finanzas.repository';

type AplicacionFake = {
  id: number;
  origenId: number;
  destinoId: number;
  origenTipo: string;
  destinoTipo: string;
  origenTotal: number;
  destinoTotal: number;
  monto: number;
  montoMoneda: number;
};

function saldoOrigen(aplicaciones: AplicacionFake[], origenId: number, total: number) {
  const aplicado = aplicaciones
    .filter((item) => item.origenId === origenId)
    .reduce((sum, item) => sum + item.monto, 0);
  return Math.max(0, total - aplicado);
}

function saldoDestino(aplicaciones: AplicacionFake[], destinoId: number, total: number) {
  const aplicado = aplicaciones
    .filter((item) => item.destinoId === destinoId)
    .reduce((sum, item) => sum + item.montoMoneda, 0);
  return Math.max(0, total - aplicado);
}

function fakeClient(iniciales: AplicacionFake[], empresaId = 8) {
  const totales = new Map<number, { total: number; naturaleza: 'abono' | 'cargo' }>();
  for (const item of iniciales) {
    totales.set(item.origenId, { total: item.origenTotal, naturaleza: 'abono' });
    totales.set(item.destinoId, { total: item.destinoTotal, naturaleza: 'cargo' });
  }
  let aplicaciones = iniciales.map((item) => ({ ...item }));
  let committed = false;
  let rolledBack = false;
  let deletes = 0;
  const calls: string[] = [];
  let snapshot = aplicaciones.map((item) => ({ ...item }));

  const query = async (sql: string, params: unknown[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    calls.push(normalized);
    if (/documentos_relaciones|documentos_partidas_vinculos|documentos_partidas\b|UPDATE documentos\b/i.test(normalized)) {
      throw new Error(`La desaplicación no debe tocar documentos ni relaciones: ${normalized}`);
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
    if (normalized.startsWith('SELECT a.*')) {
      const id = Number(params[0]);
      const empresa = Number(params[1]);
      const app = empresa === empresaId ? aplicaciones.find((item) => item.id === id) : undefined;
      if (!app) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          id: app.id,
          documento_origen_id: app.origenId,
          documento_destino_id: app.destinoId,
          monto: app.monto,
          monto_moneda_documento: app.montoMoneda,
          origen_tipo: app.origenTipo,
          destino_tipo: app.destinoTipo,
          origen_total: app.origenTotal,
          destino_total: app.destinoTotal,
        }],
        rowCount: 1,
      };
    }
    if (normalized.startsWith('DELETE FROM aplicaciones_saldo')) {
      const id = Number(params[0]);
      const antes = aplicaciones.length;
      aplicaciones = aplicaciones.filter((item) => item.id !== id);
      const removed = antes - aplicaciones.length;
      deletes += removed;
      return { rows: removed ? [{ id }] : [], rowCount: removed };
    }
    if (normalized.startsWith('SELECT id, saldo_operativo FROM documentos_saldo_operativo')) {
      const ids = params[1] as number[];
      return {
        rows: ids.map((id) => {
          const documento = totales.get(id);
          const saldo = documento?.naturaleza === 'abono'
            ? saldoOrigen(aplicaciones, id, documento.total)
            : saldoDestino(aplicaciones, id, documento?.total ?? 0);
          return { id, saldo_operativo: saldo };
        }),
        rowCount: ids.length,
      };
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
      aplicaciones: aplicaciones.map((item) => ({ ...item })),
      saldoOrigen: (id: number) => saldoOrigen(aplicaciones, id, totales.get(id)?.total ?? 0),
      saldoDestino: (id: number) => saldoDestino(aplicaciones, id, totales.get(id)?.total ?? 0),
    }),
  };
}

const dosAplicaciones = (): AplicacionFake[] => [
  {
    id: 10,
    origenId: 50,
    destinoId: 15,
    origenTipo: 'nota_credito',
    destinoTipo: 'factura',
    origenTotal: 10000,
    destinoTotal: 6000,
    monto: 3000,
    montoMoneda: 3000,
  },
  {
    id: 11,
    origenId: 50,
    destinoId: 21,
    origenTipo: 'nota_credito',
    destinoTipo: 'factura',
    origenTotal: 10000,
    destinoTotal: 8500,
    monto: 4000,
    montoMoneda: 4000,
  },
];

async function main() {
  const originalConnect = pool.connect.bind(pool);
  try {
    const una = fakeClient(dosAplicaciones().slice(0, 1));
    (pool as any).connect = async () => una.client;
    const solo = await desaplicarAplicacionDocumental(10, 8, 4);
    assert.equal(solo.monto_desaplicado, 3000, '1. desaplica la única aplicación');
    assert.equal(una.state().aplicaciones.length, 0, '1. ya no queda aplicación');
    assert.equal(una.state().saldoOrigen(50), 10000, '4. la nota recupera todo su saldo');
    assert.equal(una.state().saldoDestino(15), 6000, '5. la factura recupera su saldo pendiente');
    assert.equal(una.state().committed, true);
    assert.equal(una.state().calls.some((sql) => sql.startsWith('DELETE FROM aplicaciones_saldo')), true);
    assert.equal(
      una.state().calls.some((sql) => /documentos_relaciones|documentos_partidas/.test(sql)),
      false,
      '8-10. no toca relaciones, vínculos ni partidas',
    );

    const varias = fakeClient(dosAplicaciones());
    (pool as any).connect = async () => varias.client;
    const parcial = await desaplicarAplicacionDocumental(10, 8, 4);
    assert.equal(parcial.documento_destino_id, 15, '3. desaplica solo la factura elegida');
    assert.deepEqual(varias.state().aplicaciones.map((item) => item.id), [11], '3. conserva la otra aplicación');
    assert.equal(varias.state().saldoOrigen(50), 6000, '4. la nota recupera solo el importe desaplicado');
    assert.equal(varias.state().saldoDestino(15), 6000, '5. la factura desaplicada recupera su pendiente');
    assert.equal(varias.state().saldoDestino(21), 4500, '3. la otra factura conserva su saldo');
    assert.equal(varias.state().deletes, 1);
    assert.ok(varias.state().saldoOrigen(50) >= 3000, '7. el saldo recuperado vuelve a alcanzar una aplicación de 3000');

    const ajena = fakeClient(dosAplicaciones());
    (pool as any).connect = async () => ajena.client;
    await assert.rejects(
      desaplicarAplicacionDocumental(10, 99, 4),
      (error: any) => error?.status === 404,
    );
    assert.equal(ajena.state().deletes, 0, '11. otra empresa no borra la aplicación');
    assert.equal(ajena.state().rolledBack, true);
    assert.equal(ajena.state().aplicaciones.length, 2);

    const pago = fakeClient([{
      ...dosAplicaciones()[0],
      origenTipo: 'pago_cliente',
      destinoTipo: 'factura',
    }]);
    (pool as any).connect = async () => pago.client;
    await assert.rejects(
      desaplicarAplicacionDocumental(10, 8, 4),
      (error: any) => error?.status === 409 && /documental compatible/.test(String(error?.message ?? '')),
    );
    assert.equal(pago.state().deletes, 0, '11. un pago de cliente no se desaplica por este endpoint');
    assert.equal(pago.state().aplicaciones.length, 1);

    console.log('testDesaplicarAplicacionDocumental: ok');
  } finally {
    pool.connect = originalConnect;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
