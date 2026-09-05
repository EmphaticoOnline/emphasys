import {
  TransporteError,
  type ViajeEditableStatus,
  type ViajeInput,
} from './transporte.types';

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TransporteError('El cuerpo de la solicitud debe ser un objeto.');
  }
  return value as Record<string, unknown>;
};

const positiveInteger = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TransporteError(`${field} debe ser un entero positivo.`);
  }
  return parsed;
};

const optionalPositiveInteger = (value: unknown, field: string): number | null =>
  value === undefined || value === null ? null : positiveInteger(value, field);

const optionalNumber = (value: unknown, field: string): number | null => {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TransporteError(`${field} debe ser numérico.`);
  return parsed;
};

const optionalText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
};

const dateText = (value: unknown, field: string, required = false): string | null => {
  const text = optionalText(value);
  if (!text) {
    if (required) throw new TransporteError(`${field} es requerido.`);
    return null;
  }
  if (Number.isNaN(Date.parse(text))) throw new TransporteError(`${field} no es una fecha válida.`);
  return text;
};

const array = (value: unknown, field: string): unknown[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TransporteError(`${field} debe ser un arreglo.`);
  return value;
};

export function validateViajeBusinessRules(input: ViajeInput): void {
  const sequences = new Set<number>();
  for (const ubicacion of input.ubicaciones) {
    if (sequences.has(ubicacion.secuencia)) {
      throw new TransporteError(`La secuencia de ubicación ${ubicacion.secuencia} está duplicada.`);
    }
    sequences.add(ubicacion.secuencia);
  }

  for (const mercancia of input.mercancias) {
    if (mercancia.origenSecuencia !== null && mercancia.origenSecuencia !== undefined) {
      const location = input.ubicaciones.find((item) => item.secuencia === mercancia.origenSecuencia);
      if (!location || location.tipo !== 'origen') {
        throw new TransporteError(`origenSecuencia ${mercancia.origenSecuencia} no identifica un origen del viaje.`);
      }
    }
    if (mercancia.destinoSecuencia !== null && mercancia.destinoSecuencia !== undefined) {
      const location = input.ubicaciones.find((item) => item.secuencia === mercancia.destinoSecuencia);
      if (!location || location.tipo !== 'destino') {
        throw new TransporteError(`destinoSecuencia ${mercancia.destinoSecuencia} no identifica un destino del viaje.`);
      }
    }
  }

  if (input.estatus !== 'borrador') {
    if (!input.vehiculoId) throw new TransporteError('El vehículo es requerido para validar el viaje.');
    if (input.ubicaciones.filter((item) => item.tipo === 'origen').length !== 1) {
      throw new TransporteError('El viaje debe tener exactamente un origen.');
    }
    if (!input.ubicaciones.some((item) => item.tipo === 'destino')) {
      throw new TransporteError('El viaje debe tener al menos un destino.');
    }
    if (input.mercancias.length === 0) {
      throw new TransporteError('El viaje debe tener al menos una mercancía.');
    }
    if (!input.figuras.some((item) => item.tipoFigura === 'operador' && item.operadorId)) {
      throw new TransporteError('El viaje debe tener al menos un operador.');
    }
  }
}

