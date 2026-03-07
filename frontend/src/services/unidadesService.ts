export interface Unidad {
  id: number;
  clave: string;
  descripcion: string;
  unidad_sat_id: number;
  activo: boolean;
}

const BASE_URL = '/api/unidades';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Error al obtener unidades');
  }
  return res.json();
}

export async function fetchUnidades(): Promise<Unidad[]> {
  const res = await fetch(BASE_URL);
  return handleResponse<Unidad[]>(res);
}
