import type { Producto, ProductoBasico } from '../types/producto';
import { apiFetch } from './apiFetch';

const BASE_URL = '/api/productos';

export type CatalogoConfigurablesProductoRespuesta = {
  entidad_tipo_id: number;
  tipos: {
    id: number;
    nombre: string | null;
    descripcion: string | null;
    valores: {
      id: number;
      tipo_catalogo_id: number;
      descripcion: string;
      clave: string | null;
      orden: number | null;
    }[];
  }[];
  seleccionados: number[];
};

export async function fetchProductos(): Promise<Producto[]> {
  return apiFetch(BASE_URL);
}

export async function fetchProducto(id: number): Promise<Producto> {
  return apiFetch(`${BASE_URL}/${id}`);
}

export async function createProducto(payload: ProductoBasico): Promise<Producto> {
  return apiFetch(BASE_URL, {
    method: 'POST',
    body: payload as any,
  });
}

export async function updateProducto(id: number, payload: ProductoBasico): Promise<Producto> {
  return apiFetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function deleteProducto(id: number): Promise<void> {
  await apiFetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
}

export async function obtenerCatalogosConfigurablesProducto(productoId?: number): Promise<CatalogoConfigurablesProductoRespuesta> {
  const url = productoId ? `${BASE_URL}/catalogos-configurables?productoId=${productoId}` : `${BASE_URL}/catalogos-configurables`;
  return apiFetch(url);
}

export async function guardarCatalogosConfigurablesProducto(productoId: number, catalogoIds: number[]): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE_URL}/${productoId}/catalogos-configurables`, {
    method: 'PUT',
    body: { catalogoIds } as any,
  });
}
