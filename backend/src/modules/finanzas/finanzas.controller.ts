import { Request, Response } from 'express';
import {
  aplicarAnticiposDocumentoDestino,
  actualizarCuenta,
  actualizarOperacion,
  actualizarTransferencia,
  crearAplicacion,
  crearConciliacion,
  crearCuenta,
  crearOperacion,
  crearTransferencia,
  diagnosticarDuplicadosAplicaciones,
  eliminarAplicacion,
  eliminarCuenta,
  eliminarOperacion,
  eliminarTransferencia,
  listarAplicacionesPorDocumento,
  listarCuentas,
  listarEstadoCuentaContacto,
  listarOperaciones,
  obtenerSaldoDocumento,
  obtenerReporteAging,
  obtenerReporteAgingResumen,
  obtenerOperacionPorId,
  listarAnticiposDisponiblesDocumentoOrigen,
  obtenerResumenAnticiposDocumento,
  verificarSaldosCuentas,
  listarMetodosPago,
  crearMetodoPago,
  actualizarMetodoPago,
  listarFacturasCompraPendientes,
  listarProgramacionesPago,
  crearProgramacionPago,
  actualizarProgramacionPago,
  cancelarProgramacionPago,
  pagarProgramacionPago,
  obtenerMovimientosConciliacion,
  cotejarMovimientos,
  ejecutarCierreConciliacion,
  listarHistorialConciliaciones,
  deshacerConciliacion,
} from './finanzas.repository';

export async function getReporteAging(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const fechaBase = (req.query.fecha_base as string) || undefined;
  try {
    const rows = await obtenerReporteAging(empresaId, fechaBase);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener el reporte aging' });
  }
}

export async function getReporteAgingResumen(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const fechaBase = (req.query.fecha_base as string) || undefined;
  try {
    const rows = await obtenerReporteAgingResumen(empresaId, fechaBase);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener el reporte aging resumen' });
  }
}

export async function getOperacion(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const operacionId = Number(req.params.id);
  if (!Number.isFinite(operacionId)) return res.status(400).json({ message: 'operacionId inválido' });
  try {
    const row = await obtenerOperacionPorId(operacionId, empresaId);
    if (!row) return res.status(404).json({ message: 'Operación no encontrada' });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener la operación' });
  }
}

export async function getSaldoDocumento(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const documentoId = Number(req.params.id);
  if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'documentoId inválido' });
  try {
    const row = await obtenerSaldoDocumento(documentoId, empresaId);
    if (!row) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener saldo' });
  }
}

export async function getResumenAnticiposDocumento(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const documentoId = Number(req.params.id);
  if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'documentoId inválido' });
  try {
    const row = await obtenerResumenAnticiposDocumento(documentoId, empresaId);
    if (!row) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener resumen de anticipos' });
  }
}

export async function getAnticiposDisponiblesDocumento(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const documentoId = Number(req.params.id);
  if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'documentoId inválido' });
  try {
    const row = await listarAnticiposDisponiblesDocumentoOrigen(documentoId, empresaId);
    if (!row) return res.status(404).json({ message: 'Documento no encontrado' });
    res.json(row);
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo obtener anticipos disponibles' });
  }
}

export async function getAplicacionesPorDocumento(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const documentoId = Number(req.params.id);
  if (!documentoId) return res.status(400).json({ message: 'documentoId inválido' });
  try {
    const rows = await listarAplicacionesPorDocumento(documentoId, empresaId);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener aplicaciones' });
  }
}

export async function getEstadoCuentaContacto(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const contactoId = Number(req.params.id);
  if (!Number.isFinite(contactoId)) return res.status(400).json({ message: 'contactoId inválido' });
  try {
    const rows = await listarEstadoCuentaContacto(contactoId, empresaId);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener estado de cuenta' });
  }
}

export async function getCuentas(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuentas = await listarCuentas(empresaId);
    res.json(cuentas);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error al obtener cuentas' });
  }
}

export async function postCuenta(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuenta = await crearCuenta(req.body, empresaId);
    res.status(201).json(cuenta);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo crear la cuenta' });
  }
}

export async function putCuenta(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const cuenta = await actualizarCuenta(id, req.body, empresaId);
    res.json(cuenta);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo actualizar la cuenta' });
  }
}

export async function deleteCuenta(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarCuenta(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar la cuenta' });
  }
}

export async function getOperaciones(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuentaId = req.query.cuenta_id ? Number(req.query.cuenta_id) : undefined;
    const ops = await listarOperaciones(empresaId, cuentaId);
    res.json(ops);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error al obtener operaciones' });
  }
}

