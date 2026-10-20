import type { ColoresEmpresa } from './empresaBrand';

export const tieneIdentidadPersonalizada = (colores: Partial<ColoresEmpresa> | null | undefined): boolean =>
  Boolean(colores?.primario || colores?.acento || colores?.sidebar);
