import { Request, Response } from 'express';
import { crear, obtenerAlmacenes, actualizar, eliminar } from './almacenes.service';
import { AlmacenConReferenciasError } from './almacenes.repository';

function getEmpresaId(req: Request): number | null {
  const empresaId = (req as any).context?.empresaId ?? (req as any).empresaId;
  return Number.isFinite(Number(empresaId)) ? Number(empresaId) : null;
}

export async function listarAlmacenes(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es requerido' });
  }

  try {
    const almacenes = await obtenerAlmacenes(empresaId);
    return res.json(almacenes);
  } catch (error) {
    console.error('[almacenes] error al obtener almacenes', error);
    return res.status(500).json({ message: 'Error al obtener almacenes' });
  }
}

export async function listarTodosLosAlmacenes(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });
  try { return res.json(await obtenerAlmacenes(empresaId, true)); }
  catch (error) { console.error('[almacenes] error al obtener catálogo completo', error); return res.status(500).json({ message: 'Error al obtener almacenes' }); }
}

export async function crearAlmacen(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });
  try { return res.status(201).json(await crear(empresaId, req.body ?? {})); }
  catch (error: any) { return res.status(error?.code === '23505' ? 409 : 400).json({ message: error?.code === '23505' ? 'La clave del almacén ya existe en esta empresa.' : error?.message ?? 'No se pudo crear el almacén' }); }
}

export async function eliminarAlmacen(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const id = Number(req.params.id);
  if (!empresaId || !Number.isInteger(id)) return res.status(400).json({ message: 'Datos inválidos' });
  try {
    const eliminado = await eliminar(id, empresaId);
    return eliminado ? res.status(204).send() : res.status(404).json({ message: 'Almacén no encontrado' });
  } catch (error: any) {
    if (error instanceof AlmacenConReferenciasError) return res.status(409).json({ message: error.message });
    console.error('[almacenes] error al eliminar', error);
    return res.status(400).json({ message: error?.message ?? 'No se pudo eliminar el almacén' });
  }
}

export async function actualizarAlmacen(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const id = Number(req.params.id);
  if (!empresaId || !Number.isInteger(id)) return res.status(400).json({ message: 'Datos inválidos' });
  try {
    const almacen = await actualizar(id, empresaId, req.body ?? {});
    return almacen ? res.json(almacen) : res.status(404).json({ message: 'Almacén no encontrado' });
  } catch (error: any) { return res.status(error?.code === '23505' ? 409 : 400).json({ message: error?.code === '23505' ? 'La clave del almacén ya existe en esta empresa.' : error?.message ?? 'No se pudo actualizar el almacén' }); }
}
