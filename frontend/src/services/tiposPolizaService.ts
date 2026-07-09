import { apiFetch } from './apiFetch';
import type { TipoPoliza, TipoPolizaInput } from '../types/tiposPoliza';

const BASE = '/api/contabilidad/tipos-poliza';

export async function fetchTiposPoliza(soloActivos = false): Promise<TipoPoliza[]> {
  const query = soloActivos ? '?activo=true' : '';
  return apiFetch(`${BASE}${query}`);
}

export async function crearTipoPoliza(payload: TipoPolizaInput): Promise<TipoPoliza> {
  return apiFetch(BASE, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarTipoPoliza(id: number, payload: TipoPolizaInput): Promise<TipoPoliza> {
  return apiFetch(`${BASE}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function cambiarEstadoTipoPoliza(id: number, activo: boolean): Promise<TipoPoliza> {
  return apiFetch(`${BASE}/${id}/activo`, {
    method: 'PATCH',
    body: { activo } as any,
  });
}

export async function eliminarTipoPoliza(id: number): Promise<void> {
  await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}
