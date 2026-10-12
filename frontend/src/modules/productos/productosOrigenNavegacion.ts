export const PRODUCTOS_ORIGEN_STATE = 'productosOrigen';

const STORAGE_KEY = 'emphasys.productos.origenRelacionados';

export type RestauracionProductoRelacionado = {
  productoId: number;
  tipoDocumento: string;
  scrollDetalle: number;
};

export type ProductosOrigenNavegacion = {
  empresaId: number;
  productoId: number;
  busqueda: string;
  tab: 'relacionados';
  tipoDocumento: string;
  scrollLista: number;
  scrollDetalle: number;
};

function esOrigen(value: unknown): value is ProductosOrigenNavegacion {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ProductosOrigenNavegacion>;
  return (
    typeof row.empresaId === 'number'
    && Number.isFinite(row.empresaId)
    && typeof row.productoId === 'number'
    && Number.isFinite(row.productoId)
    && typeof row.busqueda === 'string'
    && row.tab === 'relacionados'
    && typeof row.tipoDocumento === 'string'
    && typeof row.scrollLista === 'number'
    && Number.isFinite(row.scrollLista)
    && typeof row.scrollDetalle === 'number'
    && Number.isFinite(row.scrollDetalle)
  );
}

export function olvidarProductosOrigen() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function guardarProductosOrigen(origen: ProductosOrigenNavegacion) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(origen));
}

export function leerProductosOrigenGuardado(): ProductosOrigenNavegacion | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return esOrigen(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function origenDesdeEstado(state: unknown): ProductosOrigenNavegacion | null {
  if (!state || typeof state !== 'object') return null;
  const value = (state as Record<string, unknown>)[PRODUCTOS_ORIGEN_STATE];
  return esOrigen(value) ? value : null;
}

export function resolverProductosOrigen(
  state: unknown,
  navigationType: string,
  empresaId: number,
): ProductosOrigenNavegacion | null {
  const desdeEstado = origenDesdeEstado(state);
  const candidato = desdeEstado ?? (navigationType === 'POP' ? leerProductosOrigenGuardado() : null);
  if (!candidato || candidato.empresaId !== empresaId) return null;
  return candidato;
}
