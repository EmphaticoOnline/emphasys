import type { Producto } from '../types/producto';

export interface ProductoColumnConfig {
  field: keyof Producto;
  headerName: string;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
  flex?: number;
}

export const productoColumns: ProductoColumnConfig[] = [
  { field: 'clave', headerName: 'Clave', minWidth: 140 },
  { field: 'descripcion', headerName: 'Descripción', minWidth: 260, flex: 1 },
  { field: 'clasificacion', headerName: 'Clasificación', minWidth: 160 },
  { field: 'tipo_producto', headerName: 'Tipo', minWidth: 140 },
  { field: 'precio_publico', headerName: 'Precio público', align: 'right', minWidth: 140 },
  { field: 'existencia_actual', headerName: 'Existencia', align: 'right', minWidth: 130 },
  { field: 'activo', headerName: 'Activo', align: 'center', minWidth: 110 },
];
