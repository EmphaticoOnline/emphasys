import { apiFetch } from './apiFetch';
import type { TipoPrecioLista } from '../constants/precios';

export type PrecioLista = {
  id: number;
  empresa_id: number;
  nombre: string;
  tipo_precio: TipoPrecioLista;
  orden: number | null;
  es_default: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type PrecioListaPayload = {
  nombre: string;
  tipo_precio: TipoPrecioLista;
  orden?: number | null;
  es_default?: boolean;
  activo?: boolean;
};

export function fetchPreciosListas(incluirInactivas = false) {
  const query = incluirInactivas ? '?incluir_inactivas=1' : '';
  return apiFetch<PrecioLista[]>(`/api/precios-listas${query}`);
}

export function fetchPrecioLista(id: number) {
  return apiFetch<PrecioLista>(`/api/precios-listas/${id}`);
}

export function createPrecioLista(payload: PrecioListaPayload) {
  return apiFetch<PrecioLista>('/api/precios-listas', {
    method: 'POST',
    body: payload as any,
  });
}

export function updatePrecioLista(id: number, payload: Partial<PrecioListaPayload>) {
  return apiFetch<PrecioLista>(`/api/precios-listas/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export function deletePrecioLista(id: number) {
  return apiFetch<PrecioLista>(`/api/precios-listas/${id}`, {
    method: 'DELETE',
  });
}