import assert from 'node:assert/strict';
import { calcularImpuestosParaSubtotal } from '../modules/impuestos/impuestos.calculador';
import { resolverImpuestosPorJerarquia } from '../modules/impuestos/impuestos.resolver';
import type { ImpuestoCatalogo } from '../modules/impuestos/impuestos.types';

const iva16: ImpuestoCatalogo = {
  id: 'iva_16',
  nombre: 'IVA 16%',
  tipo: 'traslado',
  tasa: 16,
};
const retencionIva4: ImpuestoCatalogo = {
  id: 'ret_iva_4',
  nombre: 'Retención IVA 4%',
  tipo: 'retencion',
  tasa: 4,
};

const resueltos = resolverImpuestosPorJerarquia(
  [iva16, retencionIva4],
  [],
  [iva16],
  'normal'
);

assert.deepEqual(
  resueltos.map((impuesto) => impuesto.id),
  ['iva_16', 'ret_iva_4'],
  'El tratamiento normal debe conservar traslados y retenciones explícitos del producto'
);

const calculados = calcularImpuestosParaSubtotal(1000, resueltos);
assert.deepEqual(
  calculados.map(({ impuestoId, tipo, tasa, base, monto }) => ({ impuestoId, tipo, tasa, base, monto })),
  [
    { impuestoId: 'iva_16', tipo: 'traslado', tasa: 16, base: 1000, monto: 160 },
    { impuestoId: 'ret_iva_4', tipo: 'retencion', tasa: 4, base: 1000, monto: 40 },
  ]
);

const traslados = calculados
  .filter((impuesto) => impuesto.tipo === 'traslado')
  .reduce((total, impuesto) => total + impuesto.monto, 0);
const retenciones = calculados
  .filter((impuesto) => impuesto.tipo === 'retencion')
  .reduce((total, impuesto) => total + impuesto.monto, 0);

assert.equal(1000 + traslados - retenciones, 1120);
console.log('OK: partida normal conserva IVA 16% y retención IVA 4%');
