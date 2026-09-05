import { apiFetch } from './apiFetch';

export interface Unidad {
  id: number;
  clave: string;
  descripcion: string;
  unidad_sat_id: number;
  activo: boolean;
  unidad_sat_clave?: string;
  unidad_sat_descripcion?: string;
}

const BASE_URL = '/api/unidades';

export async function fetchUnidades(incluirInactivas = false): Promise<Unidad[]> {
  return apiFetch<Unidad[]>(`${BASE_URL}?incluirInactivas=${incluirInactivas}`);
}
export const crearUnidad = (payload: Omit<Unidad, 'id' | 'unidad_sat_clave' | 'unidad_sat_descripcion'>) => apiFetch<Unidad>(BASE_URL, { method: 'POST', body: payload });
export const actualizarUnidad = (id: number, payload: Omit<Unidad, 'id' | 'unidad_sat_clave' | 'unidad_sat_descripcion'>) => apiFetch<Unidad>(`${BASE_URL}/${id}`, { method: 'PUT', body: payload });
export const eliminarUnidad = (id: number) => apiFetch<void>(`${BASE_URL}/${id}`, { method: 'DELETE' });
