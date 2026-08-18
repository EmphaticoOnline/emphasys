// Fuente única de verdad: campos económicos sensibles de producto (costo, precio)
// y las funciones para omitirlos/filtrarlos según el rol del usuario autenticado.
// El criterio de autorización es el mismo `esAdmin` de resolverContextoScopeComercial
// (backend/src/modules/auth/scope-comercial.ts) — no se introduce ningún permiso nuevo.

export const CAMPOS_ECONOMICOS_PRODUCTO = [
  'costo_estandar',
  'costo_promedio',
  'ultimo_costo',
  'precio_publico',
  'precio_mayoreo',
  'precio_menudeo',
  'precio_distribuidor',
] as const;

const CAMPOS_ECONOMICOS_SET = new Set<string>(CAMPOS_ECONOMICOS_PRODUCTO);

/** Quita los campos económicos de un producto individual si el usuario no es admin. */
export function omitirCamposEconomicos<T extends Record<string, any>>(
  producto: T | null | undefined,
  esAdmin: boolean
): T | null | undefined {
  if (esAdmin || !producto) return producto;
  const resultado: Record<string, any> = { ...producto };
  for (const campo of CAMPOS_ECONOMICOS_PRODUCTO) {
    delete resultado[campo];
  }
  return resultado as T;
}

/** Igual que omitirCamposEconomicos pero para un arreglo de productos. */
export function omitirCamposEconomicosLista<T extends Record<string, any>>(
  productos: T[],
  esAdmin: boolean
): T[] {
  if (esAdmin) return productos;
  return productos.map((producto) => omitirCamposEconomicos(producto, esAdmin) as T);
}

/** Ignora silenciosamente los campos económicos que vengan en el body de create/update si el usuario no es admin. */
export function filtrarCamposEconomicosDeEntrada<T extends Record<string, any>>(
  data: T,
  esAdmin: boolean
): T {
  if (esAdmin || !data) return data;
  const resultado: Record<string, any> = { ...data };
  for (const campo of CAMPOS_ECONOMICOS_PRODUCTO) {
    delete resultado[campo];
  }
  return resultado as T;
}

/** Quita del listado de columnas de exportación cualquier campo económico si el usuario no es admin. */
export function excluirColumnasEconomicas<T extends { field: string }>(
  columnas: T[],
  esAdmin: boolean
): T[] {
  if (esAdmin) return columnas;
  return columnas.filter((columna) => !CAMPOS_ECONOMICOS_SET.has(columna.field));
}
