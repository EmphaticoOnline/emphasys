import { randomUUID } from 'node:crypto';
import {
  CARTA_PORTE_TIPO_FIGURA_OPERADOR,
  CARTA_PORTE_UNIDAD_PESO_KG,
  CARTA_PORTE_VERSION,
  type CartaPorte31,
  type CartaPorteBuildSource,
  type CartaPorteDomicilio31,
  type CartaPorteIssue,
} from './carta-porte.types';
import { TransporteError } from './transporte.types';

const requiredText = (value: unknown, field: string): string => {
  const text = String(value ?? '').trim();
  if (!text) throw new TransporteError(`Carta Porte: falta ${field}.`);
  return text;
};

const positiveNumber = (value: unknown, field: string): number => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TransporteError(`Carta Porte: ${field} debe ser mayor a cero.`);
  }
  return number;
};

const optionalText = (value: unknown): string | undefined => {
  const text = String(value ?? '').trim();
  return text || undefined;
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export const formatCartaPorteDateTime = (
  value: unknown,
  field: string,
  timeZone = 'America/Mexico_City'
): string => {
  const text = value instanceof Date ? value.toISOString() : requiredText(value, field);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new TransporteError(`Carta Porte: ${field} no es una fecha válida.`);
  return date
    .toLocaleString('sv-SE', { timeZone, hourCycle: 'h23' })
    .replace(' ', 'T')
    .slice(0, 19);
};

const rfc = (value: unknown, field: string): string => {
  const text = requiredText(value, field).toUpperCase();
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(text)) {
    throw new TransporteError(`Carta Porte: ${field} no tiene un formato de RFC válido.`);
  }
  return text;
};

export function generateIdCcp(): string {
  return `CCC${randomUUID().slice(3).toUpperCase()}`;
}

export function isValidIdCcp(value: string): boolean {
  return /^CCC[0-9A-F]{5}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/.test(value);
}

const address = (raw: unknown, field: string): CartaPorteDomicilio31 => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const Estado = requiredText(source.estado ?? source.Estado, `${field}.Estado`);
  const Pais = requiredText(source.pais ?? source.Pais, `${field}.Pais`);
  const CodigoPostal = requiredText(source.codigoPostal ?? source.CodigoPostal, `${field}.CodigoPostal`);
  if (Pais !== 'MEX') throw new TransporteError(`Carta Porte: ${field}.Pais debe contener la clave SAT MEX.`);
  if (!/^[A-Z]{3}$/.test(Estado)) throw new TransporteError(`Carta Porte: ${field}.Estado debe contener una clave SAT de tres letras.`);
  if (!/^\d{5}$/.test(CodigoPostal)) throw new TransporteError(`Carta Porte: ${field}.CodigoPostal debe contener cinco dígitos.`);
  const result: CartaPorteDomicilio31 = { Estado, Pais, CodigoPostal };
  const mappings: Array<[keyof CartaPorteDomicilio31, unknown]> = [
    ['Calle', source.calle ?? source.Calle],
    ['NumeroExterior', source.numeroExterior ?? source.NumeroExterior],
    ['NumeroInterior', source.numeroInterior ?? source.NumeroInterior],
    ['Colonia', source.colonia ?? source.Colonia],
    ['Localidad', source.localidad ?? source.Localidad],
    ['Referencia', source.referencia ?? source.Referencia],
    ['Municipio', source.municipio ?? source.Municipio],
  ];
  for (const [key, value] of mappings) {
    const text = optionalText(value);
    if (text) (result as any)[key] = text;
  }
  return result;
};

