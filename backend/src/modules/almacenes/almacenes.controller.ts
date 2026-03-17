import { Request, Response } from 'express';
import { obtenerAlmacenes } from './almacenes.service';

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
