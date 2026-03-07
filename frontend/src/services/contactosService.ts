import { apiFetch } from './apiFetch';
import type { Contacto } from '../types/contactos.types';

export async function fetchContactos(): Promise<Contacto[]> {
  return apiFetch('/api/contactos');
}
