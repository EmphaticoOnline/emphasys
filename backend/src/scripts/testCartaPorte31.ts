import assert from 'node:assert/strict';
import {
  buildCartaPorte31,
  formatCartaPorteDateTime,
  generateIdCcp,
  isValidIdCcp,
} from '../modules/transporte/carta-porte.builder';
import type { CartaPorteBuildSource } from '../modules/transporte/carta-porte.types';

const source: CartaPorteBuildSource = {
  viaje: { id: 1, cliente_contacto_id: 10, vehiculo_id: 1, estatus: 'listo_para_validar' },
  ubicaciones: [
    {
      id: 101, tipo: 'origen', secuencia: 1,
      remitente_destinatario_rfc: 'AAA010101AAA',
      remitente_destinatario_nombre: 'TAD Zapopan',
      fecha_hora_programada: '2026-08-20T08:00:00-06:00', distancia_recorrida: null,
      domicilio_snapshot: { calle: 'Origen', estado: 'JAL', pais: 'MEX', codigoPostal: '45000' },
    },
    {
      id: 102, tipo: 'destino', secuencia: 2,
      remitente_destinatario_rfc: 'BBB010101BBB',
      remitente_destinatario_nombre: 'San Juan de los Lagos',
      fecha_hora_programada: '2026-08-20T12:00:00-06:00', distancia_recorrida: 155,
      domicilio_snapshot: { calle: 'Destino', estado: 'JAL', pais: 'MEX', codigoPostal: '47000' },
    },
  ],
  mercancias: [{
    id: 201, descripcion_snapshot: 'DIESEL AUTOMOTRIZ',
    clave_bienes_transportados_sat: '15101505', clave_unidad_sat: 'LTR',
    unidad_descripcion: 'Litro', cantidad: 31_000, peso_kg: 25_000,
    valor_mercancia: 100_000, material_peligroso: true,
    clave_material_peligroso: '1202', embalaje: '4H1', descripcion_embalaje: 'Bidones de plástico',
    origen_viaje_ubicacion_id: 101, destino_viaje_ubicacion_id: 102,
  }],
  vehiculo: {
    placas: 'ABC123A', configuracion_vehicular_sat: 'T3S2', modelo_anio: 2024,
    peso_bruto_vehicular: 44_000, tipo_permiso_sict: 'TPAF01', numero_permiso_sict: 'PERMISO-001',
    aseguradora_responsabilidad_civil: 'Aseguradora RC', poliza_responsabilidad_civil: 'RC-001',
    aseguradora_medio_ambiente: 'Aseguradora Ambiental', poliza_medio_ambiente: 'MA-001',
  },
  remolques: [{ id: 301, datos_snapshot: { placas: '41VA7J', subtipoRemolqueSat: 'CTR028' } }],
  figuras: [{
    id: 401, tipo_figura: 'operador',
    datos_snapshot: {
      nombre: 'Operador Prueba', rfc: 'CCC010101CCC', numeroLicencia: 'LIC-001',
      domicilio: { calle: 'Operador', estado: 'JAL', pais: 'MEX', codigoPostal: '44100' },
    },
  }],
};

const idCcp = generateIdCcp();
assert.equal(idCcp.length, 36);
assert.equal(isValidIdCcp(idCcp), true);

const carta = buildCartaPorte31(source, idCcp);
assert.equal(carta.Version, '3.1');
assert.equal(carta.IdCCP, idCcp);
assert.equal(carta.TranspInternac, 'No');
assert.equal(carta.TotalDistRec, 155);
assert.deepEqual(carta.Ubicaciones.map((item) => item.IDUbicacion), ['OR000001', 'DE000001']);
assert.deepEqual(carta.Ubicaciones.map((item) => item.FechaHoraSalidaLlegada), [
  '2026-08-20T08:00:00',
  '2026-08-20T12:00:00',
]);
assert.equal(
  formatCartaPorteDateTime(new Date('2026-08-20T14:00:00.000Z'), 'fecha de prueba'),
  '2026-08-20T08:00:00'
);
assert.equal(carta.Mercancias.NumTotalMercancias, 1);
assert.equal(carta.Mercancias.PesoBrutoTotal, 25_000);
assert.equal(carta.Mercancias.UnidadPeso, 'KGM');
assert.equal(carta.Mercancias.Mercancia[0].Cantidad, 31_000);
assert.equal(carta.Mercancias.Mercancia[0].ValorMercancia, 100_000);
assert.equal(carta.Mercancias.Mercancia[0].Moneda, 'MXN');
assert.deepEqual(carta.Mercancias.Mercancia[0].CantidadTransporta, [
  { Cantidad: 31_000, IDOrigen: 'OR000001', IDDestino: 'DE000001' },
]);
assert.deepEqual(carta.Mercancias.Autotransporte.Remolques, [{ SubTipoRem: 'CTR028', Placa: '41VA7J' }]);
assert.equal(carta.FiguraTransporte[0].TipoFigura, '01');

assert.throws(
  () => buildCartaPorte31({ ...source, vehiculo: { ...source.vehiculo, poliza_responsabilidad_civil: null } }, idCcp),
  /responsabilidad civil/i
);
assert.throws(
  () => buildCartaPorte31({ ...source, ubicaciones: source.ubicaciones.slice(1) }, idCcp),
  /exactamente un origen/i
);
assert.throws(
  () => buildCartaPorte31({
    ...source,
    vehiculo: { ...source.vehiculo, aseguradora_medio_ambiente: null, poliza_medio_ambiente: null },
  }, idCcp),
  /medio ambiente/i
);
assert.throws(() => buildCartaPorte31(source, 'INVALIDO'), /IdCCP/i);

const cartaSinValor = buildCartaPorte31({
  ...source,
  mercancias: [{ ...source.mercancias[0], valor_mercancia: null }],
}, generateIdCcp());
assert.equal(Object.prototype.hasOwnProperty.call(cartaSinValor.Mercancias.Mercancia[0], 'ValorMercancia'), false);
assert.equal(Object.prototype.hasOwnProperty.call(cartaSinValor.Mercancias.Mercancia[0], 'Moneda'), false);

console.log('CartaPorte31: caso DICOR, IdCCP, totales, relaciones y errores obligatorios OK.');
