import { Request, Response } from 'express';
import { listarBitacoraPaquetes } from './bitacoraPaquetes.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

const LIMITE_DEFAULT = 100;
const LIMITE_MAXIMO = 500;

export async function getBitacoraPaquetes(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicioRaw = req.query.ejercicio as string | undefined;
    const periodoRaw = req.query.periodo as string | undefined;
    const limiteRaw = req.query.limite as string | undefined;
    const buscar = (req.query.buscar as string | undefined)?.trim() || undefined;

    let ejercicio: number | undefined;
    if (ejercicioRaw?.trim()) {
      const parsed = Number(ejercicioRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ message: 'El ejercicio no es válido.' });
      }
      ejercicio = parsed;
    }

    let periodo: number | undefined;
    if (periodoRaw?.trim()) {
      const parsed = Number(periodoRaw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
        return res.status(400).json({ message: 'El periodo debe estar entre 1 y 12.' });
      }
      periodo = parsed;
    }

    let limite = LIMITE_DEFAULT;
    if (limiteRaw?.trim()) {
      const parsed = Number(limiteRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ message: 'El límite no es válido.' });
      }
      limite = Math.min(parsed, LIMITE_MAXIMO);
    }

    const items = await listarBitacoraPaquetes(empresaId, { ejercicio, periodo, buscar, limite });
    return res.json({ items });
  } catch (error) {
    console.error('Error al consultar la bitácora de paquetes de e-contabilidad', error);
    return res.status(500).json({ message: 'No se pudo consultar la bitácora de paquetes' });
  }
}
