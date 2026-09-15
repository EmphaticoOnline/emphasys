import { buildCartaPorte31, collectCartaPorteIssues, generateIdCcp } from './carta-porte.builder';
import {
  findPrincipalTripDocument,
  getCartaPorteBuildSource,
  getCurrentCartaPorteFromPool,
  inTransaction,
  lockCurrentCartaPorte,
  lockTrip,
  markTripValidated,
  saveCartaPorteMaterialization,
  findLocation,
} from './transporte.repository';
import { TransporteError } from './transporte.types';

async function validarDomiciliosSat(client: any, empresaId: number, source: any): Promise<void> {
  for (const ubicacion of source.ubicaciones ?? []) {
    const master = await findLocation(client, empresaId, Number(ubicacion.domicilio_id));
    if (!master) continue;
    const domicilio = ubicacion.domicilio_snapshot ?? ubicacion.domicilioSnapshot ?? {};
    const pais = String(domicilio.pais ?? '').trim().toUpperCase();
    if (!['MEX', 'MEXICO', 'MÉXICO', 'MX'].includes(pais)) continue;
    const faltantes: string[] = [];
    if (!/^\d{5}$/.test(String(master.cp_sat ?? '').trim())) faltantes.push('código postal');
    if (!String(master.colonia_sat ?? '').trim()) faltantes.push('colonia');
    if (faltantes.length) {
      const rol = ubicacion.tipo === 'origen' ? 'origen' : 'destino';
      const identificador = String(ubicacion.domicilio_identificador ?? ubicacion.identificador ?? domicilio.nombre ?? 'seleccionado');
      throw new TransporteError(`El domicilio ${rol} '${identificador}' no tiene completa su información SAT (${faltantes.join(' y ')}). Edite el domicilio y vuelva a seleccionar el código postal y la colonia.`, 422, 'CARTA_PORTE_DOMICILIO_SAT_INCOMPLETO');
    }
  }
}

export async function materializeCartaPorte(viajeId: number, empresaId: number) {
  return inTransaction(async (client) => {
    const trip = await lockTrip(client, empresaId, viajeId);
    if (!trip) throw new TransporteError('Viaje no encontrado.', 404, 'TRANSPORTE_NOT_FOUND');
    if (trip.estatus === 'timbrado' || trip.estatus === 'cancelado') {
      throw new TransporteError(`No se puede materializar Carta Porte para un viaje ${trip.estatus}.`, 409, 'CARTA_PORTE_LOCKED');
    }

    const current = await lockCurrentCartaPorte(client, empresaId, viajeId);
    if (current?.timbrado_at || current?.estatus === 'timbrado') {
      throw new TransporteError('La Carta Porte timbrada es inmutable.', 409, 'CARTA_PORTE_TIMBRADA');
    }

    const source = await getCartaPorteBuildSource(client, empresaId, viajeId);
    if (!source) throw new TransporteError('Viaje no encontrado.', 404, 'TRANSPORTE_NOT_FOUND');
    await validarDomiciliosSat(client, empresaId, source);

    // Reporte agrupado de faltantes para la UX. buildCartaPorte31 sigue siendo
    // la validación autoritativa (se ejecuta justo después).
    const issues = collectCartaPorteIssues(source);
    if (issues.length > 0) {
      throw new TransporteError(
        'La Carta Porte tiene datos pendientes por completar.',
        422,
        'CARTA_PORTE_VALIDATION',
        issues
      );
    }

    const snapshot = buildCartaPorte31(source, generateIdCcp());
    const documentoId = await findPrincipalTripDocument(client, empresaId, viajeId);
    const materialization = await saveCartaPorteMaterialization(client, {
      currentId: current?.id ?? null,
      empresaId,
      viajeId,
      documentoId,
      idCcp: snapshot.IdCCP,
      snapshot,
    });
    await markTripValidated(client, empresaId, viajeId);
    return { estado: 'validado', cartaPorte31: snapshot, materializacion: materialization };
  });
}

export async function getCurrentCartaPorte(viajeId: number, empresaId: number) {
  const materialization = await getCurrentCartaPorteFromPool(empresaId, viajeId);
  if (!materialization) throw new TransporteError('Carta Porte no materializada.', 404, 'CARTA_PORTE_NOT_FOUND');
  return {
    estado: materialization.estatus,
    cartaPorte31: materialization.snapshot_json,
    materializacion: materialization,
  };
}
