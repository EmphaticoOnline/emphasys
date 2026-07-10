import { Request, Response } from 'express';
import {
  previsualizarFacturaVenta,
  contabilizarFacturaVenta,
  contabilizarFacturasVentaLote,
  generarReversaCancelacionFacturaVenta,
  obtenerEstadoContableFacturasVentaLote,
  CuentaFaltanteError,
} from './facturaVentaContabilizacion.repository';

function getEmpresaId(req: Request): number {
  return Number(req.context?.empresaId ?? 0);
}

function parseError(error: unknown, fallback: string): { status: number; body: Record<string, unknown> } {
  if (error instanceof CuentaFaltanteError) {
    return { status: 400, body: { message: error.message, faltantes: error.faltantes } };
  }
  const message = (error as Error)?.message ?? fallback;
  if (message.startsWith('VALIDATION_ERROR:')) {
    return { status: 400, body: { message: message.replace('VALIDATION_ERROR:', '').trim() } };
  }
  return { status: 500, body: { message: fallback } };
}

export async function postPreviewFacturaVenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const asiento = await previsualizarFacturaVenta(empresaId, Number(req.params.documentoId));
    return res.json(asiento);
  } catch (error) {
    console.error('Error al previsualizar la póliza de la factura de venta', error);
    const { status, body } = parseError(error, 'No se pudo previsualizar la póliza de la factura de venta');
    return res.status(status).json(body);
  }
}

export async function postContabilizarFacturaVenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const body = req.body ?? {};
    const resultado = await contabilizarFacturaVenta(empresaId, Number(req.params.documentoId), {
      tipo_poliza_id: body.tipo_poliza_id != null ? Number(body.tipo_poliza_id) : undefined,
      usuario_id: body.usuario_id != null ? Number(body.usuario_id) : req.auth?.userId ?? null,
      modo_contabilizacion: 'individual',
    });
    return res.status(201).json(resultado);
  } catch (error) {
    console.error('Error al contabilizar la factura de venta', error);
    const { status, body } = parseError(error, 'No se pudo contabilizar la factura de venta');
    return res.status(status).json(body);
  }
}

export async function postContabilizarFacturasVentaLote(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const body = req.body ?? {};
    const agrupacion = body.agrupacion === 'concentrado' ? 'concentrado' : 'individual';

    const resultado = await contabilizarFacturasVentaLote(empresaId, {
      fecha_desde: String(body.fecha_desde ?? ''),
      fecha_hasta: String(body.fecha_hasta ?? ''),
      tipo_poliza_id: body.tipo_poliza_id != null ? Number(body.tipo_poliza_id) : undefined,
      usuario_id: body.usuario_id != null ? Number(body.usuario_id) : req.auth?.userId ?? null,
      agrupacion,
    });
    return res.status(201).json(resultado);
  } catch (error) {
    console.error('Error al contabilizar facturas de venta en lote', error);
    const { status, body } = parseError(error, 'No se pudo contabilizar el lote de facturas de venta');
    return res.status(status).json(body);
  }
}

export async function postEstadoContableFacturasVentaLote(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const idsCrudos = Array.isArray(req.body?.documento_ids) ? req.body.documento_ids : [];
    const documentoIds = idsCrudos
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    const estado = await obtenerEstadoContableFacturasVentaLote(empresaId, documentoIds);
    return res.json(estado);
  } catch (error) {
    console.error('Error al obtener el estado contable de facturas de venta en lote', error);
    return res.status(500).json({ message: 'No se pudo obtener el estado contable de las facturas' });
  }
}

export async function postReversaCancelacionFacturaVenta(req: Request, res: Response) {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });

    const body = req.body ?? {};
    const resultado = await generarReversaCancelacionFacturaVenta(empresaId, Number(req.params.documentoId), {
      usuario_id: body.usuario_id != null ? Number(body.usuario_id) : req.auth?.userId ?? null,
      comentario: typeof body.comentario === 'string' ? body.comentario : null,
      tipo_poliza_id: body.tipo_poliza_id != null ? Number(body.tipo_poliza_id) : undefined,
    });
    return res.status(201).json(resultado);
  } catch (error) {
    console.error('Error al generar la reversa de cancelación de la factura de venta', error);
    const { status, body } = parseError(error, 'No se pudo generar la reversa de cancelación');
    return res.status(status).json(body);
  }
}
