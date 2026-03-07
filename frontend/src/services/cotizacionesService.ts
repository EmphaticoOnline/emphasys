import type { CotizacionListado, CotizacionDetalle, CotizacionCrearPayload, CotizacionPartidaPayload } from '../types/cotizacion';
import { apiFetch } from './apiFetch';
import { loadSession, clearSession } from '../session/sessionStorage';

const BASE_URL = '/api/documentos';

export async function getCotizaciones(): Promise<CotizacionListado[]> {
  return apiFetch(`${BASE_URL}?tipo_documento=Cotizacion`);
}

export async function getCotizacion(id: number): Promise<CotizacionDetalle> {
  return apiFetch(`${BASE_URL}/${id}`);
}

export async function createCotizacion(data: CotizacionCrearPayload) {
  return apiFetch(BASE_URL, {
    method: 'POST',
    body: data as any,
  });
}

export async function updateCotizacion(id: number, data: Partial<CotizacionCrearPayload>) {
  return apiFetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    body: data as any,
  });
}

export async function addPartida(documentoId: number, partida: CotizacionPartidaPayload) {
  return apiFetch(`${BASE_URL}/${documentoId}/partidas`, {
    method: 'POST',
    body: partida as any,
  });
}

export async function replacePartidas(documentoId: number, partidas: CotizacionPartidaPayload[]) {
  return apiFetch(`${BASE_URL}/${documentoId}/partidas`, {
    method: 'PUT',
    body: { partidas } as any,
  });
}

export async function deleteCotizacion(id: number) {
  await apiFetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
}

export async function downloadCotizacionPdf(id: number): Promise<Blob> {
  const session = loadSession();
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.replace(/\/$/, '')) || '';
  const url = `${baseUrl}/api/documentos/${id}/pdf`;

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
