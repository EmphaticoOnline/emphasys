import type { CotizacionCrearPayload, CotizacionPartidaPayload } from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import {
  getDocumentos,
  getDocumento,
  createDocumento,
  updateDocumento,
  addPartida as addPartidaBase,
  replacePartidas as replacePartidasBase,
  deleteDocumento,
  abrirDocumentoPdfEnNuevaVentana,
  downloadDocumentoPdf,
} from './documentosService';

const TIPO: TipoDocumento = 'cotizacion';

export const getCotizaciones = () => getDocumentos(TIPO);
export const getCotizacion = (id: number) => getDocumento(id, TIPO);
export const createCotizacion = (data: CotizacionCrearPayload) => createDocumento(TIPO, data);
export const updateCotizacion = (id: number, data: Partial<CotizacionCrearPayload>) => updateDocumento(id, TIPO, data);
export const addPartida = (documentoId: number, partida: CotizacionPartidaPayload) => addPartidaBase(documentoId, TIPO, partida);
export const replacePartidas = (documentoId: number, partidas: CotizacionPartidaPayload[]) =>
  replacePartidasBase(documentoId, TIPO, partidas);
export const deleteCotizacion = (id: number) => deleteDocumento(id, TIPO);
export const downloadCotizacionPdf = (id: number) => downloadDocumentoPdf(id, TIPO);
export const abrirCotizacionPdfEnNuevaVentana = (id: number) => abrirDocumentoPdfEnNuevaVentana(id, TIPO);