export function parseViajeInput(value: unknown): ViajeInput {
  const body = object(value);
  const folioInterno = String(body.folioInterno ?? '').trim();
  if (!folioInterno) throw new TransporteError('folioInterno es requerido.');

  const status = String(body.estatus ?? 'borrador') as ViajeEditableStatus;
  if (!['borrador', 'listo_para_validar', 'validado'].includes(status)) {
    throw new TransporteError('estatus sólo puede ser borrador, listo_para_validar o validado.');
  }

  const input: ViajeInput = {
    folioInterno,
    clienteContactoId: positiveInteger(body.clienteContactoId, 'clienteContactoId'),
    estatus: status,
    fechaProgramada: dateText(body.fechaProgramada, 'fechaProgramada'),
    fechaInicio: dateText(body.fechaInicio, 'fechaInicio'),
    fechaFin: dateText(body.fechaFin, 'fechaFin'),
    vehiculoId: optionalPositiveInteger(body.vehiculoId, 'vehiculoId'),
    referenciaCliente: optionalText(body.referenciaCliente),
    observaciones: optionalText(body.observaciones),
    ubicaciones: array(body.ubicaciones, 'ubicaciones').map((raw, index) => {
      const item = object(raw);
      const tipo = String(item.tipo);
      if (tipo !== 'origen' && tipo !== 'destino') {
        throw new TransporteError(`ubicaciones[${index}].tipo no es válido.`);
      }
      return {
        // Contrato nuevo: domicilioId (public.contactos_domicilios.id).
        // `ubicacionId` se mantiene sólo como alias de compatibilidad interna.
        domicilioId: optionalPositiveInteger(
          item.domicilioId ?? item.ubicacionId,
          `ubicaciones[${index}].domicilioId`
        ),
        tipo,
        secuencia: positiveInteger(item.secuencia, `ubicaciones[${index}].secuencia`),
        fechaHoraProgramada: dateText(item.fechaHoraProgramada, `ubicaciones[${index}].fechaHoraProgramada`, true)!,
        fechaHoraReal: dateText(item.fechaHoraReal, `ubicaciones[${index}].fechaHoraReal`),
        distanciaRecorrida: optionalNumber(item.distanciaRecorrida, `ubicaciones[${index}].distanciaRecorrida`),
      };
    }),
    mercancias: array(body.mercancias, 'mercancias').map((raw, index) => {
      const item = object(raw);
      const cantidad = optionalNumber(item.cantidad, `mercancias[${index}].cantidad`);
      const pesoKg = optionalNumber(item.pesoKg, `mercancias[${index}].pesoKg`);
      if (cantidad === null || cantidad <= 0) throw new TransporteError(`mercancias[${index}].cantidad debe ser mayor a cero.`);
      if (pesoKg === null || pesoKg <= 0) throw new TransporteError(`mercancias[${index}].pesoKg debe ser mayor a cero.`);
      const valorMercancia = optionalNumber(item.valorMercancia, `mercancias[${index}].valorMercancia`);
      if (valorMercancia !== null && valorMercancia < 0) throw new TransporteError(`mercancias[${index}].valorMercancia no puede ser negativo.`);
      const productoId = optionalPositiveInteger(item.productoId, `mercancias[${index}].productoId`);
      if (!productoId && !optionalText(item.descripcion)) {
        throw new TransporteError(`mercancias[${index}] requiere productoId o descripcion para mercancía libre.`);
      }
      return {
        productoId,
        cantidad,
        pesoKg,
        valorMercancia,
        descripcion: optionalText(item.descripcion),
        claveBienesTransportadosSat: optionalText(item.claveBienesTransportadosSat),
        claveUnidadSat: optionalText(item.claveUnidadSat),
        unidadDescripcion: optionalText(item.unidadDescripcion),
        materialPeligroso: item.materialPeligroso == null ? undefined : Boolean(item.materialPeligroso),
        claveMaterialPeligroso: optionalText(item.claveMaterialPeligroso),
        embalaje: optionalText(item.embalaje),
        descripcionEmbalaje: optionalText(item.descripcionEmbalaje),
        origenSecuencia: optionalPositiveInteger(item.origenSecuencia, `mercancias[${index}].origenSecuencia`),
        destinoSecuencia: optionalPositiveInteger(item.destinoSecuencia, `mercancias[${index}].destinoSecuencia`),
      };
    }),
    figuras: array(body.figuras, 'figuras').map((raw, index) => {
      const item = object(raw);
      const tipoFigura = String(item.tipoFigura ?? '').trim();
      if (!tipoFigura) throw new TransporteError(`figuras[${index}].tipoFigura es requerido.`);
      if (tipoFigura !== 'operador') throw new TransporteError('Por ahora sólo se admite la figura Operador (SAT 01).');
      return {
        tipoFigura,
        operadorId: optionalPositiveInteger(item.operadorId, `figuras[${index}].operadorId`),
        contactoId: optionalPositiveInteger(item.contactoId, `figuras[${index}].contactoId`),
        secuencia: positiveInteger(item.secuencia, `figuras[${index}].secuencia`),
      };
    }),
    remolques: array(body.remolques, 'remolques').map((raw, index) => {
      const item = object(raw);
      return {
        remolqueId: positiveInteger(item.remolqueId, `remolques[${index}].remolqueId`),
        orden: positiveInteger(item.orden, `remolques[${index}].orden`),
      };
    }),
  };

  validateViajeBusinessRules(input);
  return input;
}
