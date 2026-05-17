import { apiFetch } from './apiFetch';

export type PrecioCapturaLista = {
  id: number;
  nombre: string;
  orden: number | null;
  es_default: boolean;
};

export type PrecioCapturaProducto = {
  producto_id: number;
  clave: string | null;
  descripcion: string;
  clasificacion: string | null;
  familia: string | null;
  activo: boolean;
  precios: Record<string, number | null>;
};

export type PreciosCapturaResponse = {
  listas: PrecioCapturaLista[];
  productos: PrecioCapturaProducto[];
  filtros: {
    clasificaciones: string[];
    familias: string[];
  };
};

export type PrecioBatchItem = {
  producto_id: number;
  precio_lista_id: number;
  precio: number | null;
};

export type PrecioBatchResponse = {
  ok: boolean;
  input_count: number;
  valid_count: number;
  deleted_count: number;
  updated_count: number;
  inserted_count: number;
};

export type PrecioDocumentoResolucion = {
  precio_lista_id: number | null;
  precio: number | null;
  origen: 'contacto' | 'clasificacion' | 'default' | 'sin_lista' | 'sin_precio';
};

export async function fetchPreciosCaptura(params?: {
  clave?: string;
  descripcion?: string;
  clasificacion?: string;
  familia?: string;
}): Promise<PreciosCapturaResponse> {
  const searchParams = new URLSearchParams();

  if (params?.clave?.trim()) searchParams.set('clave', params.clave.trim());
  if (params?.descripcion?.trim()) searchParams.set('descripcion', params.descripcion.trim());
  if (params?.clasificacion?.trim()) searchParams.set('clasificacion', params.clasificacion.trim());
  if (params?.familia?.trim()) searchParams.set('familia', params.familia.trim());

  const query = searchParams.toString();
  return apiFetch(`/api/precios/captura${query ? `?${query}` : ''}`);
}

export async function savePreciosBatch(items: PrecioBatchItem[]): Promise<PrecioBatchResponse> {
  return apiFetch('/api/precios/captura', {
    method: 'PUT',
    body: { items } as any,
  });
}

export async function resolvePrecioDocumento(productoId: number, contactoId?: number | null): Promise<PrecioDocumentoResolucion> {
  const searchParams = new URLSearchParams({ producto_id: String(productoId) });
  if (contactoId) {
    searchParams.set('contacto_id', String(contactoId));
  }

  return apiFetch(`/api/precios/resolver-documento?${searchParams.toString()}`);
}