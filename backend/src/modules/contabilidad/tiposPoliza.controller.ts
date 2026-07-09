import { Request, Response } from 'express';
import {
  listarTiposPoliza,
  crearTipoPoliza,
  actualizarTipoPoliza,
  cambiarEstadoTipoPoliza,
  eliminarTipoPoliza,
} from './tiposPoliza.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseValidationError(error: unknown, fallback: string): { status: number; message: string } {
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, message: message.replace('VALIDATION_ERROR:', '').trim() };
  }
  if (message.includes('duplicate key')) {
    return { status: 409, message: 'Ya existe un tipo de póliza con ese identificador en esta empresa' };
  }
  return { status: 500, message: fallback };
}

export async function getTiposPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const soloActivos = req.query.activo === 'true';
    const tipos = await listarTiposPoliza(empresaId, { soloActivos });
    return res.json(tipos);
  } catch (error) {
    console.error('Error al obtener tipos de póliza', error);
    return res.status(500).json({ message: 'Error al obtener tipos de póliza' });
  }
}

export async function postTipoPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const tipo = await crearTipoPoliza(empresaId, {
      identificador: req.body?.identificador,
      poliza_inicial: Number(req.body?.poliza_inicial),
      activo: req.body?.activo,
    });
    return res.status(201).json(tipo);
  } catch (error) {
    console.error('Error al crear tipo de póliza', error);
    const { status, message } = parseValidationError(error, 'No se pudo crear el tipo de póliza');
    return res.status(status).json({ message });
  }
}

export async function putTipoPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const tipo = await actualizarTipoPoliza(Number(req.params.id), empresaId, {
      identificador: req.body?.identificador,
      poliza_inicial: Number(req.body?.poliza_inicial),
      activo: req.body?.activo,
    });

    if (!tipo) return res.status(404).json({ message: 'Tipo de póliza no encontrado' });
    return res.json(tipo);
  } catch (error) {
    console.error('Error al actualizar tipo de póliza', error);
    const { status, message } = parseValidationError(error, 'No se pudo actualizar el tipo de póliza');
    return res.status(status).json({ message });
  }
}

export async function patchTipoPolizaActivo(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const activo = Boolean(req.body?.activo);
    const tipo = await cambiarEstadoTipoPoliza(Number(req.params.id), empresaId, activo);
    if (!tipo) return res.status(404).json({ message: 'Tipo de póliza no encontrado' });
    return res.json(tipo);
  } catch (error) {
    console.error('Error al cambiar estado del tipo de póliza', error);
    return res.status(500).json({ message: 'No se pudo cambiar el estado del tipo de póliza' });
  }
}

export async function deleteTipoPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const resultado = await eliminarTipoPoliza(Number(req.params.id), empresaId);
    if (resultado === null) return res.status(404).json({ message: 'Tipo de póliza no encontrado' });
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar tipo de póliza', error);
    const { status, message } = parseValidationError(error, 'No se pudo eliminar el tipo de póliza');
    return res.status(status).json({ message });
  }
}
