import { Request, Response } from 'express';
import { obtenerOCrearConfiguracion, actualizarConfiguracion } from './configuracion.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

export async function getConfiguracion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const configuracion = await obtenerOCrearConfiguracion(empresaId);
    return res.json(configuracion);
  } catch (error) {
    console.error('Error al obtener configuración contable', error);
    return res.status(500).json({ message: 'No se pudo obtener la configuración contable' });
  }
}

export async function putConfiguracion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const configuracion = await actualizarConfiguracion(empresaId, {
      estructura_cuentas: req.body?.estructura_cuentas,
      caracter_separador: req.body?.caracter_separador,
    });
    return res.json(configuracion);
  } catch (error) {
    console.error('Error al actualizar configuración contable', error);
    const message = (error as Error)?.message ?? 'No se pudo actualizar la configuración contable';
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({ message: message.replace('VALIDATION_ERROR:', '').trim() });
    }
    return res.status(500).json({ message: 'No se pudo actualizar la configuración contable' });
  }
}
