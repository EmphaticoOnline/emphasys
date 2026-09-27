import assert from 'node:assert/strict';
import pool from '../config/database';
import { evaluarNotaCreditoElegibleParaAplicacion } from '../modules/finanzas/aplicaciones-saldo.rules';
import { aplicarDistribucionSaldoNotaCredito } from '../modules/finanzas/finanzas.repository';

type FacturaFake = {
  total: number;
  aplicado: number;
  contacto: number;
  estatus: string;
};

type NotaFake = {
  estatus: string;
  tratamiento: string;
  uuid: string | null;
  estadoSat: string | null;
  fechaCancelacion: string | null;
  cancelacionEstado: string | null;
  total: number;
  tipoCambio: number;
  contacto: number;
  existe: boolean;
};

type Scenario = {
  nota?: Partial<NotaFake>;
  facturas?: Record<number, Partial<FacturaFake>>;
  aplicadoPrevio?: number;
  aplicaciones: Array<{ destino: number; monto: number; montoMoneda?: number }>;
};

const baseNota = (): NotaFake => ({
  estatus: 'timbrado',
  tratamiento: 'normal',
  uuid: '11111111-1111-1111-1111-111111111111',
  estadoSat: 'vigente',
  fechaCancelacion: null,
  cancelacionEstado: null,
  total: 10000,
  tipoCambio: 1,
  contacto: 9,
  existe: true,
});

function fakeClient(scenario: Scenario) {
  const nota = { ...baseNota(), ...scenario.nota };
  const facturas = new Map<number, FacturaFake>();
  for (const [id, factura] of Object.entries(scenario.facturas ?? {
    15: { total: 6000 },
    21: { total: 8500 },
  })) {
    facturas.set(Number(id), {
      total: 0,
      aplicado: 0,
      contacto: nota.contacto,
      estatus: 'timbrado',
      ...factura,
    });
  }

  let aplicadoOrigen = scenario.aplicadoPrevio ?? 0;
  let inserts = 0;
  let committed = false;
  let rolledBack = false;
  const calls: string[] = [];
  let snapshot = { aplicadoOrigen, inserts, aplicados: new Map<number, number>() };

  const tomarSnapshot = () => {
    snapshot = {
      aplicadoOrigen,
      inserts,
      aplicados: new Map([...facturas.entries()].map(([id, factura]) => [id, factura.aplicado])),
    };
  };
  const restaurar = () => {
    aplicadoOrigen = snapshot.aplicadoOrigen;
    inserts = snapshot.inserts;
    for (const [id, aplicado] of snapshot.aplicados) {
      const factura = facturas.get(id);
      if (factura) factura.aplicado = aplicado;
    }
  };

  const query = async (sql: string, params: unknown[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    calls.push(normalized);
    if (/documentos_relaciones|documentos_partidas_vinculos|documentos_partidas\b|UPDATE documentos\b/i.test(normalized)) {
      throw new Error(`La aplicación no debe tocar origen documental: ${normalized}`);
    }
    if (normalized === 'BEGIN') {
      tomarSnapshot();
      return { rows: [], rowCount: null };
    }
    if (normalized === 'COMMIT') {
      committed = true;
      return { rows: [], rowCount: null };
    }
    if (normalized === 'ROLLBACK') {
      rolledBack = true;
      committed = false;
      restaurar();
      return { rows: [], rowCount: null };
    }
    if (normalized.startsWith('SELECT id FROM documentos') && normalized.includes("tipo_documento IN ('factura', 'factura_compra')")) {
      const factura = facturas.get(Number(params[1]));
      return { rows: factura ? [{ id: Number(params[1]) }] : [], rowCount: factura ? 1 : 0 };
    }
    if (normalized.startsWith('SELECT id, tipo_documento FROM documentos')) {
      return {
        rows: nota.existe ? [{ id: Number(params[0]), tipo_documento: 'nota_credito' }] : [],
        rowCount: nota.existe ? 1 : 0,
      };
    }
    if (normalized.includes('AS contacto_id') && normalized.includes("tipo_documento IN ('factura', 'factura_compra')")) {
      const factura = facturas.get(Number(params[0]));
      if (!factura) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          id: Number(params[0]),
          empresa_id: 8,
          contacto_id: factura.contacto,
          tipo_documento: 'factura',
          moneda: 'MXN',
          tipo_cambio: 1,
          total: factura.total,
        }],
        rowCount: 1,
      };
    }
    if (normalized.includes('intento_estado')) {
      const factura = facturas.get(Number(params[0]));
      return {
        rows: [{
          serie: 'A',
          numero: Number(params[0]),
          estatus_documento: factura?.estatus ?? 'timbrado',
          cancelacion_estado: null,
          intento_estado: null,
        }],
        rowCount: 1,
      };
    }
    if (normalized.includes('AS contacto_id') && normalized.includes("'nota_credito'")) {
      if (!nota.existe) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          id: Number(params[0]),
          empresa_id: 8,
          contacto_id: nota.contacto,
          tipo_documento: 'nota_credito',
          moneda: 'MXN',
          tipo_cambio: nota.tipoCambio,
          total: nota.total,
        }],
        rowCount: 1,
      };
    }
    if (normalized.includes('tratamiento_impuestos')) {
      if (!nota.existe) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          estatus_documento: nota.estatus,
          tratamiento_impuestos: nota.tratamiento,
          uuid: nota.uuid,
          estado_sat: nota.estadoSat,
          fecha_cancelacion: nota.fechaCancelacion,
          cancelacion_estado: nota.cancelacionEstado,
        }],
        rowCount: 1,
      };
    }
    if (normalized.includes('aplicado_origen_base')) {
      return { rows: [{ aplicado_origen_base: aplicadoOrigen }], rowCount: 1 };
    }
    if (normalized.includes('aplicado_destino')) {
      const factura = facturas.get(Number(params[0]));
      return { rows: [{ aplicado_destino: factura?.aplicado ?? 0 }], rowCount: 1 };
    }
    if (normalized.includes('AS cnt')) {
      return { rows: [{ cnt: '0' }], rowCount: 1 };
    }
    if (normalized.startsWith('INSERT INTO aplicaciones_saldo')) {
      const destinoId = Number(params[2]);
      const monto = Number(params[3]);
      const montoMoneda = Number(params[4]);
      const factura = facturas.get(destinoId);
      if (!factura) throw new Error('insert sin factura');
      factura.aplicado += montoMoneda;
      aplicadoOrigen += monto;
      inserts += 1;
      return { rows: [{ id: inserts, documento_destino_id: destinoId, monto, monto_moneda_documento: montoMoneda }], rowCount: 1 };
    }
    throw new Error(`SQL no simulado: ${normalized}`);
  };

  return {
    client: { query, release() {} },
    state: () => ({ calls, inserts, committed, rolledBack, aplicadoOrigen }),
  };
}

