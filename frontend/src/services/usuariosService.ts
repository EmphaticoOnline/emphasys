import { apiFetch } from './apiFetch';
import type { Usuario, UsuarioDetalle, UsuarioPayload } from '../types/usuario';

export async function fetchUsuarios(): Promise<Usuario[]> {
  return apiFetch<Usuario[]>('/api/usuarios');
}

export async function fetchUsuario(id: number): Promise<UsuarioDetalle> {
  return apiFetch<UsuarioDetalle>(`/api/usuarios/${id}`);
}

export async function fetchUsuarioEmpresas(id: number): Promise<{ empresas: { empresa_id: number; activo: boolean }[]; roles: { empresa_id: number; rol_id: number }[] }> {
  return apiFetch(`/api/usuarios/${id}/empresas`);
}

export async function createUsuario(payload: UsuarioPayload): Promise<Usuario> {
  return apiFetch<Usuario>('/api/usuarios', {
    method: 'POST',
    body: payload as any,
  });
}

export async function updateUsuario(id: number, payload: UsuarioPayload): Promise<Usuario> {
  return apiFetch<Usuario>(`/api/usuarios/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function deleteUsuario(id: number): Promise<void> {
  await apiFetch<void>(`/api/usuarios/${id}`, {
    method: 'DELETE',
  });
}

export async function asignarEmpresas(usuarioId: number, empresas: { empresa_id: number; activo?: boolean }[]) {
  await apiFetch<void>(`/api/usuarios/${usuarioId}/empresas`, {
    method: 'POST',
    body: { empresas } as any,
  });
}

export async function asignarRoles(usuarioId: number, empresaId: number, roles: number[]) {
  await apiFetch<void>(`/api/usuarios/${usuarioId}/roles`, {
    method: 'POST',
    body: { empresa_id: empresaId, roles } as any,
  });
}