export function buildCartaPorte31(source: CartaPorteBuildSource, idCcp = generateIdCcp()): CartaPorte31 {
  if (!isValidIdCcp(idCcp)) throw new TransporteError('Carta Porte: IdCCP no cumple el formato requerido.');
  if (!source.viaje?.cliente_contacto_id) throw new TransporteError('Carta Porte: el viaje no tiene cliente.');
  if (source.viaje.estatus === 'timbrado' || source.viaje.estatus === 'cancelado') {
    throw new TransporteError(`Carta Porte: no se puede materializar un viaje ${source.viaje.estatus}.`, 409);
  }

  const origins = source.ubicaciones.filter((item) => item.tipo === 'origen');
  const destinations = source.ubicaciones.filter((item) => item.tipo === 'destino');
  if (origins.length !== 1) throw new TransporteError('Carta Porte: se requiere exactamente un origen.');
  if (destinations.length === 0) throw new TransporteError('Carta Porte: se requiere al menos un destino.');

  const fiscalIds = new Map<number, string>();
  origins.forEach((item, index) => fiscalIds.set(Number(item.id), `OR${String(index + 1).padStart(6, '0')}`));
  destinations.forEach((item, index) => fiscalIds.set(Number(item.id), `DE${String(index + 1).padStart(6, '0')}`));

  const orderedLocations = [...origins, ...destinations];
  const Ubicaciones = orderedLocations.map((item) => {
    const distance = optionalNumber(item.distancia_recorrida);
    if (distance !== undefined && distance < 0) throw new TransporteError('Carta Porte: DistanciaRecorrida no puede ser negativa.');
    const result = {
      TipoUbicacion: item.tipo === 'origen' ? 'Origen' as const : 'Destino' as const,
      IDUbicacion: fiscalIds.get(Number(item.id))!,
      RFCRemitenteDestinatario: rfc(item.remitente_destinatario_rfc, `RFC de ubicación ${item.secuencia}`),
      NombreRemitenteDestinatario: requiredText(item.remitente_destinatario_nombre, `nombre de ubicación ${item.secuencia}`),
      FechaHoraSalidaLlegada: formatCartaPorteDateTime(
        item.fecha_hora_real ?? item.fecha_hora_programada,
        `fecha de ubicación ${item.secuencia}`
      ),
      Domicilio: address(item.domicilio_snapshot, `domicilio de ubicación ${item.secuencia}`),
      ...(item.tipo === 'destino' ? { DistanciaRecorrida: positiveNumber(distance, `distancia del destino ${item.secuencia}`) } : {}),
    };
    return result;
  });

  if (source.mercancias.length === 0) throw new TransporteError('Carta Porte: se requiere al menos una mercancía.');
  const Mercancia = source.mercancias.map((item, index) => {
    const dangerous = Boolean(item.material_peligroso);
    const originId = item.origen_viaje_ubicacion_id == null ? undefined : fiscalIds.get(Number(item.origen_viaje_ubicacion_id));
    const destinationId = item.destino_viaje_ubicacion_id == null ? undefined : fiscalIds.get(Number(item.destino_viaje_ubicacion_id));
    if (!originId || !destinationId) {
      throw new TransporteError(`Carta Porte: la mercancía ${index + 1} no tiene origen y destino válidos del viaje.`);
    }
    const valorMercancia = optionalNumber(item.valor_mercancia);
    const result = {
      BienesTransp: requiredText(item.clave_bienes_transportados_sat, `BienesTransp de mercancía ${index + 1}`),
      Descripcion: requiredText(item.descripcion_snapshot, `descripción de mercancía ${index + 1}`),
      Cantidad: positiveNumber(item.cantidad, `cantidad de mercancía ${index + 1}`),
      ClaveUnidad: requiredText(item.clave_unidad_sat, `ClaveUnidad de mercancía ${index + 1}`),
      Unidad: requiredText(item.unidad_descripcion, `unidad de mercancía ${index + 1}`),
      PesoEnKg: positiveNumber(item.peso_kg, `peso de mercancía ${index + 1}`),
      MaterialPeligroso: dangerous ? 'Sí' as const : 'No' as const,
      ...(dangerous ? {
        CveMaterialPeligroso: requiredText(item.clave_material_peligroso, `CveMaterialPeligroso de mercancía ${index + 1}`),
        Embalaje: requiredText(item.embalaje, `Embalaje de mercancía ${index + 1}`),
        DescripEmbalaje: requiredText(item.descripcion_embalaje, `DescripEmbalaje de mercancía ${index + 1}`),
      } : {}),
      ...(valorMercancia !== undefined ? { ValorMercancia: valorMercancia, Moneda: 'MXN' } : {}),
      CantidadTransporta: [{ Cantidad: positiveNumber(item.cantidad, `cantidad transportada ${index + 1}`), IDOrigen: originId, IDDestino: destinationId }],
    };
    return result;
  });

  const vehicle = source.vehiculo;
  if (!vehicle) throw new TransporteError('Carta Porte: el viaje no tiene vehículo asignado.');
  const insurance = {
    AseguraRespCivil: requiredText(vehicle.aseguradora_responsabilidad_civil, 'aseguradora de responsabilidad civil'),
    PolizaRespCivil: requiredText(vehicle.poliza_responsabilidad_civil, 'póliza de responsabilidad civil'),
    ...(optionalText(vehicle.aseguradora_medio_ambiente) ? { AseguraMedAmbiente: optionalText(vehicle.aseguradora_medio_ambiente)! } : {}),
    ...(optionalText(vehicle.poliza_medio_ambiente) ? { PolizaMedAmbiente: optionalText(vehicle.poliza_medio_ambiente)! } : {}),
    ...(optionalText(vehicle.aseguradora_carga) ? { AseguraCarga: optionalText(vehicle.aseguradora_carga)! } : {}),
    ...(optionalText(vehicle.poliza_carga) ? { PolizaCarga: optionalText(vehicle.poliza_carga)! } : {}),
  };
  if (Boolean(insurance.AseguraMedAmbiente) !== Boolean(insurance.PolizaMedAmbiente)) {
    throw new TransporteError('Carta Porte: aseguradora y póliza de medio ambiente deben proporcionarse juntas.');
  }
  if (Boolean(insurance.AseguraCarga) !== Boolean(insurance.PolizaCarga)) {
    throw new TransporteError('Carta Porte: aseguradora y póliza de carga deben proporcionarse juntas.');
  }
  if (Mercancia.some((item) => item.MaterialPeligroso === 'Sí') &&
      (!insurance.AseguraMedAmbiente || !insurance.PolizaMedAmbiente)) {
    throw new TransporteError('Carta Porte: el seguro de medio ambiente es obligatorio para mercancía peligrosa.');
  }

  const trailers = source.remolques.map((item, index) => {
    const snapshot = item.datos_snapshot ?? {};
    return {
      SubTipoRem: requiredText(snapshot.subtipoRemolqueSat, `SubTipoRem del remolque ${index + 1}`),
      Placa: requiredText(snapshot.placas, `placas del remolque ${index + 1}`),
    };
  });

  const operators = source.figuras.filter((item) => item.tipo_figura === 'operador');
  if (operators.length === 0) throw new TransporteError('Carta Porte: se requiere al menos un operador.');
  const FiguraTransporte = operators.map((item, index) => {
    const snapshot = item.datos_snapshot ?? {};
    return {
      TipoFigura: CARTA_PORTE_TIPO_FIGURA_OPERADOR,
      RFCFigura: rfc(snapshot.rfc, `RFC del operador ${index + 1}`),
      NumLicencia: requiredText(snapshot.numeroLicencia, `licencia del operador ${index + 1}`),
      NombreFigura: requiredText(snapshot.nombre, `nombre del operador ${index + 1}`),
      Domicilio: address(snapshot.domicilio, `domicilio del operador ${index + 1}`),
    };
  });

  return {
    Version: CARTA_PORTE_VERSION,
    IdCCP: idCcp,
    TranspInternac: 'No',
    TotalDistRec: destinations.reduce((sum, item) => sum + positiveNumber(item.distancia_recorrida, `distancia del destino ${item.secuencia}`), 0),
    Ubicaciones,
    Mercancias: {
      NumTotalMercancias: Mercancia.length,
      PesoBrutoTotal: Mercancia.reduce((sum, item) => sum + item.PesoEnKg, 0),
      UnidadPeso: CARTA_PORTE_UNIDAD_PESO_KG,
      Mercancia,
      Autotransporte: {
        PermSCT: requiredText(vehicle.tipo_permiso_sict, 'PermSCT'),
        NumPermisoSCT: requiredText(vehicle.numero_permiso_sict, 'NumPermisoSCT'),
        IdentificacionVehicular: {
          ConfigVehicular: requiredText(vehicle.configuracion_vehicular_sat, 'ConfigVehicular'),
          PlacaVM: requiredText(vehicle.placas, 'PlacaVM'),
          AnioModeloVM: positiveNumber(vehicle.modelo_anio, 'AnioModeloVM'),
          PesoBrutoVehicular: positiveNumber(vehicle.peso_bruto_vehicular, 'PesoBrutoVehicular'),
        },
        Seguros: insurance,
        ...(trailers.length ? { Remolques: trailers } : {}),
      },
    },
    FiguraTransporte,
  };
}