export async function postOperacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const op = await crearOperacion({ ...req.body, created_by: req.auth?.userId ?? null }, empresaId);
    res.status(201).json(op);
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo crear la operación' });
  }
}

export async function putOperacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const op = await actualizarOperacion(id, { ...req.body, created_by: req.auth?.userId ?? null }, empresaId);
    res.json(op);
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo actualizar la operación' });
  }
}

export async function deleteOperacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarOperacion(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar la operación' });
  }
}

export async function postTransferencia(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await crearTransferencia(req.body, empresaId);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo registrar la transferencia' });
  }
}

export async function putTransferencia(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const result = await actualizarTransferencia(id, req.body, empresaId);
    res.json(result);
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo actualizar la transferencia' });
  }
}

export async function deleteTransferencia(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarTransferencia(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo eliminar la transferencia' });
  }
}

export async function postConciliacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await crearConciliacion(req.body, empresaId);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo registrar la conciliación' });
  }
}

export async function postAplicacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await crearAplicacion({ ...req.body, created_by: req.auth?.userId ?? null }, empresaId);
    res.status(201).json(result);
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo registrar la aplicación' });
  }
}

export async function postAplicarAnticiposDocumento(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const documentoId = Number(req.params.id);
    if (!Number.isFinite(documentoId)) return res.status(400).json({ message: 'documentoId inválido' });
    const result = await aplicarAnticiposDocumentoDestino(
      {
        ...(req.body || {}),
        documento_origen_id: documentoId,
        created_by: req.auth?.userId ?? null,
      },
      empresaId
    );
    res.status(201).json(result);
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo aplicar anticipos al documento' });
  }
}

export async function getVerificacionSaldos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await verificarSaldosCuentas(empresaId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error al verificar saldos' });
  }
}

export async function getDiagnosticoDuplicados(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await diagnosticarDuplicadosAplicaciones(empresaId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error al diagnosticar duplicados' });
  }
}

export async function deleteAplicacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    await eliminarAplicacion(id, empresaId);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo eliminar la aplicación' });
  }
}

// ── Métodos de Pago ───────────────────────────────────────────────────────────

export async function getMetodosPago(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const soloActivos = req.query.activos === 'true';
    const rows = await listarMetodosPago(empresaId, soloActivos);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Error al obtener métodos de pago' });
  }
}

export async function postMetodoPago(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const metodo = await crearMetodoPago(req.body, empresaId);
    return res.status(201).json(metodo);
  } catch (err: any) {
    const status = err?.status ?? 400;
    return res.status(status).json({ message: err.message || 'No se pudo crear el método de pago' });
  }
}

export async function putMetodoPago(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });
    const metodo = await actualizarMetodoPago(id, req.body, empresaId);
    return res.json(metodo);
  } catch (err: any) {
    const status = err?.status ?? 400;
    return res.status(status).json({ message: err.message || 'No se pudo actualizar el método de pago' });
  }
}

// ── Programación de pagos ─────────────────────────────────────────────────────

export async function getFacturasCompraPendientes(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const proveedorId = req.query.proveedor_id ? Number(req.query.proveedor_id) : null;
    const search = req.query.search ? String(req.query.search) : null;
    const excludeProgramacionId = req.query.exclude_programacion_id
      ? Number(req.query.exclude_programacion_id)
      : null;
    const rows = await listarFacturasCompraPendientes(empresaId, { proveedorId, search, excludeProgramacionId });
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Error al obtener facturas' });
  }
}

export async function getProgramacionesPago(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const filtros = {
      fechaInicio:   req.query.fecha_inicio   ? String(req.query.fecha_inicio)   : null,
      fechaFin:      req.query.fecha_fin      ? String(req.query.fecha_fin)      : null,
      proveedorId:   req.query.proveedor_id   ? Number(req.query.proveedor_id)   : null,
      estatus:       req.query.estatus        ? String(req.query.estatus)        : null,
      cuentaOrigenId: req.query.cuenta_origen_id ? Number(req.query.cuenta_origen_id) : null,
      metodoPagoId:  req.query.metodo_pago_id ? Number(req.query.metodo_pago_id) : null,
      moneda:        req.query.moneda         ? String(req.query.moneda)         : null,
    };
    const rows = await listarProgramacionesPago(empresaId, filtros);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Error al obtener programaciones' });
  }
}

export async function postProgramacionPago(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const result = await crearProgramacionPago(req.body, empresaId, req.auth?.userId ?? null);
    return res.status(201).json(result);
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    return res.status(status).json({ message: err.message || 'No se pudo crear la programación' });
  }
}

