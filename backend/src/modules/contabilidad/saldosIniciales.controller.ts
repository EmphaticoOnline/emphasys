import { Request, Response } from 'express';
import {
  listarSaldosIniciales,
  actualizarSaldosInicialesLote,
  type ItemSaldoInicialLote,
} from './saldosIniciales.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function getUsuarioId(req: Request): number | null {
  const id = Number(req.auth?.userId ?? 0);
  return id > 0 ? id : null;
}

export async function getSaldosIniciales(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.query.ejercicio);
    if (!Number.isInteger(ejercicio) || ejercicio < 2000) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }

    const saldos = await listarSaldosIniciales(empresaId, ejercicio);
    return res.json(saldos);
  } catch (error) {
    console.error('Error al obtener saldos iniciales', error);
    return res.status(500).json({ message: 'No se pudieron obtener los saldos iniciales' });
  }
}

export async function patchSaldosInicialesLote(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const ejercicio = Number(req.body?.ejercicio);
    if (!Number.isInteger(ejercicio) || ejercicio < 2000) {
      return res.status(400).json({ message: 'El ejercicio es requerido y debe ser numérico' });
    }

    const items: ItemSaldoInicialLote[] = Array.isArray(req.body?.items)
      ? req.body.items.map((it: any) => ({
          cuenta_id: Number(it?.cuenta_id),
          saldo_inicial: it?.saldo_inicial === null || it?.saldo_inicial === undefined ? null : Number(it.saldo_inicial),
          observaciones: typeof it?.observaciones === 'string' ? it.observaciones : null,
        }))
      : [];
    if (items.length === 0) {
      return res.status(400).json({ message: 'No se enviaron cuentas para actualizar' });
    }

    const resultado = await actualizarSaldosInicialesLote(empresaId, ejercicio, items, getUsuarioId(req));
    return res.json(resultado);
  } catch (error) {
    console.error('Error al actualizar saldos iniciales', error);
    return res.status(500).json({ message: 'No se pudieron actualizar los saldos iniciales' });
  }
}
