import { Request, Response } from 'express';
import {
  listarRangosCuentas,
  crearRangoCuenta,
  actualizarRangoCuenta,
  eliminarRangoCuenta,
} from './rangos.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseValidationError(error: unknown, fallback: string): { status: number; message: string } {
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, message: message.replace('VALIDATION_ERROR:', '').trim() };
  }
  if (message.includes('duplicate key')) {
    return { status: 409, message: 'Ya existe un rango con ese límite superior en esta empresa' };
  }
  return { status: 500, message: fallback };
}

export async function getRangosCuentas(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const rangos = await listarRangosCuentas(empresaId);
    return res.json(rangos);
  } catch (error) {
    console.error('Error al obtener rangos de cuentas', error);
    return res.status(500).json({ message: 'Error al obtener rangos de cuentas' });
  }
}

export async function postRangoCuenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const rango = await crearRangoCuenta(empresaId, {
      limite_superior: Number(req.body?.limite_superior),
      naturaleza_saldo: req.body?.naturaleza_saldo,
      descripcion: req.body?.descripcion,
      grupo: req.body?.grupo,
      subgrupo: req.body?.subgrupo ?? null,
      activo: req.body?.activo,
    });
    return res.status(201).json(rango);
  } catch (error) {
    console.error('Error al crear rango de cuenta', error);
    const { status, message } = parseValidationError(error, 'No se pudo crear el rango');
    return res.status(status).json({ message });
  }
}

export async function putRangoCuenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const rango = await actualizarRangoCuenta(Number(req.params.id), empresaId, {
      limite_superior: Number(req.body?.limite_superior),
      naturaleza_saldo: req.body?.naturaleza_saldo,
      descripcion: req.body?.descripcion,
      grupo: req.body?.grupo,
      subgrupo: req.body?.subgrupo ?? null,
      activo: req.body?.activo,
    });

    if (!rango) return res.status(404).json({ message: 'Rango no encontrado' });
    return res.json(rango);
  } catch (error) {
    console.error('Error al actualizar rango de cuenta', error);
    const { status, message } = parseValidationError(error, 'No se pudo actualizar el rango');
    return res.status(status).json({ message });
  }
}

export async function deleteRangoCuenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const resultado = await eliminarRangoCuenta(Number(req.params.id), empresaId);
    if (resultado === null) return res.status(404).json({ message: 'Rango no encontrado' });
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar rango de cuenta', error);
    const { status, message } = parseValidationError(error, 'No se pudo eliminar el rango');
    return res.status(status).json({ message });
  }
}