async function aplicar(scenario: Scenario) {
  const fake = fakeClient(scenario);
  (pool as any).connect = async () => fake.client;
  const result = await aplicarDistribucionSaldoNotaCredito({
    documento_origen_id: 50,
    aplicaciones: scenario.aplicaciones.map((item) => ({
      documento_destino_id: item.destino,
      monto: item.monto,
      monto_moneda_documento: item.montoMoneda ?? item.monto,
      fecha_aplicacion: '2026-09-26',
    })),
    created_by: 1,
  }, 8);
  return { result, state: fake.state() };
}

async function rechaza(scenario: Scenario, status: number, message: RegExp) {
  const fake = fakeClient(scenario);
  (pool as any).connect = async () => fake.client;
  await assert.rejects(
    aplicarDistribucionSaldoNotaCredito({
      documento_origen_id: 50,
      aplicaciones: scenario.aplicaciones.map((item) => ({
        documento_destino_id: item.destino,
        monto: item.monto,
        monto_moneda_documento: item.montoMoneda ?? item.monto,
      })),
    }, 8),
    (error: any) => error?.status === status && message.test(String(error?.message ?? '')),
  );
  return fake.state();
}

function evaluarCasos() {
  const vigente = {
    estatus_documento: 'timbrado',
    tratamiento_impuestos: 'normal',
    uuid: 'abc',
    estado_sat: 'vigente',
    fecha_cancelacion: null,
    cancelacion_estado: null,
  };
  assert.equal(evaluarNotaCreditoElegibleParaAplicacion(vigente).ok, true, '1. fiscal timbrada vigente');
  assert.equal(evaluarNotaCreditoElegibleParaAplicacion({
    estatus_documento: 'emitido',
    tratamiento_impuestos: 'sin_iva',
    uuid: null,
    estado_sat: null,
    fecha_cancelacion: null,
    cancelacion_estado: null,
  }).ok, true, '2. sin IVA emitida');
  const borrador = evaluarNotaCreditoElegibleParaAplicacion({ ...vigente, estatus_documento: 'borrador' });
  assert.equal(borrador.ok, false, '3. borrador');
  if (!borrador.ok) assert.equal(borrador.code, 'NC_NO_TIMBRADA');
  const sinTimbrar = evaluarNotaCreditoElegibleParaAplicacion({ ...vigente, estatus_documento: 'emitido', uuid: null });
  assert.equal(sinTimbrar.ok, false, '4. fiscal sin timbrar');
  if (!sinTimbrar.ok) assert.equal(sinTimbrar.code, 'NC_NO_TIMBRADA');
  const cancelada = evaluarNotaCreditoElegibleParaAplicacion({ ...vigente, estatus_documento: 'cancelado' });
  assert.equal(cancelada.ok, false, '5. cancelada');
  if (!cancelada.ok) assert.equal(cancelada.code, 'NC_CANCELADA');
  const cfdiCancelado = evaluarNotaCreditoElegibleParaAplicacion({ ...vigente, fecha_cancelacion: '2026-09-01' });
  assert.equal(cfdiCancelado.ok, false, 'CFDI cancelado');
  if (!cfdiCancelado.ok) assert.equal(cfdiCancelado.code, 'NC_NO_TIMBRADA');
}

