import assert from 'node:assert/strict';
import test from 'node:test';
import { decidirSeleccionMovimiento, idsIguales } from './inventarioMovimientosSeleccion.ts';

const inv004 = { id: '4', folio: 'INV-004', fecha: '2026-10-11' };
const inv007 = { id: '7', folio: 'INV-007', fecha: '2026-10-10' };
const listado = [inv004, inv007];

test('un bigint en texto y el id numérico del guardado son el mismo movimiento', () => {
  assert.equal(idsIguales('7', 7), true);
  assert.equal(idsIguales(7, '7'), true);
  assert.equal('7' === (7 as unknown), false);
});

test('guardar INV-007 con fecha anterior no deja seleccionado el primer registro INV-004', () => {
  const mientrasCarga = decidirSeleccionMovimiento({
    pendiente: 7,
    selectedId: null,
    movimientos: [],
    filtrados: [],
    cargaTerminada: false,
    hayFiltros: false,
  });
  assert.deepEqual(mientrasCarga, { selectedId: 7, pendiente: 7, limpiarFiltros: false });

  const alCargar = decidirSeleccionMovimiento({
    pendiente: 7,
    selectedId: mientrasCarga.selectedId,
    movimientos: listado,
    filtrados: listado,
    cargaTerminada: true,
    hayFiltros: false,
  });
  assert.equal(alCargar.selectedId, 7);
  assert.equal(alCargar.pendiente, null);
  assert.notEqual(alCargar.selectedId, Number(inv004.id));
});

test('sin movimiento pendiente, el listado sigue eligiendo el primero', () => {
  const decision = decidirSeleccionMovimiento({
    pendiente: null,
    selectedId: null,
    movimientos: listado,
    filtrados: listado,
    cargaTerminada: true,
    hayFiltros: false,
  });
  assert.equal(decision.selectedId, 4);
});

test('si un filtro oculta el movimiento guardado, se conserva hasta limpiar el filtro', () => {
  const decision = decidirSeleccionMovimiento({
    pendiente: 7,
    selectedId: 7,
    movimientos: listado,
    filtrados: [inv004],
    cargaTerminada: true,
    hayFiltros: true,
  });
  assert.equal(decision.selectedId, 7);
  assert.equal(decision.pendiente, 7);
  assert.equal(decision.limpiarFiltros, true);
});

test('después de editar, el mismo id sigue seleccionado aunque no sea el primero', () => {
  const decision = decidirSeleccionMovimiento({
    pendiente: 7,
    selectedId: 4,
    movimientos: listado,
    filtrados: listado,
    cargaTerminada: true,
    hayFiltros: false,
  });
  assert.equal(decision.selectedId, 7);
});
