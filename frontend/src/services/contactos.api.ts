import type { Contacto, ContactoDetalle, ContactoDomicilio } from '../types/contactos.types';
import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';

export type CatalogoConfigurablesRespuesta = {
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

const BASE_URL = '/api/contactos';

export async function getContactos(): Promise<Contacto[]> {
  return apiFetch(BASE_URL);
}

export async function getContacto(id: number): Promise<ContactoDetalle | Contacto> {
  return apiFetch(`${BASE_URL}/${id}`);
}

export async function crearContacto(data: Partial<Contacto> | Record<string, unknown>): Promise<Contacto> {
  return apiFetch(BASE_URL, {
    method: 'POST',
    body: data as any,
  });
}

export async function actualizarContacto(id: number, data: Partial<Contacto> | Record<string, unknown>): Promise<Contacto> {
  return apiFetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    body: data as any,
  });
}

export async function eliminarContacto(id: number): Promise<Contacto> {
  return apiFetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

export async function obtenerCatalogosConfigurablesContacto(contactoId?: number): Promise<CatalogoConfigurablesRespuesta> {
  const url = contactoId ? `${BASE_URL}/catalogos-configurables?contactoId=${contactoId}` : `${BASE_URL}/catalogos-configurables`;
  return apiFetch(url);
}

export async function guardarCatalogosConfigurablesContacto(contactoId: number, catalogoIds: number[]): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE_URL}/${contactoId}/catalogos-configurables`, {
    method: 'PUT',
    body: { catalogoIds } as any,
  });
}

export const listarDomiciliosContacto = (id: number) => apiFetch<ContactoDomicilio[]>(`${BASE_URL}/${id}/domicilios`);
export const crearDomicilioContacto = (id: number, data: Partial<ContactoDomicilio>) => apiFetch<ContactoDomicilio>(`${BASE_URL}/${id}/domicilios`, { method: 'POST', body: data as any });
export const actualizarDomicilioContacto = (id: number, domicilioId: number, data: Partial<ContactoDomicilio>) => apiFetch<ContactoDomicilio>(`${BASE_URL}/${id}/domicilios/${domicilioId}`, { method: 'PUT', body: data as any });
export const eliminarDomicilioContacto = (id: number, domicilioId: number) => apiFetch<void>(`${BASE_URL}/${id}/domicilios/${domicilioId}`, { method: 'DELETE' });

export type ExportContactoColumna = { field: string; headerName: string };

export async function exportarContactos(payload: {
  filters: Record<string, any>;
  columns: ExportContactoColumna[];
}): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`${BASE_URL}/exportar`, {
    method: 'POST',
    body: payload as any,
  });
  triggerBlobDownload(blob, filename);
}
