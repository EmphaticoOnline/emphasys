import type { DefinicionCampo } from './contactos.fields';

export type { DefinicionCampo };

export const PRODUCTOS_CAMPOS: DefinicionCampo[] = [
  { campo: 'clave',               etiqueta: 'Clave' },
  { campo: 'descripcion',         etiqueta: 'Descripción' },
  { campo: 'clave_producto_sat',  etiqueta: 'Clave SAT' },
  { campo: 'clasificacion',       etiqueta: 'Clasificación' },
  { campo: 'unidad_venta_id',     etiqueta: 'Unidad de venta' },
  { campo: 'unidad_inventario_id',etiqueta: 'Unidad de inventario' },
];
