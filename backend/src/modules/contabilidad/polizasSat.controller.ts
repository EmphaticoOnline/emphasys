import { Request, Response } from 'express';
import { construirPolizasSatResultado } from './polizasSat.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

export async function getPolizasSatPreview(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    const periodo = Number(req.query.periodo);
    if (!Number.isInteger(ejercicio) || ejercicio <= 0) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }
    if (!Number.isInteger(periodo) || periodo < 1 || periodo > 12) {
      return res.status(400).json({ message: 'El periodo debe estar entre 1 y 12' });
    }

    const resultado = await construirPolizasSatResultado(empresaId, ejercicio, periodo);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al validar las pólizas SAT del periodo', error);
    return res.status(500).json({ message: 'No se pudieron validar las pólizas SAT del periodo' });
  }
}
