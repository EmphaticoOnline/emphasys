import assert from 'node:assert/strict';
import test from 'node:test';
import { aniosDisponibles, etiquetaPeriodo, moverPeriodo, ultimoPeriodoConDatos } from './periodoSelector.utils.ts';

test('las flechas cruzan de año', () => {
  assert.deepEqual(moverPeriodo({ anio: 2026, mes: 1 }, -1), { anio: 2025, mes: 12 });
  assert.deepEqual(moverPeriodo({ anio: 2025, mes: 12 }, 1), { anio: 2026, mes: 1 });
  assert.deepEqual(moverPeriodo({ anio: 2026, mes: 10 }, 1), { anio: 2026, mes: 11 });
});

test('con todo el año, las flechas mueven el año', () => {
  assert.deepEqual(moverPeriodo({ anio: 2026, mes: null }, -1), { anio: 2025, mes: null });
});

test('etiqueta del periodo', () => {
  assert.equal(etiquetaPeriodo({ anio: 2026, mes: 10 }), 'octubre 2026');
  assert.equal(etiquetaPeriodo({ anio: 2025, mes: null }), 'todo 2025');
});

test('años con datos más el actual, del más reciente al más antiguo', () => {
  const conteos = [{ anio: 2025 }, { anio: 2007 }, { anio: 2025 }];
  assert.deepEqual(aniosDisponibles(conteos, { anio: 2026, mes: 10 }, new Date(2026, 9, 30)), [2026, 2025, 2007]);
});

test('último mes con movimientos', () => {
  const conteos = [
    { anio: 2025, mes: 11, total: 589 },
    { anio: 2025, mes: 12, total: 453 },
    { anio: 2007, mes: 6, total: 1 },
    { anio: 2026, mes: 1, total: 0 },
  ];
  assert.deepEqual(ultimoPeriodoConDatos(conteos), { anio: 2025, mes: 12 });
  assert.equal(ultimoPeriodoConDatos([]), null);
});
