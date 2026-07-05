import type { RolResumen } from './sessionTypes';

// Espejo exacto de backend/src/modules/auth/scope-comercial.ts
const ADMIN_ROLE_NAMES = new Set(['administrador', 'admin']);
const VENDEDOR_ROLE_NAMES = new Set(['vendedor', 'ventas']);

const normalizarRolNombre = (nombre?: string | null) => (nombre ?? '').trim().toLowerCase();

export function esRolAdmin(roles: RolResumen[] | undefined): boolean {
  return (roles ?? []).some((rol) => ADMIN_ROLE_NAMES.has(normalizarRolNombre(rol.nombre)));
}

export function esRolVendedor(roles: RolResumen[] | undefined): boolean {
  return (roles ?? []).some((rol) => VENDEDOR_ROLE_NAMES.has(normalizarRolNombre(rol.nombre)));
}
