import { extractCfdiFechaTimbrado, parseCartaPorte31Xml } from './carta-porte-print.parser';
import type { CartaPortePrintModel } from './carta-porte-print.types';
import { resolverDomicilioParaImpresion } from '../catalogos/sat/sat.repository';

export type CartaPortePrintGeneralData = {
  documentoId: number; serie?: string | null; folio?: string | number | null; fecha?: string | null;
  viajeObservaciones?: string | null;
  uuid?: string | null; fechaTimbrado?: string | null; rfcEmisor?: string | null; rfcReceptor?: string | null;
  selloCfdi?: string | null; total?: number | null;
  cancelado?: boolean;
  colorTablaHeader?: string | null;
  branding?: CartaPortePrintModel['branding'];
};

async function resolvePrintDomicilio(domicilio: NonNullable<CartaPortePrintModel['ubicaciones'][number]['domicilio']>) {
  const cp = domicilio.codigoPostal?.trim();
  if (!cp) return domicilio;
  try {
    const catalogo = await resolverDomicilioParaImpresion(cp, domicilio.colonia);
    if (!catalogo) return domicilio;
    return { ...domicilio, colonia: catalogo.colonia_nombre ?? domicilio.colonia, localidad: catalogo.localidad_nombre,
      municipio: catalogo.municipio_nombre, estado: catalogo.estado_nombre, pais: catalogo.pais_nombre };
  } catch { return domicilio; }
}

export async function mapCartaPortePrintModel(data: CartaPortePrintGeneralData, xmlTimbrado: string): Promise<CartaPortePrintModel> {
  const parsed = parseCartaPorte31Xml(xmlTimbrado);
  const ubicaciones = await Promise.all(parsed.ubicaciones.map(async (ubicacion) => ({
    ...ubicacion,
    domicilio: ubicacion.domicilio ? await resolvePrintDomicilio(ubicacion.domicilio) : undefined,
  })));
  return {
    documento: { documentoId: data.documentoId, serie: data.serie ?? undefined, folio: data.folio == null ? undefined : String(data.folio), fecha: data.fecha ?? undefined },
    viaje: { observaciones: data.viajeObservaciones ?? null },
    branding: data.branding,
    cancelado: data.cancelado === true,
    colorTablaHeader: data.colorTablaHeader ?? undefined,
    cfdi: { uuid: data.uuid ?? undefined, fechaTimbrado: extractCfdiFechaTimbrado(xmlTimbrado) ?? data.fechaTimbrado ?? undefined, rfcEmisor: data.rfcEmisor ?? undefined, rfcReceptor: data.rfcReceptor ?? undefined, selloCfdi: data.selloCfdi ?? undefined, total: data.total ?? undefined },
    ...parsed,
    ubicaciones,
  };
}
