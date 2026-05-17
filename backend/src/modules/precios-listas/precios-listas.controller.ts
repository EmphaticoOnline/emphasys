import { Request, Response } from 'express';
import {
  actualizarPrecioListaService,
  crearPrecioListaService,
  desactivarPrecioListaService,
  listarPreciosListasService,
  obtenerPrecioListaPorIdService,
} from './precios-listas.service';

function getEmpresaId(req: Request): number | null {
  const empresaId = req.context?.empresaId;
  return Number.isFinite(Number(empresaId)) ? Number(empresaId) : null;
}

function getErrorStatus(error: any): number {
  if (error?.code === '23505') return 409;
  if (String(error?.message || '').toLowerCase().includes('no encontrada')) return 404;
  return 400;
}

function getPrecioListaErrorMessage(error: unknown, fallback: string): string {
  const pgError = error as { code?: string; constraint?: string; message?: string };

  if (
    pgError?.code === '23505' &&
    pgError?.constraint === 'ux_precios_listas_empresa_tipo_nombre'
  ) {
    return 'Ya existe una lista de precios con ese nombre para este tipo de precio.';
  }

  if (
    pgError?.code === '23505' &&
    pgError?.constraint === 'ux_precios_listas_empresa_tipo_default'
  ) {
    return 'Ya existe una lista predeterminada para este tipo de precio en la empresa.';
  }

  return error instanceof Error ? error.message : fallback;
}

export async function getPreciosListas(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }

  try {
    const incluirInactivas = ['1', 'true', 'si', 'yes'].includes(
      String(req.query.incluir_inactivas ?? '').toLowerCase()
    );
    const rows = await listarPreciosListasService(empresaId, incluirInactivas);
    return res.json(rows);
  } catch (error) {
    console.error('[precios-listas] error al listar', error);
    return res.status(500).json({ message: 'Error al obtener listas de precios' });
  }
}

export async function getPrecioListaById(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const id = Number(req.params.id);

  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }
  if (!id) {
    return res.status(400).json({ message: 'id es obligatorio' });
  }

  try {
    const row = await obtenerPrecioListaPorIdService(id, empresaId);
    if (!row) {
      return res.status(404).json({ message: 'Lista de precios no encontrada' });
    }
    return res.json(row);
  } catch (error) {
    console.error('[precios-listas] error al obtener por id', error);
    return res.status(500).json({ message: 'Error al obtener la lista de precios' });
  }
}

export async function postPrecioLista(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }

  try {
    const created = await crearPrecioListaService(empresaId, req.body);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: getPrecioListaErrorMessage(error, 'No se pudo crear la lista de precios'),
    });
  }
}

export async function putPrecioLista(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const id = Number(req.params.id);

  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }
  if (!id) {
    return res.status(400).json({ message: 'id es obligatorio' });
  }

  try {
    const updated = await actualizarPrecioListaService(id, empresaId, req.body);
    return res.json(updated);
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: getPrecioListaErrorMessage(error, 'No se pudo actualizar la lista de precios'),
    });
  }
}

export async function deletePrecioLista(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const id = Number(req.params.id);

  if (!empresaId) {
    return res.status(400).json({ message: 'empresaId es obligatorio' });
  }
  if (!id) {
    return res.status(400).json({ message: 'id es obligatorio' });
  }

  try {
    const updated = await desactivarPrecioListaService(id, empresaId);
    return res.json(updated);
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'No se pudo desactivar la lista de precios',
    });
  }
}