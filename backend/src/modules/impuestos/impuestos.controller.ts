import { Request, Response } from 'express';
import {
  actualizarImpuestoDefaultEmpresa,
  crearImpuestoDefaultEmpresa,
  eliminarImpuestoDefaultEmpresa,
  listarImpuestosCatalogo,
  listarImpuestosDefaultEmpresa,
} from './impuestos.repository';

export async function getImpuestosCatalogo(req: Request, res: Response) {
  try {
    const data = await listarImpuestosCatalogo();
    res.json(data);
  } catch (error) {
    console.error('Error al obtener impuestos', error);
    const message = error instanceof Error ? error.message : 'Error al obtener impuestos';
    res.status(500).json({ message });
  }
}

export async function getImpuestosDefaultEmpresa(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const data = await listarImpuestosDefaultEmpresa(Number(empresaId));
    res.json(data);
  } catch (error) {
    console.error('Error al obtener impuestos default de empresa', error);
    const message = error instanceof Error ? error.message : 'Error al obtener impuestos default de la empresa';
    res.status(500).json({ message });
  }
}

export async function crearImpuestoDefault(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const { impuesto_id, orden } = req.body || {};
    if (!impuesto_id || typeof impuesto_id !== 'string') {
      return res.status(400).json({ message: 'impuesto_id es obligatorio' });
    }

    const created = await crearImpuestoDefaultEmpresa(Number(empresaId), { impuesto_id, orden: orden ?? null });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear impuesto default de empresa', error);
    const message = error instanceof Error ? error.message : 'Error al crear impuesto default de la empresa';
    res.status(500).json({ message });
  }
}

export async function actualizarImpuestoDefault(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'id inválido' });

    const { orden } = req.body || {};
    const updated = await actualizarImpuestoDefaultEmpresa(id, Number(empresaId), { orden: orden ?? null });
    if (!updated) return res.status(404).json({ message: 'Registro no encontrado' });
    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar impuesto default de empresa', error);
    const message = error instanceof Error ? error.message : 'Error al actualizar impuesto default de la empresa';
    res.status(500).json({ message });
  }
}

export async function eliminarImpuestoDefault(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId;
    if (!empresaId) return res.status(400).json({ message: 'empresaId no disponible en contexto' });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'id inválido' });

    await eliminarImpuestoDefaultEmpresa(id, Number(empresaId));
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar impuesto default de empresa', error);
    const message = error instanceof Error ? error.message : 'Error al eliminar impuesto default de la empresa';
    res.status(500).json({ message });
  }
}
