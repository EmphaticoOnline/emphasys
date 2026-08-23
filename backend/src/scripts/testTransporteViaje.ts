import assert from 'node:assert/strict';
import { buildMerchandiseSnapshot, resolveLocationSequence } from '../modules/transporte/transporte.snapshots';
import { parseViajeInput } from '../modules/transporte/transporte.validation';

const input = parseViajeInput({
  folioInterno: 'VIAJE-PRUEBA-001',
  clienteContactoId: 100,
  estatus: 'borrador',
  vehiculoId: 1,
  ubicaciones: [
    { ubicacionId: 10, tipo: 'origen', secuencia: 1, fechaHoraProgramada: '2026-08-20T08:00:00-06:00' },
    { ubicacionId: 20, tipo: 'destino', secuencia: 2, fechaHoraProgramada: '2026-08-20T12:00:00-06:00' },
  ],
  mercancias: [
    { mercanciaId: 30, cantidad: 31_000, pesoKg: 25_000, valorMercancia: 500_000, origenSecuencia: 1, destinoSecuencia: 2 },
  ],
  figuras: [{ tipoFigura: 'operador', operadorId: 1, secuencia: 1 }],
  remolques: [{ remolqueId: 1, orden: 1 }],
});

assert.equal(input.mercancias[0].cantidad, 31_000);
assert.equal(input.mercancias[0].pesoKg, 25_000);
assert.equal(resolveLocationSequence(new Map([[1, 501], [2, 502]]), 1, 'origenSecuencia'), 501);
assert.equal(resolveLocationSequence(new Map([[1, 501], [2, 502]]), 2, 'destinoSecuencia'), 502);
assert.deepEqual(buildMerchandiseSnapshot({
  id: 30,
  descripcion: 'DIESEL',
  clave_bienes_transportados_sat: '15101505',
  clave_unidad_sat: 'LTR',
  unidad_descripcion: 'Litro',
  material_peligroso: true,
  clave_material_peligroso: '1202',
  embalaje: null,
  descripcion_embalaje: null,
}), {
  descripcion: 'DIESEL',
  claveBienesTransportadosSat: '15101505',
  claveUnidadSat: 'LTR',
  unidadDescripcion: 'Litro',
  materialPeligroso: true,
  claveMaterialPeligroso: '1202',
  embalaje: null,
  descripcionEmbalaje: null,
});
assert.throws(() => parseViajeInput({ ...input, estatus: 'timbrado' }), /estatus/i);
assert.throws(() => parseViajeInput({ ...input, ubicaciones: input.ubicaciones.slice(0, 1), mercancias: [{ ...input.mercancias[0], destinoSecuencia: 2 }] }), /destinoSecuencia/i);

console.log('Transporte Viaje: DTO, caso conceptual, snapshots y resolución por secuencia OK.');
