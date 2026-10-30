import { Request, Response } from 'express';
import {
  aplicarInventarioDesdeDocumento,
  revertirInventarioDocumento,
  crearMovimientoManual,
  listarMovimientos,
  listarMovimientosPagina,
  listarPeriodosMovimientos,
  obtenerMovimientoDetalle,
  afectarMovimientoManual,
  desafectarMovimientoManual,
  actualizarMovimientoManualDesafectado,
  eliminarMovimientoManualDesafectado,
} from './inventario.service';
import { generarExcelBuffer } from '../../utils/exportar';
import type { ExportColumna } from '../../utils/exportar';
import pool from '../../config/database';

function numeroMensaje(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : '0';
}

async function construirErrorMovimiento(error: any, empresaId: number | null) {
  const raw = String(error?.message ?? '');
  const match = raw.match(/EXISTENCIA_INSUFICIENTE:\s*producto\s+(\d+),\s*almacén\s+(\d+),\s*disponible\s+([\d.-]+),\s*solicitado\s+([\d.-]+)/i);
  if (!match || !empresaId) return { message: 'No se pudo completar el movimiento.', code: 'MOVIMIENTO_NO_APLICADO' };
  const [, productoId, almacenId, disponible, solicitado] = match;
  const { rows } = await pool.query<{ producto: string | null; almacen: string | null }>(
    `SELECT p.clave || ' · ' || p.descripcion AS producto, a.nombre AS almacen
       FROM productos p
       LEFT JOIN inventario.almacenes a ON a.id = $3 AND a.empresa_id = $1
      WHERE p.id = $2 AND p.empresa_id = $1`,
    [empresaId, Number(productoId), Number(almacenId)]
  );
  return {
    message: 'No hay suficientes unidades para completar la salida.',
    code: 'EXISTENCIA_INSUFICIENTE',
    detalle: {
      producto: rows[0]?.producto ?? 'Producto no identificado',
      almacen: rows[0]?.almacen ?? 'Almacén no identificado',
      disponible: numeroMensaje(disponible),
      solicitado: numeroMensaje(solicitado),
    },
  };
}

