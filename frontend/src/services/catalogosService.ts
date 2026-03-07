import { apiFetch } from './apiFetch';

export type CatalogoValor = {
  id: number;
  empresa_id: number;
  tipo_catalogo_id: number;
  clave: string | null;
  descripcion: string;
  orden: number | null;
  activo: boolean | null;
  extra?: any;
  tipo_catalogo_nombre?: string | null;
};

const BASE_URL = '/api/catalogos';

export async function fetchCatalogos(tipoCatalogoId: number): Promise<CatalogoValor[]> {
  return apiFetch(`${BASE_URL}?tipo_catalogo_id=${tipoCatalogoId}`);
}

export async function fetchCatalogoTipo(tipoCatalogoId: number): Promise<{ id: number; nombre: string | null }> {
  return apiFetch(`${BASE_URL}/tipos/${tipoCatalogoId}`);
}

export async function createCatalogoValor(payload: {
  tipo_catalogo_id: number;
  clave?: string | null;
  descripcion: string;
  orden?: number | null;
  activo?: boolean;
}): Promise<CatalogoValor> {
  return apiFetch(BASE_URL, {
    method: 'POST',
    body: payload as any,
  });
}

export async function updateCatalogoValor(id: number, payload: Partial<CatalogoValor>): Promise<CatalogoValor> {
  return apiFetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function deleteCatalogoValor(id: number): Promise<void> {
  await apiFetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}
