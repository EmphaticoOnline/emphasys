import { apiFetch } from './apiFetch';
import type { Rol, RolPayload } from '../types/rol';

export async function fetchRoles(empresaId: number): Promise<Rol[]> {
  return apiFetch<Rol[]>(`/api/empresas/${empresaId}/roles`);
}

export async function createRol(payload: RolPayload): Promise<Rol> {
  return apiFetch<Rol>('/api/roles', {
    method: 'POST',
    body: payload as any,
  });
}

export async function updateRol(id: number, payload: RolPayload): Promise<Rol> {
  return apiFetch<Rol>(`/api/roles/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function deleteRol(id: number): Promise<void> {
  await apiFetch<void>(`/api/roles/${id}`, {
    method: 'DELETE',
  });
}
