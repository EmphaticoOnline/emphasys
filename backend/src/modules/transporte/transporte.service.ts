import {
  clearTripChildren,
  findContact,
  findLocation,
  findProductMerchandise,
  findOperator,
  findTrailer,
  findVehicle,
  getTripAggregate,
  getTripAggregateFromPool,
  getReinsertableMercancias,
  getTripByDocument as findTripByDocument,
  inTransaction,
  insertFigure,
  insertLocation,
  insertMerchandise,
  insertPreservedMercancia,
  insertTrailer,
  insertTrip,
  invalidateCurrentCartaPorteForEdit,
  lockTrip,
  updateTrip,
  type DbClient,
  type ReinsertableMercancia,
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
  input: ViajeInput,
  options: { skipMercancias?: boolean } = {}
): Promise<Map<number, number>> {
  const locationIdsBySequence = new Map<number, number>();

  for (const item of input.ubicaciones) {
    const domicilioId = item.domicilioId ?? item.ubicacionId ?? null;
    if (!domicilioId) {
      throw new TransporteError(`La ubicación de secuencia ${item.secuencia} requiere domicilioId.`);
    }
    const master = requiredMaster(
      await findLocation(client, empresaId, domicilioId),
      'El domicilio', domicilioId
    );
    const snapshot = buildLocationSnapshot(master);
    const insertedId = await insertLocation(client, [
      empresaId, viajeId, domicilioId, item.tipo, item.secuencia, snapshot.nombre, snapshot.rfc,
      item.fechaHoraProgramada, item.fechaHoraReal, item.distanciaRecorrida,
      snapshot.domicilio, snapshot.coordenadas,
    ]);
    locationIdsBySequence.set(item.secuencia, insertedId);
  }

  // Cuando skipMercancias está activo, las mercancías existentes se preservan
  // por separado (ver reinsertPreservedMercancias) y no se tocan aquí.
  for (const item of options.skipMercancias ? [] : input.mercancias) {
    // El maestro de Productos sólo aporta VALORES POR DEFECTO al alta desde
    // producto: los campos que el cliente envía siempre ganan, para que el
    // snapshot de Carta Porte sea propio del Viaje y editable, sin quedar
    // ligado en vivo a public.productos ni a las partidas de factura.
    const master = item.productoId
      ? requiredMaster(await findProductMerchandise(client, empresaId, item.productoId), 'El producto', item.productoId)
      : null;
    const base = master ? buildMerchandiseSnapshot(master) : null;
    const pick = <T,>(propio: T | null | undefined, defecto: T | null | undefined): T | null =>
      propio !== undefined && propio !== null ? propio : (defecto ?? null);
    const snapshot = {
      descripcion: (pick(item.descripcion, base?.descripcion) ?? '') as string,
      claveBienesTransportadosSat: pick(item.claveBienesTransportadosSat, base?.claveBienesTransportadosSat),
      claveUnidadSat: pick(item.claveUnidadSat, base?.claveUnidadSat),
      unidadDescripcion: pick(item.unidadDescripcion, base?.unidadDescripcion),
      materialPeligroso: item.materialPeligroso ?? base?.materialPeligroso ?? false,
      claveMaterialPeligroso: pick(item.claveMaterialPeligroso, base?.claveMaterialPeligroso),
      embalaje: pick(item.embalaje, base?.embalaje),
      descripcionEmbalaje: pick(item.descripcionEmbalaje, base?.descripcionEmbalaje),
    };
    const originId = resolveLocationSequence(locationIdsBySequence, item.origenSecuencia, 'origenSecuencia');
    const destinationId = resolveLocationSequence(locationIdsBySequence, item.destinoSecuencia, 'destinoSecuencia');
    await insertMerchandise(client, [
      empresaId, viajeId, item.productoId ?? null, snapshot.descripcion,
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
      if (operator.vigencia_licencia && new Date(operator.vigencia_licencia) < new Date()) throw new TransporteError('La licencia del operador ' + item.operadorId + ' está vencida.');
      if (!operator.numero_licencia?.trim()) throw new TransporteError('El operador ' + item.operadorId + ' no tiene número de licencia.');
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

  return locationIdsBySequence;
}

/**
 * Reinserta verbatim las mercancías capturadas previamente, remapeando su
 * origen/destino a las nuevas ubicaciones por número de secuencia. No consulta
 * el maestro de Productos: preserva el snapshot y los datos logísticos tal cual.
 */
async function reinsertPreservedMercancias(
  client: DbClient,
  empresaId: number,
  viajeId: number,
  mercancias: ReinsertableMercancia[],
  locationIdsBySequence: ReadonlyMap<number, number>
): Promise<void> {
  for (const item of mercancias) {
    const resolve = (secuencia: number | null, rol: 'origen' | 'destino'): number | null => {
      if (secuencia == null) return null;
      const id = locationIdsBySequence.get(secuencia);
      if (!id) {
        throw new TransporteError(
          `No se puede quitar la ubicación de secuencia ${secuencia}: una mercancía existente la usa como ${rol}.`,
          409,
          'TRANSPORTE_MERCANCIA_UBICACION'
        );
      }
      return id;
    };
    await insertPreservedMercancia(client, [
      empresaId, viajeId, item.producto_id ?? null, item.descripcion_snapshot,
      item.clave_bienes_transportados_sat, item.clave_unidad_sat, item.unidad_descripcion,
      item.cantidad, item.peso_kg, item.valor_mercancia, item.material_peligroso,
      item.clave_material_peligroso, item.embalaje, item.descripcion_embalaje,
      resolve(item.origen_secuencia, 'origen'), resolve(item.destino_secuencia, 'destino'),
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
  // Contrato: si `mercancias` se omite del cuerpo, se preservan intactas las
  // mercancías ya capturadas (Ruta/Unidad/Operador no deben tocarlas). Si se
  // envía un arreglo explícito (incluido []), se reemplazan como siempre.
  const mercanciasOmitidas =
    !!raw && typeof raw === 'object' && !Array.isArray(raw) &&
    (raw as Record<string, unknown>).mercancias === undefined;

  const input = parseViajeInput(raw);
  return inTransaction(async (client) => {
    const current = await lockTrip(client, empresaId, viajeId);
    if (!current) throw new TransporteError('Viaje no encontrado.', 404, 'TRANSPORTE_NOT_FOUND');
    if (current.estatus === 'timbrado' || current.estatus === 'cancelado') {
      throw new TransporteError(`No se puede editar un viaje ${current.estatus}.`, 409, 'TRANSPORTE_LOCKED');
    }
    await validateHeaderMasters(client, empresaId, input);
    await invalidateCurrentCartaPorteForEdit(client, empresaId, viajeId);

    const mercanciasPreservadas = mercanciasOmitidas
      ? await getReinsertableMercancias(client, empresaId, viajeId)
      : [];

    await clearTripChildren(client, empresaId, viajeId);
    const editableInput = resetViajeInputToDraft(input);
    await updateTrip(client, empresaId, viajeId, editableInput);
    const locationIdsBySequence = await validateAndWriteChildren(
      client, empresaId, viajeId, editableInput, { skipMercancias: mercanciasOmitidas }
    );
    if (mercanciasOmitidas && mercanciasPreservadas.length > 0) {
      await reinsertPreservedMercancias(client, empresaId, viajeId, mercanciasPreservadas, locationIdsBySequence);
    }
    return getTripAggregate(client, empresaId, viajeId);
  });
}

export async function getTrip(empresaId: number, viajeId: number) {
  const aggregate = await getTripAggregateFromPool(empresaId, viajeId);
  if (!aggregate) throw new TransporteError('Viaje no encontrado.', 404, 'TRANSPORTE_NOT_FOUND');
  return aggregate;
}

export async function getTripByDocument(empresaId: number, documentoId: number) {
  return inTransaction(async (client) => findTripByDocument(client, empresaId, documentoId));
}

export async function createTripFromDocument(empresaId: number, usuarioId: number, documentoId: number) {
  return inTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [empresaId, documentoId]);
    const existing = await findTripByDocument(client, empresaId, documentoId);
    if (existing) return getTripAggregate(client, empresaId, Number(existing.viaje_id));
    const { rows } = await client.query(
      `SELECT id, contacto_principal_id FROM public.documentos
        WHERE id=$1 AND empresa_id=$2 AND LOWER(tipo_documento)='factura' FOR UPDATE`, [documentoId, empresaId]);
    const documento = rows[0];
    if (!documento) throw new TransporteError('Factura no encontrada en la empresa activa.', 404);
    const input = { folioInterno: `FAC-${documentoId}`, clienteContactoId: Number(documento.contacto_principal_id), estatus: 'borrador' as const,
      fechaProgramada: null, fechaInicio: null, fechaFin: null, vehiculoId: null, referenciaCliente: null, observaciones: null,
      ubicaciones: [], mercancias: [], figuras: [], remolques: [] } as ViajeInput;
    await validateHeaderMasters(client, empresaId, input);
    const viajeId = await insertTrip(client, empresaId, usuarioId, input);
    await client.query(`INSERT INTO transporte.viaje_documentos (empresa_id, viaje_id, documento_id, tipo_relacion, principal) VALUES ($1,$2,$3,'factura_servicio',true)`, [empresaId, viajeId, documentoId]);
    await getTripAggregate(client, empresaId, viajeId);
    return findTripByDocument(client, empresaId, documentoId);
  });
}
