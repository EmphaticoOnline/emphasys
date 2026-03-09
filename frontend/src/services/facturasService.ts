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
import { apiFetch } from './apiFetch';

const TIPO: TipoDocumento = 'factura';

export const getFacturas = () => getDocumentos(TIPO);
export const getFactura = (id: number) => getDocumento(id, TIPO);
export const createFactura = (data: CotizacionCrearPayload) => createDocumento(TIPO, data);
export const updateFactura = (id: number, data: Partial<CotizacionCrearPayload>) => updateDocumento(id, TIPO, data);
export const replacePartidas = (documentoId: number, partidas: CotizacionPartidaPayload[]) =>
  replacePartidasBase(documentoId, TIPO, partidas);
export const deleteFactura = (id: number) => deleteDocumento(id, TIPO);
export const downloadFacturaPdf = (id: number) => downloadDocumentoPdf(id, TIPO);

export const timbrarFactura = (id: number) =>
  apiFetch(`/api/facturas/${id}/timbrar`, {
    method: 'POST',
  });

export const enviarFactura = (id: number, email?: string) =>
  apiFetch(`/api/facturas/${id}/enviar`, {
    method: 'POST',
    // El body se serializa como JSON en apiFetch si es un objeto
    body: email ? ({ email } as any) : undefined,
  });
