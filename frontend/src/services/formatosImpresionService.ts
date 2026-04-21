import { apiFetch } from './apiFetch';
import type { LayoutConfig, LayoutConfigResponse } from '../types/formatosImpresion';

const BASE_URL = '/api/configuracion/layout';

export async function fetchLayoutConfiguracion(params: {
  tipo_documento: string;
  serie?: string | null;
  includeSeries?: boolean;
}): Promise<LayoutConfigResponse> {
  const qs = new URLSearchParams();
  qs.set('tipo_documento', params.tipo_documento);
  if (params.serie) {
    qs.set('serie', params.serie);
  }
  if (params.includeSeries) {
    qs.set('includeSeries', 'true');
  }
  return apiFetch<LayoutConfigResponse>(`${BASE_URL}?${qs.toString()}`);
}

export async function guardarLayoutConfiguracion(payload: {
  tipo_documento: string;
  serie?: string | null;
  configuracion: LayoutConfig;
}) {
  return apiFetch(BASE_URL, {
    method: 'POST',
    body: payload as any,
  });
}
