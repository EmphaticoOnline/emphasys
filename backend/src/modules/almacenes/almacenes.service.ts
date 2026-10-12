import { actualizarAlmacen, crearAlmacen, eliminarAlmacen, getAlmacenesRepository } from './almacenes.repository';

export async function obtenerAlmacenes(empresaId: number, incluirInactivos = false) {
  if (!Number.isFinite(empresaId) || empresaId <= 0) {
    throw new Error('empresaId inválido');
  }
  return getAlmacenesRepository(empresaId, incluirInactivos);
}

function validar(data: any) {
  if (!String(data?.clave ?? '').trim() || !String(data?.nombre ?? '').trim()) throw new Error('La clave y el nombre son obligatorios');
  return { clave: String(data.clave), nombre: String(data.nombre), tipo: String(data.tipo ?? 'normal'), activo: data.activo !== false };
}

export async function crear(empresaId: number, data: any) { return crearAlmacen(empresaId, validar(data)); }
export async function eliminar(id: number, empresaId: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Almacén inválido');
  return eliminarAlmacen(id, empresaId);
}

export async function actualizar(id: number, empresaId: number, data: any) {
  const v = validar(data);
  return actualizarAlmacen(id, empresaId, { ...v, activo: data.activo === true });
}
