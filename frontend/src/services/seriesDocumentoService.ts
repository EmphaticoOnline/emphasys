import { apiFetch } from './apiFetch';

export type SerieDocumentoItem = {
  id: number;
  serie: string;
  descripcion: string | null;
  tipo_documento: string;
  tipo_documento_nombre: string | null;
  es_fiscal: boolean;
  activa: boolean;
  ultimo_numero: number;
};

export type SerieDocumentoPayload = {
  serie: string;
  descripcion?: string | null;
  tipo_documento: string;
  es_fiscal: boolean;
  activa?: boolean;
  ultimo_numero?: number;
};

export type AsignacionSerieDocumentoItem = {
  id: number;
  usuario_id: number;
  usuario_nombre: string;
  tipo_documento: string;
  tipo_documento_nombre: string | null;
  serie_documento_id: number;
  serie: string;
  es_fiscal: boolean;
  created_at: string;
};

export type AsignacionSerieDocumentoPayload = {
  usuario_id: number;
  serie_documento_id: number;
};

export async function fetchSeriesDocumento(): Promise<SerieDocumentoItem[]> {
  return apiFetch<SerieDocumentoItem[]>('/api/configuracion/series-documento');
}

export async function createSerieDocumento(payload: SerieDocumentoPayload): Promise<SerieDocumentoItem> {
  return apiFetch<SerieDocumentoItem>('/api/configuracion/series-documento', {
    method: 'POST',
    body: payload,
  });
}

export async function updateSerieDocumento(id: number, payload: SerieDocumentoPayload): Promise<SerieDocumentoItem> {
  return apiFetch<SerieDocumentoItem>(`/api/configuracion/series-documento/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function updateSerieDocumentoActiva(id: number, activa: boolean): Promise<SerieDocumentoItem> {
  return apiFetch<SerieDocumentoItem>(`/api/configuracion/series-documento/${id}/activa`, {
    method: 'PATCH',
    body: { activa },
  });
}

export async function fetchAsignacionesSeriesDocumento(): Promise<AsignacionSerieDocumentoItem[]> {
  return apiFetch<AsignacionSerieDocumentoItem[]>('/api/configuracion/series-documento/asignaciones');
}

export async function createAsignacionSerieDocumento(
  payload: AsignacionSerieDocumentoPayload
): Promise<AsignacionSerieDocumentoItem> {
  return apiFetch<AsignacionSerieDocumentoItem>('/api/configuracion/series-documento/asignaciones', {
    method: 'POST',
    body: payload,
  });
}

export async function updateAsignacionSerieDocumento(
  id: number,
  payload: AsignacionSerieDocumentoPayload
): Promise<AsignacionSerieDocumentoItem> {
  return apiFetch<AsignacionSerieDocumentoItem>(`/api/configuracion/series-documento/asignaciones/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteAsignacionSerieDocumento(id: number): Promise<void> {
  await apiFetch<void>(`/api/configuracion/series-documento/asignaciones/${id}`, {
    method: 'DELETE',
  });
}