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
} from './transporte.repository';
import { TransporteError } from './transporte.types';

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