// ---------------------------------------------------------------------------
// Recolector de faltantes para la UX de "Validar Carta Porte".
//
// Reproduce, en forma de lista y agrupada por sección, los MISMOS requisitos
// que impone buildCartaPorte31. buildCartaPorte31 sigue siendo la autoridad:
// materializeCartaPorte lo ejecuta después, así que ninguna regla puede
// saltarse aunque este recolector omitiera algo. No introduce reglas nuevas.
// ---------------------------------------------------------------------------

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const vacio = (v: unknown): boolean => String(v ?? '').trim() === '';
const noPositivo = (v: unknown): boolean => {
  const n = Number(v);
  return !Number.isFinite(n) || n <= 0;
};
const rfcInvalido = (v: unknown): boolean => !RFC_RE.test(String(v ?? '').trim().toUpperCase());
const fechaInvalida = (v: unknown): boolean => {
  const t = v instanceof Date ? v.toISOString() : String(v ?? '').trim();
  return !t || Number.isNaN(Date.parse(t));
};
const domicilioIncompleto = (raw: unknown): boolean => {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const estado = String(s.estado ?? s.Estado ?? '').trim().toUpperCase();
  const pais = String(s.pais ?? s.Pais ?? '').trim().toUpperCase();
  const cp = String(s.codigoPostal ?? s.CodigoPostal ?? '').trim();
  return !/^[A-Z]{3}$/.test(estado) || pais !== 'MEX' || !/^\d{5}$/.test(cp);
};

