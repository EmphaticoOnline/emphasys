import type { CotizacionCrearPayload, CotizacionPartidaPayload } from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import {
  getDocumentos,
  getDocumento,
  createDocumento,
  updateDocumento,
  replacePartidas as replacePartidasBase,
  deleteDocumento,
  downloadDocumentoPdf,
} from './documentosService';

const TIPO: TipoDocumento = 'factura';

export const getFacturas = () => getDocumentos(TIPO);
export const getFactura = (id: number) => getDocumento(id, TIPO);
export const createFactura = (data: CotizacionCrearPayload) => createDocumento(TIPO, data);
export const updateFactura = (id: number, data: Partial<CotizacionCrearPayload>) => updateDocumento(id, TIPO, data);
export const replacePartidas = (documentoId: number, partidas: CotizacionPartidaPayload[]) =>
  replacePartidasBase(documentoId, TIPO, partidas);
export const deleteFactura = (id: number) => deleteDocumento(id, TIPO);
export const downloadFacturaPdf = (id: number) => downloadDocumentoPdf(id, TIPO);
