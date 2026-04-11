import { apiFetch } from './apiFetch';
import type { Contacto } from '../types/contactos.types';

export async function fetchContactos(): Promise<Contacto[]> {
  return apiFetch('/api/contactos');
}

export async function fetchVendedores(): Promise<Contacto[]> {
  const contactos = await apiFetch('/api/contactos');
  return (contactos as Contacto[]).filter((c) => (c.tipo_contacto || '').toLowerCase() === 'vendedor');
}
