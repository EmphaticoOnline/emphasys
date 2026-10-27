import type { RolResumen } from './sessionTypes';

// Espejo exacto de backend/src/modules/auth/scope-comercial.ts
const ADMIN_ROLE_NAMES = new Set(['administrador', 'admin']);
const VENDEDOR_ROLE_NAMES = new Set(['vendedor', 'ventas']);
// Espejo de backend/src/modules/auth/rol-produccion.ts
const PRODUCCION_ROLE_NAMES = new Set(['produccion', 'producción']);

const normalizarRolNombre = (nombre?: string | null) => (nombre ?? '').trim().toLowerCase();

export function esRolAdmin(roles: RolResumen[] | undefined): boolean {
  return (roles ?? []).some((rol) => ADMIN_ROLE_NAMES.has(normalizarRolNombre(rol.nombre)));
}

export function esRolVendedor(roles: RolResumen[] | undefined): boolean {
  return (roles ?? []).some((rol) => VENDEDOR_ROLE_NAMES.has(normalizarRolNombre(rol.nombre)));
}

// Restringido al módulo de Producción sólo si TODOS sus roles son "Producción".
export function esSoloRolProduccion(roles: RolResumen[] | undefined): boolean {
  const lista = roles ?? [];
  return lista.length > 0 && lista.every((rol) => PRODUCCION_ROLE_NAMES.has(normalizarRolNombre(rol.nombre)));
}
