import { Request, Response } from 'express';
import {
  obtenerContabilizacionPorId,
  listarContabilizacionesPorReferencia,
  listarContabilizacionesPoliza,
  estaContabilizado,
  puedeEditarseReferencia,
  registrarContabilizacion,
  registrarReversa,
  type ContabilizacionInput,
  type ReferenciaOperativa,
  type ReversaInput,
} from './contabilizaciones.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseValidationError(error: unknown, fallback: string): { status: number; message: string } {
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, message: message.replace('VALIDATION_ERROR:', '').trim() };
  }
  if (message.includes('duplicate key')) {
    return { status: 409, message: 'Ya existe una contabilización activa para esta referencia y evento contable.' };
  }
  return { status: 500, message: fallback };
}

async function responderContabilizacionesPorReferencia(req: Request, res: Response, referencia: ReferenciaOperativa) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

  const contabilizaciones = await listarContabilizacionesPorReferencia(empresaId, referencia);
  return res.json(contabilizaciones);
}

async function responderEstadoPorReferencia(req: Request, res: Response, referencia: ReferenciaOperativa) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

  const eventoContable = typeof req.query.evento_contable === 'string' ? req.query.evento_contable : undefined;
  const contabilizado = await estaContabilizado(empresaId, referencia, eventoContable);
  return res.json({ contabilizado });
}

async function responderEditablePorReferencia(req: Request, res: Response, referencia: ReferenciaOperativa) {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

  const estado = await puedeEditarseReferencia(empresaId, referencia);
  return res.json(estado);
}

export async function getContabilizacionesDocumento(req: Request, res: Response) {
  try {
    await responderContabilizacionesPorReferencia(req, res, { documento_id: Number(req.params.documentoId) });
  } catch (error) {
    console.error('Error al obtener contabilizaciones del documento', error);
    res.status(500).json({ message: 'No se pudieron obtener las contabilizaciones del documento' });
  }
}

export async function getEstadoContableDocumento(req: Request, res: Response) {
  try {
    await responderEstadoPorReferencia(req, res, { documento_id: Number(req.params.documentoId) });
  } catch (error) {
    console.error('Error al consultar el estado contable del documento', error);
    res.status(500).json({ message: 'No se pudo consultar el estado contable del documento' });
  }
}

export async function getEditableDocumento(req: Request, res: Response) {
  try {
    await responderEditablePorReferencia(req, res, { documento_id: Number(req.params.documentoId) });
  } catch (error) {
    console.error('Error al validar si el documento puede editarse', error);
    res.status(500).json({ message: 'No se pudo validar si el documento puede editarse' });
  }
}

export async function getContabilizacionesOperacionDinero(req: Request, res: Response) {
  try {
    await responderContabilizacionesPorReferencia(req, res, { operacion_dinero_id: Number(req.params.operacionDineroId) });
  } catch (error) {
    console.error('Error al obtener contabilizaciones de la operación de dinero', error);
    res.status(500).json({ message: 'No se pudieron obtener las contabilizaciones de la operación de dinero' });
  }
}

export async function getEstadoContableOperacionDinero(req: Request, res: Response) {
  try {
    await responderEstadoPorReferencia(req, res, { operacion_dinero_id: Number(req.params.operacionDineroId) });
  } catch (error) {
    console.error('Error al consultar el estado contable de la operación de dinero', error);
    res.status(500).json({ message: 'No se pudo consultar el estado contable de la operación de dinero' });
  }
}

export async function getEditableOperacionDinero(req: Request, res: Response) {
  try {
    await responderEditablePorReferencia(req, res, { operacion_dinero_id: Number(req.params.operacionDineroId) });
  } catch (error) {
    console.error('Error al validar si la operación de dinero puede editarse', error);
    res.status(500).json({ message: 'No se pudo validar si la operación de dinero puede editarse' });
  }
}

export async function getContabilizacionesMovimientoInventario(req: Request, res: Response) {
  try {
    await responderContabilizacionesPorReferencia(req, res, {
      movimiento_inventario_id: Number(req.params.movimientoInventarioId),
    });
  } catch (error) {
    console.error('Error al obtener contabilizaciones del movimiento de inventario', error);
    res.status(500).json({ message: 'No se pudieron obtener las contabilizaciones del movimiento de inventario' });
  }
}

