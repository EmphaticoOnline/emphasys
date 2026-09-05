import { extractCfdiFechaTimbrado, parseCartaPorte31Xml } from './carta-porte-print.parser';
import type { CartaPortePrintModel } from './carta-porte-print.types';

export type CartaPortePrintGeneralData = {
  documentoId: number; serie?: string | null; folio?: string | number | null; fecha?: string | null;
  uuid?: string | null; fechaTimbrado?: string | null; rfcEmisor?: string | null; rfcReceptor?: string | null;
  selloCfdi?: string | null; total?: number | null;
  cancelado?: boolean;
  colorTablaHeader?: string | null;
  branding?: CartaPortePrintModel['branding'];
};

export function mapCartaPortePrintModel(data: CartaPortePrintGeneralData, xmlTimbrado: string): CartaPortePrintModel {
  const parsed = parseCartaPorte31Xml(xmlTimbrado);
  return {
    documento: { documentoId: data.documentoId, serie: data.serie ?? undefined, folio: data.folio == null ? undefined : String(data.folio), fecha: data.fecha ?? undefined },
    branding: data.branding,
    cancelado: data.cancelado === true,
    colorTablaHeader: data.colorTablaHeader ?? undefined,
    cfdi: { uuid: data.uuid ?? undefined, fechaTimbrado: extractCfdiFechaTimbrado(xmlTimbrado) ?? data.fechaTimbrado ?? undefined, rfcEmisor: data.rfcEmisor ?? undefined, rfcReceptor: data.rfcReceptor ?? undefined, selloCfdi: data.selloCfdi ?? undefined, total: data.total ?? undefined },
    ...parsed,
  };
}
