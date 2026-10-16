import assert from 'node:assert/strict';
import {
  addDays,
  cargarEstadoInventario,
  esFechaCivilReal,
  hoyMexico,
  limitarFecha,
  establecerFechaMaxima,
  validarConfig,
  getExist,
} from './seed-demo-empresa-8';

assert.equal(esFechaCivilReal('2026-02-28'), true);
assert.equal(esFechaCivilReal('2026-02-29'), false);
assert.equal(esFechaCivilReal('2026-04-31'), false);

const hoy = hoyMexico();
assert.doesNotThrow(() => validarConfig({
  desde: '2025-01-01', hasta: hoy, ventas: 1, compras: 1, limpiar: false,
  minMovimientosPorProducto: 1, productosAltaRotacion: 1, seed: 'test', tesoreriaDepositos: 0, tesoreriaRetiros: 0,
  tesoreriaTransferencias: 0, tesoreriaCotejados: 0, tesoreriaConciliados: 0, notasVenta: 60, ordenesCompra: 8, pedidos: 8, remisiones: 8, ajustes: 0,
}, [[2025, 1]], hoy));
assert.throws(() => validarConfig({
  desde: '2026-02-29', hasta: hoy, ventas: 1, compras: 1, limpiar: false,
  minMovimientosPorProducto: 1, productosAltaRotacion: 1, seed: 'test', tesoreriaDepositos: 0, tesoreriaRetiros: 0,
  tesoreriaTransferencias: 0, tesoreriaCotejados: 0, tesoreriaConciliados: 0, notasVenta: 60, ordenesCompra: 8, pedidos: 8, remisiones: 8, ajustes: 0,
}, [[2026, 2]], hoy), /fecha civil real/);
assert.throws(() => validarConfig({
  desde: '2999-01-01', hasta: '2999-01-31', ventas: 1, compras: 1, limpiar: false,
  minMovimientosPorProducto: 1, productosAltaRotacion: 1, seed: 'test', tesoreriaDepositos: 0, tesoreriaRetiros: 0,
  tesoreriaTransferencias: 0, tesoreriaCotejados: 0, tesoreriaConciliados: 0, notasVenta: 60, ordenesCompra: 8, pedidos: 8, remisiones: 8, ajustes: 0,
}, [[2999, 1]], hoy), /completamente futuro/);
assert.throws(() => validarConfig({
  desde: '2025-01-01', hasta: hoy, ventas: 1, compras: 1, limpiar: false,
  minMovimientosPorProducto: 1, productosAltaRotacion: 1, seed: 'test', tesoreriaDepositos: -1, tesoreriaRetiros: 0,
  tesoreriaTransferencias: 0, tesoreriaCotejados: 0, tesoreriaConciliados: 0, notasVenta: 60, ordenesCompra: 8, pedidos: 8, remisiones: 8, ajustes: 0,
}, [[2025, 1]], hoy), /entero >= 0/);
assert.throws(() => validarConfig({
  desde: '2025-01-01', hasta: hoy, ventas: 1, compras: 1, limpiar: false,
  minMovimientosPorProducto: 1, productosAltaRotacion: 1, seed: 'test', tesoreriaDepositos: 0, tesoreriaRetiros: 0,
  tesoreriaTransferencias: 0, tesoreriaCotejados: 1, tesoreriaConciliados: 2, notasVenta: 60, ordenesCompra: 8, pedidos: 8, remisiones: 8, ajustes: 0,
}, [[2025, 1]], hoy), /no puede superar/);

// Las fechas derivadas nunca deben rebasar el límite configurado por el proceso.
establecerFechaMaxima(hoy);
assert.equal(addDays(hoy, 30), hoy);
assert.equal(limitarFecha(hoy), hoy);

// Una ejecución sobre datos existentes parte de existencias y conteos reales.
async function main() {
  const respuestas = [
    { rows: [{ producto_id: 101, almacen_id: 40, existencia: '17' }] },
    { rows: [{ producto_id: 101, n: '9' }] },
    { rows: [{ producto_id: 101, almacen_id: 40, fecha: '2025-01-15' }] },
  ];
  const cliente = { query: async () => respuestas.shift() } as any;
  await cargarEstadoInventario(cliente);
  assert.equal(getExist(101, 40), 17);
  console.log('✓ pruebas de fechas y estado preexistente del seed aprobadas');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
