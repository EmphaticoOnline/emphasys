export type AlmacenMock = {
  id: number;
  clave: string;
  nombre: string;
  tipo: string;
  activo: boolean;
};

export const TIPOS_ALMACEN = ['normal', 'transito', 'cuarentena', 'produccion'] as const;

export const ALMACENES_INICIALES: AlmacenMock[] = [
  { id: 1, clave: 'GEN', nombre: 'Almacén general', tipo: 'normal', activo: true },
  { id: 2, clave: 'MP', nombre: 'Materia prima', tipo: 'normal', activo: true },
  { id: 3, clave: 'PT', nombre: 'Producto terminado', tipo: 'normal', activo: true },
  { id: 4, clave: 'TRN', nombre: 'Tránsito', tipo: 'transito', activo: true },
  { id: 5, clave: 'CUA', nombre: 'Cuarentena', tipo: 'cuarentena', activo: true },
  { id: 6, clave: 'SUC', nombre: 'Sucursal centro', tipo: 'normal', activo: true },
  { id: 7, clave: 'DEV', nombre: 'Devoluciones', tipo: 'normal', activo: false },
  { id: 8, clave: 'OBS', nombre: 'Obsoletos', tipo: 'normal', activo: false },
];

export type FiltroEstado = 'todos' | 'activos' | 'inactivos';

export type FormularioAlmacen = {
  clave: string;
  nombre: string;
  tipo: string;
  activo: boolean;
};

export const formularioVacio = (): FormularioAlmacen => ({
  clave: '',
  nombre: '',
  tipo: 'normal',
  activo: true,
});
