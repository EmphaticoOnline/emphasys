import { obtenerRolesDeUsuarioEnEmpresa, obtenerUsuarioPorId } from './auth.service';

export const ADMIN_ROLE_NAMES = new Set(['administrador', 'admin']);
export const VENDEDOR_ROLE_NAMES = new Set(['vendedor', 'ventas']);

export const normalizarRolNombre = (nombre?: string | null) => (nombre ?? '').trim().toLowerCase();

export interface ContextoScopeComercial {
  esAdmin: boolean;
  esVendedor: boolean;
  vendedorContactoId: number | null;
}

export async function resolverContextoScopeComercial(
  empresaId: number,
  userId?: number,
  esSuperadmin?: boolean
): Promise<ContextoScopeComercial> {
  if (!userId) {
    return { esAdmin: Boolean(esSuperadmin), esVendedor: false, vendedorContactoId: null };
  }

  const [usuario, roles] = await Promise.all([
    obtenerUsuarioPorId(userId),
    obtenerRolesDeUsuarioEnEmpresa(userId, empresaId),
  ]);

  const roleNames = roles.map((rol) => normalizarRolNombre(rol.nombre));
  const esAdminRole = roleNames.some((name) => ADMIN_ROLE_NAMES.has(name));
  const esVendedorRole = roleNames.some((name) => VENDEDOR_ROLE_NAMES.has(name));

  return {
    esAdmin: Boolean(esSuperadmin || esAdminRole),
    esVendedor: Boolean(esVendedorRole),
    vendedorContactoId: usuario?.vendedor_contacto_id ?? null,
  };
}

export interface ScopeVentasResultado {
  /** true si hay que forzar el filtro por agente/vendedor en la consulta */
  restringido: boolean;
  /** true si el usuario es vendedor sin vendedor_contacto_id asociado: debe ver cero resultados */
  sinAcceso: boolean;
  agenteId: number | null;
}

/**
 * Admin -> sin restricción. Otros roles distintos de "vendedor" -> sin restricción
 * (comportamiento actual intacto). Vendedor con vendedor_contacto_id -> restringido a ese id.
 * Vendedor sin vendedor_contacto_id -> sinAcceso (cero resultados).
 */
export function evaluarScopeVentas(ctx: ContextoScopeComercial): ScopeVentasResultado {
  if (ctx.esAdmin) {
    return { restringido: false, sinAcceso: false, agenteId: null };
  }
  if (!ctx.esVendedor) {
    return { restringido: false, sinAcceso: false, agenteId: null };
  }
  if (!ctx.vendedorContactoId) {
    return { restringido: true, sinAcceso: true, agenteId: null };
  }
  return { restringido: true, sinAcceso: false, agenteId: ctx.vendedorContactoId };
}

/**
 * Empuja `<columnaAgente> = $N` a whereClauses/values cuando el scope está restringido.
 * No-op para admin u otros roles, y no-op cuando sinAcceso (el caller debe cortocircuitar antes).
 */
export function buildSalesScopeWhere(
  scope: ScopeVentasResultado,
  columnaAgente: string,
  whereClauses: string[],
  values: any[]
): void {
  if (scope.restringido && !scope.sinAcceso && scope.agenteId) {
    values.push(scope.agenteId);
    whereClauses.push(`${columnaAgente} = $${values.length}`);
  }
}
