import assert from 'node:assert/strict';
import { buildCartaPorte31, generateIdCcp } from '../modules/transporte/carta-porte.builder';
import type { CartaPorteBuildSource } from '../modules/transporte/carta-porte.types';
import { invalidateCurrentCartaPorteForEdit, type DbClient } from '../modules/transporte/transporte.repository';
import { resetViajeInputToDraft } from '../modules/transporte/transporte.service';
import { parseViajeInput } from '../modules/transporte/transporte.validation';

const source: CartaPorteBuildSource = {
  viaje: { id: 1, cliente_contacto_id: 10, vehiculo_id: 1, estatus: 'validado' },
  ubicaciones: [
    { id: 1, tipo: 'origen', secuencia: 1, remitente_destinatario_rfc: 'AAA010101AAA', remitente_destinatario_nombre: 'Origen', fecha_hora_programada: '2026-08-20T08:00:00-06:00', domicilio_snapshot: { estado: 'JAL', pais: 'MEX', codigoPostal: '45000' } },
    { id: 2, tipo: 'destino', secuencia: 2, remitente_destinatario_rfc: 'BBB010101BBB', remitente_destinatario_nombre: 'Destino', fecha_hora_programada: '2026-08-20T12:00:00-06:00', distancia_recorrida: 100, domicilio_snapshot: { estado: 'JAL', pais: 'MEX', codigoPostal: '47000' } },
  ],
  mercancias: [{ id: 1, descripcion_snapshot: 'DIESEL', clave_bienes_transportados_sat: '15101505', clave_unidad_sat: 'LTR', unidad_descripcion: 'Litro', cantidad: 31_000, peso_kg: 25_000, material_peligroso: true, clave_material_peligroso: '1202', embalaje: '4H1', descripcion_embalaje: 'Bidón', origen_viaje_ubicacion_id: 1, destino_viaje_ubicacion_id: 2 }],
  vehiculo: { placas: 'ABC123A', configuracion_vehicular_sat: 'T3S2', modelo_anio: 2024, peso_bruto_vehicular: 44_000, tipo_permiso_sict: 'TPAF01', numero_permiso_sict: 'P-1', aseguradora_responsabilidad_civil: 'RC', poliza_responsabilidad_civil: 'RC-1', aseguradora_medio_ambiente: 'MA', poliza_medio_ambiente: 'MA-1' },
  remolques: [{ id: 1, datos_snapshot: { subtipoRemolqueSat: 'CTR028', placas: '41VA7J' } }],
  figuras: [{ id: 1, tipo_figura: 'operador', datos_snapshot: { nombre: 'Operador', rfc: 'CCC010101CCC', numeroLicencia: 'LIC-1', domicilio: { estado: 'JAL', pais: 'MEX', codigoPostal: '44100' } } }],
};

async function main() {
  const first = buildCartaPorte31(source, generateIdCcp());
  let deleted = false;
  const editableClient = {
    async query(sql: string) {
      if (sql.includes('SELECT id, documento_id')) return { rows: [{ id: 9, estatus: 'validado', timbrado_at: null }] };
      if (sql.includes('DELETE FROM transporte.cartas_porte')) { deleted = true; return { rows: [] }; }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as DbClient;
  assert.equal(await invalidateCurrentCartaPorteForEdit(editableClient, 1, 1), true);
  assert.equal(deleted, true, 'Editar debe eliminar la materialización no timbrada');
  const editedInput = resetViajeInputToDraft(parseViajeInput({
    folioInterno: 'V-1', clienteContactoId: 10, estatus: 'validado', vehiculoId: 1,
    ubicaciones: [
      { domicilioId: 1, tipo: 'origen', secuencia: 1, fechaHoraProgramada: '2026-08-20T08:00:00-06:00' },
      { domicilioId: 2, tipo: 'destino', secuencia: 2, fechaHoraProgramada: '2026-08-20T12:00:00-06:00' },
    ],
  mercancias: [{ productoId: 6177, cantidad: 31_000, pesoKg: 25_000, origenSecuencia: 1, destinoSecuencia: 2 }],
    figuras: [{ tipoFigura: 'operador', operadorId: 1, secuencia: 1 }], remolques: [],
  }));
  assert.equal(editedInput.estatus, 'borrador');

  const rematerialized = buildCartaPorte31({ ...source, viaje: { ...source.viaje, estatus: 'borrador' } }, generateIdCcp());
  assert.notEqual(rematerialized.IdCCP, first.IdCCP);
  assert.deepEqual(rematerialized.Mercancias.Autotransporte.Remolques, [{ SubTipoRem: 'CTR028', Placa: '41VA7J' }]);

  const lockedClient = {
    async query(sql: string) {
      if (sql.includes('SELECT id, documento_id')) return { rows: [{ id: 10, estatus: 'timbrado', timbrado_at: new Date() }] };
      throw new Error('Una Carta Porte timbrada nunca debe eliminarse');
    },
  } as unknown as DbClient;
  await assert.rejects(() => invalidateCurrentCartaPorteForEdit(lockedClient, 1, 1), /timbrada es inmutable/i);

  assert.throws(() => buildCartaPorte31({ ...source, viaje: { ...source.viaje, estatus: 'timbrado' } }), /viaje timbrado/i);
  assert.throws(() => buildCartaPorte31({ ...source, viaje: { ...source.viaje, estatus: 'cancelado' } }), /viaje cancelado/i);
  console.log('Carta Porte consistencia: invalidación, rematerialización, remolque y bloqueo fiscal OK.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