export async function putProgramacionPago(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });
    const result = await actualizarProgramacionPago(id, req.body, empresaId, req.auth?.userId ?? null);
    return res.json(result);
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    return res.status(status).json({ message: err.message || 'No se pudo actualizar la programación' });
  }
}

export async function postCancelarProgramacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });
    const result = await cancelarProgramacionPago(id, empresaId, req.auth?.userId ?? null);
    return res.json(result);
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    return res.status(status).json({ message: err.message || 'No se pudo cancelar la programación' });
  }
}

export async function postPagarProgramacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'id inválido' });
    const result = await pagarProgramacionPago(id, empresaId, req.auth?.userId ?? null);
    return res.json(result);
  } catch (err: any) {
    const status = (err as any)?.status ?? 400;
    return res.status(status).json({ message: err.message || 'No se pudo ejecutar el pago' });
  }
}

// =============================================================================
// Fase 3.4 — Conciliación Bancaria Básica Manual
// =============================================================================

export async function getConciliacionMovimientos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuentaId = Number(req.query.cuenta_id);
    const fechaCorte = req.query.fecha_corte as string;
    if (!Number.isFinite(cuentaId) || cuentaId <= 0)
      return res.status(400).json({ message: 'cuenta_id requerido y debe ser válido' });
    if (!fechaCorte)
      return res.status(400).json({ message: 'fecha_corte requerida' });
    const result = await obtenerMovimientosConciliacion(cuentaId, fechaCorte, empresaId);
    return res.json(result);
  } catch (err: any) {
    return res.status(err?.status ?? 400).json({ message: err.message || 'Error al obtener movimientos de conciliación' });
  }
}

export async function postCotejarMovimientos(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const { operacion_ids, estado } = req.body as { operacion_ids: number[]; estado: 'pendiente' | 'cotejado' };
    if (!Array.isArray(operacion_ids) || operacion_ids.length === 0)
      return res.status(400).json({ message: 'operacion_ids debe ser un arreglo no vacío' });
    if (!['pendiente', 'cotejado'].includes(estado))
      return res.status(400).json({ message: 'estado inválido: debe ser pendiente o cotejado' });
    const result = await cotejarMovimientos(operacion_ids, estado, empresaId);
    return res.json(result);
  } catch (err: any) {
    return res.status(err?.status ?? 400).json({ message: err.message || 'Error al actualizar estado de conciliación' });
  }
}

export async function postCerrarConciliacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const { cuenta_id, fecha_corte, saldo_banco, observaciones } = req.body as {
      cuenta_id: number;
      fecha_corte: string;
      saldo_banco: number;
      observaciones?: string | null;
    };
    if (!cuenta_id || !fecha_corte || saldo_banco === undefined || saldo_banco === null)
      return res.status(400).json({ message: 'cuenta_id, fecha_corte y saldo_banco son requeridos' });
    const result = await ejecutarCierreConciliacion(
      {
        cuentaId: Number(cuenta_id),
        fechaCorte: fecha_corte,
        saldoBanco: Number(saldo_banco),
        observaciones: observaciones ?? null,
      },
      empresaId,
      req.auth?.userId ?? null
    );
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(err?.status ?? 400).json({ message: err.message || 'Error al cerrar la conciliación' });
  }
}

export async function getHistorialConciliaciones(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const cuentaId = Number(req.query.cuenta_id);
    if (!Number.isFinite(cuentaId) || cuentaId <= 0)
      return res.status(400).json({ message: 'cuenta_id requerido y debe ser válido' });
    const result = await listarHistorialConciliaciones(cuentaId, empresaId);
    return res.json(result);
  } catch (err: any) {
    return res.status(err?.status ?? 400).json({ message: err.message || 'Error al obtener historial de conciliaciones' });
  }
}

export async function postDeshacerConciliacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const conciliacionId = Number(req.params.id);
    if (!Number.isFinite(conciliacionId) || conciliacionId <= 0)
      return res.status(400).json({ message: 'ID de conciliación inválido' });
    const { motivo } = req.body as { motivo?: string };
    if (!motivo || motivo.trim().length < 5)
      return res.status(400).json({ message: 'El motivo de anulación es requerido y debe tener al menos 5 caracteres.' });
    const result = await deshacerConciliacion(
      conciliacionId,
      empresaId,
      req.auth?.userId ?? null,
      motivo
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(err?.status ?? 400).json({ message: err.message || 'Error al deshacer la conciliación' });
  }
}
