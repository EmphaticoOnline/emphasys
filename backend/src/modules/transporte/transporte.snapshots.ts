import { TransporteError, type ProductoMercanciaMaster, type OperadorMaster, type RemolqueMaster, type UbicacionMaster } from './transporte.types';

export function buildLocationSnapshot(master: UbicacionMaster) {
  return {
    nombre: master.nombre,
    rfc: master.rfc,
    domicilio: {
      calle: master.calle,
      numeroExterior: master.numero_exterior,
      numeroInterior: master.numero_interior,
      colonia: master.colonia,
      localidad: master.localidad,
      municipio: master.municipio,
      estado: master.estado,
      pais: master.pais,
      codigoPostal: master.codigo_postal,
      referencia: master.referencia,
    },
    coordenadas: master.latitud === null && master.longitud === null
      ? null
      : { latitud: master.latitud, longitud: master.longitud },
  };
}

export function buildMerchandiseSnapshot(master: ProductoMercanciaMaster) {
  return {
    descripcion: master.descripcion,
    claveBienesTransportadosSat: master.clave_bienes_transportados_sat,
    claveUnidadSat: master.clave_unidad_sat,
    unidadDescripcion: master.unidad_descripcion,
    materialPeligroso: master.material_peligroso,
    claveMaterialPeligroso: master.clave_material_peligroso,
    embalaje: master.embalaje,
    descripcionEmbalaje: master.descripcion_embalaje,
  };
}

export function buildOperatorSnapshot(master: OperadorMaster) {
  return {
    nombre: master.nombre,
    rfc: master.rfc,
    curp: master.curp,
    numeroLicencia: master.numero_licencia,
    tipoLicencia: master.tipo_licencia,
    vigenciaLicencia: master.vigencia_licencia,
    domicilio: master.domicilio,
  };
}

export function buildTrailerSnapshot(master: RemolqueMaster) {
  return { placas: master.placas, subtipoRemolqueSat: master.subtipo_remolque_sat };
}

export function resolveLocationSequence(
  idsBySequence: ReadonlyMap<number, number>,
  sequence: number | null | undefined,
  field: 'origenSecuencia' | 'destinoSecuencia'
): number | null {
  if (sequence == null) return null;
  const id = idsBySequence.get(sequence);
  if (!id) throw new TransporteError(`No se pudo resolver ${field} ${sequence}.`);
  return id;
}
