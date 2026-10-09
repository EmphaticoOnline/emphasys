import { isThemeId, type ThemeId } from './themes';

/**
 * Único punto que decide qué tema está activo.
 *
 * Hoy la política es la ruta. Mañana puede anteponerse una preferencia
 * de perfil sin tocar componentes ni los temas mismos: quien llama pasa
 * `preference` y esta función la respeta antes que la ruta.
 *
 * Los temas no saben por qué fueron elegidos. Los componentes no eligen tema.
 */

export type ThemeResolutionContext = {
  pathname: string;
  preference?: ThemeId | null;
};

/**
 * Política vigente: estas rutas usan el tema experimental.
 * No es una propiedad del tema ni de un módulo de UI.
 *
 * Las rutas exactas no se propagan a sus hijos. `/informes` y `/configuracion`
 * no pueden ser prefijo: las pantallas que se abren desde el índice conservan
 * su tema hasta que cada una se homologue por separado.
 */
const EXPERIMENTAL_EXACT_PATHS = [
  '/informes',
  '/crm',
  '/configuracion',
  '/login',
  '/seleccionar-empresa',
  '/inventario/movimientos',
] as const;

const EXPERIMENTAL_PATH_PREFIXES = [
  '/ventas/nota_credito',
  '/ventas/pago_cliente',
  '/ventas/ajuste_cliente',
  '/ventas/factura',
  '/ventas/traslado',
  '/ventas/cotizacion',
  '/compras/nota_credito_compra',
  '/compras/orden_compra',
  '/compras/recepcion',
  '/compras/factura_compra',
  '/compras/pago_proveedor',
  '/compras/ajuste_proveedor',
  '/informes/resumen-ejecutivo',
  '/informes/ventas/ventas-por-origen-contacto',
  '/informes/ventas/ventas-por-producto',
  '/informes/ventas/ventas-por-periodo',
  '/informes/ventas/conversion-cotizaciones',
  '/informes/ventas/ventas-por-cliente',
  '/informes/ventas/ventas-por-vendedor',
  '/informes/crm/evaluacion-vendedores',
  '/finanzas',
  '/contabilidad',
  '/contactos',
  '/productos',
  '/crm/conversaciones',
  '/crm/actividades',
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resolveThemeFromPath(pathname: string): ThemeId {
  if (EXPERIMENTAL_EXACT_PATHS.some((path) => pathname === path)) {
    return 'experimental';
  }
  if (EXPERIMENTAL_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return 'experimental';
  }
  return 'classic';
}

export function resolveActiveThemeId(context: ThemeResolutionContext): ThemeId {
  if (context.preference && isThemeId(context.preference)) {
    return context.preference;
  }
  return resolveThemeFromPath(context.pathname);
}
