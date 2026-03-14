import { Request, Response } from 'express';
import {
  actualizarCuenta,
  actualizarOperacion,
  actualizarTransferencia,
  crearAplicacion,
  crearConciliacion,
  crearCuenta,
  crearOperacion,
  crearTransferencia,
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
  obtenerDisponibleOperacion,
  obtenerOperacionPorId,
  listarAplicacionesPorOperacion,
} from './finanzas.repository';

export async function getReporteAging(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  try {
    const rows = await obtenerReporteAging(empresaId);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener el reporte aging' });
  }
}

export async function getReporteAgingResumen(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  try {
    const rows = await obtenerReporteAgingResumen(empresaId);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener el reporte aging resumen' });
  }
}

export async function getDisponibleOperacion(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const operacionId = Number(req.params.id);
  if (!Number.isFinite(operacionId)) return res.status(400).json({ message: 'operacionId inválido' });
  try {
    const row = await obtenerDisponibleOperacion(operacionId, empresaId);
    if (!row) return res.status(404).json({ message: 'Operación no encontrada' });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener disponible de la operación' });
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

export async function getAplicacionesPorOperacion(req: Request, res: Response) {
  const empresaId = req.context?.empresaId as number;
  if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
  const operacionId = Number(req.params.id);
  if (!Number.isFinite(operacionId)) return res.status(400).json({ message: 'operacionId inválido' });
  try {
    const rows = await listarAplicacionesPorOperacion(operacionId, empresaId);
    res.json(rows);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo obtener aplicaciones de la operación' });
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
    const op = await crearOperacion(req.body, empresaId);
    res.status(201).json(op);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo crear la operación' });
  }
}

export async function putOperacion(req: Request, res: Response) {
  try {
    const empresaId = req.context?.empresaId as number;
    if (!empresaId) return res.status(400).json({ message: 'Empresa requerida' });
    const id = Number(req.params.id);
    const op = await actualizarOperacion(id, req.body, empresaId);
    res.json(op);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'No se pudo actualizar la operación' });
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
    res.status(400).json({ message: err.message || 'No se pudo actualizar la transferencia' });
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
    res.status(400).json({ message: err.message || 'No se pudo eliminar la transferencia' });
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
    const result = await crearAplicacion(req.body, empresaId);
    res.status(201).json(result);
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({ message: err.message || 'No se pudo registrar la aplicación' });
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
