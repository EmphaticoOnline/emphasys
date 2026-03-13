import { Request, Response } from 'express';
import { listarConceptos, crearConcepto, actualizarConcepto, eliminarConcepto } from './conceptos.repository';

export async function getConceptos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const conceptos = await listarConceptos(empresaId);
    res.json(conceptos);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error al obtener conceptos' });
  }
}

export async function postConcepto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const concepto = await crearConcepto(req.body, empresaId);
    res.status(201).json(concepto);
  } catch (err: any) {
    const status = err.message?.includes('duplicate key') ? 409 : 400;
    res.status(status).json({ message: err.message || 'No se pudo crear el concepto' });
  }
}

export async function putConcepto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const concepto = await actualizarConcepto(id, req.body, empresaId);
    res.json(concepto);
  } catch (err: any) {
    const status = err.message?.includes('duplicate key') ? 409 : 400;
    res.status(status).json({ message: err.message || 'No se pudo actualizar el concepto' });
  }
}

export async function deleteConcepto(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarConcepto(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar el concepto' });
  }
}