async function main() {
  const originalConnect = pool.connect.bind(pool);
  try {
    evaluarCasos();

    const distribuida = await aplicar({
      aplicaciones: [
        { destino: 15, monto: 6000 },
        { destino: 21, monto: 4000 },
      ],
    });
    assert.equal(distribuida.result.length, 2, '9. crea las dos aplicaciones');
    assert.equal(distribuida.state.committed, true, '9. una sola transacción');
    assert.equal(distribuida.state.inserts, 2);
    assert.equal(distribuida.state.calls.some((sql) => /documentos_relaciones|documentos_partidas/.test(sql)), false, '15. no altera relaciones ni vínculos');

    const parcial = await aplicar({ aplicaciones: [{ destino: 15, monto: 3000 }] });
    assert.equal(parcial.result.length, 1, '7. aplicación parcial');
    assert.equal(parcial.state.committed, true);
    assert.equal(Number(parcial.result[0].monto_moneda_documento), 3000);

    const completa = await aplicar({ aplicaciones: [{ destino: 15, monto: 6000 }] });
    assert.equal(completa.state.committed, true, '8. aplicación completa a una factura');
    assert.equal(completa.state.inserts, 1);

    const previa = await aplicar({
      aplicadoPrevio: 3000,
      aplicaciones: [{ destino: 21, monto: 4000 }],
    });
    assert.equal(previa.state.committed, true, '12. aplicación previa más nueva');
    assert.equal(previa.state.aplicadoOrigen, 7000);

    const excedeFactura = await rechaza(
      { aplicaciones: [{ destino: 15, monto: 6000.01 }] },
      409,
      /excede el saldo del destino/i,
    );
    assert.equal(excedeFactura.committed, false, '10. rechaza tope de factura');
    assert.equal(excedeFactura.rolledBack, true);
    assert.equal(excedeFactura.inserts, 0, '10. no conserva la aplicación rechazada');

    const excedeNota = await rechaza(
      {
        aplicaciones: [
          { destino: 15, monto: 6000 },
          { destino: 21, monto: 5000 },
        ],
      },
      409,
      /excede el saldo del origen/i,
    );
    assert.equal(excedeNota.committed, false, '11. rechaza tope de la nota');
    assert.equal(excedeNota.rolledBack, true);
    assert.equal(excedeNota.inserts, 0, '11. revierte también la primera factura');

    const borrador = await rechaza(
      { nota: { estatus: 'borrador' }, aplicaciones: [{ destino: 15, monto: 100 }] },
      409,
      /timbrada y vigente/i,
    );
    assert.equal(borrador.inserts, 0, '3. borrador no inserta');

    const sinIva = await aplicar({
      nota: { estatus: 'emitido', tratamiento: 'sin_iva', uuid: null, total: 1000 },
      facturas: { 15: { total: 1000 } },
      aplicaciones: [{ destino: 15, monto: 250 }],
    });
    assert.equal(sinIva.state.committed, true, '2. sin IVA emitida puede aplicar');

    const repetida = fakeClient({ aplicaciones: [] });
    (pool as any).connect = async () => {
      throw new Error('no debe abrir transacción');
    };
    await assert.rejects(
      aplicarDistribucionSaldoNotaCredito({
        documento_origen_id: 50,
        aplicaciones: [
          { documento_destino_id: 15, monto: 10, monto_moneda_documento: 10 },
          { documento_destino_id: 15, monto: 10, monto_moneda_documento: 10 },
        ],
      }, 8),
      (error: any) => error?.status === 400 && /repite una factura/.test(error.message),
    );
    assert.equal(repetida.state().inserts, 0);

    console.log('testAplicarSaldoNotaCredito: ok');
  } finally {
    pool.connect = originalConnect;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
