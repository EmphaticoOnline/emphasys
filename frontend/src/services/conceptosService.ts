import { apiFetch } from './apiFetch';
import type { Concepto } from '../types/finanzas';

const BASE = '/api/conceptos';

export async function fetchConceptos(): Promise<Concepto[]> {
  return apiFetch(BASE);
}

export async function crearConcepto(payload: Partial<Concepto>): Promise<Concepto> {
  return apiFetch(BASE, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarConcepto(id: number, payload: Partial<Concepto>): Promise<Concepto> {
  return apiFetch(`${BASE}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarConcepto(id: number): Promise<void> {
  await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}
