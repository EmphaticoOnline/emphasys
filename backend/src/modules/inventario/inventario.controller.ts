import { Request, Response } from 'express';
import {
  aplicarInventarioDesdeDocumento,
  revertirInventarioDocumento,
  crearMovimientoManual,
  listarMovimientos,
  obtenerMovimientoDetalle,
} from './inventario.service';

function getEmpresaId(req: Request): number | null {
  const empresaId = (req as any).context?.empresaId ?? (req as any).empresaId;
  return Number.isFinite(Number(empresaId)) ? Number(empresaId) : null;
}

function getUsuarioId(req: Request): number | null {
  const usuarioId = req.auth?.userId ?? null;
  return usuarioId ?? null;
}

export async function postMovimientoManual(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });
    if (!usuarioId) return res.status(400).json({ message: 'usuarioId es requerido' });

    const { tipo_movimiento, fecha, observaciones, partidas } = req.body || {};

    if (!tipo_movimiento || typeof tipo_movimiento !== 'string') {
      return res.status(400).json({ message: 'tipo_movimiento es requerido' });
    }
    if (!Array.isArray(partidas) || partidas.length === 0) {
      return res.status(400).json({ message: 'Se requiere al menos una partida' });
    }

    const payload = {
      empresaId,
      usuarioId,
      tipoMovimiento: (tipo_movimiento as string).toLowerCase() as any,
      fecha,
      observaciones,
      partidas: partidas.map((p: any) => ({
        productoId: p.producto_id,
        almacenId: p.almacen_id,
        almacenDestinoId: p.almacen_destino_id,
        cantidad: p.cantidad,
      })),
    };

    const result = await crearMovimientoManual(payload);
    return res.status(201).json(result);
  } catch (error) {
    const message = (error as any)?.message || 'Error al crear movimiento manual';
    const code = (error as any)?.code;
    const status = code === 'SIN_PARTIDAS' || code?.includes('REQUERIDO') || code?.includes('INVALIDO') ? 400 : 500;
    return res.status(status).json({ message, code });
  }
}

export async function postAplicarDocumento(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const documentoId = Number(req.params.id);

    if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });
    if (!usuarioId) return res.status(400).json({ message: 'usuarioId es requerido' });
    if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'id de documento inválido' });

    const { fecha, observaciones } = req.body || {};

    const result = await aplicarInventarioDesdeDocumento(documentoId, empresaId, usuarioId, { fecha, observaciones });
    return res.status(201).json(result);
  } catch (error) {
    const message = (error as any)?.message || 'Error al aplicar inventario desde documento';
    const code = (error as any)?.code;
    const status = code?.includes('NO_ENCONTRADO') || code?.includes('SIN_PARTIDAS') ? 404
      : code?.includes('NO_CONFIRMADO') || code?.includes('TIPO_NO_AFECTA') ? 400
      : 500;
    return res.status(status).json({ message, code });
  }
}

export async function postRevertirDocumento(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    const usuarioId = getUsuarioId(req);
    const documentoId = Number(req.params.id);

    if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });
    if (!usuarioId) return res.status(400).json({ message: 'usuarioId es requerido' });
    if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'id de documento inválido' });

    const { fecha, observaciones } = req.body || {};

    const result = await revertirInventarioDocumento(documentoId, empresaId, usuarioId, { fecha, observaciones });
    return res.status(201).json(result);
  } catch (error) {
    const message = (error as any)?.message || 'Error al revertir inventario del documento';
    const code = (error as any)?.code;
    const status = code?.includes('YA_REVERTIDO') || code?.includes('NO_ENCONTRADO') ? 400
      : 500;
    return res.status(status).json({ message, code });
  }
}

// Opcional: listado básico si más adelante se implementa en el servicio/repo
export async function getMovimientos(_req: Request, res: Response) {
  const empresaId = getEmpresaId(_req);
  if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });

  try {
    const movimientos = await listarMovimientos(empresaId);
    return res.json(movimientos);
  } catch (error) {
    const message = (error as any)?.message || 'Error al listar movimientos de inventario';
    return res.status(500).json({ message });
  }
}

export async function getMovimientoDetalle(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  const movimientoId = Number(req.params.id);

  if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });
  if (!Number.isFinite(movimientoId)) return res.status(400).json({ message: 'id de movimiento inválido' });

  try {
    const detalle = await obtenerMovimientoDetalle(movimientoId, empresaId);
    if (!detalle) return res.status(404).json({ message: 'Movimiento no encontrado' });
    return res.json(detalle);
  } catch (error) {
    const message = (error as any)?.message || 'Error al obtener detalle del movimiento';
    return res.status(500).json({ message });
  }
}