export function collectCartaPorteIssues(source: CartaPorteBuildSource): CartaPorteIssue[] {
  const issues: CartaPorteIssue[] = [];
  const add = (section: CartaPorteIssue['section'], message: string, index?: number) =>
    issues.push(index === undefined ? { section, message } : { section, message, index });

  // Datos generales
  if (!source.viaje?.cliente_contacto_id) add('generales', 'El viaje no tiene cliente asociado.');

  // Ruta
  const origenes = source.ubicaciones.filter((u) => u.tipo === 'origen');
  const destinos = source.ubicaciones.filter((u) => u.tipo === 'destino');
  if (origenes.length !== 1) add('ruta', 'El viaje debe tener exactamente un origen.');
  if (destinos.length === 0) add('ruta', 'El viaje debe tener al menos un destino.');
  for (const u of [...origenes, ...destinos]) {
    const etiqueta = u.tipo === 'origen' ? 'origen' : 'destino';
    const sec = Number(u.secuencia);
    if (rfcInvalido(u.remitente_destinatario_rfc)) add('ruta', `Falta el RFC del ${etiqueta} (o no tiene formato válido).`, sec);
    if (vacio(u.remitente_destinatario_nombre)) add('ruta', `Falta el nombre / razón social del ${etiqueta}.`, sec);
    if (fechaInvalida(u.fecha_hora_real ?? u.fecha_hora_programada)) add('ruta', `Falta la fecha y hora programada del ${etiqueta}.`, sec);
    if (domicilioIncompleto(u.domicilio_snapshot)) add('ruta', `El domicilio del ${etiqueta} necesita estado, país (MEX) y código postal de 5 dígitos.`, sec);
    if (u.tipo === 'destino' && noPositivo(u.distancia_recorrida)) add('ruta', 'El destino necesita distancia recorrida mayor a cero.', sec);
  }

  // Mercancías
  const origenIds = new Set(origenes.map((u) => Number(u.id)));
  const destinoIds = new Set(destinos.map((u) => Number(u.id)));
  if (source.mercancias.length === 0) {
    add('mercancias', 'Agrega al menos una mercancía.');
  }
  source.mercancias.forEach((m, i) => {
    const n = i + 1;
    if (!origenIds.has(Number(m.origen_viaje_ubicacion_id)) || !destinoIds.has(Number(m.destino_viaje_ubicacion_id))) {
      add('mercancias', `La mercancía ${n} no tiene origen y destino del viaje asignados.`, n);
    }
    if (vacio(m.clave_bienes_transportados_sat)) add('mercancias', `La mercancía ${n} necesita la clave SAT de bienes/servicios transportados.`, n);
    if (vacio(m.descripcion_snapshot)) add('mercancias', `La mercancía ${n} necesita descripción.`, n);
    if (noPositivo(m.cantidad)) add('mercancias', `La mercancía ${n} necesita cantidad mayor a cero.`, n);
    if (vacio(m.clave_unidad_sat)) add('mercancias', `La mercancía ${n} necesita la clave SAT de unidad.`, n);
    if (vacio(m.unidad_descripcion)) add('mercancias', `La mercancía ${n} necesita la unidad.`, n);
    if (noPositivo(m.peso_kg)) add('mercancias', `La mercancía ${n} necesita peso (kg) mayor a cero.`, n);
    if (m.material_peligroso && (vacio(m.clave_material_peligroso) || vacio(m.embalaje) || vacio(m.descripcion_embalaje))) {
      add('mercancias', `La mercancía ${n} es material peligroso: necesita clave de material peligroso, embalaje y descripción del embalaje.`, n);
    }
  });

  // Unidad / Remolques
  const v = source.vehiculo;
  if (!v) {
    add('unidad', 'El viaje no tiene vehículo asignado.');
  } else {
    if (vacio(v.aseguradora_responsabilidad_civil) || vacio(v.poliza_responsabilidad_civil)) {
      add('unidad', 'El vehículo necesita aseguradora y póliza de responsabilidad civil.');
    }
    if (vacio(v.aseguradora_medio_ambiente) !== vacio(v.poliza_medio_ambiente)) {
      add('unidad', 'La aseguradora y la póliza de medio ambiente del vehículo deben capturarse juntas.');
    }
    if (vacio(v.aseguradora_carga) !== vacio(v.poliza_carga)) {
      add('unidad', 'La aseguradora y la póliza de carga del vehículo deben capturarse juntas.');
    }
    const hayPeligrosa = source.mercancias.some((m) => Boolean(m.material_peligroso));
    if (hayPeligrosa && (vacio(v.aseguradora_medio_ambiente) || vacio(v.poliza_medio_ambiente))) {
      add('unidad', 'Hay mercancía peligrosa: el seguro de medio ambiente del vehículo es obligatorio.');
    }
    if (vacio(v.tipo_permiso_sict)) add('unidad', 'El vehículo necesita el tipo de permiso SICT (PermSCT).');
    if (vacio(v.numero_permiso_sict)) add('unidad', 'El vehículo necesita el número de permiso SICT.');
    if (vacio(v.configuracion_vehicular_sat)) add('unidad', 'El vehículo necesita la configuración vehicular SAT.');
    if (vacio(v.placas)) add('unidad', 'El vehículo necesita placas.');
    if (noPositivo(v.modelo_anio)) add('unidad', 'El vehículo necesita el año modelo.');
    if (noPositivo(v.peso_bruto_vehicular)) add('unidad', 'El vehículo necesita el peso bruto vehicular.');
  }
  source.remolques.forEach((r, i) => {
    const snap = (r.datos_snapshot ?? {}) as Record<string, unknown>;
    if (vacio(snap.subtipoRemolqueSat) || vacio(snap.placas)) {
      add('unidad', `El remolque ${i + 1} necesita subtipo SAT y placas.`, i + 1);
    }
  });

  // Operador
  const operadores = source.figuras.filter((f) => f.tipo_figura === 'operador');
  if (operadores.length === 0) {
    add('operador', 'Asigna al menos un operador.');
  }
  operadores.forEach((f, i) => {
    const n = i + 1;
    const snap = (f.datos_snapshot ?? {}) as Record<string, unknown>;
    if (rfcInvalido(snap.rfc)) add('operador', `El operador ${n} necesita un RFC válido.`, n);
    if (vacio(snap.numeroLicencia)) add('operador', `El operador ${n} necesita número de licencia.`, n);
    if (vacio(snap.nombre)) add('operador', `El operador ${n} necesita nombre.`, n);
    if (domicilioIncompleto(snap.domicilio)) add('operador', `El domicilio del operador ${n} necesita estado, país (MEX) y código postal de 5 dígitos.`, n);
  });

  return issues;
}
