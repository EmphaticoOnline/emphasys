import type { CotizacionDetalle, CotizacionListado, CotizacionCrearPayload, CotizacionPartidaPayload } from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import { apiFetch } from './apiFetch';
import { clearSession, loadSession } from '../session/sessionStorage';

const BASE_PATH: Record<TipoDocumento, string> = {
  cotizacion: '/api/documentos',
  factura: '/api/facturas',
  pedido: '/api/documentos',
  remision: '/api/documentos',
};

const getBasePath = (tipo: TipoDocumento) => BASE_PATH[tipo] || '/api/documentos';
const shouldAppendTipoQuery = (tipo: TipoDocumento) => getBasePath(tipo) === '/api/documentos';
const withTipoQuery = (path: string, tipo: TipoDocumento) =>
  shouldAppendTipoQuery(tipo) ? `${path}${path.includes('?') ? '&' : '?'}tipo_documento=${tipo}` : path;

export function getDocumentos(tipo: TipoDocumento): Promise<CotizacionListado[]> {
  const base = getBasePath(tipo);
  const url = withTipoQuery(base, tipo);
  return apiFetch(url);
}

export function getDocumento(id: number, tipo: TipoDocumento): Promise<CotizacionDetalle> {
  const base = getBasePath(tipo);
  const url = withTipoQuery(`${base}/${id}`, tipo);
  return apiFetch(url);
}

export function createDocumento(tipo: TipoDocumento, data: CotizacionCrearPayload) {
  const base = getBasePath(tipo);
  return apiFetch(base, {
    method: 'POST',
    body: { ...data, tipo_documento: tipo } as any,
  });
}

export function updateDocumento(id: number, tipo: TipoDocumento, data: Partial<CotizacionCrearPayload>) {
  const base = getBasePath(tipo);
  const url = withTipoQuery(`${base}/${id}`, tipo);
  return apiFetch(url, {
    method: 'PUT',
    body: { ...data, tipo_documento: tipo } as any,
  });
}

export function addPartida(documentoId: number, tipo: TipoDocumento, partida: CotizacionPartidaPayload) {
  const base = getBasePath(tipo);
  return apiFetch(`${base}/${documentoId}/partidas`, {
    method: 'POST',
    body: partida as any,
  });
}

export function replacePartidas(documentoId: number, tipo: TipoDocumento, partidas: CotizacionPartidaPayload[]) {
  const base = getBasePath(tipo);
  return apiFetch(`${base}/${documentoId}/partidas`, {
    method: 'PUT',
    body: { partidas } as any,
  });
}

export async function deleteDocumento(id: number, tipo: TipoDocumento) {
  const base = getBasePath(tipo);
  const url = withTipoQuery(`${base}/${id}`, tipo);
  await apiFetch(url, { method: 'DELETE' });
}

export async function downloadDocumentoPdf(id: number, tipo: TipoDocumento): Promise<Blob> {
  const session = loadSession();
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.replace(/\/$/, '')) || '';
  const basePath = getBasePath(tipo);
  const pathWithQuery = withTipoQuery(`${basePath}/${id}/pdf`, tipo);
  const url = `${apiBase}${pathWithQuery}`;

  const headers = new Headers();
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`);
  if (session.empresaActivaId) headers.set('X-Empresa-Id', String(session.empresaActivaId));

  const response = await fetch(url, { headers });

  if (response.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = text || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return response.blob();
}
