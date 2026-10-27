import type { GridSortModel } from '@mui/x-data-grid';

// Debe coincidir con las columnas que acepta GET /api/productos?sort=
export type ProductosOrdenCampo = 'clave' | 'descripcion' | 'familia' | 'fecha_creacion';
export type ProductosOrdenDireccion = 'asc' | 'desc';

export type ProductosOrden = { field: ProductosOrdenCampo; sort: ProductosOrdenDireccion };

export const PRODUCTOS_ORDEN_OPCIONES: Array<ProductosOrden & { id: string; label: string }> = [
  { id: 'clave-asc', field: 'clave', sort: 'asc', label: 'Clave (A–Z)' },
  { id: 'clave-desc', field: 'clave', sort: 'desc', label: 'Clave (Z–A)' },
  { id: 'descripcion-asc', field: 'descripcion', sort: 'asc', label: 'Descripción (A–Z)' },
  { id: 'descripcion-desc', field: 'descripcion', sort: 'desc', label: 'Descripción (Z–A)' },
  { id: 'familia-asc', field: 'familia', sort: 'asc', label: 'Familia (A–Z)' },
  { id: 'fecha_creacion-desc', field: 'fecha_creacion', sort: 'desc', label: 'Más recientes' },
  { id: 'fecha_creacion-asc', field: 'fecha_creacion', sort: 'asc', label: 'Más antiguos' },
];

export const PRODUCTOS_ORDEN_DEFAULT: GridSortModel = [{ field: 'clave', sort: 'asc' }];

export function resolverOrdenProductos(sortModel: GridSortModel): ProductosOrden {
  const primero = sortModel[0];
  const opcion = PRODUCTOS_ORDEN_OPCIONES.find(
    (item) => item.field === primero?.field && item.sort === primero?.sort
  );
  return opcion ? { field: opcion.field, sort: opcion.sort } : { field: 'clave', sort: 'asc' };
}
