import { apiFetch } from './apiFetch';

export interface Unidad {
  id: number;
  clave: string;
  descripcion: string;
  unidad_sat_id: number;
  activo: boolean;
}

const BASE_URL = '/api/unidades';

export async function fetchUnidades(): Promise<Unidad[]> {
  return apiFetch<Unidad[]>(BASE_URL);
}
