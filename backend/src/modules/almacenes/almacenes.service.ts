import { getAlmacenesRepository } from './almacenes.repository';

export async function obtenerAlmacenes(empresaId: number) {
  if (!Number.isFinite(empresaId) || empresaId <= 0) {
    throw new Error('empresaId inválido');
  }
  return getAlmacenesRepository(empresaId);
}
