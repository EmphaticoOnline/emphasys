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
  origenContactoId?: number | null;
  vendedorId?: number | null;
  activo?: 'todos' | 'activos' | 'inactivos';
  fechaAltaDesde?: string;
  fechaAltaHasta?: string;
  interesInicial?: string;
  observaciones?: string;
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
  if (options.origenContactoId) {
    params.set('origen_contacto_id', String(options.origenContactoId));
  }
  if (options.vendedorId) {
    params.set('vendedor_id', String(options.vendedorId));
  }
  if (options.activo && options.activo !== 'todos') {
    params.set('activo', options.activo);
  }
  if (options.fechaAltaDesde) {
    params.set('fecha_alta_desde', options.fechaAltaDesde);
  }
  if (options.fechaAltaHasta) {
    params.set('fecha_alta_hasta', options.fechaAltaHasta);
  }
  if (options.interesInicial) {
    params.set('interes_inicial', options.interesInicial);
  }
  if (options.observaciones) {
    params.set('observaciones', options.observaciones);
  }
  return apiFetch(`/api/contactos?${params.toString()}`);
}

export async function fetchVendedores(): Promise<Contacto[]> {
  const contactos = await apiFetch('/api/contactos');
  return (contactos as Contacto[]).filter((c) => (c.tipo_contacto || '').toLowerCase() === 'vendedor');
}
