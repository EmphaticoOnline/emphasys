import {
  clearTripChildren,
  findContact,
  findLocation,
  findMerchandise,
  findOperator,
  findTrailer,
  findVehicle,
  getTripAggregate,
  getTripAggregateFromPool,
  inTransaction,
  insertFigure,
  insertLocation,
  insertMerchandise,
  insertTrailer,
  insertTrip,
  invalidateCurrentCartaPorteForEdit,
  lockTrip,
  updateTrip,
  type DbClient,
} from './transporte.repository';
import { TransporteError, type ViajeInput } from './transporte.types';
import { parseViajeInput } from './transporte.validation';
import {
  buildLocationSnapshot,
  buildMerchandiseSnapshot,
  buildOperatorSnapshot,
  buildTrailerSnapshot,
  resolveLocationSequence,
} from './transporte.snapshots';

const requiredMaster = <T>(value: T | null, label: string, id: number): T => {
  if (!value) throw new TransporteError(`${label} ${id} no existe o no pertenece a la empresa activa.`);
  return value;
};

export const resetViajeInputToDraft = (input: ViajeInput): ViajeInput => ({
  ...input,
  estatus: 'borrador',
});

async function validateAndWriteChildren(
  client: DbClient,
  empresaId: number,
  viajeId: number,
  input: ViajeInput
): Promise<void> {
  const locationIdsBySequence = new Map<number, number>();

  for (const item of input.ubicaciones) {
    if (!item.ubicacionId) {
      throw new TransporteError(`La ubicación de secuencia ${item.secuencia} requiere ubicacionId.`);
    }
    const master = requiredMaster(
      await findLocation(client, empresaId, item.ubicacionId),
      'La ubicación', item.ubicacionId
    );
    const snapshot = buildLocationSnapshot(master);
    const insertedId = await insertLocation(client, [
      empresaId, viajeId, master.id, item.tipo, item.secuencia, snapshot.nombre, snapshot.rfc,
      item.fechaHoraProgramada, item.fechaHoraReal, item.distanciaRecorrida,
      snapshot.domicilio, snapshot.coordenadas,
    ]);
    locationIdsBySequence.set(item.secuencia, insertedId);
  }

  for (const item of input.mercancias) {
    const master = requiredMaster(
      await findMerchandise(client, empresaId, item.mercanciaId),
      'La mercancía', item.mercanciaId
    );
    const snapshot = buildMerchandiseSnapshot(master);
    const originId = resolveLocationSequence(locationIdsBySequence, item.origenSecuencia, 'origenSecuencia');
    const destinationId = resolveLocationSequence(locationIdsBySequence, item.destinoSecuencia, 'destinoSecuencia');
    await insertMerchandise(client, [
      empresaId, viajeId, master.id, snapshot.descripcion,
      snapshot.claveBienesTransportadosSat, snapshot.claveUnidadSat, snapshot.unidadDescripcion,
      item.cantidad, item.pesoKg, item.valorMercancia, snapshot.materialPeligroso,
      snapshot.claveMaterialPeligroso, snapshot.embalaje, snapshot.descripcionEmbalaje,
      originId, destinationId,
    ]);
  }

  for (const item of input.figuras) {
    let snapshot: Record<string, unknown> = {};
    let contactoId = item.contactoId ?? null;
    if (item.operadorId) {
      const operator = requiredMaster(
        await findOperator(client, empresaId, item.operadorId),
        'El operador', item.operadorId
      );
      contactoId = operator.contacto_id;
      snapshot = buildOperatorSnapshot(operator);
    } else if (contactoId) {
      const contact = requiredMaster(await findContact(client, empresaId, contactoId), 'El contacto', contactoId);
      snapshot = { nombre: contact.nombre, rfc: contact.rfc, curp: contact.curp, domicilio: contact.domicilio };
    }
    await insertFigure(client, [empresaId, viajeId, item.tipoFigura, item.operadorId, contactoId, item.secuencia, snapshot]);
  }

  for (const item of input.remolques) {
    const master = requiredMaster(
      await findTrailer(client, empresaId, item.remolqueId),
      'El remolque', item.remolqueId
    );
    await insertTrailer(client, [
      empresaId, viajeId, master.id, item.orden,
      buildTrailerSnapshot(master),
    ]);
  }
}

async function validateHeaderMasters(client: DbClient, empresaId: number, input: ViajeInput): Promise<void> {
  requiredMaster(await findContact(client, empresaId, input.clienteContactoId), 'El cliente/contacto', input.clienteContactoId);
  if (input.vehiculoId) {
    requiredMaster(await findVehicle(client, empresaId, input.vehiculoId), 'El vehículo', input.vehiculoId);
  }
}

export async function createTrip(empresaId: number, usuarioId: number, raw: unknown) {
  const input = parseViajeInput(raw);
  return inTransaction(async (client) => {
    await validateHeaderMasters(client, empresaId, input);
    const viajeId = await insertTrip(client, empresaId, usuarioId, input);
    await validateAndWriteChildren(client, empresaId, viajeId, input);
    return getTripAggregate(client, empresaId, viajeId);
  });
}

export async function updateTripAggregate(empresaId: number, viajeId: number, raw: unknown) {
  const input = parseViajeInput(raw);
  return inTransaction(async (client) => {
    const current = await lockTrip(client, empresaId, viajeId);
    if (!current) throw new TransporteError('Viaje no encontrado.', 404, 'TRANSPORTE_NOT_FOUND');
    if (current.estatus === 'timbrado' || current.estatus === 'cancelado') {
      throw new TransporteError(`No se puede editar un viaje ${current.estatus}.`, 409, 'TRANSPORTE_LOCKED');
    }
    await validateHeaderMasters(client, empresaId, input);
    await invalidateCurrentCartaPorteForEdit(client, empresaId, viajeId);
    await clearTripChildren(client, empresaId, viajeId);
    const editableInput = resetViajeInputToDraft(input);
    await updateTrip(client, empresaId, viajeId, editableInput);
    await validateAndWriteChildren(client, empresaId, viajeId, editableInput);
    return getTripAggregate(client, empresaId, viajeId);
  });
}

export async function getTrip(empresaId: number, viajeId: number) {
  const aggregate = await getTripAggregateFromPool(empresaId, viajeId);
  if (!aggregate) throw new TransporteError('Viaje no encontrado.', 404, 'TRANSPORTE_NOT_FOUND');
  return aggregate;
}