export async function getEstadoContableMovimientoInventario(req: Request, res: Response) {
  try {
    await responderEstadoPorReferencia(req, res, { movimiento_inventario_id: Number(req.params.movimientoInventarioId) });
  } catch (error) {
    console.error('Error al consultar el estado contable del movimiento de inventario', error);
    res.status(500).json({ message: 'No se pudo consultar el estado contable del movimiento de inventario' });
  }
}

export async function getEditableMovimientoInventario(req: Request, res: Response) {
  try {
    await responderEditablePorReferencia(req, res, { movimiento_inventario_id: Number(req.params.movimientoInventarioId) });
  } catch (error) {
    console.error('Error al validar si el movimiento de inventario puede editarse', error);
    res.status(500).json({ message: 'No se pudo validar si el movimiento de inventario puede editarse' });
  }
}

export async function getContabilizacionesPoliza(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const contabilizaciones = await listarContabilizacionesPoliza(empresaId, Number(req.params.polizaId));
    return res.json(contabilizaciones);
  } catch (error) {
    console.error('Error al obtener contabilizaciones de la póliza', error);
    return res.status(500).json({ message: 'No se pudieron obtener las contabilizaciones de la póliza' });
  }
}

export async function getContabilizacion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const contabilizacion = await obtenerContabilizacionPorId(Number(req.params.id), empresaId);
    if (!contabilizacion) return res.status(404).json({ message: 'Contabilización no encontrada' });
    return res.json(contabilizacion);
  } catch (error) {
    console.error('Error al obtener la contabilización', error);
    return res.status(500).json({ message: 'No se pudo obtener la contabilización' });
  }
}

function extraerInput(body: Record<string, unknown>): ContabilizacionInput {
  return {
    poliza_id: Number(body?.poliza_id),
    tipo_movimiento: String(body?.tipo_movimiento ?? ''),
    tipo_documento: String(body?.tipo_documento ?? ''),
    documento_id: body?.documento_id != null ? Number(body.documento_id) : null,
    operacion_dinero_id: body?.operacion_dinero_id != null ? Number(body.operacion_dinero_id) : null,
    movimiento_inventario_id: body?.movimiento_inventario_id != null ? Number(body.movimiento_inventario_id) : null,
    evento_contable: String(body?.evento_contable ?? ''),
    modo_contabilizacion: String(body?.modo_contabilizacion ?? ''),
    fecha_documento: String(body?.fecha_documento ?? ''),
    usuario_id: body?.usuario_id != null ? Number(body.usuario_id) : null,
    comentario: typeof body?.comentario === 'string' ? body.comentario : null,
  };
}

export async function postContabilizacion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const input = extraerInput(req.body ?? {});
    if (input.usuario_id == null) {
      input.usuario_id = req.auth?.userId ?? null;
    }

    const contabilizacion = await registrarContabilizacion(empresaId, input);
    return res.status(201).json(contabilizacion);
  } catch (error) {
    console.error('Error al registrar la contabilización', error);
    const { status, message } = parseValidationError(error, 'No se pudo registrar la contabilización');
    return res.status(status).json({ message });
  }
}

export async function postReversaContabilizacion(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const body = req.body ?? {};
    const input: ReversaInput = {
      poliza_id: Number(body?.poliza_id),
      fecha_documento: typeof body?.fecha_documento === 'string' ? body.fecha_documento : undefined,
      usuario_id: body?.usuario_id != null ? Number(body.usuario_id) : req.auth?.userId ?? null,
      comentario: typeof body?.comentario === 'string' ? body.comentario : null,
    };

    const reversa = await registrarReversa(empresaId, Number(req.params.id), input);
    if (!reversa) return res.status(404).json({ message: 'Contabilización original no encontrada' });
    return res.status(201).json(reversa);
  } catch (error) {
    console.error('Error al registrar la reversa de la contabilización', error);
    const { status, message } = parseValidationError(error, 'No se pudo registrar la reversa');
    return res.status(status).json({ message });
  }
}