function errorMovimientoSeguro(error: any) {
  const raw = String(error?.message ?? '');
  const code = raw.split(':', 1)[0].trim().toUpperCase();
  switch (code) {
    case 'COSTO_ENTRADA_REQUERIDO':
      return { status: 409, body: { code, message: 'El historial de costos del producto no está completo. No se inventó una valoración y la operación fue revertida.' } };
    case 'COSTO_NO_DISPONIBLE':
      return { status: 409, body: { code, message: 'No existe un costo válido para valorar esta salida. La operación fue revertida.' } };
    case 'COSTO_TRANSFERENCIA_NO_DISPONIBLE':
      return { status: 409, body: { code, message: 'No existe una valoración válida en el almacén origen para completar la transferencia.' } };
    case 'EXISTENCIA_INSUFICIENTE':
      return { status: 409, body: { code, message: 'No hay existencia suficiente para completar la operación.' } };
    default:
      return { status: 500, body: { code: 'MOVIMIENTO_NO_APLICADO', message: 'No fue posible registrar la operación. El sistema no realizó ningún cambio. Inténtalo nuevamente.' } };
  }
}

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

    const { tipo_movimiento, fecha, observaciones, contacto_id, partidas } = req.body || {};

    if (!Array.isArray(partidas) || partidas.length === 0) {
      return res.status(400).json({ message: 'Se requiere al menos una partida' });
    }

    const payload = {
      empresaId,
      usuarioId,
      tipoMovimiento: tipo_movimiento ? (tipo_movimiento as string).toLowerCase() as any : 'mixto',
      fecha,
      observaciones,
      contactoId: contacto_id == null || contacto_id === '' ? null : Number(contacto_id),
      partidas: partidas.map((p: any) => ({
        productoId: p.producto_id,
        almacenId: p.almacen_id,
        almacenDestinoId: p.almacen_destino_id,
        cantidad: p.cantidad,
        costoUnitario: p.costo_unitario,
        sentido: p.sentido,
      })),
    };

    const result = await crearMovimientoManual(payload);
    return res.status(201).json(result);
  } catch (error) {
    const technical = String((error as any)?.message ?? '');
    if (technical.includes('EXISTENCIA_INSUFICIENTE')) {
      const translated = await construirErrorMovimiento(error, getEmpresaId(req));
      return res.status(409).json(translated);
    }
    const code = (error as any)?.code;
    if (code === 'SIN_PARTIDAS' || code?.includes('REQUERIDO') || code?.includes('INVALIDO') || code === 'CONTACTO_EMPRESA_INVALIDO') {
      return res.status(400).json({ message: (error as any)?.message || 'Revisa los datos de la operación.', code });
    }
    const safe = errorMovimientoSeguro(error);
    console.error('[inventario] movimiento manual rechazado', { code: safe.body.code, empresaId: getEmpresaId(req), usuarioId: getUsuarioId(req) });
    return res.status(safe.status).json(safe.body);
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

function responderOperacionMovimiento(error: any, res: Response) {
  const code = String(error?.code ?? error?.message ?? 'MOVIMIENTO_NO_APLICADO').split(':', 1)[0];
  const mensajes: Record<string, string> = {
    MOVIMIENTO_NO_ENCONTRADO: 'El movimiento no existe.',
    MOVIMIENTO_DOCUMENTAL: 'Esta operación debe realizarse desde el documento comercial.',
    MOVIMIENTO_REVERSION: 'Las reversiones no se pueden desafectar manualmente.',
    YA_AFECTADO: 'El movimiento ya está afectado.',
    YA_DESAFECTADO: 'El movimiento ya está desafectado.',
    EXISTENCIA_INSUFICIENTE: 'La operación dejaría una existencia insuficiente en el historial posterior.',
    COSTO_NO_DISPONIBLE: 'La reconstrucción no encontró un costo válido para una salida posterior.',
  };
  return res.status(409).json({ code, message: mensajes[code] ?? 'No fue posible actualizar la afectación del movimiento.' });
}

export async function postDesafectarMovimiento(req: Request, res: Response) {
  const empresaId = getEmpresaId(req); const usuarioId = getUsuarioId(req); const id = Number(req.params.id);
  if (!empresaId || !usuarioId || !Number.isFinite(id)) return res.status(400).json({ code: 'SOLICITUD_INVALIDA', message: 'La solicitud del movimiento no es válida.' });
  try {
    const result = await desafectarMovimientoManual(id, empresaId, usuarioId, String(req.body?.motivo ?? '').trim());
    return res.json(result);
  } catch (error) { return responderOperacionMovimiento(error, res); }
}

export async function postAfectarMovimiento(req: Request, res: Response) {
  const empresaId = getEmpresaId(req); const usuarioId = getUsuarioId(req); const id = Number(req.params.id);
  if (!empresaId || !usuarioId || !Number.isFinite(id)) return res.status(400).json({ code: 'SOLICITUD_INVALIDA', message: 'La solicitud del movimiento no es válida.' });
  try {
    const result = await afectarMovimientoManual(id, empresaId, usuarioId);
    return res.json(result);
  } catch (error) { return responderOperacionMovimiento(error, res); }
}

export async function putEditarMovimientoManual(req: Request, res: Response) {
  const empresaId = getEmpresaId(req); const usuarioId = getUsuarioId(req); const id = Number(req.params.id);
  if (!empresaId || !usuarioId || !Number.isFinite(id)) return res.status(400).json({ code: 'SOLICITUD_INVALIDA', message: 'La solicitud del movimiento no es válida.' });
  try {
    const body = req.body || {};
    const result = await actualizarMovimientoManualDesafectado(id, {
      empresaId, usuarioId, tipoMovimiento: body.tipo_movimiento, fecha: body.fecha,
      observaciones: body.observaciones, contactoId: body.contacto_id == null ? null : Number(body.contacto_id),
      partidas: Array.isArray(body.partidas) ? body.partidas.map((p: any) => ({
        productoId: p.producto_id, almacenId: p.almacen_id, almacenDestinoId: p.almacen_destino_id,
        cantidad: p.cantidad, costoUnitario: p.costo_unitario, sentido: p.sentido,
      })) : [],
    });
    return res.json(result);
  } catch (error) {
    const code = String((error as any)?.code ?? (error as any)?.message ?? 'MOVIMIENTO_NO_APLICADO').split(':', 1)[0];
    const status = code === 'MOVIMIENTO_NO_ENCONTRADO' ? 404 : 409;
    return res.status(status).json({ code, message: code === 'MOVIMIENTO_AFECTADO' ? 'Solo se pueden editar movimientos desafectados.' : 'No fue posible editar y afectar el movimiento. No se aplicaron cambios.' });
  }
}

export async function deleteMovimientoManual(req: Request, res: Response) {
  const empresaId = getEmpresaId(req); const usuarioId = getUsuarioId(req); const id = Number(req.params.id);
  if (!empresaId || !usuarioId || !Number.isFinite(id)) return res.status(400).json({ code: 'SOLICITUD_INVALIDA', message: 'La solicitud del movimiento no es válida.' });
  try {
    return res.json(await eliminarMovimientoManualDesafectado(id, empresaId, usuarioId));
  } catch (error) {
    const code = String((error as any)?.code ?? 'MOVIMIENTO_NO_APLICADO');
    const status = code === 'MOVIMIENTO_NO_ENCONTRADO' ? 404 : 409;
    return res.status(status).json({ code, message: (error as any)?.message ?? 'No se pudo eliminar el movimiento.' });
  }
}

// Opcional: listado básico si más adelante se implementa en el servicio/repo
function enteroQuery(valor: unknown, min: number, max: number): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// GET /movimientos?anio=2026&mes=10&q=texto&solo_manuales=1&limite=100&despues_fecha=2026-10-05&despues_id=123
// Con q se busca en todos los periodos (se ignoran anio y mes). Responde { items, siguiente, total }.
export async function getMovimientos(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });

  const q = req.query;
  const despuesFecha = typeof q.despues_fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.despues_fecha) ? q.despues_fecha : null;
  const despuesId = enteroQuery(q.despues_id, 1, Number.MAX_SAFE_INTEGER);

  try {
    const pagina = await listarMovimientosPagina(empresaId, {
      anio: enteroQuery(q.anio, 1900, 9999),
      mes: enteroQuery(q.mes, 1, 12),
      texto: typeof q.q === 'string' ? q.q.slice(0, 100) : null,
      soloManuales: q.solo_manuales === '1' || q.solo_manuales === 'true',
      limite: enteroQuery(q.limite, 1, 500) ?? 100,
      despues: despuesFecha && despuesId ? { fecha: despuesFecha, id: despuesId } : null,
    });
    return res.json(pagina);
  } catch (error) {
    const message = (error as any)?.message || 'Error al listar movimientos de inventario';
    return res.status(500).json({ message });
  }
}

export async function getPeriodosMovimientos(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });

  try {
    return res.json(await listarPeriodosMovimientos(empresaId));
  } catch (error) {
    const message = (error as any)?.message || 'Error al listar periodos de movimientos de inventario';
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

export async function exportarMovimientos(req: Request, res: Response) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'empresaId es requerido' });

  const { columns } = req.body as { columns: ExportColumna[] };

  if (!Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ message: 'columns es obligatorio' });
  }

  const exportColumns = columns
    .filter((c) => c && typeof c.field === 'string' && typeof c.headerName === 'string')
    .slice(0, 50);

  if (exportColumns.length === 0) {
    return res.status(400).json({ message: 'No hay columnas válidas para exportar' });
  }

  try {
    const movimientos = await listarMovimientos(empresaId);
    const buffer = generarExcelBuffer(movimientos as Record<string, any>[], exportColumns, 'Movimientos');
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="movimientos-inventario-${fecha}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    const message = (error as any)?.message || 'Error al exportar movimientos';
    return res.status(500).json({ message });
  }
}
