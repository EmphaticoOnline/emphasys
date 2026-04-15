import { apiFetch } from './apiFetch';
import type { Contacto } from '../types/contactos.types';

export async function fetchContactos(tipos?: string[]): Promise<Contacto[]> {
  const query = tipos && tipos.length ? `?tipos=${encodeURIComponent(tipos.join(','))}` : '';
  return apiFetch(`/api/contactos${query}`);
}

export type ContactosPaginadosResponse = {
  data: Contacto[];
  total: number;
  page: number;
  limit: number;
};

export async function fetchContactosPaginados(options: {
  page: number;
  limit: number;
  tipos?: string[];
  search?: string;
}): Promise<ContactosPaginadosResponse> {
  const params = new URLSearchParams();
  params.set('page', String(options.page));
  params.set('limit', String(options.limit));
  if (options.tipos && options.tipos.length) {
    params.set('tipos', options.tipos.join(','));
  }
  if (options.search) {
    params.set('search', options.search);
  }
  return apiFetch(`/api/contactos?${params.toString()}`);
}

export async function fetchVendedores(): Promise<Contacto[]> {
  const contactos = await apiFetch('/api/contactos');
  return (contactos as Contacto[]).filter((c) => (c.tipo_contacto || '').toLowerCase() === 'vendedor');
}
