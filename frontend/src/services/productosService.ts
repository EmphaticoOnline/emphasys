import type { Producto, ProductoBasico } from '../types/producto';
import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';

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

export type ProductoArchivo = {
  id: number;
  producto_id: number;
  tipo_archivo: string;
  archivo: string;
  descripcion: string | null;
  orden_visual: number;
  principal: boolean;
  fecha_creacion: string;
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

export async function fetchProductoArchivos(productoId: number): Promise<ProductoArchivo[]> {
  return apiFetch(`${BASE_URL}/${productoId}/archivos`);
}

export async function uploadProductoImagen(productoId: number, file: File, descripcion?: string): Promise<ProductoArchivo> {
  const formData = new FormData();
  formData.append('file', file);

  if (descripcion?.trim()) {
    formData.append('descripcion', descripcion.trim());
  }

  return apiFetch(`${BASE_URL}/${productoId}/archivos`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteProductoArchivo(archivoId: number): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE_URL}/archivos/${archivoId}`, {
    method: 'DELETE',
  });
}

export async function marcarProductoArchivoPrincipal(archivoId: number): Promise<ProductoArchivo> {
  return apiFetch(`${BASE_URL}/archivos/${archivoId}/principal`, {
    method: 'PATCH',
  });
}

export type ExportProductoColumna = { field: string; headerName: string };

export async function exportarProductos(payload: {
  filters: Record<string, any>;
  columns: ExportProductoColumna[];
}): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`${BASE_URL}/exportar`, {
    method: 'POST',
    body: payload as any,
  });
  triggerBlobDownload(blob, filename);
}
